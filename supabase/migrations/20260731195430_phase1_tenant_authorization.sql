-- Phase 1: tenant roles, explicit permissions, ownership integrity, and RLS.
-- This draft must be copied into a file created by `supabase migration new`.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

ALTER TABLE public.user_profiles
  ADD COLUMN tenant_role text NOT NULL DEFAULT 'member',
  ADD CONSTRAINT user_profiles_tenant_role_check
    CHECK (tenant_role IN ('member', 'admin', 'owner'));

-- Legacy administrators already had full management access. Treating them as
-- owners preserves that access while the application moves off admin_users.
UPDATE public.user_profiles AS profile
SET tenant_role = 'owner'
WHERE EXISTS (
  SELECT 1
  FROM public.admin_users AS legacy_admin
  WHERE legacy_admin.id = profile.id
);

CREATE TABLE private.permission_definitions (
  code text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE private.role_permissions (
  role text NOT NULL,
  permission text NOT NULL REFERENCES private.permission_definitions(code)
    ON UPDATE CASCADE ON DELETE CASCADE,
  PRIMARY KEY (role, permission),
  CONSTRAINT role_permissions_role_check
    CHECK (role IN ('member', 'admin', 'owner', 'platform_operator'))
);

CREATE TABLE private.platform_operators (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  disabled_at timestamptz,
  CONSTRAINT platform_operators_disabled_after_creation
    CHECK (disabled_at IS NULL OR disabled_at >= created_at)
);

INSERT INTO private.permission_definitions (code, description)
VALUES
  ('tenant.data.read', 'Read tenant-owned application data'),
  ('tenant.data.update', 'Create, update, and delete tenant-owned application data'),
  ('tenant.settings.update', 'Update supported tenant settings'),
  ('tenant.users.read', 'Read tenant member information'),
  ('tenant.users.invite', 'Create, resend, and revoke tenant invitations'),
  ('tenant.users.roles.update', 'Update supported tenant member roles'),
  ('tenant.reports.generate', 'Generate reports for the current tenant'),
  ('platform.tenants.create', 'Provision a new tenant'),
  ('platform.tenants.suspend', 'Suspend or reactivate a tenant');

INSERT INTO private.role_permissions (role, permission)
VALUES
  ('member', 'tenant.data.read'),
  ('member', 'tenant.users.read'),
  ('admin', 'tenant.data.read'),
  ('admin', 'tenant.data.update'),
  ('admin', 'tenant.settings.update'),
  ('admin', 'tenant.users.read'),
  ('admin', 'tenant.users.invite'),
  ('admin', 'tenant.users.roles.update'),
  ('admin', 'tenant.reports.generate'),
  ('owner', 'tenant.data.read'),
  ('owner', 'tenant.data.update'),
  ('owner', 'tenant.settings.update'),
  ('owner', 'tenant.users.read'),
  ('owner', 'tenant.users.invite'),
  ('owner', 'tenant.users.roles.update'),
  ('owner', 'tenant.reports.generate'),
  ('platform_operator', 'platform.tenants.create'),
  ('platform_operator', 'platform.tenants.suspend');

REVOKE ALL ON private.permission_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.role_permissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.platform_operators FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.permission_definitions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.role_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.platform_operators TO service_role;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT profile.tenant_id
  FROM public.user_profiles AS profile
  WHERE profile.id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT profile.tenant_role
  FROM public.user_profiles AS profile
  WHERE profile.id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_platform_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM private.platform_operators AS operator
      WHERE operator.user_id = (SELECT auth.uid())
        AND operator.disabled_at IS NULL
    )
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
  )
  SELECT CASE
    WHEN p_permission LIKE 'platform.%' THEN
      (SELECT public.is_platform_operator())
      AND EXISTS (
        SELECT 1
        FROM private.role_permissions AS mapping
        WHERE mapping.role = 'platform_operator'
          AND mapping.permission = p_permission
      )
    ELSE EXISTS (
      SELECT 1
      FROM caller
      JOIN private.role_permissions AS mapping
        ON mapping.role = caller.tenant_role
       AND mapping.permission = p_permission
      WHERE caller.tenant_id = COALESCE(p_tenant_id, caller.tenant_id)
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((SELECT public.current_tenant_role()) IN ('admin', 'owner'), false)
$$;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_tenant_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_platform_operator() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(text, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_tenant_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(text, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Fail before adding constraints if legacy rows cross tenant boundaries.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_profiles AS profile
    JOIN public.groups AS member_group ON member_group.id = profile.group_id
    WHERE profile.group_id IS NOT NULL
      AND profile.tenant_id <> member_group.tenant_id
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant ownership: user_profiles.group_id crosses tenants';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.objects AS object_record
    JOIN public.categories AS category ON category.id = object_record.category_id
    WHERE object_record.category_id IS NOT NULL
      AND object_record.tenant_id <> category.tenant_id
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant ownership: objects.category_id crosses tenants';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.objects AS object_record
    JOIN public.user_profiles AS owner_profile ON owner_profile.id = object_record.current_owner_id
    WHERE object_record.current_owner_id IS NOT NULL
      AND object_record.tenant_id <> owner_profile.tenant_id
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant ownership: objects.current_owner_id crosses tenants';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.events AS event_record
    JOIN public.objects AS object_record ON object_record.id = event_record.object_id
    JOIN public.groups AS event_group ON event_group.id = event_record.group_id
    JOIN public.event_types AS event_type ON event_type.id = event_record.event_type_id
    LEFT JOIN public.user_profiles AS from_profile ON from_profile.id = event_record.e_from
    LEFT JOIN public.user_profiles AS to_profile ON to_profile.id = event_record.e_to
    WHERE event_group.tenant_id <> object_record.tenant_id
       OR event_type.tenant_id <> object_record.tenant_id
       OR (event_record.e_from IS NOT NULL AND from_profile.tenant_id IS DISTINCT FROM object_record.tenant_id)
       OR (event_record.e_to IS NOT NULL AND to_profile.tenant_id IS DISTINCT FROM object_record.tenant_id)
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant ownership: events contain cross-tenant relationships';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transfer_requests AS request
    JOIN public.objects AS object_record ON object_record.id = request.object_id
    LEFT JOIN public.groups AS request_group ON request_group.id = request.group_id
    LEFT JOIN public.user_profiles AS from_profile ON from_profile.id = request.from_user_id
    LEFT JOIN public.user_profiles AS to_profile ON to_profile.id = request.to_user_id
    WHERE from_profile.id IS NULL
       OR to_profile.id IS NULL
       OR from_profile.tenant_id <> object_record.tenant_id
       OR to_profile.tenant_id <> object_record.tenant_id
       OR (request.group_id IS NOT NULL AND request_group.tenant_id IS DISTINCT FROM object_record.tenant_id)
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant ownership: transfer_requests contain cross-tenant relationships';
  END IF;
END;
$$;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_id_tenant_id_key UNIQUE (id, tenant_id);
ALTER TABLE public.groups
  ADD CONSTRAINT groups_id_tenant_id_key UNIQUE (id, tenant_id);
ALTER TABLE public.categories
  ADD CONSTRAINT categories_id_tenant_id_key UNIQUE (id, tenant_id);
ALTER TABLE public.event_types
  ADD CONSTRAINT event_types_id_tenant_id_key UNIQUE (id, tenant_id);
ALTER TABLE public.objects
  ADD CONSTRAINT objects_id_tenant_id_key UNIQUE (id, tenant_id);

ALTER TABLE public.event_types DROP CONSTRAINT event_types_label_key;
ALTER TABLE public.event_types
  ADD CONSTRAINT event_types_tenant_id_label_key UNIQUE (tenant_id, label);

ALTER TABLE public.events ADD COLUMN tenant_id bigint;
UPDATE public.events AS event_record
SET tenant_id = object_record.tenant_id
FROM public.objects AS object_record
WHERE object_record.id = event_record.object_id;
ALTER TABLE public.events
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT events_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  ADD CONSTRAINT events_id_tenant_id_key UNIQUE (id, tenant_id);

ALTER TABLE public.transfer_requests ADD COLUMN tenant_id bigint;
UPDATE public.transfer_requests AS request
SET tenant_id = object_record.tenant_id
FROM public.objects AS object_record
WHERE object_record.id = request.object_id;
ALTER TABLE public.transfer_requests
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT transfer_requests_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  ADD CONSTRAINT transfer_requests_id_tenant_id_key UNIQUE (id, tenant_id);

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_group_tenant_fkey
    FOREIGN KEY (group_id, tenant_id) REFERENCES public.groups(id, tenant_id);
ALTER TABLE public.objects
  ADD CONSTRAINT objects_category_tenant_fkey
    FOREIGN KEY (category_id, tenant_id) REFERENCES public.categories(id, tenant_id),
  ADD CONSTRAINT objects_owner_tenant_fkey
    FOREIGN KEY (current_owner_id, tenant_id) REFERENCES public.user_profiles(id, tenant_id);
ALTER TABLE public.events
  ADD CONSTRAINT events_group_tenant_fkey
    FOREIGN KEY (group_id, tenant_id) REFERENCES public.groups(id, tenant_id),
  ADD CONSTRAINT events_object_tenant_fkey
    FOREIGN KEY (object_id, tenant_id) REFERENCES public.objects(id, tenant_id),
  ADD CONSTRAINT events_event_type_tenant_fkey
    FOREIGN KEY (event_type_id, tenant_id) REFERENCES public.event_types(id, tenant_id),
  ADD CONSTRAINT events_from_profile_tenant_fkey
    FOREIGN KEY (e_from, tenant_id) REFERENCES public.user_profiles(id, tenant_id),
  ADD CONSTRAINT events_to_profile_tenant_fkey
    FOREIGN KEY (e_to, tenant_id) REFERENCES public.user_profiles(id, tenant_id);
ALTER TABLE public.transfer_requests
  ADD CONSTRAINT transfer_requests_object_tenant_fkey
    FOREIGN KEY (object_id, tenant_id) REFERENCES public.objects(id, tenant_id),
  ADD CONSTRAINT transfer_requests_group_tenant_fkey
    FOREIGN KEY (group_id, tenant_id) REFERENCES public.groups(id, tenant_id),
  ADD CONSTRAINT transfer_requests_from_profile_tenant_fkey
    FOREIGN KEY (from_user_id, tenant_id) REFERENCES public.user_profiles(id, tenant_id),
  ADD CONSTRAINT transfer_requests_to_profile_tenant_fkey
    FOREIGN KEY (to_user_id, tenant_id) REFERENCES public.user_profiles(id, tenant_id);

CREATE INDEX events_tenant_id_created_at_idx
  ON public.events (tenant_id, created_at DESC);
CREATE INDEX events_group_tenant_idx
  ON public.events (group_id, tenant_id);
CREATE INDEX events_object_tenant_idx
  ON public.events (object_id, tenant_id);
CREATE INDEX events_event_type_tenant_idx
  ON public.events (event_type_id, tenant_id);
CREATE INDEX events_from_profile_tenant_idx
  ON public.events (e_from, tenant_id);
CREATE INDEX events_to_profile_tenant_idx
  ON public.events (e_to, tenant_id);
CREATE INDEX objects_category_tenant_idx
  ON public.objects (category_id, tenant_id);
CREATE INDEX objects_owner_tenant_idx
  ON public.objects (current_owner_id, tenant_id);
CREATE INDEX transfer_requests_tenant_id_status_created_at_idx
  ON public.transfer_requests (tenant_id, status, created_at DESC);
CREATE INDEX transfer_requests_object_tenant_idx
  ON public.transfer_requests (object_id, tenant_id);
CREATE INDEX transfer_requests_group_tenant_idx
  ON public.transfer_requests (group_id, tenant_id);
CREATE INDEX transfer_requests_from_profile_tenant_idx
  ON public.transfer_requests (from_user_id, tenant_id);
CREATE INDEX transfer_requests_to_profile_tenant_idx
  ON public.transfer_requests (to_user_id, tenant_id);
CREATE INDEX user_profiles_group_tenant_idx
  ON public.user_profiles (group_id, tenant_id);
CREATE INDEX role_permissions_permission_idx
  ON private.role_permissions (permission);
CREATE INDEX platform_operators_created_by_idx
  ON private.platform_operators (created_by);

CREATE TRIGGER events_assign_current_tenant
BEFORE INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.assign_current_tenant();
CREATE TRIGGER transfer_requests_assign_current_tenant
BEFORE INSERT ON public.transfer_requests
FOR EACH ROW EXECUTE FUNCTION public.assign_current_tenant();

CREATE OR REPLACE FUNCTION public.enforce_profile_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor_role text := public.current_tenant_role();
BEGIN
  IF OLD.tenant_role IS DISTINCT FROM NEW.tenant_role THEN
    IF NOT public.has_permission('tenant.users.roles.update', NEW.tenant_id) THEN
      RAISE EXCEPTION 'Permission denied: tenant.users.roles.update' USING ERRCODE = '42501';
    END IF;
    IF NEW.tenant_role = 'owner' AND v_actor_role IS DISTINCT FROM 'owner' THEN
      RAISE EXCEPTION 'Only a tenant owner can grant the owner role' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_profiles_enforce_role_assignment
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_role_assignment();

-- Replace every public-table policy in scope, then add only the intended rules.
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'admin_users', 'categories', 'event_types', 'events', 'groups',
        'object_custom_schemas', 'objects', 'tenant', 'transfer_requests',
        'user_profiles'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$$;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.object_custom_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own legacy admin marker"
ON public.admin_users FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()));

CREATE POLICY "Tenant users read tenant"
ON public.tenant FOR SELECT TO authenticated
USING (id = (SELECT public.current_tenant_id()));
CREATE POLICY "Tenant managers update settings"
ON public.tenant FOR UPDATE TO authenticated
USING (public.has_permission('tenant.settings.update', id))
WITH CHECK (public.has_permission('tenant.settings.update', id));

CREATE POLICY "Tenant users read profiles"
ON public.user_profiles FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));
CREATE POLICY "Tenant managers create profiles"
ON public.user_profiles FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = (SELECT public.current_tenant_id())
  AND public.has_permission('tenant.users.roles.update', tenant_id)
  AND (
    tenant_role <> 'owner'
    OR (SELECT public.current_tenant_role()) = 'owner'
  )
);
CREATE POLICY "Tenant managers update profiles"
ON public.user_profiles FOR UPDATE TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND public.has_permission('tenant.data.update', tenant_id)
)
WITH CHECK (
  tenant_id = (SELECT public.current_tenant_id())
  AND public.has_permission('tenant.data.update', tenant_id)
);
CREATE POLICY "Tenant managers delete profiles"
ON public.user_profiles FOR DELETE TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND public.has_permission('tenant.users.roles.update', tenant_id)
  AND tenant_role <> 'owner'
);

