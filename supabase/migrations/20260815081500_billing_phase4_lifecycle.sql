-- Billing Phase 4: subscription lifecycle, dunning, and downgrade safety.
--
-- Decision 4 sets a 30-day dunning window with reminders at day 0, 7, 21, and
-- 29. Decision 3 sets the over-quota policy: block creation, never delete.
--
-- Note the grace clock is ours, not Stripe's. Stripe's own retry schedule must
-- be configured not to cancel or mark unpaid before day 30, otherwise the two
-- clocks disagree and a workspace is downgraded early.

ALTER TABLE private.tenant_billing
  ADD COLUMN grace_started_at timestamptz;

COMMENT ON COLUMN private.tenant_billing.grace_started_at IS
  'When the current past_due grace window opened. Null when not in grace.';

-- Reminder ledger. One row per workspace, grace window, and stage, so a
-- reminder is never sent twice for the same window.
CREATE TABLE private.billing_dunning_log (
  tenant_id bigint NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  grace_started_at timestamptz NOT NULL,
  stage_day integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, grace_started_at, stage_day),
  CONSTRAINT billing_dunning_log_stage_check
    CHECK (stage_day IN (0, 7, 21, 29))
);

ALTER TABLE private.billing_dunning_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.billing_dunning_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON private.billing_dunning_log TO service_role;

-- Replaces the Phase 3 version. The only change is grace-window bookkeeping:
-- entering past_due opens a 30-day window, recovering closes it.
CREATE OR REPLACE FUNCTION public.apply_stripe_subscription_event(
  p_secret text,
  p_event jsonb
)
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
    cancel_at_period_end, grace_started_at, grace_until, updated_at
  ) VALUES (
    v_tenant_id,
    p_event ->> 'stripe_customer_id',
    p_event ->> 'stripe_subscription_id',
    v_status,
    v_interval,
    NULLIF(p_event ->> 'current_period_end', '')::timestamptz,
    COALESCE((p_event ->> 'cancel_at_period_end')::boolean, false),
    CASE WHEN v_status = 'past_due' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'past_due' THEN now() + interval '30 days' ELSE NULL END,
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
      -- An existing grace window keeps its original start, so repeated
      -- payment_failed events cannot extend the deadline indefinitely.
      grace_started_at = CASE
        WHEN EXCLUDED.subscription_status = 'past_due'
          THEN COALESCE(billing.grace_started_at, now())
        ELSE NULL
      END,
      grace_until = CASE
        WHEN EXCLUDED.subscription_status = 'past_due'
          THEN COALESCE(billing.grace_started_at, now()) + interval '30 days'
        ELSE NULL
      END,
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

-- Downgrade workspaces whose grace window has expired. Run from the scheduled
-- worker. Never deletes tenant data: it only changes the plan.
CREATE OR REPLACE FUNCTION public.expire_billing_grace()
RETURNS TABLE (tenant_id bigint, previous_plan text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row record;
BEGIN
  FOR v_row IN
    SELECT billing.tenant_id AS id, tenant_record.plan_code AS plan
    FROM private.tenant_billing AS billing
    JOIN public.tenant AS tenant_record
      ON tenant_record.id = billing.tenant_id
    WHERE billing.subscription_status = 'past_due'
      AND billing.grace_until IS NOT NULL
      AND billing.grace_until <= now()
      AND tenant_record.plan_code <> 'free'
    FOR UPDATE OF billing
  LOOP
    UPDATE public.tenant
    SET plan_code = 'free', updated_at = now()
    WHERE id = v_row.id;

    UPDATE private.tenant_billing
    SET grace_started_at = NULL, grace_until = NULL, updated_at = now()
    WHERE private.tenant_billing.tenant_id = v_row.id;

    INSERT INTO private.audit_log (
      actor_id, tenant_id, action, target_type, target_id, metadata
    ) VALUES (
      NULL, v_row.id, 'tenant.plan.changed', 'tenant', v_row.id::text,
      jsonb_build_object(
        'from', v_row.plan, 'to', 'free', 'source', 'grace_expired'
      )
    );

    tenant_id := v_row.id;
    previous_plan := v_row.plan;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Reminders that are due but not yet sent, for the scheduled worker.
CREATE OR REPLACE FUNCTION public.billing_dunning_due()
RETURNS TABLE (
  tenant_id bigint,
  workspace_name text,
  owner_email text,
  stage_day integer,
  grace_started_at timestamptz,
  grace_until timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    billing.tenant_id,
    tenant_record.institution_name,
    owner_profile.email,
    stage.day,
    billing.grace_started_at,
    billing.grace_until
  FROM private.tenant_billing AS billing
  JOIN public.tenant AS tenant_record
    ON tenant_record.id = billing.tenant_id
  CROSS JOIN LATERAL (VALUES (0), (7), (21), (29)) AS stage(day)
  LEFT JOIN LATERAL (
    SELECT profile.email
    FROM public.user_profiles AS profile
    WHERE profile.tenant_id = billing.tenant_id
      AND profile.tenant_role = 'owner'
    ORDER BY profile.id
    LIMIT 1
  ) AS owner_profile ON true
  WHERE billing.subscription_status = 'past_due'
    AND billing.grace_started_at IS NOT NULL
    AND now() >= billing.grace_started_at + (stage.day || ' days')::interval
    AND NOT EXISTS (
      SELECT 1 FROM private.billing_dunning_log AS sent
      WHERE sent.tenant_id = billing.tenant_id
        AND sent.grace_started_at = billing.grace_started_at
        AND sent.stage_day = stage.day
    )
$$;

CREATE OR REPLACE FUNCTION public.record_billing_dunning_sent(
  p_tenant_id bigint,
  p_grace_started_at timestamptz,
  p_stage_day integer
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO private.billing_dunning_log (
    tenant_id, grace_started_at, stage_day
  ) VALUES (
    p_tenant_id, p_grace_started_at, p_stage_day
  )
  ON CONFLICT DO NOTHING
  RETURNING true
$$;

-- Worker-only surface. The scheduled process runs with the service role.
REVOKE ALL ON FUNCTION public.expire_billing_grace()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_billing_grace() TO service_role;

REVOKE ALL ON FUNCTION public.billing_dunning_due()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_dunning_due() TO service_role;

REVOKE ALL ON FUNCTION public.record_billing_dunning_sent(bigint, timestamptz, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_billing_dunning_sent(bigint, timestamptz, integer)
  TO service_role;

-- Owner-visible grace state, so the UI can warn before the deadline.
CREATE OR REPLACE FUNCTION public.current_tenant_billing_status()
RETURNS TABLE (
  subscription_status text,
  grace_until timestamptz,
  cancel_at_period_end boolean,
  current_period_end timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    billing.subscription_status,
    billing.grace_until,
    billing.cancel_at_period_end,
    billing.current_period_end
  FROM public.user_profiles AS profile
  JOIN private.tenant_billing AS billing
    ON billing.tenant_id = profile.tenant_id
  WHERE profile.id = (SELECT auth.uid())
    AND public.has_permission('tenant.billing.manage', profile.tenant_id)
$$;

REVOKE ALL ON FUNCTION public.current_tenant_billing_status()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_billing_status()
  TO authenticated, service_role;
