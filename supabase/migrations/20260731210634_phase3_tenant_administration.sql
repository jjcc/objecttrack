-- Phase 3: tenant administration services and owner-safety rules.

CREATE OR REPLACE FUNCTION public.enforce_profile_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor_role text := public.current_tenant_role();
  v_owner_count bigint;
BEGIN
  IF OLD.tenant_role IS DISTINCT FROM NEW.tenant_role THEN
    IF NOT public.has_permission('tenant.users.roles.update', NEW.tenant_id) THEN
      RAISE EXCEPTION 'Permission denied: tenant.users.roles.update'
        USING ERRCODE = '42501';
    END IF;

    IF (OLD.tenant_role = 'owner' OR NEW.tenant_role = 'owner')
       AND v_actor_role IS DISTINCT FROM 'owner' THEN
      RAISE EXCEPTION 'Only a tenant owner can grant or remove the owner role'
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

CREATE OR REPLACE FUNCTION public.tenant_admin_profile()
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
  show_object_info_without_authentication boolean
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
    tenant_record.show_object_info_without_authentication
  FROM public.tenant AS tenant_record
  WHERE tenant_record.id = public.current_tenant_id()
    AND public.has_permission('tenant.settings.update', tenant_record.id)
$$;

CREATE OR REPLACE FUNCTION public.update_current_tenant_profile(
  p_institution_name text,
  p_description text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_contact text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_social_media jsonb DEFAULT '{}'::jsonb,
  p_show_object_info_without_authentication boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.settings.update', v_tenant_id) THEN
    RAISE EXCEPTION 'Permission denied: tenant.settings.update'
      USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_institution_name), '') IS NULL THEN
    RAISE EXCEPTION 'Institution name is required' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(p_email), '') IS NOT NULL
     AND p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Institution email is invalid' USING ERRCODE = '22023';
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
    show_object_info_without_authentication =
      p_show_object_info_without_authentication,
    updated_at = now()
  WHERE id = v_tenant_id;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_actor_id,
    v_tenant_id,
    'tenant.settings.updated',
    'tenant',
    v_tenant_id::text,
    jsonb_build_object(
      'fields',
      jsonb_build_array(
        'institution_name',
        'description',
        'address',
        'contact',
        'phone',
        'email',
        'website',
        'social_media',
        'show_object_info_without_authentication'
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_members()
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  email text,
  title text,
  tenant_role text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    profile.id,
    profile.first_name,
    profile.last_name,
    profile.email,
    profile.title,
    profile.tenant_role,
    profile.created_at
  FROM public.user_profiles AS profile
  WHERE profile.tenant_id = public.current_tenant_id()
    AND public.has_permission('tenant.users.roles.update', profile.tenant_id)
  ORDER BY
    CASE profile.tenant_role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
    profile.first_name NULLS LAST,
    profile.last_name NULLS LAST,
    profile.id
$$;

CREATE OR REPLACE FUNCTION public.update_tenant_member_role(
  p_user_id uuid,
  p_tenant_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
  v_previous_role text;
BEGIN
  IF v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.users.roles.update', v_tenant_id) THEN
    RAISE EXCEPTION 'Permission denied: tenant.users.roles.update'
      USING ERRCODE = '42501';
  END IF;
  IF p_tenant_role NOT IN ('member', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Unsupported tenant role' USING ERRCODE = '22023';
  END IF;

  SELECT profile.tenant_role INTO v_previous_role
  FROM public.user_profiles AS profile
  WHERE profile.id = p_user_id
    AND profile.tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant member not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.user_profiles
  SET tenant_role = p_tenant_role
  WHERE id = p_user_id
    AND tenant_id = v_tenant_id;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_actor_id,
    v_tenant_id,
    'tenant.member.role.updated',
    'user_profile',
    p_user_id::text,
    jsonb_build_object(
      'previous_role', v_previous_role,
      'new_role', p_tenant_role
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_tenant_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
  v_actor_role text := public.current_tenant_role();
  v_target_role text;
  v_owner_count bigint;
BEGIN
  IF v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.users.roles.update', v_tenant_id) THEN
    RAISE EXCEPTION 'Permission denied: tenant.users.roles.update'
      USING ERRCODE = '42501';
  END IF;
  IF p_user_id = v_actor_id THEN
    RAISE EXCEPTION 'Administrators cannot remove their own membership'
      USING ERRCODE = '22023';
  END IF;

  SELECT profile.tenant_role INTO v_target_role
  FROM public.user_profiles AS profile
  WHERE profile.id = p_user_id
    AND profile.tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant member not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_target_role = 'owner' THEN
    IF v_actor_role IS DISTINCT FROM 'owner' THEN
      RAISE EXCEPTION 'Only a tenant owner can remove another owner'
        USING ERRCODE = '42501';
    END IF;
    SELECT count(*) INTO v_owner_count
    FROM public.user_profiles AS profile
    WHERE profile.tenant_id = v_tenant_id
      AND profile.tenant_role = 'owner';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'The last tenant owner cannot be removed'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  DELETE FROM public.user_profiles
  WHERE id = p_user_id
    AND tenant_id = v_tenant_id;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_actor_id,
    v_tenant_id,
    'tenant.member.removed',
    'user_profile',
    p_user_id::text,
    jsonb_build_object('previous_role', v_target_role)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tenant_admin_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_current_tenant_profile(
  text, text, text, text, text, text, text, jsonb, boolean
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_members() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_tenant_member_role(uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_tenant_member(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.tenant_admin_profile()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_current_tenant_profile(
  text, text, text, text, text, text, text, jsonb, boolean
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_members()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_tenant_member_role(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_tenant_member(uuid)
  TO authenticated, service_role;
