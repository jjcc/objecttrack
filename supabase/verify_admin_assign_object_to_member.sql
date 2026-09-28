-- Rollback-only verification for admin assignment, reassignment, and unassignment.
-- Run with psql as local postgres after all migrations.

BEGIN;

CREATE TEMP TABLE assignment_fixture (tenant_id bigint, assigned_object_id bigint, denied_object_id bigint);
GRANT SELECT, INSERT ON assignment_fixture TO authenticated;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at, is_sso_user, is_anonymous
) VALUES
  ('99000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'assign-operator@example.test', now(), false, false),
  ('99000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'assign-admin@example.test', now(), false, false),
  ('99000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'assign-member@example.test', now(), false, false),
  ('99000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'assign-member-2@example.test', now(), false, false);

INSERT INTO private.platform_operators (user_id)
VALUES ('99000000-0000-4000-8000-000000000001');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '99000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal2', true);

INSERT INTO assignment_fixture (tenant_id)
SELECT public.provision_tenant('Object assignment fixture', 'fixture-owner@example.test');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
SELECT '99000000-0000-4000-8000-000000000002', tenant_id, 'admin', 'assign-admin@example.test'
FROM assignment_fixture;

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
SELECT '99000000-0000-4000-8000-000000000003', tenant_id, 'member', 'assign-member@example.test'
FROM assignment_fixture;

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
SELECT '99000000-0000-4000-8000-000000000004', tenant_id, 'member', 'assign-member-2@example.test'
FROM assignment_fixture;

INSERT INTO public.objects (tenant_id, name)
SELECT tenant_id, 'Admin assignment fixture'
FROM assignment_fixture;

UPDATE assignment_fixture
SET assigned_object_id = (
  SELECT id FROM public.objects
  WHERE tenant_id = assignment_fixture.tenant_id
    AND name = 'Admin assignment fixture'
);

INSERT INTO public.objects (tenant_id, name)
SELECT tenant_id, 'Assignment permission fixture'
FROM assignment_fixture;

UPDATE assignment_fixture
SET denied_object_id = (
  SELECT id FROM public.objects
  WHERE tenant_id = assignment_fixture.tenant_id
    AND name = 'Assignment permission fixture'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '99000000-0000-4000-8000-000000000002', true);

DO $$
DECLARE
  v_tenant_id bigint;
  v_object_id bigint;
BEGIN
  SELECT tenant_id, assigned_object_id
  INTO v_tenant_id, v_object_id
  FROM assignment_fixture;

  IF v_object_id IS NULL THEN
    RAISE EXCEPTION 'Fixture object was not created';
  END IF;

  PERFORM public.assign_object_to_member(
    v_object_id,
    '99000000-0000-4000-8000-000000000003'
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.objects
    WHERE id = v_object_id
      AND tenant_id = v_tenant_id
      AND current_owner_id = '99000000-0000-4000-8000-000000000003'
  ) THEN
    RAISE EXCEPTION 'Admin assignment did not set the member as current owner';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.events
    WHERE object_id = v_object_id
      AND tenant_id = v_tenant_id
      AND group_id IS NULL
      AND e_from = '99000000-0000-4000-8000-000000000002'
      AND e_to = '99000000-0000-4000-8000-000000000003'
  ) THEN
    RAISE EXCEPTION 'Assignment event was not recorded for an ungrouped object';
  END IF;

  PERFORM public.assign_object_to_member(
    v_object_id,
    '99000000-0000-4000-8000-000000000004'
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.objects
    WHERE id = v_object_id
      AND current_owner_id = '99000000-0000-4000-8000-000000000004'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.events
    WHERE object_id = v_object_id
      AND e_from = '99000000-0000-4000-8000-000000000003'
      AND e_to = '99000000-0000-4000-8000-000000000004'
      AND extra->>'action' = 'reassigned'
  ) THEN
    RAISE EXCEPTION 'Admin reassignment did not update ownership and history';
  END IF;

  PERFORM public.assign_object_to_member(v_object_id, NULL);
  IF NOT EXISTS (
    SELECT 1 FROM public.objects
    WHERE id = v_object_id
      AND current_owner_id IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.events
    WHERE object_id = v_object_id
      AND e_from = '99000000-0000-4000-8000-000000000004'
      AND e_to IS NULL
      AND extra->>'action' = 'unassigned'
  ) THEN
    RAISE EXCEPTION 'Admin unassignment did not clear ownership and record history';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '99000000-0000-4000-8000-000000000003', true);

DO $$
DECLARE
  v_object_id bigint;
  v_denied boolean := false;
BEGIN
  SELECT denied_object_id INTO v_object_id FROM assignment_fixture;
  BEGIN
    PERFORM public.assign_object_to_member(
      v_object_id,
      '99000000-0000-4000-8000-000000000003'
    );
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'A Member assigned an object';
  END IF;
END;
$$;

RESET ROLE;
SELECT 'admin assignment, reassignment, and unassignment verification passed' AS result;
ROLLBACK;
