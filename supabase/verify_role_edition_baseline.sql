-- Rollback-only regression fixture for the pre-edition role catalog.
--
-- Run after all current migrations against a local/disposable database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/verify_role_edition_baseline.sql

BEGIN;

INSERT INTO public.tenant (id, institution_name)
OVERRIDING SYSTEM VALUE
VALUES
  (970000001, 'Role baseline tenant A'),
  (970000002, 'Role baseline tenant B');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('97000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-a@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'admin-a@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'member-a@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'owner-b@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'operator@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
VALUES
  ('97000000-0000-4000-8000-000000000001', 970000001, 'owner', 'owner-a@example.test'),
  ('97000000-0000-4000-8000-000000000002', 970000001, 'admin', 'admin-a@example.test'),
  ('97000000-0000-4000-8000-000000000003', 970000001, 'member', 'member-a@example.test'),
  ('97000000-0000-4000-8000-000000000004', 970000002, 'owner', 'owner-b@example.test');

INSERT INTO private.platform_operators (user_id)
VALUES ('97000000-0000-4000-8000-000000000005');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal1', true);

SELECT set_config(
  'request.jwt.claim.sub',
  '97000000-0000-4000-8000-000000000003',
  true
);

DO $$
BEGIN
  IF public.current_tenant_id() <> 970000001
     OR public.current_tenant_role() <> 'member' THEN
    RAISE EXCEPTION 'Member tenant context is incorrect';
  END IF;
  IF NOT public.has_permission('tenant.data.read')
     OR NOT public.has_permission('tenant.users.read') THEN
    RAISE EXCEPTION 'Member baseline read permissions are missing';
  END IF;
  IF public.has_permission('tenant.data.update')
     OR public.has_permission('tenant.users.invite')
     OR public.has_permission('tenant.reports.generate')
     OR public.has_permission('tenant.audit.read') THEN
    RAISE EXCEPTION 'Member received a privileged tenant permission';
  END IF;
  IF public.has_permission('tenant.data.read', 970000002) THEN
    RAISE EXCEPTION 'Member permission crossed the tenant boundary';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '97000000-0000-4000-8000-000000000002',
  true
);

DO $$
DECLARE
  v_permission text;
BEGIN
  FOREACH v_permission IN ARRAY ARRAY[
    'tenant.data.read',
    'tenant.data.update',
    'tenant.settings.update',
    'tenant.users.read',
    'tenant.users.invite',
    'tenant.users.roles.update',
    'tenant.reports.generate',
    'tenant.audit.read'
  ] LOOP
    IF NOT public.has_permission(v_permission) THEN
      RAISE EXCEPTION 'Admin baseline permission is missing: %', v_permission;
    END IF;
  END LOOP;
  IF public.has_permission('tenant.data.read', 970000002) THEN
    RAISE EXCEPTION 'Admin permission crossed the tenant boundary';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '97000000-0000-4000-8000-000000000001',
  true
);

DO $$
DECLARE
  v_permission text;
BEGIN
  FOREACH v_permission IN ARRAY ARRAY[
    'tenant.data.read',
    'tenant.data.update',
    'tenant.settings.update',
    'tenant.users.read',
    'tenant.users.invite',
    'tenant.users.roles.update',
    'tenant.reports.generate',
    'tenant.audit.read'
  ] LOOP
    IF NOT public.has_permission(v_permission) THEN
      RAISE EXCEPTION 'Owner baseline permission is missing: %', v_permission;
    END IF;
  END LOOP;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '97000000-0000-4000-8000-000000000005',
  true
);

DO $$
BEGIN
  IF public.is_platform_operator()
     OR public.has_permission('platform.tenants.create') THEN
    RAISE EXCEPTION 'AAL1 Platform Operator received privileged access';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.aal', 'aal2', true);

DO $$
DECLARE
  v_permission text;
BEGIN
  FOREACH v_permission IN ARRAY ARRAY[
    'platform.tenants.create',
    'platform.tenants.update',
    'platform.tenants.suspend',
    'platform.audit.read'
  ] LOOP
    IF NOT public.has_permission(v_permission) THEN
      RAISE EXCEPTION 'Platform Operator permission is missing: %', v_permission;
    END IF;
  END LOOP;
  IF public.has_permission('tenant.data.read') THEN
    RAISE EXCEPTION 'Platform Operator received tenant permission without membership';
  END IF;
END;
$$;

RESET ROLE;

SELECT 'role and edition Phase 0 baseline verification passed' AS result;
ROLLBACK;

