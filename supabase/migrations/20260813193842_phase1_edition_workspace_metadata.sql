-- Phase 1: durable Simple/Full edition metadata and trusted entitlements.

ALTER TABLE public.tenant
  ADD COLUMN edition text NOT NULL DEFAULT 'full',
  ADD COLUMN workspace_kind text,
  ADD COLUMN member_visibility text NOT NULL DEFAULT 'private',
  ADD CONSTRAINT tenant_edition_check
    CHECK (edition IN ('simple', 'full')),
  ADD CONSTRAINT tenant_workspace_kind_check
    CHECK (
      workspace_kind IS NULL
      OR workspace_kind IN ('family', 'business', 'club', 'collector', 'other')
    ),
  ADD CONSTRAINT tenant_member_visibility_check
    CHECK (member_visibility IN ('private', 'shared'));

COMMENT ON COLUMN public.tenant.edition IS
  'Product edition. Existing and operator-provisioned tenants default to full.';
COMMENT ON COLUMN public.tenant.workspace_kind IS
  'Optional onboarding/wording label. Never an authorization input.';
COMMENT ON COLUMN public.tenant.member_visibility IS
  'Workspace-wide member object visibility mode used by later RLS phases.';

CREATE TABLE private.edition_entitlements (
  edition text PRIMARY KEY,
  max_users integer,
  max_objects integer,
  custom_categories boolean NOT NULL,
  groups boolean NOT NULL,
  advanced_transfers boolean NOT NULL,
  reports boolean NOT NULL,
  audit_ui boolean NOT NULL,
  CONSTRAINT edition_entitlements_edition_check
    CHECK (edition IN ('simple', 'full')),
  CONSTRAINT edition_entitlements_max_users_check
    CHECK (max_users IS NULL OR max_users > 0),
  CONSTRAINT edition_entitlements_max_objects_check
    CHECK (max_objects IS NULL OR max_objects > 0)
);

ALTER TABLE private.edition_entitlements ENABLE ROW LEVEL SECURITY;

INSERT INTO private.edition_entitlements (
  edition,
  max_users,
  max_objects,
  custom_categories,
  groups,
  advanced_transfers,
  reports,
  audit_ui
) VALUES
  ('simple', 5, 100, false, false, false, false, false),
  ('full', NULL, NULL, true, true, true, true, true);