CREATE POLICY "Tenant users read groups"
ON public.groups FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));
CREATE POLICY "Tenant managers create groups"
ON public.groups FOR INSERT TO authenticated
WITH CHECK (public.has_permission('tenant.data.update', tenant_id));
CREATE POLICY "Tenant managers update groups"
ON public.groups FOR UPDATE TO authenticated
USING (public.has_permission('tenant.data.update', tenant_id))
WITH CHECK (public.has_permission('tenant.data.update', tenant_id));
CREATE POLICY "Tenant managers delete groups"
ON public.groups FOR DELETE TO authenticated
USING (public.has_permission('tenant.data.update', tenant_id));

CREATE POLICY "Tenant users read categories"
ON public.categories FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));
CREATE POLICY "Tenant managers create categories"
ON public.categories FOR INSERT TO authenticated
WITH CHECK (public.has_permission('tenant.data.update', tenant_id));
CREATE POLICY "Tenant managers update categories"
ON public.categories FOR UPDATE TO authenticated
USING (public.has_permission('tenant.data.update', tenant_id))
WITH CHECK (public.has_permission('tenant.data.update', tenant_id));
CREATE POLICY "Tenant managers delete categories"
ON public.categories FOR DELETE TO authenticated
USING (public.has_permission('tenant.data.update', tenant_id));

