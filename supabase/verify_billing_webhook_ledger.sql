-- Rollback-only verification for the Stripe webhook entry point.
--
-- Asserts secret enforcement, replay protection, plan resolution from the
-- price rather than from caller input, status-to-plan mapping, and that a
-- downgrade never destroys data.
--
-- Run after all current migrations against a local/disposable database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/verify_billing_webhook_ledger.sql

BEGIN;

INSERT INTO public.tenant (id, institution_name, plan_code)
OVERRIDING SYSTEM VALUE
VALUES (962000001, 'Webhook workspace', 'free');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('96200000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'webhook-operator@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO private.platform_operators (user_id)
VALUES ('96200000-0000-4000-8000-000000000001');

-- Setting the secret is AAL2-operator-only -------------------------------

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal1', true);
SELECT set_config(
  'request.jwt.claim.sub', '96200000-0000-4000-8000-000000000001', true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.set_billing_webhook_secret(repeat('a', 40));
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'An aal1 operator set the webhook secret';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.aal', 'aal2', true);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  -- A short secret is rejected.
  BEGIN
    PERFORM public.set_billing_webhook_secret('too-short');
  EXCEPTION WHEN sqlstate '22023' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'A weak webhook secret was accepted';
  END IF;

  PERFORM public.set_billing_webhook_secret(repeat('s', 48));
END;
$$;

RESET ROLE;

-- The secret is stored only as a digest ----------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM private.billing_config
    WHERE webhook_secret_sha256 = repeat('s', 48)
  ) THEN
    RAISE EXCEPTION 'The webhook secret was stored in plaintext';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.billing_config
    WHERE webhook_secret_sha256 IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'The webhook secret was not stored';
  END IF;
END;
$$;

-- A wrong secret is refused, as the anon role would be -------------------

SET LOCAL ROLE anon;

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.apply_stripe_subscription_event(
      repeat('w', 48),
      jsonb_build_object(
        'event_id', 'evt_wrong_secret',
        'event_type', 'customer.subscription.created',
        'tenant_id', 962000001,
        'subscription_status', 'active',
        'stripe_price_id', 'price_1U4eiMExuGi7DZSFZFpw67NI'
      )
    );
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'A wrong webhook secret was accepted';
  END IF;

  -- anon cannot read public.tenant, which is the point. Step out to check.
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.tenant
             WHERE id = 962000001 AND plan_code <> 'free') THEN
    RAISE EXCEPTION 'A refused event still changed the plan';
  END IF;
  SET LOCAL ROLE anon;
END;
$$;

-- A valid event upgrades the workspace ------------------------------------

DO $$
DECLARE
  v_result record;
  v_edition text;
BEGIN
  SELECT * INTO v_result FROM public.apply_stripe_subscription_event(
    repeat('s', 48),
    jsonb_build_object(
      'event_id', 'evt_business_active',
      'event_type', 'customer.subscription.created',
      'tenant_id', 962000001,
      'subscription_status', 'active',
      'stripe_price_id', 'price_1U4eiMExuGi7DZSFZFpw67NI',
      'stripe_customer_id', 'cus_test_1',
      'stripe_subscription_id', 'sub_test_1',
      'current_period_end', '2026-09-15T00:00:00Z',
      'cancel_at_period_end', false
    )
  );

  IF NOT v_result.applied THEN
    RAISE EXCEPTION 'A first-delivery event was not applied';
  END IF;
  IF v_result.resulting_plan_code <> 'business' THEN
    RAISE EXCEPTION 'Business price did not resolve to the business plan, got %',
      v_result.resulting_plan_code;
  END IF;

  RESET ROLE;
  SELECT edition INTO v_edition FROM public.tenant WHERE id = 962000001;
  IF v_edition <> 'full' THEN
    RAISE EXCEPTION 'Edition did not follow the webhook plan change, got %',
      v_edition;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.tenant_billing
    WHERE tenant_id = 962000001
      AND stripe_customer_id = 'cus_test_1'
      AND stripe_subscription_id = 'sub_test_1'
      AND subscription_status = 'active'
      AND billing_interval = 'month'
  ) THEN
    RAISE EXCEPTION 'Subscription state was not recorded';
  END IF;
  SET LOCAL ROLE anon;
END;
$$;

-- Redelivery of the same event applies nothing ----------------------------

DO $$
DECLARE
  v_result record;
  v_audit_count integer;
