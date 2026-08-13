-- Phase 4: authoritative Simple-edition entitlements, quotas, and usage.

ALTER TABLE public.categories
  ADD COLUMN system_managed boolean NOT NULL DEFAULT false,
  ADD COLUMN system_key text,
  ADD CONSTRAINT categories_system_identity_check CHECK (
    (system_managed AND system_key IS NOT NULL AND btrim(system_key) <> '')
    OR (NOT system_managed AND system_key IS NULL)
  );

CREATE UNIQUE INDEX categories_tenant_system_key_idx
  ON public.categories (tenant_id, system_key)
  WHERE system_managed;

UPDATE public.categories AS category
SET system_managed = true,
    system_key = lower(regexp_replace(btrim(category.name), '[^[:alnum:]]+', '_', 'g'))
FROM public.tenant AS tenant_record,
     private.tenant_default_versions AS defaults
WHERE tenant_record.id = category.tenant_id
  AND tenant_record.edition = 'simple'
  AND defaults.version = tenant_record.defaults_version
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(defaults.categories) AS item
    WHERE item->>'name' = category.name
  );

CREATE OR REPLACE FUNCTION private.apply_tenant_defaults(
  p_tenant_id bigint,
  p_version integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_defaults private.tenant_default_versions%ROWTYPE;
  v_simple boolean;
  v_previous_defaults_context text := current_setting(
    'app.applying_tenant_defaults', true
  );
BEGIN
  SELECT defaults.* INTO v_defaults
  FROM private.tenant_default_versions AS defaults
  WHERE defaults.version = p_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown tenant defaults version' USING ERRCODE = '22023';
  END IF;

  SELECT tenant_record.edition = 'simple' INTO v_simple
  FROM public.tenant AS tenant_record
  WHERE tenant_record.id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.event_types (tenant_id, label)
  SELECT p_tenant_id, value
  FROM jsonb_array_elements_text(v_defaults.event_types)
  ON CONFLICT (tenant_id, label) DO NOTHING;

  PERFORM set_config('app.applying_tenant_defaults', 'true', true);

  INSERT INTO public.categories (
    tenant_id, name, description, system_managed, system_key
  )
  SELECT
    p_tenant_id,
    category->>'name',
    NULLIF(category->>'description', ''),
    v_simple,
    CASE WHEN v_simple THEN
      lower(regexp_replace(btrim(category->>'name'), '[^[:alnum:]]+', '_', 'g'))
    END
  FROM jsonb_array_elements(v_defaults.categories) AS category
  WHERE NULLIF(btrim(category->>'name'), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.categories AS existing
      WHERE existing.tenant_id = p_tenant_id
        AND existing.name = category->>'name'
    );

  PERFORM set_config(
    'app.applying_tenant_defaults',
    COALESCE(v_previous_defaults_context, ''),
    true
  );

  INSERT INTO public.object_custom_schemas (tenant_id, fields)
  VALUES (p_tenant_id, '[]'::jsonb)
  ON CONFLICT (tenant_id) DO NOTHING;

  UPDATE public.tenant
  SET
    defaults_version = p_version,
    show_object_info_without_authentication = COALESCE(
      (v_defaults.settings->>'show_object_info_without_authentication')::boolean,
      show_object_info_without_authentication
    ),
    updated_at = now()
  WHERE id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(
  p_permission text,
  p_tenant_id bigint DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH caller AS (
    SELECT profile.tenant_id, profile.tenant_role
    FROM public.user_profiles AS profile
    WHERE profile.id = (SELECT auth.uid())
  ), permission_entitlement AS (
    SELECT CASE p_permission
      WHEN 'tenant.categories.manage' THEN 'custom_categories'
      WHEN 'tenant.groups.manage' THEN 'groups'
      WHEN 'tenant.transfers.participate' THEN 'advanced_transfers'
      WHEN 'tenant.transfers.manage' THEN 'advanced_transfers'
      WHEN 'tenant.reports.generate' THEN 'reports'
      WHEN 'tenant.audit.read' THEN 'audit_ui'
    END AS entitlement
  )
  SELECT CASE
    WHEN p_permission LIKE 'platform.%' THEN
      (SELECT public.is_platform_operator())
      AND EXISTS (
        SELECT 1 FROM private.role_permissions AS mapping
        WHERE mapping.role = 'platform_operator'
          AND mapping.permission = p_permission
      )
    ELSE EXISTS (
      SELECT 1
      FROM caller
      JOIN private.role_permissions AS mapping
        ON mapping.role = caller.tenant_role
       AND mapping.permission = p_permission
      CROSS JOIN permission_entitlement AS required
      WHERE caller.tenant_id = COALESCE(p_tenant_id, caller.tenant_id)
        AND (
          required.entitlement IS NULL
          OR public.has_tenant_entitlement(required.entitlement, caller.tenant_id)
        )
    )
  END
$$;

CREATE OR REPLACE FUNCTION private.enforce_category_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id bigint := COALESCE(NEW.tenant_id, OLD.tenant_id);
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR current_setting('app.applying_tenant_defaults', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF NOT public.has_tenant_entitlement('custom_categories', v_tenant_id) THEN
    RAISE EXCEPTION 'entitlement.custom_categories.required'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_category_entitlement()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER categories_enforce_entitlement
BEFORE INSERT OR UPDATE OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION private.enforce_category_entitlement();

CREATE OR REPLACE FUNCTION private.enforce_group_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id bigint := COALESCE(NEW.tenant_id, OLD.tenant_id);
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF NOT public.has_tenant_entitlement('groups', v_tenant_id) THEN
    RAISE EXCEPTION 'entitlement.groups.required' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_group_entitlement()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER groups_enforce_entitlement
BEFORE INSERT OR UPDATE OR DELETE ON public.groups
FOR EACH ROW EXECUTE FUNCTION private.enforce_group_entitlement();

CREATE OR REPLACE FUNCTION private.enforce_transfer_participation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  tenant_scope bigint := COALESCE(NEW.tenant_id, OLD.tenant_id);
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF NOT public.has_tenant_entitlement('advanced_transfers', tenant_scope) THEN
    RAISE EXCEPTION 'entitlement.advanced_transfers.required'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_permission('tenant.transfers.participate', tenant_scope)
     AND NOT public.has_permission('tenant.transfers.manage', tenant_scope) THEN
    RAISE EXCEPTION 'Permission denied: tenant.transfers.participate'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_object_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max integer;
  v_count bigint;
BEGIN
  SELECT entitlement.max_objects INTO v_max
  FROM public.tenant AS tenant_record
  JOIN private.edition_entitlements AS entitlement
    ON entitlement.edition = tenant_record.edition
  WHERE tenant_record.id = NEW.tenant_id;
  IF v_max IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quota:objects:' || NEW.tenant_id::text, 0)
  );
  SELECT count(*) INTO v_count
  FROM public.objects AS object_record
  WHERE object_record.tenant_id = NEW.tenant_id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'quota.objects.exceeded' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_object_quota()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER objects_enforce_quota
BEFORE INSERT ON public.objects
FOR EACH ROW EXECUTE FUNCTION private.enforce_object_quota();

CREATE OR REPLACE FUNCTION private.enforce_profile_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max integer;
  v_reserved bigint;
  v_accepting_invitation_id uuid := NULLIF(
    current_setting('app.accepting_tenant_invitation_id', true), ''
  )::uuid;
BEGIN
  SELECT entitlement.max_users INTO v_max
  FROM public.tenant AS tenant_record
  JOIN private.edition_entitlements AS entitlement
    ON entitlement.edition = tenant_record.edition
  WHERE tenant_record.id = NEW.tenant_id;
  IF v_max IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quota:users:' || NEW.tenant_id::text, 0)
  );
  SELECT
    (SELECT count(*) FROM public.user_profiles AS profile
      WHERE profile.tenant_id = NEW.tenant_id)
    +
    (SELECT count(*) FROM private.tenant_invitations AS invitation
      WHERE invitation.tenant_id = NEW.tenant_id
        AND invitation.id IS DISTINCT FROM v_accepting_invitation_id
        AND invitation.accepted_at IS NULL
        AND invitation.revoked_at IS NULL
        AND invitation.expired_at IS NULL
        AND invitation.expires_at > now())
  INTO v_reserved;
  IF v_reserved >= v_max THEN
    RAISE EXCEPTION 'quota.users.exceeded' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_profile_quota()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER user_profiles_enforce_quota
BEFORE INSERT ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION private.enforce_profile_quota();

CREATE OR REPLACE FUNCTION private.enforce_invitation_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max integer;
  v_reserved bigint;
BEGIN
  SELECT entitlement.max_users INTO v_max
  FROM public.tenant AS tenant_record
  JOIN private.edition_entitlements AS entitlement
    ON entitlement.edition = tenant_record.edition
  WHERE tenant_record.id = NEW.tenant_id;
  IF v_max IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quota:users:' || NEW.tenant_id::text, 0)
  );
  SELECT
    (SELECT count(*) FROM public.user_profiles AS profile
      WHERE profile.tenant_id = NEW.tenant_id)
    +
    (SELECT count(*) FROM private.tenant_invitations AS invitation
      WHERE invitation.tenant_id = NEW.tenant_id
        AND invitation.accepted_at IS NULL
        AND invitation.revoked_at IS NULL
        AND invitation.expired_at IS NULL
        AND invitation.expires_at > now())
  INTO v_reserved;
  IF v_reserved >= v_max THEN
    RAISE EXCEPTION 'quota.users.exceeded' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_invitation_quota()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tenant_invitations_enforce_quota
