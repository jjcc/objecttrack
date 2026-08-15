-- Rollback-only verification for the billing plan catalog.
--
-- Asserts that plan resolves entitlements, that plan and edition can never
-- disagree, that Free enforces its 10-object limit, that grandfathered Hobby
-- workspaces keep the allowance Simple had, and that plan_code is
-- platform-managed rather than tenant-writable.
--
-- Run after all current migrations against a local/disposable database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/verify_billing_plan_catalog.sql

BEGIN;

-- Catalog shape ------------------------------------------------------------

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM private.subscription_plans;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Expected three seeded plans, found %', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM private.subscription_plans
    WHERE code = 'free' AND edition = 'simple'
      AND max_objects = 10 AND max_users = 2
      AND NOT custom_categories AND NOT groups
      AND NOT advanced_transfers AND NOT reports AND NOT audit_ui
  ) THEN
    RAISE EXCEPTION 'Free plan is not seeded as expected';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM private.subscription_plans
    WHERE code = 'hobby' AND edition = 'simple'
      AND max_objects = 100 AND max_users = 5
  ) THEN
    RAISE EXCEPTION 'Hobby plan must preserve the historical simple allowance';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM private.subscription_plans
    WHERE code = 'business' AND edition = 'full'
      AND max_objects IS NULL AND max_users IS NULL
      AND custom_categories AND groups
      AND advanced_transfers AND reports AND audit_ui
  ) THEN
    RAISE EXCEPTION 'Business plan is not seeded as expected';
  END IF;
END;
$$;

-- Plan and edition stay in step -------------------------------------------

INSERT INTO public.tenant (id, institution_name, edition)
OVERRIDING SYSTEM VALUE
VALUES (964000001, 'Plan default simple', 'simple');

INSERT INTO public.tenant (id, institution_name, plan_code)
OVERRIDING SYSTEM VALUE
VALUES (964000002, 'Plan explicit hobby', 'hobby');

INSERT INTO public.tenant (id, institution_name, edition)
OVERRIDING SYSTEM VALUE
VALUES (964000003, 'Plan default full', 'full');

DO $$
DECLARE
  v_plan text;
  v_edition text;
BEGIN
  SELECT plan_code INTO v_plan FROM public.tenant WHERE id = 964000001;
  IF v_plan <> 'free' THEN
    RAISE EXCEPTION 'A simple workspace with no plan must default to free, got %', v_plan;
  END IF;

  SELECT edition INTO v_edition FROM public.tenant WHERE id = 964000002;
  IF v_edition <> 'simple' THEN
    RAISE EXCEPTION 'Explicit hobby must resolve to the simple edition, got %', v_edition;
  END IF;

  SELECT plan_code INTO v_plan FROM public.tenant WHERE id = 964000003;
  IF v_plan <> 'business' THEN
    RAISE EXCEPTION 'A full workspace with no plan must default to business, got %', v_plan;
  END IF;

  -- Changing the plan drags the edition with it.
  UPDATE public.tenant SET plan_code = 'business' WHERE id = 964000001;
  SELECT edition INTO v_edition FROM public.tenant WHERE id = 964000001;
  IF v_edition <> 'full' THEN
    RAISE EXCEPTION 'Moving to business must switch the edition to full, got %', v_edition;
  END IF;

  -- Changing the edition drags the plan with it.
  UPDATE public.tenant SET edition = 'simple' WHERE id = 964000001;
  SELECT plan_code INTO v_plan FROM public.tenant WHERE id = 964000001;
  IF v_plan <> 'free' THEN
    RAISE EXCEPTION 'Moving to simple must switch the plan to free, got %', v_plan;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenant AS tenant_record
    JOIN private.subscription_plans AS plan ON plan.code = tenant_record.plan_code
    WHERE plan.edition IS DISTINCT FROM tenant_record.edition
  ) THEN
    RAISE EXCEPTION 'A workspace has a plan and edition that disagree';
  END IF;
END;
$$;

