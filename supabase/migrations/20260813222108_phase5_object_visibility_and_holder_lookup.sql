-- Phase 5: edition-aware object visibility and controlled holder lookup.

CREATE OR REPLACE FUNCTION public.can_read_object(
  p_object_id bigint,
  p_tenant_id bigint,
  p_current_holder_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH caller AS (
    SELECT
      profile.id,
      profile.tenant_id,
      profile.tenant_role,
      profile.group_id,
      tenant_record.edition,
      tenant_record.member_visibility
    FROM public.user_profiles AS profile
    JOIN public.tenant AS tenant_record
      ON tenant_record.id = profile.tenant_id
     AND tenant_record.status = 'active'
    WHERE profile.id = (SELECT auth.uid())
      AND profile.tenant_id = p_tenant_id
  )
  SELECT EXISTS (
    SELECT 1
    FROM caller
    WHERE
      public.has_permission('tenant.objects.read_all', p_tenant_id)
      OR (
        public.has_permission('tenant.objects.read_assigned', p_tenant_id)
        AND (
          p_current_holder_id = caller.id
          OR (
            caller.tenant_role = 'member'
            AND caller.edition = 'simple'
            AND caller.member_visibility = 'shared'
          )
          OR (
            caller.tenant_role = 'member'
            AND caller.edition = 'full'
            AND caller.group_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.user_profiles AS holder
              WHERE holder.id = p_current_holder_id
                AND holder.tenant_id = caller.tenant_id
                AND holder.group_id = caller.group_id
            )
          )
        )
      )
      OR (
        (
          public.has_permission('tenant.transfers.participate', p_tenant_id)
          OR public.has_permission('tenant.transfers.manage', p_tenant_id)
        )
        AND EXISTS (
          SELECT 1
          FROM public.transfer_requests AS related_request
          WHERE related_request.object_id = p_object_id
            AND related_request.tenant_id = p_tenant_id
            AND (
              related_request.from_user_id = caller.id
              OR related_request.to_user_id = caller.id
            )
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_read_object(bigint, bigint, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_object(bigint, bigint, uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.can_read_object(bigint, bigint, uuid) IS
  'Authoritative object read predicate: managers read all; Viewer reads assigned; Simple Member follows private/shared; Full Member includes assigned/group scope; related Full transfer participants retain workflow access.';

DROP POLICY IF EXISTS "Authorized users read objects" ON public.objects;
CREATE POLICY "Authorized users read objects"
ON public.objects FOR SELECT TO authenticated
USING (
  public.can_read_object(id, tenant_id, current_owner_id)
);

DROP POLICY IF EXISTS "Authorized users read events" ON public.events;
CREATE POLICY "Authorized users read events"
ON public.events FOR SELECT TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND EXISTS (
    SELECT 1
    FROM public.objects AS related_object
    WHERE related_object.id = events.object_id
      AND related_object.tenant_id = events.tenant_id
      AND public.can_read_object(
        related_object.id,
        related_object.tenant_id,
        related_object.current_owner_id
      )
  )
);

DROP POLICY IF EXISTS "Authorized users read transfer requests"
  ON public.transfer_requests;
CREATE POLICY "Authorized users read transfer requests"
ON public.transfer_requests FOR SELECT TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND public.has_tenant_entitlement('advanced_transfers', tenant_id)
  AND (
    from_user_id = (SELECT auth.uid())
    OR to_user_id = (SELECT auth.uid())
    OR public.has_permission('tenant.transfers.manage', tenant_id)
  )
);

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
WHERE public.has_tenant_entitlement('advanced_transfers', request.tenant_id)
  AND (
    public.has_permission('tenant.transfers.manage', request.tenant_id)
    OR (SELECT auth.uid()) = request.from_user_id
    OR (SELECT auth.uid()) = request.to_user_id
  );

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
        OR public.can_read_object(
          object_record.id,
          object_record.tenant_id,
          object_record.current_owner_id
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_view_object_image(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_object_image(text)
  TO anon, authenticated;

DROP POLICY IF EXISTS "Tenant managers upload object images"
  ON storage.objects;
DROP POLICY IF EXISTS "Tenant managers update object images"
  ON storage.objects;
DROP POLICY IF EXISTS "Tenant managers delete object images"
  ON storage.objects;

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
    nullif(concat_ws(' ', holder_profile.first_name, holder_profile.last_name), ''),
    object_record.created_at
  FROM public.objects AS object_record
  JOIN public.tenant AS tenant_record
    ON tenant_record.id = object_record.tenant_id
  LEFT JOIN public.categories AS category
    ON category.id = object_record.category_id
   AND category.tenant_id = object_record.tenant_id
  LEFT JOIN public.user_profiles AS holder_profile
    ON holder_profile.id = object_record.current_owner_id
   AND holder_profile.tenant_id = object_record.tenant_id
  WHERE object_record.id = p_object_id
    AND (
      tenant_record.show_object_info_without_authentication
      OR public.can_read_object(
        object_record.id,
        object_record.tenant_id,
        object_record.current_owner_id
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
  JOIN public.objects AS object_record
    ON object_record.id = event_record.object_id
   AND object_record.tenant_id = event_record.tenant_id
  JOIN public.tenant AS tenant_record
    ON tenant_record.id = object_record.tenant_id
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
      OR public.can_read_object(
        object_record.id,
        object_record.tenant_id,
        object_record.current_owner_id
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

CREATE OR REPLACE FUNCTION public.lookup_object_holder(p_object_id bigint)
RETURNS TABLE (
  object_id bigint,
  object_name text,
  category_name text,
  model text,
  current_holder_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    object_record.id,
    object_record.name,
    category.name,
    object_record.model,
    nullif(concat_ws(' ', holder.first_name, holder.last_name), '')
  FROM public.user_profiles AS caller
  JOIN public.objects AS object_record
    ON object_record.tenant_id = caller.tenant_id
   AND object_record.id = p_object_id
  LEFT JOIN public.categories AS category
    ON category.id = object_record.category_id
   AND category.tenant_id = object_record.tenant_id
  LEFT JOIN public.user_profiles AS holder
    ON holder.id = object_record.current_owner_id
   AND holder.tenant_id = object_record.tenant_id
  WHERE caller.id = (SELECT auth.uid())
    AND public.has_permission('tenant.holder.lookup', caller.tenant_id)
$$;

REVOKE ALL ON FUNCTION public.lookup_object_holder(bigint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_object_holder(bigint)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.lookup_object_holder(bigint) IS
  'Tenant-scoped object-ID lookup returning only object identity/classification and the current holder display name.';

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
  WHERE caller.group_id IS NOT NULL
    AND profile.group_id = caller.group_id
    AND (
      public.has_permission('tenant.users.read', caller.tenant_id)
      OR public.has_permission('tenant.transfers.participate', caller.tenant_id)
    )
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
      OR (
        public.has_permission('tenant.transfers.participate', caller.tenant_id)
        AND caller.group_id IS NOT NULL
        AND profile.group_id = caller.group_id
      )
    )
$$;

REVOKE ALL ON FUNCTION public.group_profile_directory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_profile_directory()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.profile_names(uuid[])
  TO authenticated, service_role;