CREATE POLICY "Tenant users read event types"
ON public.event_types FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));
CREATE POLICY "Tenant managers create event types"
ON public.event_types FOR INSERT TO authenticated
WITH CHECK (public.has_permission('tenant.data.update', tenant_id));
CREATE POLICY "Tenant managers update event types"
ON public.event_types FOR UPDATE TO authenticated
USING (public.has_permission('tenant.data.update', tenant_id))
WITH CHECK (public.has_permission('tenant.data.update', tenant_id));
CREATE POLICY "Tenant managers delete event types"
ON public.event_types FOR DELETE TO authenticated
USING (public.has_permission('tenant.data.update', tenant_id));

CREATE POLICY "Tenant users read objects"
ON public.objects FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));
CREATE POLICY "Tenant managers create objects"
ON public.objects FOR INSERT TO authenticated
WITH CHECK (public.has_permission('tenant.data.update', tenant_id));
CREATE POLICY "Tenant managers update objects"
ON public.objects FOR UPDATE TO authenticated
USING (public.has_permission('tenant.data.update', tenant_id))
WITH CHECK (public.has_permission('tenant.data.update', tenant_id));
CREATE POLICY "Tenant managers delete objects"
ON public.objects FOR DELETE TO authenticated
USING (public.has_permission('tenant.data.update', tenant_id));

