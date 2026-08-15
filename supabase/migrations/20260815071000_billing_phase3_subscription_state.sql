-- Billing Phase 3 (database half): subscription state, price mapping, and the
-- privileged webhook entry point.
--
-- Decision 5 of the billing plan keeps SUPABASE_SERVICE_ROLE_KEY out of
-- application code. The Stripe webhook route therefore verifies the Stripe
-- signature itself, then calls apply_stripe_subscription_event() with a shared
-- secret. The privileged surface stays in the database, where the rest of the
-- authorization already lives.
--
-- No card data is stored here, ever. Only Stripe identifiers and subscription
-- state.

CREATE TABLE private.plan_prices (
  plan_code text NOT NULL REFERENCES private.subscription_plans(code),
  billing_interval text NOT NULL,
  stripe_price_id text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (plan_code, billing_interval),
  CONSTRAINT plan_prices_interval_check
    CHECK (billing_interval IN ('month', 'year'))
);

ALTER TABLE private.plan_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.plan_prices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.plan_prices TO service_role;

-- Test-mode prices for the Metavues Tech Inc. account. Price identifiers are
-- not secrets. Free has no Stripe price: it is the absence of a subscription.
INSERT INTO private.plan_prices (plan_code, billing_interval, stripe_price_id)
VALUES
  ('hobby',    'month', 'price_1U4eiDExuGi7DZSF9GGh2BS7'),
  ('hobby',    'year',  'price_1U4eiFExuGi7DZSFZqJkutwX'),
  ('business', 'month', 'price_1U4eiMExuGi7DZSFZFpw67NI'),
  ('business', 'year',  'price_1U4eiPExuGi7DZSFEmQqdVkV');

