-- Phase 2b: activate granular tenant permissions and edition-aware roles.

DELETE FROM private.role_permissions
WHERE role IN ('viewer', 'member', 'admin', 'owner');

INSERT INTO private.role_permissions (role, permission)
VALUES
  ('viewer', 'tenant.objects.read_assigned'),
  ('viewer', 'tenant.holder.lookup'),
  ('member', 'tenant.objects.read_assigned'),
  ('member', 'tenant.transfers.participate'),
  ('member', 'tenant.holder.lookup'),
  ('admin', 'tenant.admin.access'),
  ('admin', 'tenant.users.read'),
  ('admin', 'tenant.users.invite'),
  ('admin', 'tenant.users.roles.update'),
  ('admin', 'tenant.objects.read_all'),
  ('admin', 'tenant.objects.manage'),
  ('admin', 'tenant.categories.manage'),
  ('admin', 'tenant.event_types.manage'),
  ('admin', 'tenant.custom_fields.manage'),
  ('admin', 'tenant.transfers.participate'),
  ('admin', 'tenant.transfers.manage'),
  ('admin', 'tenant.holder.lookup'),
  ('owner', 'tenant.admin.access'),
  ('owner', 'tenant.settings.update'),
  ('owner', 'tenant.billing.manage'),
  ('owner', 'tenant.owners.manage'),
  ('owner', 'tenant.users.read'),
  ('owner', 'tenant.users.invite'),
  ('owner', 'tenant.users.roles.update'),
  ('owner', 'tenant.objects.read_all'),
  ('owner', 'tenant.objects.manage'),
  ('owner', 'tenant.categories.manage'),
  ('owner', 'tenant.event_types.manage'),
  ('owner', 'tenant.groups.manage'),
  ('owner', 'tenant.custom_fields.manage'),
  ('owner', 'tenant.transfers.participate'),
  ('owner', 'tenant.transfers.manage'),
  ('owner', 'tenant.holder.lookup'),
  ('owner', 'tenant.reports.generate'),
  ('owner', 'tenant.audit.read');

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_permission(
    'tenant.admin.access',
    public.current_tenant_id()
  )
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Compatibility helper. New authorization must check a resource permission.';

