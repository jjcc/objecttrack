-- Tenant organizations and tenant-scoped object customization.
CREATE TABLE public.tenant (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  institution_name text NOT NULL,
  description text,
  address text,
  contact text,
  phone text,
  email text,
  website text,
  social_media jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_email_format CHECK (
    email IS NULL OR email = '' OR email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  CONSTRAINT tenant_social_media_object CHECK (jsonb_typeof(social_media) = 'object')
);

ALTER TABLE public.tenant ENABLE ROW LEVEL SECURITY;

-- Preserve existing installations by placing current data in one organization.
INSERT INTO public.tenant (institution_name, description)
VALUES ('Default Institution', 'Created automatically for existing application data');

ALTER TABLE public.user_profiles
  ADD COLUMN tenant_id bigint REFERENCES public.tenant(id);
ALTER TABLE public.groups
  ADD COLUMN tenant_id bigint REFERENCES public.tenant(id);
ALTER TABLE public.categories
  ADD COLUMN tenant_id bigint REFERENCES public.tenant(id);
ALTER TABLE public.event_types
  ADD COLUMN tenant_id bigint REFERENCES public.tenant(id);
ALTER TABLE public.objects
  ADD COLUMN tenant_id bigint REFERENCES public.tenant(id),
  ADD COLUMN image text,
  ADD COLUMN extra jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.user_profiles SET tenant_id = (SELECT min(id) FROM public.tenant);
UPDATE public.groups SET tenant_id = (SELECT min(id) FROM public.tenant);
UPDATE public.categories SET tenant_id = (SELECT min(id) FROM public.tenant);
UPDATE public.event_types SET tenant_id = (SELECT min(id) FROM public.tenant);
UPDATE public.objects SET tenant_id = (SELECT min(id) FROM public.tenant);

ALTER TABLE public.user_profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.groups ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.event_types ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.objects ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.objects
  ADD CONSTRAINT objects_extra_object CHECK (jsonb_typeof(extra) = 'object');

CREATE INDEX user_profiles_tenant_id_idx ON public.user_profiles (tenant_id);
CREATE INDEX groups_tenant_id_idx ON public.groups (tenant_id);
CREATE INDEX categories_tenant_id_idx ON public.categories (tenant_id);
CREATE INDEX event_types_tenant_id_idx ON public.event_types (tenant_id);
CREATE INDEX objects_tenant_id_idx ON public.objects (tenant_id);

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tenant_id
  FROM public.user_profiles
  WHERE id = (SELECT auth.uid())
$$;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_current_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Record must belong to the acting user tenant';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER groups_assign_current_tenant
BEFORE INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.assign_current_tenant();
CREATE TRIGGER categories_assign_current_tenant
BEFORE INSERT ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.assign_current_tenant();
CREATE TRIGGER event_types_assign_current_tenant
BEFORE INSERT ON public.event_types
FOR EACH ROW EXECUTE FUNCTION public.assign_current_tenant();
CREATE TRIGGER objects_assign_current_tenant
BEFORE INSERT ON public.objects
FOR EACH ROW EXECUTE FUNCTION public.assign_current_tenant();
CREATE TRIGGER profiles_assign_current_tenant
BEFORE INSERT ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_current_tenant();

CREATE POLICY "Members read own tenant"
ON public.tenant FOR SELECT TO authenticated
USING (id = (SELECT public.current_tenant_id()));

CREATE POLICY "Admins update own tenant"
ON public.tenant FOR UPDATE TO authenticated
USING (
  id = (SELECT public.current_tenant_id())
  AND (SELECT public.is_admin())
)
WITH CHECK (
  id = (SELECT public.current_tenant_id())
  AND (SELECT public.is_admin())
);

CREATE TABLE public.object_custom_schemas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL UNIQUE REFERENCES public.tenant(id) ON DELETE CASCADE,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT object_custom_schema_fields_array CHECK (jsonb_typeof(fields) = 'array')
);

ALTER TABLE public.object_custom_schemas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own object schema"
ON public.object_custom_schemas FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY "Admins create own object schema"
ON public.object_custom_schemas FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = (SELECT public.current_tenant_id())
  AND (SELECT public.is_admin())
);

CREATE POLICY "Admins update own object schema"
ON public.object_custom_schemas FOR UPDATE TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND (SELECT public.is_admin())
)
WITH CHECK (
  tenant_id = (SELECT public.current_tenant_id())
  AND (SELECT public.is_admin())
);

-- Tenant-aware policies supplement existing policies without disrupting current users.
CREATE POLICY "Tenant members read groups"
ON public.groups FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY "Tenant members read categories"
ON public.categories FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY "Tenant members read event types"
ON public.event_types FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY "Tenant members read objects"
ON public.objects FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));

-- Private object image bucket. Standard uploads are appropriate for the 2 MB limit.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'object-images',
  'object-images',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Tenant members view object images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'object-images'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
);

CREATE POLICY "Tenant admins upload object images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'object-images'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
  AND (SELECT public.is_admin())
);

CREATE POLICY "Tenant admins update object images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'object-images'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
  AND (SELECT public.is_admin())
)
WITH CHECK (
  bucket_id = 'object-images'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
  AND (SELECT public.is_admin())
);

CREATE POLICY "Tenant admins delete object images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'object-images'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
  AND (SELECT public.is_admin())
);
