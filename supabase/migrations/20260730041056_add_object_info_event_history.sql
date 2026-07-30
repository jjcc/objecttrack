CREATE OR REPLACE FUNCTION public.object_info_events(p_object_id bigint)
RETURNS TABLE (
  id bigint,
  event_type_label text,
  group_name text,
  from_user_name text,
  to_user_name text,
  created_at timestamptz
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
    nullif(
      concat_ws(' ', from_profile.first_name, from_profile.last_name),
      ''
    ),
    nullif(
      concat_ws(' ', to_profile.first_name, to_profile.last_name),
      ''
    ),
    event_record.created_at
  FROM public.events AS event_record
  JOIN public.objects AS object_record
    ON object_record.id = event_record.object_id
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
      OR (
        (SELECT auth.uid()) IS NOT NULL
        AND object_record.tenant_id = public.current_tenant_id()
      )
    )
  ORDER BY event_record.created_at DESC, event_record.id DESC
  LIMIT 50
$$;

REVOKE ALL ON FUNCTION public.object_info_events(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.object_info_events(bigint) TO anon, authenticated;