CREATE OR REPLACE FUNCTION private.role_allowed_for_tenant(
  p_tenant_id bigint,
  p_tenant_role text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant AS tenant_record
    WHERE tenant_record.id = p_tenant_id
      AND p_tenant_role IN ('viewer', 'member', 'admin', 'owner')
      AND (
        tenant_record.edition = 'full'
        OR (
          tenant_record.edition = 'simple'
          AND p_tenant_role IN ('member', 'owner')
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION private.role_allowed_for_tenant(bigint, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_assign_tenant_role(
  p_tenant_id bigint,
  p_tenant_role text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles AS actor
    JOIN public.tenant AS tenant_record
      ON tenant_record.id = actor.tenant_id
    WHERE actor.id = (SELECT auth.uid())
      AND actor.tenant_id = p_tenant_id
      AND tenant_record.status = 'active'
      AND public.has_permission('tenant.users.roles.update', p_tenant_id)
      AND private.role_allowed_for_tenant(p_tenant_id, p_tenant_role)
      AND (
        p_tenant_role <> 'owner'
        OR public.has_permission('tenant.owners.manage', p_tenant_id)
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_assign_tenant_role(bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_assign_tenant_role(bigint, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.enforce_profile_role_edition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.role_allowed_for_tenant(NEW.tenant_id, NEW.tenant_role) THEN
    RAISE EXCEPTION 'Role is not available for this tenant edition'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_profile_role_edition()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER user_profiles_enforce_role_edition
BEFORE INSERT OR UPDATE OF tenant_id, tenant_role ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION private.enforce_profile_role_edition();

CREATE OR REPLACE FUNCTION public.enforce_profile_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_owner_count bigint;
BEGIN
  IF OLD.tenant_role IS DISTINCT FROM NEW.tenant_role THEN
    IF NOT public.can_assign_tenant_role(NEW.tenant_id, NEW.tenant_role) THEN
      RAISE EXCEPTION 'Permission denied: tenant.users.roles.update'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.tenant_role = 'owner'
       AND NOT public.has_permission('tenant.owners.manage', OLD.tenant_id) THEN
      RAISE EXCEPTION 'Only a tenant owner can remove the owner role'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.tenant_role = 'owner' AND NEW.tenant_role <> 'owner' THEN
      SELECT count(*) INTO v_owner_count
      FROM public.user_profiles AS profile
      WHERE profile.tenant_id = OLD.tenant_id
        AND profile.tenant_role = 'owner';

      IF v_owner_count <= 1 THEN
        RAISE EXCEPTION 'The last tenant owner cannot be demoted'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'admin_users',
        'categories',
        'event_types',
        'events',
        'groups',
        'object_custom_schemas',
        'objects',
        'tenant',
        'transfer_requests',
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

CREATE POLICY "Users read own legacy admin marker"
ON public.admin_users FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()));

CREATE POLICY "Tenant members read tenant"
ON public.tenant FOR SELECT TO authenticated
USING (id = (SELECT public.current_tenant_id()));

CREATE POLICY "Tenant owners update settings"
ON public.tenant FOR UPDATE TO authenticated
USING (public.has_permission('tenant.settings.update', id))
WITH CHECK (public.has_permission('tenant.settings.update', id));

CREATE POLICY "Authorized users read profiles"
ON public.user_profiles FOR SELECT TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND (
    id = (SELECT auth.uid())
    OR public.has_permission('tenant.users.read', tenant_id)
  )
);

CREATE POLICY "Tenant managers create profiles"
ON public.user_profiles FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = (SELECT public.current_tenant_id())
  AND public.can_assign_tenant_role(tenant_id, tenant_role)
);

CREATE POLICY "Tenant managers update profiles"
ON public.user_profiles FOR UPDATE TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND public.has_permission('tenant.users.roles.update', tenant_id)
)
WITH CHECK (
  tenant_id = (SELECT public.current_tenant_id())
  AND public.has_permission('tenant.users.roles.update', tenant_id)
);

CREATE POLICY "Tenant managers delete non-owner profiles"
ON public.user_profiles FOR DELETE TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND public.has_permission('tenant.users.roles.update', tenant_id)
  AND tenant_role <> 'owner'
);

CREATE POLICY "Tenant members read groups"
ON public.groups FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY "Tenant owners create groups"
ON public.groups FOR INSERT TO authenticated
WITH CHECK (public.has_permission('tenant.groups.manage', tenant_id));
CREATE POLICY "Tenant owners update groups"
ON public.groups FOR UPDATE TO authenticated
USING (public.has_permission('tenant.groups.manage', tenant_id))
WITH CHECK (public.has_permission('tenant.groups.manage', tenant_id));
CREATE POLICY "Tenant owners delete groups"
ON public.groups FOR DELETE TO authenticated
USING (public.has_permission('tenant.groups.manage', tenant_id));

CREATE POLICY "Tenant members read categories"
ON public.categories FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY "Tenant managers create categories"
ON public.categories FOR INSERT TO authenticated
WITH CHECK (public.has_permission('tenant.categories.manage', tenant_id));
CREATE POLICY "Tenant managers update categories"
ON public.categories FOR UPDATE TO authenticated
USING (public.has_permission('tenant.categories.manage', tenant_id))
WITH CHECK (public.has_permission('tenant.categories.manage', tenant_id));
CREATE POLICY "Tenant managers delete categories"
ON public.categories FOR DELETE TO authenticated
USING (public.has_permission('tenant.categories.manage', tenant_id));

CREATE POLICY "Tenant members read event types"
ON public.event_types FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY "Tenant managers create event types"
ON public.event_types FOR INSERT TO authenticated
WITH CHECK (public.has_permission('tenant.event_types.manage', tenant_id));
CREATE POLICY "Tenant managers update event types"
ON public.event_types FOR UPDATE TO authenticated
USING (public.has_permission('tenant.event_types.manage', tenant_id))
WITH CHECK (public.has_permission('tenant.event_types.manage', tenant_id));
CREATE POLICY "Tenant managers delete event types"
ON public.event_types FOR DELETE TO authenticated
USING (public.has_permission('tenant.event_types.manage', tenant_id));

CREATE POLICY "Authorized users read objects"
ON public.objects FOR SELECT TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND (
    public.has_permission('tenant.objects.read_all', tenant_id)
    OR (
      public.has_permission('tenant.objects.read_assigned', tenant_id)
      AND current_owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.transfer_requests AS related_request
      WHERE related_request.object_id = objects.id
        AND related_request.tenant_id = objects.tenant_id
        AND (
          related_request.from_user_id = (SELECT auth.uid())
          OR related_request.to_user_id = (SELECT auth.uid())
        )
    )
  )
);

CREATE POLICY "Tenant managers create objects"
ON public.objects FOR INSERT TO authenticated
WITH CHECK (public.has_permission('tenant.objects.manage', tenant_id));
CREATE POLICY "Tenant managers update objects"
ON public.objects FOR UPDATE TO authenticated
USING (public.has_permission('tenant.objects.manage', tenant_id))
WITH CHECK (public.has_permission('tenant.objects.manage', tenant_id));
CREATE POLICY "Tenant managers delete objects"
ON public.objects FOR DELETE TO authenticated
USING (public.has_permission('tenant.objects.manage', tenant_id));

CREATE POLICY "Authorized users read events"
ON public.events FOR SELECT TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND (
    public.has_permission('tenant.objects.read_all', tenant_id)
    OR EXISTS (
      SELECT 1
      FROM public.objects AS visible_object
      WHERE visible_object.id = events.object_id
        AND visible_object.tenant_id = events.tenant_id
        AND visible_object.current_owner_id = (SELECT auth.uid())
        AND public.has_permission(
          'tenant.objects.read_assigned',
          events.tenant_id
        )
    )
  )
);

