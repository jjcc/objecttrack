-- Assignment must be based on the owner FK, not the optional profile name.
DROP FUNCTION public.object_info(bigint);

CREATE FUNCTION public.object_info(p_object_id bigint)
RETURNS TABLE (
  id bigint,
  name text,
  description text,
  category_name text,
  model text,
  image text,
  extra jsonb,
  institution_name text,
  owner_name text,
  created_at timestamptz,
  is_assigned boolean
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
    object_record.created_at,
    object_record.current_owner_id IS NOT NULL
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

REVOKE ALL ON FUNCTION public.object_info(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.object_info(bigint) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
