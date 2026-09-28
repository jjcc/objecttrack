-- Rollback-only verification for guarded accidental-workspace deletion.
-- Run with psql as local postgres after all migrations.

BEGIN;

CREATE TEMP TABLE accidental_workspace_result (
  tenant_id bigint NOT NULL,
  owner_id uuid NOT NULL
);
GRANT SELECT, INSERT ON accidental_workspace_result TO authenticated;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at, is_sso_user, is_anonymous
) VALUES
  (
    '98000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'operator-delete@example.test', now(),
    false, false
  ),
  (
    '98000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'accidental-owner@example.test', now(),
    false, false
  ),
  (
    '98000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'workspace-with-data@example.test', now(),
    false, false
  );

INSERT INTO private.platform_operators (user_id)
VALUES ('98000000-0000-4000-8000-000000000001');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '98000000-0000-4000-8000-000000000002',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO accidental_workspace_result (tenant_id, owner_id)
SELECT tenant_id, '98000000-0000-4000-8000-000000000002'::uuid
FROM public.create_simple_workspace('Accidental workspace', 'other');

SELECT set_config(
  'request.jwt.claim.sub',
  '98000000-0000-4000-8000-000000000003',
  true
);

INSERT INTO accidental_workspace_result (tenant_id, owner_id)
SELECT tenant_id, '98000000-0000-4000-8000-000000000003'::uuid
FROM public.create_simple_workspace('Workspace with data', 'other');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO public.objects (name, tenant_id)
SELECT 'Deletion blocker', tenant_id
FROM accidental_workspace_result
WHERE owner_id = '98000000-0000-4000-8000-000000000003';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '98000000-0000-4000-8000-000000000001',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal2', true);

DO $$
DECLARE
  v_tenant_id bigint;
  v_blocked boolean := false;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM accidental_workspace_result
  WHERE owner_id = '98000000-0000-4000-8000-000000000002';

  BEGIN
    PERFORM public.delete_accidental_workspace(
      v_tenant_id,
      'Wrong workspace name',
      'Must be blocked'
    );
  EXCEPTION WHEN sqlstate '22023' THEN
    v_blocked := true;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Incorrect workspace-name confirmation was accepted';
  END IF;
END;
$$;

-- Production installations may intentionally precede the optional billing
-- migrations. Verify that the cleanup still works when that relation is absent.
RESET ROLE;
ALTER TABLE private.tenant_billing
  RENAME TO tenant_billing_verification_backup;
SET LOCAL ROLE authenticated;

SELECT public.delete_accidental_workspace(
  tenant_id,
  'Accidental workspace',
  'Owner created a workspace before accepting the institute invitation'
)
FROM accidental_workspace_result
WHERE owner_id = '98000000-0000-4000-8000-000000000002';

RESET ROLE;
ALTER TABLE private.tenant_billing_verification_backup
  RENAME TO tenant_billing;
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_tenant_id bigint;
  v_blocked boolean := false;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM accidental_workspace_result
  WHERE owner_id = '98000000-0000-4000-8000-000000000003';

  BEGIN
    PERFORM public.delete_accidental_workspace(
      v_tenant_id,
      'Workspace with data',
      'Must be blocked'
    );
  EXCEPTION WHEN sqlstate '55000' THEN
    v_blocked := true;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Workspace containing an object was deleted';
  END IF;
END;
$$;

RESET ROLE;

DO $$
DECLARE
  v_deleted_tenant_id bigint;
  v_blocked_tenant_id bigint;
BEGIN
  SELECT tenant_id INTO v_deleted_tenant_id
  FROM accidental_workspace_result
  WHERE owner_id = '98000000-0000-4000-8000-000000000002';

  SELECT tenant_id INTO v_blocked_tenant_id
  FROM accidental_workspace_result
  WHERE owner_id = '98000000-0000-4000-8000-000000000003';

  IF EXISTS (SELECT 1 FROM public.tenant WHERE id = v_deleted_tenant_id) THEN
    RAISE EXCEPTION 'Accidental workspace still exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = '98000000-0000-4000-8000-000000000002'
  ) THEN
    RAISE EXCEPTION 'Obsolete workspace membership still exists';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = '98000000-0000-4000-8000-000000000002'
  ) THEN
    RAISE EXCEPTION 'The owner auth account was deleted';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.audit_log
    WHERE tenant_id = v_deleted_tenant_id
      AND action = 'tenant.accidental_workspace.deleted'
      AND metadata->>'owner_email' = 'accidental-owner@example.test'
  ) THEN
    RAISE EXCEPTION 'Deletion audit event was not retained';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant WHERE id = v_blocked_tenant_id) THEN
    RAISE EXCEPTION 'Blocked workspace was modified';
  END IF;
END;
$$;

SELECT 'accidental workspace deletion verification passed' AS result;
ROLLBACK;