CREATE POLICY "Tenant managers create events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = (SELECT public.current_tenant_id())
  AND public.has_permission('tenant.objects.manage', tenant_id)
);

CREATE POLICY "Authorized users read transfer requests"
ON public.transfer_requests FOR SELECT TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND (
    from_user_id = (SELECT auth.uid())
    OR to_user_id = (SELECT auth.uid())
    OR public.has_permission('tenant.transfers.manage', tenant_id)
  )
);

CREATE POLICY "Tenant members read custom schema"
ON public.object_custom_schemas FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY "Tenant managers create custom schema"
ON public.object_custom_schemas FOR INSERT TO authenticated
WITH CHECK (public.has_permission('tenant.custom_fields.manage', tenant_id));
CREATE POLICY "Tenant managers update custom schema"
ON public.object_custom_schemas FOR UPDATE TO authenticated
USING (public.has_permission('tenant.custom_fields.manage', tenant_id))
WITH CHECK (public.has_permission('tenant.custom_fields.manage', tenant_id));
CREATE POLICY "Tenant managers delete custom schema"
ON public.object_custom_schemas FOR DELETE TO authenticated
USING (public.has_permission('tenant.custom_fields.manage', tenant_id));

CREATE OR REPLACE VIEW public.transfer_requests_display
WITH (security_barrier = true)
AS
SELECT
  request.id,
  request.status,
  request.reason,
  request.created_at,
  request.updated_at,
  object_record.name AS object_name,
  object_record.description AS object_description,
  object_record.model AS object_model,
  nullif(concat_ws(' ', from_profile.first_name, from_profile.last_name), '')
    AS from_user_full_name,
  nullif(concat_ws(' ', to_profile.first_name, to_profile.last_name), '')
    AS to_user_full_name
FROM public.transfer_requests AS request
JOIN public.objects AS object_record ON object_record.id = request.object_id
LEFT JOIN public.user_profiles AS from_profile
  ON from_profile.id = request.from_user_id
LEFT JOIN public.user_profiles AS to_profile
  ON to_profile.id = request.to_user_id
WHERE public.has_permission('tenant.transfers.manage', request.tenant_id)
   OR (SELECT auth.uid()) = request.from_user_id
   OR (SELECT auth.uid()) = request.to_user_id;

