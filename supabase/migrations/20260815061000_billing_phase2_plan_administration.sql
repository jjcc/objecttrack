-- Billing Phase 2: plan administration without payment.
--
-- Adds an operator RPC for moving a workspace between plans, and an
-- Owner-facing read of the current plan and its usage.
--
-- `upgrade_tenant_to_full` is deliberately left untouched. It still sets
-- edition = 'full', and private.sync_tenant_plan_edition() derives the business
-- plan from that, so the existing ops flow and the Flutter client keep working
-- with no signature or audit-action change.

CREATE OR REPLACE FUNCTION public.set_tenant_plan(
  p_tenant_id bigint,
  p_plan_code text
)
RETURNS TABLE (tenant_id bigint, plan_code text, edition text, changed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_current_plan text;
  v_current_edition text;
  v_target_edition text;
BEGIN
  IF NOT public.has_permission('platform.tenants.update') THEN
    RAISE EXCEPTION 'AAL2 platform access is required'
      USING ERRCODE = '42501';
  END IF;
  IF p_tenant_id IS NULL OR p_tenant_id <= 0 THEN
    RAISE EXCEPTION 'Invalid tenant ID' USING ERRCODE = '22023';
  END IF;

  SELECT plan.edition
  INTO v_target_edition
  FROM private.subscription_plans AS plan
  WHERE plan.code = p_plan_code
    AND plan.is_active;

  IF v_target_edition IS NULL THEN
    RAISE EXCEPTION 'Unknown or inactive plan' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tenant-plan-change:' || p_tenant_id::text, 0)
  );

  SELECT tenant_record.plan_code, tenant_record.edition
  INTO v_current_plan, v_current_edition
  FROM public.tenant AS tenant_record
  WHERE tenant_record.id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_current_plan = p_plan_code THEN
    RETURN QUERY SELECT p_tenant_id, v_current_plan, v_current_edition, false;
    RETURN;
  END IF;

  UPDATE public.tenant
  SET plan_code = p_plan_code, updated_at = now()
  WHERE id = p_tenant_id;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_actor_id,
    p_tenant_id,
    'tenant.plan.changed',
    'tenant',
    p_tenant_id::text,
    jsonb_build_object(
      'from', v_current_plan,
      'to', p_plan_code,
      'from_edition', v_current_edition,
      'to_edition', v_target_edition
    )
  );

  RETURN QUERY SELECT p_tenant_id, p_plan_code, v_target_edition, true;
END;
$$;

COMMENT ON FUNCTION public.set_tenant_plan(bigint, text) IS
  'AAL2 platform-operator-only, idempotent, audited plan change. The edition '
  'follows the plan through private.sync_tenant_plan_edition(). No tenant data '
  'or identifiers are copied or removed.';

-- Owner-facing read of the current plan and its usage. Gated on the existing
-- Owner-only tenant.billing.manage permission.
CREATE OR REPLACE FUNCTION public.current_tenant_plan()
RETURNS TABLE (
  plan_code text,
  plan_edition text,
  max_users integer,
  max_objects integer,
  active_users bigint,
  object_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    entitlement.plan_code,
    entitlement.edition,
    entitlement.max_users,
    entitlement.max_objects,
    (SELECT count(*) FROM public.user_profiles AS member
      WHERE member.tenant_id = tenant_record.id),
    (SELECT count(*) FROM public.objects AS object_record
      WHERE object_record.tenant_id = tenant_record.id)
  FROM public.user_profiles AS profile
  JOIN public.tenant AS tenant_record
    ON tenant_record.id = profile.tenant_id
  JOIN private.tenant_entitlements AS entitlement
    ON entitlement.tenant_id = tenant_record.id
  WHERE profile.id = (SELECT auth.uid())
    AND tenant_record.status = 'active'
    AND public.has_permission('tenant.billing.manage', tenant_record.id)
$$;

COMMENT ON FUNCTION public.current_tenant_plan() IS
  'Read-only plan and usage for the caller''s workspace. Returns no rows unless '
  'the caller holds tenant.billing.manage, which is Owner-only.';

REVOKE ALL ON FUNCTION public.set_tenant_plan(bigint, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tenant_plan(bigint, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.current_tenant_plan()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_plan()
  TO authenticated, service_role;
