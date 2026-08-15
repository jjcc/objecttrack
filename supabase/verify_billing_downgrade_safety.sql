-- Rollback-only verification for the subscription lifecycle.
--
-- The central guarantee: a downgrade never destroys or hides tenant data. It
-- blocks creation only. Also covers the 30-day grace window, that repeated
-- payment failures cannot extend the deadline, dunning stage scheduling, and
-- that reminders are never sent twice for the same window.
--
-- Run after all current migrations against a local/disposable database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/verify_billing_downgrade_safety.sql

BEGIN;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('96100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'grace-owner@example.test', '', now(), now(), now(), '', '', '', ''),
  ('96100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'grace-operator@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO public.tenant (id, institution_name, plan_code)
OVERRIDING SYSTEM VALUE
VALUES (961000001, 'Grace workspace', 'business');

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
VALUES ('96100000-0000-4000-8000-000000000001', 961000001, 'owner', 'grace-owner@example.test');

INSERT INTO private.platform_operators (user_id)
VALUES ('96100000-0000-4000-8000-000000000002');

-- 40 objects: comfortably over the free ceiling of 10.
INSERT INTO public.objects (tenant_id, name)
SELECT 961000001, 'grace-object-' || i FROM generate_series(1, 40) AS i;

UPDATE private.billing_config
SET webhook_secret_sha256 = encode(sha256((repeat('g', 48))::bytea), 'hex')
WHERE id;

-- Entering past_due opens a 30-day window and holds the plan --------------

DO $$
DECLARE
  v_result record;
  v_billing record;
BEGIN
  SELECT * INTO v_result FROM public.apply_stripe_subscription_event(
    repeat('g', 48),
    jsonb_build_object(
      'event_id', 'evt_grace_open',
      'event_type', 'invoice.payment_failed',
      'tenant_id', 961000001,
      'subscription_status', 'past_due',
      'stripe_price_id', 'price_1U4eiMExuGi7DZSFZFpw67NI',
      'stripe_customer_id', 'cus_grace',
      'stripe_subscription_id', 'sub_grace'
    )
  );

  IF v_result.resulting_plan_code <> 'business' THEN
    RAISE EXCEPTION 'past_due must hold the paid plan, got %',
      v_result.resulting_plan_code;
  END IF;

  SELECT * INTO v_billing FROM private.tenant_billing
  WHERE tenant_id = 961000001;

  IF v_billing.grace_started_at IS NULL OR v_billing.grace_until IS NULL THEN
    RAISE EXCEPTION 'past_due did not open a grace window';
  END IF;
  IF v_billing.grace_until < now() + interval '29 days'
     OR v_billing.grace_until > now() + interval '31 days' THEN
    RAISE EXCEPTION 'Grace window is not 30 days: %', v_billing.grace_until;
  END IF;
END;
$$;

-- A repeated failure cannot extend the deadline ---------------------------

DO $$
DECLARE
  v_first timestamptz;
  v_second timestamptz;
BEGIN
  SELECT grace_until INTO v_first FROM private.tenant_billing
  WHERE tenant_id = 961000001;

  -- Backdate the window so a naive implementation would visibly reset it.
  UPDATE private.tenant_billing
  SET grace_started_at = now() - interval '10 days',
      grace_until = now() + interval '20 days'
  WHERE tenant_id = 961000001;

  PERFORM public.apply_stripe_subscription_event(
    repeat('g', 48),
    jsonb_build_object(
      'event_id', 'evt_grace_repeat',
      'event_type', 'invoice.payment_failed',
      'tenant_id', 961000001,
      'subscription_status', 'past_due',
      'stripe_price_id', 'price_1U4eiMExuGi7DZSFZFpw67NI'
    )
  );

  SELECT grace_until INTO v_second FROM private.tenant_billing
  WHERE tenant_id = 961000001;

  IF v_second > now() + interval '21 days' THEN
    RAISE EXCEPTION 'A repeated failure extended the grace deadline to %',
      v_second;
  END IF;
END;
$$;

-- Dunning stages become due in order and are recorded once ----------------

DO $$
DECLARE
  v_due integer;
  v_stages integer[];
BEGIN
  -- Ten days in: stages 0 and 7 are due, 21 and 29 are not.
  SELECT count(*), array_agg(stage_day ORDER BY stage_day)
  INTO v_due, v_stages
  FROM public.billing_dunning_due()
  WHERE tenant_id = 961000001;

  IF v_due <> 2 OR v_stages <> ARRAY[0, 7] THEN
    RAISE EXCEPTION 'Expected stages {0,7} due, got % (%)', v_stages, v_due;
  END IF;

  PERFORM public.record_billing_dunning_sent(
    961000001, (SELECT grace_started_at FROM private.tenant_billing
                WHERE tenant_id = 961000001), 0
  );
  PERFORM public.record_billing_dunning_sent(
    961000001, (SELECT grace_started_at FROM private.tenant_billing
                WHERE tenant_id = 961000001), 7
  );

  SELECT count(*) INTO v_due FROM public.billing_dunning_due()
  WHERE tenant_id = 961000001;
  IF v_due <> 0 THEN
    RAISE EXCEPTION 'Recorded reminders are still due: %', v_due;
  END IF;

  -- Recording the same stage twice is a no-op rather than an error.
  PERFORM public.record_billing_dunning_sent(
    961000001, (SELECT grace_started_at FROM private.tenant_billing
                WHERE tenant_id = 961000001), 0
  );
END;
$$;

-- Recovery closes the window and clears the reminder schedule -------------

DO $$
DECLARE
  v_billing record;
BEGIN
  PERFORM public.apply_stripe_subscription_event(
    repeat('g', 48),
    jsonb_build_object(
      'event_id', 'evt_recovered',
      'event_type', 'customer.subscription.updated',
      'tenant_id', 961000001,
      'subscription_status', 'active',
      'stripe_price_id', 'price_1U4eiMExuGi7DZSFZFpw67NI'
    )
  );

  SELECT * INTO v_billing FROM private.tenant_billing WHERE tenant_id = 961000001;
  IF v_billing.grace_until IS NOT NULL OR v_billing.grace_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'Recovery did not close the grace window';
  END IF;
  IF EXISTS (SELECT 1 FROM public.billing_dunning_due()
             WHERE tenant_id = 961000001) THEN
    RAISE EXCEPTION 'Reminders are still due after recovery';
  END IF;
END;
$$;

-- An expired window downgrades, and destroys nothing ----------------------

DO $$
DECLARE
  v_before bigint;
  v_after bigint;
  v_expired integer;
  v_plan text;
  v_blocked boolean := false;
BEGIN
  SELECT count(*) INTO v_before FROM public.objects WHERE tenant_id = 961000001;

  -- Re-enter grace, then age it past the deadline.
  PERFORM public.apply_stripe_subscription_event(
    repeat('g', 48),
    jsonb_build_object(
      'event_id', 'evt_grace_again',
      'event_type', 'invoice.payment_failed',
      'tenant_id', 961000001,
      'subscription_status', 'past_due',
      'stripe_price_id', 'price_1U4eiMExuGi7DZSFZFpw67NI'
    )
  );
  UPDATE private.tenant_billing
  SET grace_started_at = now() - interval '31 days',
      grace_until = now() - interval '1 day'
  WHERE tenant_id = 961000001;

  SELECT count(*) INTO v_expired FROM public.expire_billing_grace();
  IF v_expired <> 1 THEN
    RAISE EXCEPTION 'Expected one expiry, got %', v_expired;
  END IF;

  SELECT plan_code INTO v_plan FROM public.tenant WHERE id = 961000001;
  IF v_plan <> 'free' THEN
    RAISE EXCEPTION 'Expired grace did not downgrade, plan is %', v_plan;
  END IF;

  -- The whole point: 40 objects survive a downgrade to a 10-object plan.
  SELECT count(*) INTO v_after FROM public.objects WHERE tenant_id = 961000001;
  IF v_after <> v_before OR v_after <> 40 THEN
    RAISE EXCEPTION 'Downgrade destroyed objects: % before, % after',
      v_before, v_after;
  END IF;

  -- And they remain readable, not merely present.
  IF NOT EXISTS (
    SELECT 1 FROM public.objects
    WHERE tenant_id = 961000001 AND name = 'grace-object-40'
  ) THEN
    RAISE EXCEPTION 'An object above the new limit became unreadable';
  END IF;

  -- Only creation is blocked.
  BEGIN
    INSERT INTO public.objects (tenant_id, name)
    VALUES (961000001, 'post-downgrade-object');
  EXCEPTION WHEN sqlstate 'P0001' THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'An over-quota workspace still created an object';
  END IF;

  -- Running the sweep again is a no-op.
  SELECT count(*) INTO v_expired FROM public.expire_billing_grace();
  IF v_expired <> 0 THEN
    RAISE EXCEPTION 'The sweep downgraded an already-free workspace';
  END IF;
END;
$$;

-- The lifecycle surface is worker-only ------------------------------------

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal2', true);
SELECT set_config(
  'request.jwt.claim.sub', '96100000-0000-4000-8000-000000000002', true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.expire_billing_grace();
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'A platform operator ran the billing sweep directly';
  END IF;

  v_denied := false;
  BEGIN
    PERFORM public.billing_dunning_due();
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'A platform operator read the dunning queue directly';
  END IF;
END;
$$;

RESET ROLE;

ROLLBACK;