REVOKE ALL ON public.transfer_requests_display FROM PUBLIC, anon;
GRANT SELECT ON public.transfer_requests_display TO authenticated;
ALTER VIEW public.transfer_requests_display SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.can_view_object_image(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.objects AS object_record
    JOIN public.tenant AS tenant_record
      ON tenant_record.id = object_record.tenant_id
    WHERE object_record.image = p_name
      AND (
        tenant_record.show_object_info_without_authentication
        OR (
          object_record.tenant_id = public.current_tenant_id()
          AND (
            public.has_permission(
              'tenant.objects.read_all', object_record.tenant_id
            )
            OR (
              public.has_permission(
                'tenant.objects.read_assigned', object_record.tenant_id
              )
              AND object_record.current_owner_id = (SELECT auth.uid())
            )
          )
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_view_object_image(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_object_image(text)
  TO anon, authenticated;

DROP POLICY IF EXISTS "Tenant members view object images" ON storage.objects;
DROP POLICY IF EXISTS "Visible object images can be read" ON storage.objects;
DROP POLICY IF EXISTS "Tenant admins upload object images" ON storage.objects;
DROP POLICY IF EXISTS "Tenant admins update object images" ON storage.objects;
DROP POLICY IF EXISTS "Tenant admins delete object images" ON storage.objects;

CREATE POLICY "Visible object images can be read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'object-images'
  AND public.can_view_object_image(name)
);

CREATE POLICY "Tenant object managers upload images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'object-images'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
  AND public.has_permission(
    'tenant.objects.manage', (SELECT public.current_tenant_id())
  )
);

CREATE POLICY "Tenant object managers update images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'object-images'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
  AND public.has_permission(
    'tenant.objects.manage', (SELECT public.current_tenant_id())
  )
)
WITH CHECK (
  bucket_id = 'object-images'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
  AND public.has_permission(
    'tenant.objects.manage', (SELECT public.current_tenant_id())
  )
);

CREATE POLICY "Tenant object managers delete images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'object-images'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
  AND public.has_permission(
    'tenant.objects.manage', (SELECT public.current_tenant_id())
  )
);

