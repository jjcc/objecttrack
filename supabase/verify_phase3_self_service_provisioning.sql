-- Rollback-only verification for Phase 3 self-service Simple provisioning.

BEGIN;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) VALUES
  ('97300000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'simple-owner@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97300000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'unconfirmed@example.test', '', NULL, now(), now(), '', '', '', ''),
  ('97300000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'existing@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97300000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'limited@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO public.tenant (id, institution_name, edition)
OVERRIDING SYSTEM VALUE
VALUES (973000001, 'Existing Full Tenant', 'full');
INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
VALUES (
  '97300000-0000-4000-8000-000000000003',
  973000001,
  'member',
  'existing@example.test'
);

SET LOCAL ROLE anon;
DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.create_simple_workspace('Anonymous Workspace', 'family');
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Anonymous caller executed Simple provisioning';
  END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal1', true);

SELECT set_config('request.jwt.claim.sub', '97300000-0000-4000-8000-000000000002', true);
DO $$
DECLARE result record;
BEGIN
  SELECT * INTO result
  FROM public.create_simple_workspace('Unconfirmed Workspace', 'family');
  IF result.result_code <> 'email_unconfirmed' OR result.tenant_id IS NOT NULL THEN
    RAISE EXCEPTION 'Unconfirmed user provisioning result is incorrect';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '97300000-0000-4000-8000-000000000003', true);
DO $$
DECLARE result record;
BEGIN
  SELECT * INTO result
  FROM public.create_simple_workspace('Second Workspace', 'business');
  IF result.result_code <> 'already_member' OR result.tenant_id IS NOT NULL THEN
    RAISE EXCEPTION 'Existing member was allowed to provision another workspace';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '97300000-0000-4000-8000-000000000001', true);
DO $$
DECLARE first_result record;
DECLARE replay_result record;
DECLARE category_count bigint;
DECLARE event_type_count bigint;
BEGIN
  SELECT * INTO first_result
  FROM public.create_simple_workspace('Chen Family', 'family');
  IF first_result.result_code <> 'created'
     OR NOT first_result.created
     OR first_result.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Simple workspace was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenant AS tenant_record
    WHERE tenant_record.id = first_result.tenant_id
      AND tenant_record.institution_name = 'Chen Family'
      AND tenant_record.email = 'simple-owner@example.test'
      AND tenant_record.edition = 'simple'
      AND tenant_record.workspace_kind = 'family'
      AND tenant_record.member_visibility = 'private'
      AND tenant_record.status = 'active'
      AND tenant_record.billing_owner_id =
        '97300000-0000-4000-8000-000000000001'
      AND NOT tenant_record.show_object_info_without_authentication
      AND tenant_record.defaults_version > 0
  ) THEN
    RAISE EXCEPTION 'Simple tenant metadata is incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles AS profile
    WHERE profile.id = '97300000-0000-4000-8000-000000000001'
      AND profile.tenant_id = first_result.tenant_id
      AND profile.tenant_role = 'owner'
      AND profile.email = 'simple-owner@example.test'
  ) THEN
    RAISE EXCEPTION 'Authenticated user was not made Simple Owner';
  END IF;

  SELECT count(*) INTO category_count
  FROM public.categories WHERE tenant_id = first_result.tenant_id;
  SELECT count(*) INTO event_type_count
  FROM public.event_types WHERE tenant_id = first_result.tenant_id;
  IF category_count <> 6 OR event_type_count <> 6 THEN
    RAISE EXCEPTION 'Versioned defaults were not installed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.object_custom_schemas
    WHERE tenant_id = first_result.tenant_id AND fields = '[]'::jsonb
  ) THEN
    RAISE EXCEPTION 'Default custom schema is missing';
  END IF;

  SELECT * INTO replay_result
  FROM public.create_simple_workspace('Ignored Replay Name', 'collector');
  IF replay_result.result_code <> 'existing'
     OR replay_result.created
     OR replay_result.tenant_id <> first_result.tenant_id THEN
    RAISE EXCEPTION 'Provisioning replay was not idempotent';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '97300000-0000-4000-8000-000000000004', true);
DO $$
DECLARE result record;
DECLARE attempt_number integer;
BEGIN
  FOR attempt_number IN 1..5 LOOP
    SELECT * INTO result
    FROM public.create_simple_workspace('x', 'family');
  END LOOP;
  SELECT * INTO result
  FROM public.create_simple_workspace('Valid After Limit', 'family');
  IF result.result_code <> 'rate_limited' OR result.tenant_id IS NOT NULL THEN
    RAISE EXCEPTION 'Provisioning attempt rate limit was not enforced';
  END IF;
END;
$$;

RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM private.simple_workspace_provisioning) <> 1 THEN
    RAISE EXCEPTION 'Provisioning ledger contains an unexpected row count';
  END IF;
  IF (SELECT count(*) FROM public.tenant WHERE edition = 'simple') <> 1 THEN
    RAISE EXCEPTION 'Provisioning created duplicate Simple tenants';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.audit_log
    WHERE actor_id = '97300000-0000-4000-8000-000000000001'
      AND action = 'tenant.simple_workspace.created'
  ) THEN
    RAISE EXCEPTION 'Provisioning audit record is missing';
  END IF;
END;
$$;

SELECT 'phase 3 self-service provisioning verification passed' AS result;
ROLLBACK;
