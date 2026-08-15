-- Rollback-only verification for the Admin/Owner permission split.
--
-- Asserts that Admin gained the two operational permissions, that Owner kept
-- the governance core exclusively, and that edition entitlements still gate
-- both permissions independently of role.
--
-- Run after all current migrations against a local/disposable database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/verify_admin_operational_permissions.sql

BEGIN;

INSERT INTO public.tenant (id, institution_name, edition)
OVERRIDING SYSTEM VALUE
VALUES
  (960000001, 'Admin split full tenant', 'full'),
  (960000002, 'Admin split simple tenant', 'simple');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('96000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'split-owner@example.test', '', now(), now(), now(), '', '', '', ''),
  ('96000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'split-admin@example.test', '', now(), now(), now(), '', '', '', ''),
  ('96000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'split-member@example.test', '', now(), now(), now(), '', '', '', ''),
  ('96000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'split-simple-owner@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
VALUES
  ('96000000-0000-4000-8000-000000000001', 960000001, 'owner', 'split-owner@example.test'),
  ('96000000-0000-4000-8000-000000000002', 960000001, 'admin', 'split-admin@example.test'),
  ('96000000-0000-4000-8000-000000000003', 960000001, 'member', 'split-member@example.test'),
  ('96000000-0000-4000-8000-000000000004', 960000002, 'owner', 'split-simple-owner@example.test');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal1', true);

-- Full-edition Admin: gained operational permissions, still denied governance.
SELECT set_config(
  'request.jwt.claim.sub',
  '96000000-0000-4000-8000-000000000002',
  true
);

DO $$
BEGIN
  IF public.current_tenant_role() <> 'admin' THEN
    RAISE EXCEPTION 'Admin tenant context is incorrect';
  END IF;
  IF NOT public.has_permission('tenant.groups.manage') THEN
    RAISE EXCEPTION 'Admin should now manage groups';
  END IF;
  IF NOT public.has_permission('tenant.reports.generate') THEN
    RAISE EXCEPTION 'Admin should now generate reports';
  END IF;
  IF public.has_permission('tenant.settings.update')
     OR public.has_permission('tenant.billing.manage')
     OR public.has_permission('tenant.owners.manage')
     OR public.has_permission('tenant.audit.read') THEN
    RAISE EXCEPTION 'Admin must not hold governance permissions';
  END IF;
END;
$$;

-- Admin can act on groups through RLS, not merely hold the permission.
INSERT INTO public.groups (tenant_id, title)
VALUES (960000001, 'Admin created group');

-- Full-edition Owner: retains everything, including the governance core.
SELECT set_config(
  'request.jwt.claim.sub',
  '96000000-0000-4000-8000-000000000001',
  true
);

DO $$
BEGIN
  IF NOT public.has_permission('tenant.groups.manage')
     OR NOT public.has_permission('tenant.reports.generate')
     OR NOT public.has_permission('tenant.settings.update')
     OR NOT public.has_permission('tenant.billing.manage')
     OR NOT public.has_permission('tenant.owners.manage')
     OR NOT public.has_permission('tenant.audit.read') THEN
    RAISE EXCEPTION 'Owner lost a permission it must retain';
  END IF;
END;
$$;

-- Full-edition Member: unaffected by the split.
SELECT set_config(
  'request.jwt.claim.sub',
  '96000000-0000-4000-8000-000000000003',
  true
);

DO $$
DECLARE
  v_blocked boolean := false;
BEGIN
  IF public.has_permission('tenant.groups.manage')
     OR public.has_permission('tenant.reports.generate') THEN
    RAISE EXCEPTION 'Member must not gain operational permissions';
  END IF;

  BEGIN
    INSERT INTO public.groups (tenant_id, title)
    VALUES (960000001, 'Member created group');
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_blocked := true;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Member group insert must be blocked by RLS';
  END IF;
END;
$$;

-- Simple-edition Owner: entitlements still gate both permissions, proving the
-- split did not leak Full-only features into Simple workspaces.
SELECT set_config(
  'request.jwt.claim.sub',
  '96000000-0000-4000-8000-000000000004',
  true
);

DO $$
BEGIN
  IF public.current_tenant_role() <> 'owner' THEN
    RAISE EXCEPTION 'Simple owner tenant context is incorrect';
  END IF;
  IF public.has_permission('tenant.groups.manage') THEN
    RAISE EXCEPTION 'Simple workspaces must not reach group management';
  END IF;
  IF public.has_permission('tenant.reports.generate') THEN
    RAISE EXCEPTION 'Simple workspaces must not reach report generation';
  END IF;
END;
$$;

RESET ROLE;

ROLLBACK;