CREATE OR REPLACE FUNCTION public.object_info(p_object_id bigint)
RETURNS TABLE (
  id bigint, name text, description text, category_name text, model text,
  image text, extra jsonb, institution_name text, owner_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    object_record.id,
    object_record.name,
    CASE
      WHEN length(object_record.description) > 100
        THEN left(object_record.description, 100) || '…'
      ELSE object_record.description
    END,
    category.name,
    object_record.model,
    object_record.image,
    object_record.extra,
    tenant_record.institution_name,
    nullif(concat_ws(' ', owner_profile.first_name, owner_profile.last_name), ''),
    object_record.created_at
  FROM public.objects AS object_record
  JOIN public.tenant AS tenant_record
    ON tenant_record.id = object_record.tenant_id
  LEFT JOIN public.categories AS category
    ON category.id = object_record.category_id
   AND category.tenant_id = object_record.tenant_id
  LEFT JOIN public.user_profiles AS owner_profile
    ON owner_profile.id = object_record.current_owner_id
   AND owner_profile.tenant_id = object_record.tenant_id
  WHERE object_record.id = p_object_id
    AND (
      tenant_record.show_object_info_without_authentication
      OR public.has_permission('tenant.objects.read_all', object_record.tenant_id)
      OR (
        public.has_permission(
          'tenant.objects.read_assigned', object_record.tenant_id
        )
        AND object_record.current_owner_id = (SELECT auth.uid())
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.object_info_events(p_object_id bigint)
RETURNS TABLE (
  id bigint, event_type_label text, group_name text,
  from_user_name text, to_user_name text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    event_record.id,
    event_type.label,
    event_group.title,
    nullif(concat_ws(' ', from_profile.first_name, from_profile.last_name), ''),
    nullif(concat_ws(' ', to_profile.first_name, to_profile.last_name), ''),
    event_record.created_at
  FROM public.events AS event_record
  JOIN public.objects AS object_record ON object_record.id = event_record.object_id
  JOIN public.tenant AS tenant_record ON tenant_record.id = object_record.tenant_id
  LEFT JOIN public.event_types AS event_type
    ON event_type.id = event_record.event_type_id
   AND event_type.tenant_id = object_record.tenant_id
  LEFT JOIN public.groups AS event_group
    ON event_group.id = event_record.group_id
   AND event_group.tenant_id = object_record.tenant_id
  LEFT JOIN public.user_profiles AS from_profile
    ON from_profile.id = event_record.e_from
   AND from_profile.tenant_id = object_record.tenant_id
  LEFT JOIN public.user_profiles AS to_profile
    ON to_profile.id = event_record.e_to
   AND to_profile.tenant_id = object_record.tenant_id
  WHERE event_record.object_id = p_object_id
    AND (
      tenant_record.show_object_info_without_authentication
      OR public.has_permission('tenant.objects.read_all', object_record.tenant_id)
      OR (
        public.has_permission(
          'tenant.objects.read_assigned', object_record.tenant_id
        )
        AND object_record.current_owner_id = (SELECT auth.uid())
      )
    )
  ORDER BY event_record.created_at DESC, event_record.id DESC
  LIMIT 50
$$;

REVOKE ALL ON FUNCTION public.object_info(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.object_info_events(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.object_info(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.object_info_events(bigint)
  TO anon, authenticated;

-- Keep the mature invitation and transfer workflows intact while replacing
-- their two legacy role/permission predicates with the Phase 2 vocabulary.
DO $$
DECLARE
  function_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.create_tenant_invitation(text,text,text,timestamptz)'::regprocedure
  ) INTO function_definition;
  function_definition := replace(
    function_definition,
    $replace$p_intended_role NOT IN ('member', 'admin', 'owner')$replace$,
    $replace$p_intended_role NOT IN ('viewer', 'member', 'admin', 'owner')$replace$
  );
  EXECUTE function_definition;

  SELECT pg_get_functiondef(
    'public.update_tenant_member_role(uuid,text)'::regprocedure
  ) INTO function_definition;
  function_definition := replace(
    function_definition,
    $replace$p_tenant_role NOT IN ('member', 'admin', 'owner')$replace$,
    $replace$p_tenant_role NOT IN ('viewer', 'member', 'admin', 'owner')$replace$
  );
  EXECUTE function_definition;

  SELECT pg_get_functiondef(
    'public.approve_transfer(bigint)'::regprocedure
  ) INTO function_definition;
  function_definition := replace(
    function_definition,
    $replace$public.has_permission('tenant.data.update', v_tenant_id)$replace$,
    $replace$public.has_permission('tenant.transfers.manage', v_tenant_id)$replace$
  );
  EXECUTE function_definition;

  SELECT pg_get_functiondef(
    'public.reject_transfer(bigint,text)'::regprocedure
  ) INTO function_definition;
  function_definition := replace(
    function_definition,
    $replace$public.has_permission('tenant.data.update', v_tenant_id)$replace$,
    $replace$public.has_permission('tenant.transfers.manage', v_tenant_id)$replace$
  );
  EXECUTE function_definition;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_invitation_role_edition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.role_allowed_for_tenant(NEW.tenant_id, NEW.intended_role) THEN
    RAISE EXCEPTION 'Role is not available for this tenant edition'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_invitation_role_edition()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tenant_invitations_enforce_role_edition
BEFORE INSERT OR UPDATE OF tenant_id, intended_role
ON private.tenant_invitations
FOR EACH ROW EXECUTE FUNCTION private.enforce_invitation_role_edition();

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
    RETURN NEW;
  END IF;
  IF NOT public.has_permission('tenant.transfers.participate', tenant_scope)
     AND NOT public.has_permission('tenant.transfers.manage', tenant_scope) THEN
    RAISE EXCEPTION 'Permission denied: tenant.transfers.participate'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_transfer_participation()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER transfer_requests_enforce_participation
BEFORE INSERT OR UPDATE ON public.transfer_requests
FOR EACH ROW EXECUTE FUNCTION private.enforce_transfer_participation();
