-- Rollback-only verification for billing plan administration.
--
-- Asserts that set_tenant_plan is platform-operator-only and AAL2-gated, that
-- it is idempotent and audited, that it drags the edition along, that an
-- unknown plan is rejected, and that current_tenant_plan is Owner-only.
--
-- Run after all current migrations against a local/disposable database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/verify_billing_plan_administration.sql

BEGIN;

INSERT INTO public.tenant (id, institution_name, plan_code)
OVERRIDING SYSTEM VALUE
VALUES (963000001, 'Plan admin workspace', 'free');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('96300000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'plan-admin-owner@example.test', '', now(), now(), now(), '', '', '', ''),
  ('96300000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'plan-admin-member@example.test', '', now(), now(), now(), '', '', '', ''),
  ('96300000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'plan-admin-operator@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
VALUES
  ('96300000-0000-4000-8000-000000000001', 963000001, 'owner', 'plan-admin-owner@example.test'),
  ('96300000-0000-4000-8000-000000000002', 963000001, 'member', 'plan-admin-member@example.test');

INSERT INTO private.platform_operators (user_id)
VALUES ('96300000-0000-4000-8000-000000000003');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- A workspace Owner cannot change the plan -------------------------------

SELECT set_config('request.jwt.claim.aal', 'aal1', true);
SELECT set_config(
  'request.jwt.claim.sub', '96300000-0000-4000-8000-000000000001', true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.set_tenant_plan(963000001, 'business');
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'A workspace Owner changed its own plan';
  END IF;
END;
$$;

-- A platform operator without AAL2 cannot change the plan -----------------

SELECT set_config(
  'request.jwt.claim.sub', '96300000-0000-4000-8000-000000000003', true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.set_tenant_plan(963000001, 'business');
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'An aal1 operator changed a plan';
  END IF;
END;
$$;

-- An AAL2 platform operator can, idempotently and with an audit trail -----

SELECT set_config('request.jwt.claim.aal', 'aal2', true);

DO $$
DECLARE
  v_result record;
  v_audit_count integer;
  v_edition text;
  v_denied boolean := false;
BEGIN
  SELECT * INTO v_result FROM public.set_tenant_plan(963000001, 'business');
  IF NOT v_result.changed THEN
    RAISE EXCEPTION 'First plan change reported no change';
  END IF;
  IF v_result.plan_code <> 'business' OR v_result.edition <> 'full' THEN
    RAISE EXCEPTION 'Plan change returned % / %',
      v_result.plan_code, v_result.edition;
  END IF;

  -- The edition follows the plan.
  SELECT tenant_record.edition INTO v_edition
  FROM public.tenant AS tenant_record WHERE tenant_record.id = 963000001;
  IF v_edition <> 'full' THEN
    RAISE EXCEPTION 'Edition did not follow the plan, got %', v_edition;
  END IF;

  -- Repeating it is a no-op.
  SELECT * INTO v_result FROM public.set_tenant_plan(963000001, 'business');
  IF v_result.changed THEN
    RAISE EXCEPTION 'Repeated plan change was not idempotent';
  END IF;

  -- private.audit_log is not readable by the authenticated role, which is the
  -- point of the schema. Step out to inspect it, then step back in.
  RESET ROLE;
  SELECT count(*) INTO v_audit_count
  FROM private.audit_log
  WHERE tenant_id = 963000001
    AND action = 'tenant.plan.changed';
  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one audit row, found %', v_audit_count;
  END IF;
  SET LOCAL ROLE authenticated;

  -- An unknown plan is rejected.
  BEGIN
    PERFORM public.set_tenant_plan(963000001, 'enterprise');
  EXCEPTION WHEN sqlstate '22023' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'An unknown plan was accepted';
  END IF;

  -- A missing tenant is rejected.
  v_denied := false;
  BEGIN
    PERFORM public.set_tenant_plan(963999999, 'free');
  EXCEPTION WHEN sqlstate 'P0002' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'A missing tenant was accepted';
  END IF;
END;
$$;

-- Downgrading back to free keeps every object; it only blocks new ones ----

DO $$
DECLARE
  v_before bigint;
  v_after bigint;
  v_blocked boolean := false;
BEGIN
  RESET ROLE;
  FOR i IN 1..12 LOOP
    INSERT INTO public.objects (tenant_id, name)
    VALUES (963000001, 'downgrade-object-' || i);
  END LOOP;
  SELECT count(*) INTO v_before FROM public.objects WHERE tenant_id = 963000001;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.aal', 'aal2', true);
  PERFORM set_config(
    'request.jwt.claim.sub', '96300000-0000-4000-8000-000000000003', true
  );
  PERFORM public.set_tenant_plan(963000001, 'free');

  RESET ROLE;
  SELECT count(*) INTO v_after FROM public.objects WHERE tenant_id = 963000001;
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'Downgrade destroyed objects: % before, % after',
      v_before, v_after;
  END IF;

  BEGIN
    INSERT INTO public.objects (tenant_id, name)
    VALUES (963000001, 'over-quota-after-downgrade');
  EXCEPTION WHEN sqlstate 'P0001' THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'An over-quota workspace still created an object';
  END IF;
END;
$$;

-- current_tenant_plan is Owner-only ---------------------------------------

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal1', true);

DO $$
DECLARE
  v_count integer;
  v_plan record;
BEGIN
  PERFORM set_config(
    'request.jwt.claim.sub', '96300000-0000-4000-8000-000000000001', true
  );
  SELECT count(*) INTO v_count FROM public.current_tenant_plan();
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Owner could not read the workspace plan';
  END IF;

  SELECT * INTO v_plan FROM public.current_tenant_plan();
  IF v_plan.plan_code <> 'free' OR v_plan.max_objects <> 10 THEN
    RAISE EXCEPTION 'Owner plan read is wrong: % / %',
      v_plan.plan_code, v_plan.max_objects;
  END IF;
  IF v_plan.object_count <> 12 THEN
    RAISE EXCEPTION 'Owner usage read is wrong: %', v_plan.object_count;
  END IF;

  PERFORM set_config(
    'request.jwt.claim.sub', '96300000-0000-4000-8000-000000000002', true
  );
  SELECT count(*) INTO v_count FROM public.current_tenant_plan();
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'A Member read the workspace plan';
  END IF;
END;
$$;

RESET ROLE;

ROLLBACK;