CREATE POLICY "Tenant users read events"
ON public.events FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));
CREATE POLICY "Tenant users create events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = (SELECT public.current_tenant_id())
  AND (
    e_from = (SELECT auth.uid())
    OR public.has_permission('tenant.data.update', tenant_id)
  )
);

CREATE POLICY "Tenant users read transfer requests"
ON public.transfer_requests FOR SELECT TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND (
    from_user_id = (SELECT auth.uid())
    OR to_user_id = (SELECT auth.uid())
    OR public.has_permission('tenant.data.update', tenant_id)
  )
);

CREATE POLICY "Tenant users read custom schema"
ON public.object_custom_schemas FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));
CREATE POLICY "Tenant managers create custom schema"
ON public.object_custom_schemas FOR INSERT TO authenticated
WITH CHECK (public.has_permission('tenant.data.update', tenant_id));
CREATE POLICY "Tenant managers update custom schema"
ON public.object_custom_schemas FOR UPDATE TO authenticated
USING (public.has_permission('tenant.data.update', tenant_id))
WITH CHECK (public.has_permission('tenant.data.update', tenant_id));

DROP POLICY IF EXISTS "Tenant admins upload object images" ON storage.objects;
DROP POLICY IF EXISTS "Tenant admins update object images" ON storage.objects;
DROP POLICY IF EXISTS "Tenant admins delete object images" ON storage.objects;
CREATE POLICY "Tenant managers upload object images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'object-images'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
  AND public.has_permission('tenant.data.update', (SELECT public.current_tenant_id()))
);
CREATE POLICY "Tenant managers update object images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'object-images'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
  AND public.has_permission('tenant.data.update', (SELECT public.current_tenant_id()))
)
WITH CHECK (
  bucket_id = 'object-images'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
  AND public.has_permission('tenant.data.update', (SELECT public.current_tenant_id()))
);
CREATE POLICY "Tenant managers delete object images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'object-images'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
  AND public.has_permission('tenant.data.update', (SELECT public.current_tenant_id()))
);

