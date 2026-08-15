-- Billing Phase 5: expose the plan catalog for comparison in the UI.
--
-- private.subscription_plans stays unreadable by the authenticated role. This
-- RPC is the only way in, and it returns nothing unless the caller holds the
-- Owner-only tenant.billing.manage permission.
--
-- Prices are not stored in the database. They live in Stripe and the catalog
-- carries only which intervals are purchasable, so a price change in Stripe
-- never requires a migration here.

CREATE OR REPLACE FUNCTION public.billing_plan_catalog()
RETURNS TABLE (
  plan_code text,
  plan_edition text,
  max_users integer,
  max_objects integer,
  custom_categories boolean,
  groups boolean,
  advanced_transfers boolean,
  reports boolean,
  audit_ui boolean,
  sort_order integer,
  is_current boolean,
  has_monthly boolean,
  has_annual boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    plan.code,
    plan.edition,
    plan.max_users,
    plan.max_objects,
    plan.custom_categories,
    plan.groups,
    plan.advanced_transfers,
    plan.reports,
    plan.audit_ui,
    plan.sort_order,
    plan.code = tenant_record.plan_code,
    EXISTS (
      SELECT 1 FROM private.plan_prices AS price
      WHERE price.plan_code = plan.code
        AND price.billing_interval = 'month'
        AND price.is_active
    ),
    EXISTS (
      SELECT 1 FROM private.plan_prices AS price
      WHERE price.plan_code = plan.code
        AND price.billing_interval = 'year'
        AND price.is_active
    )
  FROM private.subscription_plans AS plan
  CROSS JOIN LATERAL (
    SELECT tenant_record.plan_code
    FROM public.user_profiles AS profile
    JOIN public.tenant AS tenant_record
      ON tenant_record.id = profile.tenant_id
    WHERE profile.id = (SELECT auth.uid())
      AND public.has_permission('tenant.billing.manage', tenant_record.id)
  ) AS tenant_record
  WHERE plan.is_active
  ORDER BY plan.sort_order
$$;

REVOKE ALL ON FUNCTION public.billing_plan_catalog()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.billing_plan_catalog()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.billing_plan_catalog() IS
  'Active plans with their entitlements, flagged with the caller''s current '
  'plan. Returns no rows unless the caller holds tenant.billing.manage.';