BEFORE INSERT ON private.tenant_invitations
FOR EACH ROW EXECUTE FUNCTION private.enforce_invitation_quota();

CREATE OR REPLACE FUNCTION public.current_tenant_usage()
RETURNS TABLE (
  active_users bigint,
  pending_invitations bigint,
  max_users integer,
  object_count bigint,
  max_objects integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT count(*) FROM public.user_profiles AS member
      WHERE member.tenant_id = tenant_record.id),
    (SELECT count(*) FROM private.tenant_invitations AS invitation
      WHERE invitation.tenant_id = tenant_record.id
        AND invitation.accepted_at IS NULL
        AND invitation.revoked_at IS NULL
        AND invitation.expired_at IS NULL
        AND invitation.expires_at > now()),
    entitlement.max_users,
    (SELECT count(*) FROM public.objects AS object_record
      WHERE object_record.tenant_id = tenant_record.id),
    entitlement.max_objects
  FROM public.user_profiles AS profile
  JOIN public.tenant AS tenant_record ON tenant_record.id = profile.tenant_id
  JOIN private.edition_entitlements AS entitlement
    ON entitlement.edition = tenant_record.edition
  WHERE profile.id = (SELECT auth.uid())
    AND tenant_record.status = 'active'
$$;

REVOKE ALL ON FUNCTION public.current_tenant_usage()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_usage()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.current_tenant_usage() IS
  'Current tenant usage and edition limits. Pending invitations reserve user seats.';