-- Security-definer read helpers must always stay inside the caller's tenant.
CREATE OR REPLACE FUNCTION public.group_profile_directory()
RETURNS TABLE (id uuid, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT profile.id, profile.first_name, profile.last_name
  FROM public.user_profiles AS profile
  JOIN public.user_profiles AS caller
    ON caller.id = (SELECT auth.uid())
   AND caller.tenant_id = profile.tenant_id
  WHERE profile.group_id = caller.group_id
  ORDER BY profile.first_name NULLS LAST, profile.last_name NULLS LAST, profile.id
$$;

CREATE OR REPLACE FUNCTION public.profile_names(p_user_ids uuid[])
RETURNS TABLE (id uuid, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT profile.id, profile.first_name, profile.last_name
  FROM public.user_profiles AS profile
  JOIN public.user_profiles AS caller
    ON caller.id = (SELECT auth.uid())
   AND caller.tenant_id = profile.tenant_id
  WHERE profile.id = ANY(COALESCE(p_user_ids, ARRAY[]::uuid[]))
    AND (
      public.has_permission('tenant.users.read', caller.tenant_id)
      OR profile.group_id = caller.group_id
    )
$$;

CREATE OR REPLACE FUNCTION public.request_transfer(p_object_id bigint, p_to_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_requester_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
  v_group_id bigint;
  v_current_owner_id uuid;
  v_request_id bigint;
BEGIN
  IF v_requester_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Authentication and tenant membership required' USING ERRCODE = '42501';
  END IF;

  SELECT object_record.current_owner_id
  INTO v_current_owner_id
  FROM public.objects AS object_record
  WHERE object_record.id = p_object_id
    AND object_record.tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Object not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_current_owner_id IS NULL THEN
    RAISE EXCEPTION 'Object has no current owner' USING ERRCODE = '22023';
  END IF;
  IF v_current_owner_id = v_requester_id THEN
    RAISE EXCEPTION 'Requester already owns this object' USING ERRCODE = '22023';
  END IF;
  IF p_to_user_id <> v_current_owner_id THEN
    RAISE EXCEPTION 'Transfer recipient must be the current owner' USING ERRCODE = '22023';
  END IF;

  SELECT requester.group_id INTO v_group_id
  FROM public.user_profiles AS requester
  WHERE requester.id = v_requester_id AND requester.tenant_id = v_tenant_id;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Requester has no group profile' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles AS owner_profile
    WHERE owner_profile.id = v_current_owner_id
      AND owner_profile.tenant_id = v_tenant_id
      AND owner_profile.group_id = v_group_id
  ) THEN
    RAISE EXCEPTION 'Current owner is not in the requester group' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.transfer_requests AS request
    WHERE request.object_id = p_object_id AND request.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'A pending transfer already exists for this object' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.transfer_requests (
    tenant_id, object_id, from_user_id, to_user_id, group_id, status
  ) VALUES (
    v_tenant_id, p_object_id, v_requester_id, v_current_owner_id, v_group_id, 'pending'
  ) RETURNING id INTO v_request_id;
  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_transfer(p_request_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
  v_request public.transfer_requests%ROWTYPE;
  v_actor_role text;
  v_transfer_event_type_id bigint;
BEGIN
  IF v_actor_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Authentication and tenant membership required' USING ERRCODE = '42501';
  END IF;
  SELECT request.* INTO v_request
  FROM public.transfer_requests AS request
  WHERE request.id = p_request_id AND request.tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_actor_id = v_request.to_user_id THEN
    v_actor_role := 'recipient';
  ELSIF public.has_permission('tenant.data.update', v_tenant_id) THEN
    v_actor_role := 'administrator';
  ELSE
    RAISE EXCEPTION 'Only the recipient or a tenant manager can approve this transfer' USING ERRCODE = '42501';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Transfer request is not pending' USING ERRCODE = '22023';
  END IF;

  UPDATE public.objects
  SET current_owner_id = v_request.from_user_id
  WHERE id = v_request.object_id
    AND tenant_id = v_tenant_id
    AND current_owner_id = v_request.to_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Object ownership changed before approval' USING ERRCODE = '40001';
  END IF;
  UPDATE public.transfer_requests SET status = 'approved', updated_at = now()
  WHERE id = v_request.id AND tenant_id = v_tenant_id;

  SELECT event_type.id INTO v_transfer_event_type_id
  FROM public.event_types AS event_type
  WHERE event_type.tenant_id = v_tenant_id AND event_type.label = 'transfer';
  IF v_transfer_event_type_id IS NULL THEN
    RAISE EXCEPTION 'Transfer event type is not configured';
  END IF;
  INSERT INTO public.events (
    tenant_id, group_id, object_id, event_type_id, e_from, e_to, extra
  ) VALUES (
    v_tenant_id, v_request.group_id, v_request.object_id, v_transfer_event_type_id,
    v_request.to_user_id, v_request.from_user_id,
    jsonb_build_object(
      'transfer_request_id', v_request.id, 'action', 'approved',
      'acted_by', v_actor_id, 'actor_role', v_actor_role
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_transfer(p_request_id bigint, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
  v_request public.transfer_requests%ROWTYPE;
  v_actor_role text;
  v_transfer_event_type_id bigint;
BEGIN
  IF v_actor_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Authentication and tenant membership required' USING ERRCODE = '42501';
  END IF;
  SELECT request.* INTO v_request
  FROM public.transfer_requests AS request
  WHERE request.id = p_request_id AND request.tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_actor_id = v_request.to_user_id THEN
    v_actor_role := 'recipient';
  ELSIF public.has_permission('tenant.data.update', v_tenant_id) THEN
    v_actor_role := 'administrator';
  ELSE
    RAISE EXCEPTION 'Only the recipient or a tenant manager can reject this transfer' USING ERRCODE = '42501';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Transfer request is not pending' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.objects AS object_record
  WHERE object_record.id = v_request.object_id
    AND object_record.tenant_id = v_tenant_id
    AND object_record.current_owner_id = v_request.to_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Object ownership changed before rejection' USING ERRCODE = '40001';
  END IF;
  UPDATE public.transfer_requests
  SET status = 'rejected', reason = COALESCE(p_reason, reason), updated_at = now()
  WHERE id = v_request.id AND tenant_id = v_tenant_id;

  SELECT event_type.id INTO v_transfer_event_type_id
  FROM public.event_types AS event_type
  WHERE event_type.tenant_id = v_tenant_id AND event_type.label = 'transfer';
  IF v_transfer_event_type_id IS NULL THEN
    RAISE EXCEPTION 'Transfer event type is not configured';
  END IF;
  INSERT INTO public.events (
    tenant_id, group_id, object_id, event_type_id, e_from, e_to, extra
  ) VALUES (
    v_tenant_id, v_request.group_id, v_request.object_id, v_transfer_event_type_id,
    v_request.to_user_id, v_request.from_user_id,
    jsonb_strip_nulls(jsonb_build_object(
      'transfer_request_id', v_request.id, 'action', 'rejected',
      'reason', p_reason, 'acted_by', v_actor_id, 'actor_role', v_actor_role
    ))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.group_profile_directory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_names(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_transfer(bigint, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_transfer(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_transfer(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_profile_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_names(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_transfer(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_transfer(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_transfer(bigint, text) TO authenticated;

-- Explicit Data API surface. Public object information remains exposed only
-- through the deliberately granted object_info/object_info_events RPCs.
REVOKE ALL ON TABLE public.admin_users, public.categories, public.event_types,
  public.events, public.groups, public.object_custom_schemas, public.objects,
  public.tenant, public.transfer_requests, public.user_profiles
FROM anon, authenticated;

GRANT SELECT ON TABLE public.admin_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_types TO authenticated;
GRANT SELECT, INSERT ON TABLE public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.object_custom_schemas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.objects TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.tenant TO authenticated;
GRANT SELECT ON TABLE public.transfer_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_users,
  public.categories, public.event_types, public.events, public.groups,
  public.object_custom_schemas, public.objects, public.tenant,
  public.transfer_requests, public.user_profiles TO service_role;

-- Authenticated callers need sequence access only for tables they may insert
-- into directly. Do not expose tenant/transfer sequence state or let arbitrary
-- callers advance sequences owned by service-only workflows.
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT USAGE ON SEQUENCE
  public.categories_id_seq,
  public.event_types_id_seq,
  public.events_id_seq,
  public.groups_id_seq,
  public.object_custom_schemas_id_seq,
  public.objects_id_seq
TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
