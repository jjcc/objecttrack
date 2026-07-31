-- Phase 2: transactional tenant provisioning, versioned defaults, and
-- a separately authorized platform-operations control plane.

ALTER TABLE public.tenant
  ADD COLUMN status text NOT NULL DEFAULT 'active',
  ADD COLUMN status_reason text,
  ADD COLUMN suspended_at timestamptz,
  ADD COLUMN defaults_version integer NOT NULL DEFAULT 0,
  ADD COLUMN billing_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT tenant_status_check CHECK (status IN ('active', 'suspended')),
  ADD CONSTRAINT tenant_suspension_state_check CHECK (
    (status = 'active' AND suspended_at IS NULL)
    OR (status = 'suspended' AND suspended_at IS NOT NULL)
  );

INSERT INTO private.permission_definitions (code, description)
VALUES ('platform.tenants.update', 'Edit tenant profile and operational fields');

INSERT INTO private.role_permissions (role, permission)
VALUES ('platform_operator', 'platform.tenants.update');

CREATE TABLE private.tenant_default_versions (
  version integer PRIMARY KEY CHECK (version >= 0),
  name text NOT NULL UNIQUE,
  is_current boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  event_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT tenant_default_settings_object CHECK (jsonb_typeof(settings) = 'object'),
  CONSTRAINT tenant_default_categories_array CHECK (jsonb_typeof(categories) = 'array'),
  CONSTRAINT tenant_default_event_types_array CHECK (jsonb_typeof(event_types) = 'array')
);

CREATE UNIQUE INDEX tenant_default_versions_one_current_idx
  ON private.tenant_default_versions (is_current)
  WHERE is_current;

INSERT INTO private.tenant_default_versions (
  version, name, is_current, settings, categories, event_types
)
VALUES
  (0, 'legacy', false, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb),
  (
    1,
    'initial-defaults',
    true,
    '{"show_object_info_without_authentication":true}'::jsonb,
    '[
      {"name":"GeneralElectronics","description":"Electronic devices and equipment"},
      {"name":"USBCCamera","description":"USB cameras and related accessories"},
      {"name":"MipiCamera","description":"MIPI cameras and related accessories"},
      {"name":"GigECamera","description":"GigE cameras and related accessories"},
      {"name":"Equipment","description":"General equipment and tools"},
      {"name":"Other","description":"Miscellaneous items"}
    ]'::jsonb,
    '["transfer","inspection","handover","maintenance","return","assignment"]'::jsonb
  );

ALTER TABLE public.tenant
  ADD CONSTRAINT tenant_defaults_version_fkey
    FOREIGN KEY (defaults_version)
    REFERENCES private.tenant_default_versions(version);

CREATE TABLE private.initial_owner_invitations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL UNIQUE REFERENCES public.tenant(id) ON DELETE CASCADE,
  email text NOT NULL,
  intended_role text NOT NULL DEFAULT 'owner' CHECK (intended_role = 'owner'),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  last_error text,
  CONSTRAINT initial_owner_invitation_email_format CHECK (
    email = lower(btrim(email))
    AND email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
);