CREATE TABLE private.tenant_billing (
  tenant_id bigint PRIMARY KEY REFERENCES public.tenant(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  subscription_status text,
  billing_interval text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  grace_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_billing_interval_check
    CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year'))
);

ALTER TABLE private.tenant_billing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.tenant_billing FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.tenant_billing TO service_role;

COMMENT ON TABLE private.tenant_billing IS
  'Stripe subscription state per workspace. Never stores card data.';

-- Idempotency and replay ledger. Stripe redelivers events; each one applies at
-- most once.
CREATE TABLE private.billing_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  tenant_id bigint REFERENCES public.tenant(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb
);

ALTER TABLE private.billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.billing_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.billing_events TO service_role;

-- Shared secret for the webhook entry point, stored only as a SHA-256 digest so
-- the plaintext never lives in the database or in a migration.
CREATE TABLE private.billing_config (
  id boolean PRIMARY KEY DEFAULT true,
  webhook_secret_sha256 text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_config_single_row CHECK (id)
);

ALTER TABLE private.billing_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.billing_config FROM PUBLIC, anon, authenticated;

INSERT INTO private.billing_config (id, webhook_secret_sha256) VALUES (true, NULL);

CREATE OR REPLACE FUNCTION public.set_billing_webhook_secret(p_secret text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_permission('platform.tenants.update') THEN
    RAISE EXCEPTION 'AAL2 platform access is required'
      USING ERRCODE = '42501';
  END IF;
  IF p_secret IS NULL OR pg_catalog.length(p_secret) < 32 THEN
    RAISE EXCEPTION 'Webhook secret must be at least 32 characters'
      USING ERRCODE = '22023';
  END IF;

  UPDATE private.billing_config
  SET webhook_secret_sha256 = pg_catalog.encode(
        pg_catalog.sha256(p_secret::bytea), 'hex'
      ),
      updated_at = now()
  WHERE id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_billing_webhook_secret(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_billing_webhook_secret(text)
  TO authenticated;

-- Checkout and portal context for the caller's own workspace.
--
-- The tenant is derived from the caller, never supplied by the client, and the
-- price is resolved from the catalog rather than trusted from a form field.
-- Returns no rows unless the caller holds the Owner-only tenant.billing.manage.
CREATE OR REPLACE FUNCTION public.billing_checkout_context(
  p_plan_code text DEFAULT NULL,
  p_billing_interval text DEFAULT NULL
)
RETURNS TABLE (
  workspace_id bigint,
  stripe_customer_id text,
  stripe_price_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    tenant_record.id,
    billing.stripe_customer_id,
    price.stripe_price_id
  FROM public.user_profiles AS profile
  JOIN public.tenant AS tenant_record
    ON tenant_record.id = profile.tenant_id
  LEFT JOIN private.tenant_billing AS billing
    ON billing.tenant_id = tenant_record.id
  LEFT JOIN private.plan_prices AS price
    ON price.plan_code = p_plan_code
   AND price.billing_interval = p_billing_interval
   AND price.is_active
  WHERE profile.id = (SELECT auth.uid())
    AND tenant_record.status = 'active'
    AND public.has_permission('tenant.billing.manage', tenant_record.id)
$$;

REVOKE ALL ON FUNCTION public.billing_checkout_context(text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.billing_checkout_context(text, text)
  TO authenticated, service_role;

-- Map a Stripe subscription status to the plan a workspace should hold.
-- 'active' and 'trialing' hold the purchased plan. 'past_due' keeps it during
-- the grace window. Anything terminal falls back to free.
CREATE OR REPLACE FUNCTION private.plan_for_subscription_status(
  p_status text,
  p_purchased_plan text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_status IN ('active', 'trialing', 'past_due') THEN p_purchased_plan
    ELSE 'free'
  END
$$;

-- The privileged webhook entry point.
--
-- Callable by the anon role because a Stripe webhook carries no user session.
-- Authorization is the shared secret, which the caller proves knowledge of, and
-- the Stripe signature the route verifies before ever reaching here.
CREATE OR REPLACE FUNCTION public.apply_stripe_subscription_event(
  p_secret text,
  p_event jsonb
)
-- Output columns are deliberately not named tenant_id/plan_code: RETURNS TABLE
-- declares them as plpgsql variables, which would collide with the identically
-- named columns in ON CONFLICT and UPDATE targets below.
RETURNS TABLE (applied boolean, event_tenant_id bigint, resulting_plan_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expected text;
  v_event_id text := p_event ->> 'event_id';
  v_event_type text := p_event ->> 'event_type';
  v_tenant_id bigint := (p_event ->> 'tenant_id')::bigint;
  v_status text := p_event ->> 'subscription_status';
  v_price_id text := p_event ->> 'stripe_price_id';
  v_purchased_plan text;
  v_interval text;
  v_target_plan text;
  v_current_plan text;
  v_inserted boolean := false;
BEGIN
  SELECT config.webhook_secret_sha256 INTO v_expected
  FROM private.billing_config AS config
  WHERE config.id;

  IF v_expected IS NULL
     OR p_secret IS NULL
     OR pg_catalog.encode(pg_catalog.sha256(p_secret::bytea), 'hex')
        IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'Invalid billing webhook credentials'
      USING ERRCODE = '42501';
  END IF;

  IF v_event_id IS NULL OR v_event_type IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Malformed billing event' USING ERRCODE = '22023';
  END IF;

  -- Replay protection. A redelivered event inserts nothing and applies nothing.
  INSERT INTO private.billing_events (
    stripe_event_id, event_type, tenant_id, payload
  ) VALUES (
    v_event_id, v_event_type, v_tenant_id, p_event
  )
  ON CONFLICT (stripe_event_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF NOT v_inserted THEN
    SELECT tenant_record.plan_code INTO v_current_plan
    FROM public.tenant AS tenant_record
    WHERE tenant_record.id = v_tenant_id;
    RETURN QUERY SELECT false, v_tenant_id, v_current_plan;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tenant-plan-change:' || v_tenant_id::text, 0)
  );

  -- Resolve the purchased plan from the price, never from client input.
  SELECT price.plan_code, price.billing_interval
  INTO v_purchased_plan, v_interval
  FROM private.plan_prices AS price
  WHERE price.stripe_price_id = v_price_id;

  v_target_plan := private.plan_for_subscription_status(
    v_status, COALESCE(v_purchased_plan, 'free')
  );

  INSERT INTO private.tenant_billing AS billing (
    tenant_id, stripe_customer_id, stripe_subscription_id,
    subscription_status, billing_interval, current_period_end,
    cancel_at_period_end, updated_at
  ) VALUES (
    v_tenant_id,
    p_event ->> 'stripe_customer_id',
    p_event ->> 'stripe_subscription_id',
    v_status,
    v_interval,
    NULLIF(p_event ->> 'current_period_end', '')::timestamptz,
    COALESCE((p_event ->> 'cancel_at_period_end')::boolean, false),
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE
  SET stripe_customer_id = COALESCE(
        EXCLUDED.stripe_customer_id, billing.stripe_customer_id
      ),
      stripe_subscription_id = COALESCE(
        EXCLUDED.stripe_subscription_id, billing.stripe_subscription_id
      ),
      subscription_status = EXCLUDED.subscription_status,
      billing_interval = COALESCE(
        EXCLUDED.billing_interval, billing.billing_interval
      ),
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      updated_at = now();

  SELECT tenant_record.plan_code INTO v_current_plan
  FROM public.tenant AS tenant_record
  WHERE tenant_record.id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_current_plan IS DISTINCT FROM v_target_plan THEN
    UPDATE public.tenant
    SET plan_code = v_target_plan, updated_at = now()
    WHERE id = v_tenant_id;

    INSERT INTO private.audit_log (
      actor_id, tenant_id, action, target_type, target_id, metadata
    ) VALUES (
      NULL,
      v_tenant_id,
      'tenant.plan.changed',
      'tenant',
      v_tenant_id::text,
      jsonb_build_object(
        'from', v_current_plan,
        'to', v_target_plan,
        'source', 'stripe_webhook',
        'stripe_event_id', v_event_id,
        'subscription_status', v_status
      )
    );
  END IF;

  RETURN QUERY SELECT true, v_tenant_id, v_target_plan;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(text, jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription_event(text, jsonb)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.apply_stripe_subscription_event(text, jsonb) IS
  'Applies a verified Stripe subscription event. Authorization is a shared '
  'secret so that the service role key stays out of application code. '
  'Idempotent: a redelivered stripe_event_id applies nothing.';