-- Free enforces its object ceiling; hobby keeps the historical allowance ----

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('96400000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'plan-free-owner@example.test', '', now(), now(), now(), '', '', '', ''),
  ('96400000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'plan-hobby-owner@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO public.tenant (id, institution_name, plan_code)
OVERRIDING SYSTEM VALUE
VALUES (964000010, 'Free workspace', 'free');

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
VALUES
  ('96400000-0000-4000-8000-000000000001', 964000010, 'owner', 'plan-free-owner@example.test'),
  ('96400000-0000-4000-8000-000000000002', 964000002, 'owner', 'plan-hobby-owner@example.test');

DO $$
DECLARE
  v_blocked boolean := false;
  v_usage record;
BEGIN
  -- Ten objects fit.
  FOR i IN 1..10 LOOP
    INSERT INTO public.objects (tenant_id, name) VALUES (964000010, 'free-object-' || i);
  END LOOP;

  -- The eleventh does not.
  BEGIN
    INSERT INTO public.objects (tenant_id, name) VALUES (964000010, 'free-object-11');
  EXCEPTION WHEN sqlstate 'P0001' THEN
    v_blocked := true;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Free plan did not enforce its 10-object limit';
  END IF;

  -- Usage reports against the plan, not the edition.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claim.sub', '96400000-0000-4000-8000-000000000001', true
  );

  SELECT * INTO v_usage FROM public.current_tenant_usage();
  IF v_usage.max_objects <> 10 OR v_usage.max_users <> 2 THEN
    RAISE EXCEPTION 'Free usage limits are wrong: % objects, % users',
      v_usage.max_objects, v_usage.max_users;
  END IF;
  IF v_usage.object_count <> 10 THEN
    RAISE EXCEPTION 'Free object count is wrong: %', v_usage.object_count;
  END IF;

  PERFORM set_config(
    'request.jwt.claim.sub', '96400000-0000-4000-8000-000000000002', true
  );
  SELECT * INTO v_usage FROM public.current_tenant_usage();
  IF v_usage.max_objects <> 100 OR v_usage.max_users <> 5 THEN
    RAISE EXCEPTION 'Grandfathered hobby limits are wrong: % objects, % users',
      v_usage.max_objects, v_usage.max_users;
  END IF;

  RESET ROLE;
END;
$$;

-- Simple-edition plans carry no Full features -----------------------------

DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claim.sub', '96400000-0000-4000-8000-000000000001', true
  );

  IF public.has_tenant_entitlement('groups')
     OR public.has_tenant_entitlement('reports')
     OR public.has_tenant_entitlement('audit_ui')
     OR public.has_tenant_entitlement('custom_categories')
     OR public.has_tenant_entitlement('advanced_transfers') THEN
    RAISE EXCEPTION 'A free workspace reached a Full-only entitlement';
  END IF;

  RESET ROLE;
END;
$$;

-- plan_code is platform-managed -------------------------------------------

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claim.sub', '96400000-0000-4000-8000-000000000001', true
  );

  BEGIN
    UPDATE public.tenant SET plan_code = 'business' WHERE id = 964000010;
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;

  IF NOT v_denied THEN
    IF EXISTS (
      SELECT 1 FROM public.tenant
      WHERE id = 964000010 AND plan_code = 'business'
    ) THEN
      RAISE EXCEPTION 'A workspace Owner upgraded its own plan';
    END IF;
  END IF;

  RESET ROLE;
END;
$$;

-- The plan catalog read is Owner-only and flags the current plan -----------

-- Clear the acting identity first: the tenant-isolation trigger rejects a
-- profile insert for a tenant other than the acting user's.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('96400000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'plan-catalog-member@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
VALUES ('96400000-0000-4000-8000-000000000003', 964000002, 'member', 'plan-catalog-member@example.test');

DO $$
DECLARE
  v_count integer;
  v_current text;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claim.sub', '96400000-0000-4000-8000-000000000001', true
  );

  SELECT count(*) INTO v_count FROM public.billing_plan_catalog();
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Owner should see three plans, saw %', v_count;
  END IF;

  SELECT plan_code INTO v_current FROM public.billing_plan_catalog()
  WHERE is_current;
  IF v_current <> 'free' THEN
    RAISE EXCEPTION 'Current plan flagged as %, expected free', v_current;
  END IF;

  -- Paid plans are purchasable on both intervals; free has no Stripe price.
  IF EXISTS (
    SELECT 1 FROM public.billing_plan_catalog()
    WHERE plan_code IN ('hobby', 'business')
      AND NOT (has_monthly AND has_annual)
  ) THEN
    RAISE EXCEPTION 'A paid plan is missing an interval price';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.billing_plan_catalog()
    WHERE plan_code = 'free' AND (has_monthly OR has_annual)
  ) THEN
    RAISE EXCEPTION 'The free plan should have no Stripe price';
  END IF;

  PERFORM set_config(
    'request.jwt.claim.sub', '96400000-0000-4000-8000-000000000003', true
  );
  SELECT count(*) INTO v_count FROM public.billing_plan_catalog();
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'A Member read the plan catalog';
  END IF;

  RESET ROLE;
END;
$$;

ROLLBACK;