REVOKE ALL ON private.edition_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.edition_entitlements TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_tenant_platform_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.status_reason IS DISTINCT FROM NEW.status_reason
       OR OLD.suspended_at IS DISTINCT FROM NEW.suspended_at
       OR OLD.defaults_version IS DISTINCT FROM NEW.defaults_version
       OR OLD.billing_owner_id IS DISTINCT FROM NEW.billing_owner_id
       OR OLD.edition IS DISTINCT FROM NEW.edition
     )
     AND NOT (SELECT public.is_platform_operator()) THEN
    RAISE EXCEPTION 'Platform-managed tenant fields cannot be changed here'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_edition()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT tenant_record.edition
  FROM public.tenant AS tenant_record
  WHERE tenant_record.id = public.current_tenant_id()
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_entitlement(
  p_entitlement text,
  p_tenant_id bigint DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH caller AS (
    SELECT profile.tenant_id
    FROM public.user_profiles AS profile
    WHERE profile.id = (SELECT auth.uid())
  )
  SELECT COALESCE(
    (
      SELECT CASE p_entitlement
        WHEN 'custom_categories' THEN entitlement.custom_categories
        WHEN 'groups' THEN entitlement.groups
        WHEN 'advanced_transfers' THEN entitlement.advanced_transfers
        WHEN 'reports' THEN entitlement.reports
        WHEN 'audit_ui' THEN entitlement.audit_ui
        ELSE false
      END
      FROM caller
      JOIN public.tenant AS tenant_record
        ON tenant_record.id = caller.tenant_id
       AND tenant_record.id = COALESCE(p_tenant_id, caller.tenant_id)
       AND tenant_record.status = 'active'
      JOIN private.edition_entitlements AS entitlement
        ON entitlement.edition = tenant_record.edition
    ),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_product_context()
RETURNS TABLE (
  tenant_id bigint,
  edition text,
  workspace_kind text,
  member_visibility text,
  tenant_status text,
  max_users integer,
  max_objects integer,
  custom_categories boolean,
  groups boolean,
  advanced_transfers boolean,
  reports boolean,
  audit_ui boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    tenant_record.id,
    tenant_record.edition,
    tenant_record.workspace_kind,
    tenant_record.member_visibility,
    tenant_record.status,
    entitlement.max_users,
    entitlement.max_objects,
    entitlement.custom_categories,
    entitlement.groups,
    entitlement.advanced_transfers,
    entitlement.reports,
    entitlement.audit_ui
  FROM public.user_profiles AS profile
  JOIN public.tenant AS tenant_record
    ON tenant_record.id = profile.tenant_id
  JOIN private.edition_entitlements AS entitlement
    ON entitlement.edition = tenant_record.edition
  WHERE profile.id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.audit_tenant_product_configuration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
BEGIN
  IF OLD.edition IS DISTINCT FROM NEW.edition THEN
    v_changes := v_changes || jsonb_build_object(
      'edition',
      jsonb_build_object('from', OLD.edition, 'to', NEW.edition)
    );
  END IF;
  IF OLD.workspace_kind IS DISTINCT FROM NEW.workspace_kind THEN
    v_changes := v_changes || jsonb_build_object(
      'workspace_kind',
      jsonb_build_object('from', OLD.workspace_kind, 'to', NEW.workspace_kind)
    );
  END IF;
  IF OLD.member_visibility IS DISTINCT FROM NEW.member_visibility THEN
    v_changes := v_changes || jsonb_build_object(
      'member_visibility',
      jsonb_build_object(
        'from', OLD.member_visibility,
        'to', NEW.member_visibility
      )
    );
  END IF;

  IF v_changes <> '{}'::jsonb THEN
    INSERT INTO private.audit_log (
      actor_id,
      tenant_id,
      action,
      target_type,
      target_id,
      metadata
    ) VALUES (
      (SELECT auth.uid()),
      NEW.id,
      'tenant.product_configuration.updated',
      'tenant',
      NEW.id::text,
      jsonb_build_object('changes', v_changes)
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.audit_tenant_product_configuration()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tenant_audit_product_configuration
AFTER UPDATE OF edition, workspace_kind, member_visibility ON public.tenant
FOR EACH ROW
WHEN (
  OLD.edition IS DISTINCT FROM NEW.edition
  OR OLD.workspace_kind IS DISTINCT FROM NEW.workspace_kind
  OR OLD.member_visibility IS DISTINCT FROM NEW.member_visibility
)
EXECUTE FUNCTION private.audit_tenant_product_configuration();

DROP FUNCTION public.tenant_admin_profile();

CREATE FUNCTION public.tenant_admin_profile()
RETURNS TABLE (
  id bigint,
  institution_name text,
  description text,
  address text,
  contact text,
  phone text,
  email text,
  website text,
  social_media jsonb,
  show_object_info_without_authentication boolean,
  edition text,
  workspace_kind text,
  member_visibility text,
  max_users integer,
  max_objects integer,
  custom_categories boolean,
  groups boolean,
  advanced_transfers boolean,
  reports boolean,
  audit_ui boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    tenant_record.id,
    tenant_record.institution_name,
    tenant_record.description,
    tenant_record.address,
    tenant_record.contact,
    tenant_record.phone,
    tenant_record.email,
    tenant_record.website,
    tenant_record.social_media,
    tenant_record.show_object_info_without_authentication,
    tenant_record.edition,
    tenant_record.workspace_kind,
    tenant_record.member_visibility,
    entitlement.max_users,
    entitlement.max_objects,
    entitlement.custom_categories,
    entitlement.groups,
    entitlement.advanced_transfers,
    entitlement.reports,
    entitlement.audit_ui
  FROM public.tenant AS tenant_record
  JOIN private.edition_entitlements AS entitlement
    ON entitlement.edition = tenant_record.edition
  WHERE tenant_record.id = public.current_tenant_id()
    AND public.has_permission('tenant.settings.update', tenant_record.id)
$$;

REVOKE ALL ON FUNCTION public.current_tenant_edition()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_tenant_entitlement(text, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_tenant_product_context()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tenant_admin_profile()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_tenant_edition()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_tenant_entitlement(text, bigint)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_tenant_product_context()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_admin_profile()
  TO authenticated, service_role;