CREATE TABLE private.work_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id bigint REFERENCES public.tenant(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  completed_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_queue_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX work_queue_pending_idx
  ON private.work_queue (available_at, created_at)
  WHERE completed_at IS NULL AND failed_at IS NULL;
CREATE INDEX work_queue_tenant_id_idx ON private.work_queue (tenant_id);

CREATE TABLE private.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id bigint REFERENCES public.tenant(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX audit_log_tenant_created_idx
  ON private.audit_log (tenant_id, created_at DESC);
CREATE INDEX audit_log_actor_created_idx
  ON private.audit_log (actor_id, created_at DESC);
CREATE INDEX initial_owner_invitations_created_by_idx
  ON private.initial_owner_invitations (created_by);
CREATE INDEX tenant_default_versions_created_by_idx
  ON private.tenant_default_versions (created_by);
CREATE INDEX tenant_billing_owner_id_idx
  ON public.tenant (billing_owner_id);
CREATE INDEX tenant_defaults_version_idx
  ON public.tenant (defaults_version);

REVOKE ALL ON private.tenant_default_versions,
  private.initial_owner_invitations,
  private.work_queue,
  private.audit_log
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON private.tenant_default_versions TO service_role;
GRANT SELECT, INSERT, UPDATE ON private.initial_owner_invitations TO service_role;
GRANT SELECT, INSERT, UPDATE ON private.work_queue TO service_role;
GRANT SELECT, INSERT ON private.audit_log TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA private TO service_role;

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
     )
     AND NOT (SELECT public.is_platform_operator()) THEN
    RAISE EXCEPTION 'Platform-managed tenant fields cannot be changed here'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenant_enforce_platform_fields
BEFORE UPDATE ON public.tenant
FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_platform_fields();

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
BEGIN
  SELECT defaults.* INTO v_defaults
  FROM private.tenant_default_versions AS defaults
  WHERE defaults.version = p_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown tenant defaults version' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.event_types (tenant_id, label)
  SELECT p_tenant_id, value
  FROM jsonb_array_elements_text(v_defaults.event_types)
  ON CONFLICT (tenant_id, label) DO NOTHING;

  INSERT INTO public.categories (tenant_id, name, description)
  SELECT
    p_tenant_id,
    category->>'name',
    NULLIF(category->>'description', '')
  FROM jsonb_array_elements(v_defaults.categories) AS category
  WHERE NULLIF(btrim(category->>'name'), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.categories AS existing
      WHERE existing.tenant_id = p_tenant_id
        AND existing.name = category->>'name'
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.apply_tenant_defaults(bigint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.apply_tenant_defaults(bigint, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.provision_tenant(
  p_institution_name text,
  p_owner_email text,
  p_description text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_contact text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_website text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_defaults_version integer;
  v_tenant_id bigint;
  v_owner_email text := lower(btrim(p_owner_email));
BEGIN
  IF NOT public.has_permission('platform.tenants.create') THEN
    RAISE EXCEPTION 'Permission denied: platform.tenants.create'
      USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_institution_name), '') IS NULL THEN
    RAISE EXCEPTION 'Institution name is required' USING ERRCODE = '22023';
  END IF;
  IF v_owner_email IS NULL
     OR v_owner_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'A valid initial owner email is required' USING ERRCODE = '22023';
  END IF;

  SELECT defaults.version INTO v_defaults_version
  FROM private.tenant_default_versions AS defaults
  WHERE defaults.is_current
  FOR SHARE;
  IF v_defaults_version IS NULL THEN
    RAISE EXCEPTION 'No current tenant defaults version is configured';
  END IF;

  INSERT INTO public.tenant (
    institution_name, description, address, contact, phone, email, website,
    status, defaults_version
  ) VALUES (
    btrim(p_institution_name), NULLIF(btrim(p_description), ''),
    NULLIF(btrim(p_address), ''), NULLIF(btrim(p_contact), ''),
    NULLIF(btrim(p_phone), ''), NULLIF(lower(btrim(p_email)), ''),
    NULLIF(btrim(p_website), ''), 'active', 0
  )
  RETURNING id INTO v_tenant_id;

  PERFORM private.apply_tenant_defaults(v_tenant_id, v_defaults_version);

  INSERT INTO private.initial_owner_invitations (
    tenant_id, email, intended_role, created_by
  ) VALUES (
    v_tenant_id, v_owner_email, 'owner', v_actor_id
  );

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_actor_id,
    v_tenant_id,
    'tenant.provisioned',
    'tenant',
    v_tenant_id::text,
    jsonb_build_object('defaults_version', v_defaults_version)
  );

  INSERT INTO private.work_queue (tenant_id, kind, payload)
  VALUES (
    v_tenant_id,
    'tenant.initial_owner_invitation',
    jsonb_build_object(
      'tenant_id', v_tenant_id,
      'email', v_owner_email,
      'role', 'owner'
    )
  );

  RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_tenants(p_search text DEFAULT NULL)
RETURNS TABLE (
  id bigint,
  institution_name text,
  email text,
  status text,
  defaults_version integer,
  initial_owner_email text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    tenant_record.id,
    tenant_record.institution_name,
    tenant_record.email,
    tenant_record.status,
    tenant_record.defaults_version,
    owner_invitation.email,
    tenant_record.created_at,
    tenant_record.updated_at
  FROM public.tenant AS tenant_record
  LEFT JOIN private.initial_owner_invitations AS owner_invitation
    ON owner_invitation.tenant_id = tenant_record.id
  WHERE public.has_permission('platform.tenants.update')
    AND (
      NULLIF(btrim(p_search), '') IS NULL
      OR tenant_record.institution_name ILIKE '%' || btrim(p_search) || '%'
      OR tenant_record.email ILIKE '%' || btrim(p_search) || '%'
      OR owner_invitation.email ILIKE '%' || btrim(p_search) || '%'
    )
  ORDER BY tenant_record.created_at DESC, tenant_record.id DESC
$$;

CREATE OR REPLACE FUNCTION public.platform_tenant(p_tenant_id bigint)
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
  status text,
  status_reason text,
  suspended_at timestamptz,
  defaults_version integer,
  billing_owner_id uuid,
  initial_owner_email text,
  initial_owner_status text,
  created_at timestamptz,
  updated_at timestamptz
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
    tenant_record.status,
    tenant_record.status_reason,
    tenant_record.suspended_at,
    tenant_record.defaults_version,
    tenant_record.billing_owner_id,
    owner_invitation.email,
    owner_invitation.status,
    tenant_record.created_at,
    tenant_record.updated_at
  FROM public.tenant AS tenant_record
  LEFT JOIN private.initial_owner_invitations AS owner_invitation
    ON owner_invitation.tenant_id = tenant_record.id
  WHERE public.has_permission('platform.tenants.update')
    AND tenant_record.id = p_tenant_id
$$;

CREATE OR REPLACE FUNCTION public.update_platform_tenant(
  p_tenant_id bigint,
  p_institution_name text,
  p_description text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_contact text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_social_media jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
BEGIN
  IF NOT public.has_permission('platform.tenants.update') THEN
    RAISE EXCEPTION 'Permission denied: platform.tenants.update'
      USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_institution_name), '') IS NULL THEN
    RAISE EXCEPTION 'Institution name is required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_social_media, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Social media must be a JSON object' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tenant
  SET
    institution_name = btrim(p_institution_name),
    description = NULLIF(btrim(p_description), ''),
    address = NULLIF(btrim(p_address), ''),
    contact = NULLIF(btrim(p_contact), ''),
    phone = NULLIF(btrim(p_phone), ''),
    email = NULLIF(lower(btrim(p_email)), ''),
    website = NULLIF(btrim(p_website), ''),
    social_media = COALESCE(p_social_media, '{}'::jsonb),
    updated_at = now()
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id
  ) VALUES (
    v_actor_id, p_tenant_id, 'tenant.profile.updated', 'tenant', p_tenant_id::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_tenant_status(
  p_tenant_id bigint,
  p_status text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_previous_status text;
BEGIN
  IF NOT public.has_permission('platform.tenants.suspend') THEN
    RAISE EXCEPTION 'Permission denied: platform.tenants.suspend'
      USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Tenant status must be active or suspended' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A status-change reason is required' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_previous_status
  FROM public.tenant
  WHERE id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.tenant
  SET
    status = p_status,
    status_reason = btrim(p_reason),
    suspended_at = CASE WHEN p_status = 'suspended' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_tenant_id;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_actor_id,
    p_tenant_id,
    CASE WHEN p_status = 'suspended' THEN 'tenant.suspended' ELSE 'tenant.activated' END,
    'tenant',
    p_tenant_id::text,
    jsonb_build_object(
      'previous_status', v_previous_status,
      'new_status', p_status,
      'reason', btrim(p_reason)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.migrate_tenant_defaults(
  p_tenant_id bigint,
  p_target_version integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_current_version integer;
BEGIN
  IF NOT public.has_permission('platform.tenants.update') THEN
    RAISE EXCEPTION 'Permission denied: platform.tenants.update'
      USING ERRCODE = '42501';
  END IF;

  SELECT defaults_version INTO v_current_version
  FROM public.tenant
  WHERE id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_target_version <= v_current_version THEN
    RAISE EXCEPTION 'Target defaults version must be newer than the tenant version'
      USING ERRCODE = '22023';
  END IF;

  PERFORM private.apply_tenant_defaults(p_tenant_id, p_target_version);

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_actor_id,
    p_tenant_id,
    'tenant.defaults.migrated',
    'tenant',
    p_tenant_id::text,
    jsonb_build_object(
      'previous_version', v_current_version,
      'target_version', p_target_version
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provision_tenant(text, text, text, text, text, text, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_tenants(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_tenant(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_platform_tenant(bigint, text, text, text, text, text, text, text, jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_tenant_status(bigint, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.migrate_tenant_defaults(bigint, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.provision_tenant(text, text, text, text, text, text, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_tenants(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_tenant(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_platform_tenant(bigint, text, text, text, text, text, text, text, jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_tenant_status(bigint, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.migrate_tenant_defaults(bigint, integer)
  TO authenticated, service_role;