BEGIN
  SELECT * INTO v_result FROM public.apply_stripe_subscription_event(
    repeat('s', 48),
    jsonb_build_object(
      'event_id', 'evt_business_active',
      'event_type', 'customer.subscription.created',
      'tenant_id', 962000001,
      'subscription_status', 'canceled',
      'stripe_price_id', 'price_1U4eiMExuGi7DZSFZFpw67NI'
    )
  );

  IF v_result.applied THEN
    RAISE EXCEPTION 'A redelivered event was applied twice';
  END IF;

  RESET ROLE;
  IF NOT EXISTS (SELECT 1 FROM public.tenant
                 WHERE id = 962000001 AND plan_code = 'business') THEN
    RAISE EXCEPTION 'A redelivered event downgraded the workspace';
  END IF;

  SELECT count(*) INTO v_audit_count FROM private.audit_log
  WHERE tenant_id = 962000001 AND action = 'tenant.plan.changed';
  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected one audit row, found %', v_audit_count;
  END IF;
  SET LOCAL ROLE anon;
END;
$$;

-- past_due holds the plan during the grace window -------------------------

DO $$
DECLARE
  v_result record;
BEGIN
  SELECT * INTO v_result FROM public.apply_stripe_subscription_event(
    repeat('s', 48),
    jsonb_build_object(
      'event_id', 'evt_past_due',
      'event_type', 'invoice.payment_failed',
      'tenant_id', 962000001,
      'subscription_status', 'past_due',
      'stripe_price_id', 'price_1U4eiMExuGi7DZSFZFpw67NI'
    )
  );
  IF v_result.resulting_plan_code <> 'business' THEN
    RAISE EXCEPTION 'past_due must hold the plan during grace, got %',
      v_result.resulting_plan_code;
  END IF;
END;
$$;

-- Cancellation falls back to free without destroying data -----------------

DO $$
DECLARE
  v_result record;
  v_before bigint;
  v_after bigint;
  v_blocked boolean := false;
BEGIN
  RESET ROLE;
  FOR i IN 1..15 LOOP
    INSERT INTO public.objects (tenant_id, name)
    VALUES (962000001, 'webhook-object-' || i);
  END LOOP;
  SELECT count(*) INTO v_before FROM public.objects WHERE tenant_id = 962000001;
  SET LOCAL ROLE anon;

  SELECT * INTO v_result FROM public.apply_stripe_subscription_event(
    repeat('s', 48),
    jsonb_build_object(
      'event_id', 'evt_canceled',
      'event_type', 'customer.subscription.deleted',
      'tenant_id', 962000001,
      'subscription_status', 'canceled',
      'stripe_price_id', 'price_1U4eiMExuGi7DZSFZFpw67NI'
    )
  );
  IF v_result.resulting_plan_code <> 'free' THEN
    RAISE EXCEPTION 'Cancellation must fall back to free, got %',
      v_result.resulting_plan_code;
  END IF;

  RESET ROLE;
  SELECT count(*) INTO v_after FROM public.objects WHERE tenant_id = 962000001;
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'Cancellation destroyed objects: % before, % after',
      v_before, v_after;
  END IF;

  BEGIN
    INSERT INTO public.objects (tenant_id, name) VALUES (962000001, 'over-quota');
  EXCEPTION WHEN sqlstate 'P0001' THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'An over-quota downgraded workspace still created an object';
  END IF;
  SET LOCAL ROLE anon;
END;
$$;

-- An unknown price cannot buy a paid plan ---------------------------------

DO $$
DECLARE
  v_result record;
BEGIN
  SELECT * INTO v_result FROM public.apply_stripe_subscription_event(
    repeat('s', 48),
    jsonb_build_object(
      'event_id', 'evt_unknown_price',
      'event_type', 'customer.subscription.created',
      'tenant_id', 962000001,
      'subscription_status', 'active',
      'stripe_price_id', 'price_not_in_our_catalog'
    )
  );
  IF v_result.resulting_plan_code <> 'free' THEN
    RAISE EXCEPTION 'An unknown price granted %', v_result.resulting_plan_code;
  END IF;
END;
$$;

-- A malformed event is rejected -------------------------------------------

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.apply_stripe_subscription_event(
      repeat('s', 48),
      jsonb_build_object('event_type', 'customer.subscription.created')
    );
  EXCEPTION WHEN sqlstate '22023' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'A malformed event was accepted';
  END IF;
END;
$$;

RESET ROLE;

ROLLBACK;
