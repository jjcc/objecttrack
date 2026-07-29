ALTER TABLE public.tenant
  ADD COLUMN show_object_info_without_authentication boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.object_info(p_object_id bigint)
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
    nullif(
      concat_ws(' ', owner_profile.first_name, owner_profile.last_name),
      ''
    ),
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
      OR (
        (SELECT auth.uid()) IS NOT NULL
        AND object_record.tenant_id = public.current_tenant_id()
      )
    )
$$;

REVOKE ALL ON FUNCTION public.object_info(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.object_info(bigint) TO anon, authenticated;

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
          (SELECT auth.uid()) IS NOT NULL
          AND object_record.tenant_id = public.current_tenant_id()
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_view_object_image(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_object_image(text) TO anon, authenticated;

CREATE POLICY "Visible object images can be read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'object-images'
  AND public.can_view_object_image(name)
);
