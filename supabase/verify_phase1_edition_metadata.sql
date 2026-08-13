-- Rollback-only verification for Simple/Full edition metadata and entitlements.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.tenant AS tenant_record
    WHERE tenant_record.edition IS DISTINCT FROM 'full'
  ) THEN
    RAISE EXCEPTION 'A pre-existing tenant was not backfilled as full';
  END IF;
END;
$$;

INSERT INTO public.tenant (
  id,
  institution_name,
  edition,
  workspace_kind,
  member_visibility
)
OVERRIDING SYSTEM VALUE
VALUES
  (971000001, 'Phase 1 Full Tenant', 'full', 'business', 'private'),
  (971000002, 'Phase 1 Simple Tenant', 'simple', 'family', 'private'),
  (971000003, 'Phase 1 Suspended Tenant', 'simple', 'other', 'private');

UPDATE public.tenant
SET
  status = 'suspended',
  status_reason = 'Phase 1 verification',
  suspended_at = now()
WHERE id = 971000003;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('97100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'full-owner@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'simple-owner@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'simple-member@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97100000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'suspended-owner@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
VALUES
  ('97100000-0000-4000-8000-000000000001', 971000001, 'owner', 'full-owner@example.test'),
  ('97100000-0000-4000-8000-000000000002', 971000002, 'owner', 'simple-owner@example.test'),
  ('97100000-0000-4000-8000-000000000003', 971000002, 'member', 'simple-member@example.test'),
  ('97100000-0000-4000-8000-000000000004', 971000003, 'owner', 'suspended-owner@example.test');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal1', true);
SELECT set_config(
  'request.jwt.claim.sub',
  '97100000-0000-4000-8000-000000000001',
  true
);

DO $$
DECLARE
  v_context record;
BEGIN
  IF public.current_tenant_edition() <> 'full' THEN
    RAISE EXCEPTION 'Full tenant edition was not resolved';
  END IF;
  SELECT * INTO v_context FROM public.current_tenant_product_context();
  IF v_context.tenant_id <> 971000001
     OR v_context.edition <> 'full'
     OR v_context.max_users IS NOT NULL
     OR v_context.max_objects IS NOT NULL
     OR NOT v_context.custom_categories
     OR NOT v_context.groups
     OR NOT v_context.advanced_transfers
     OR NOT v_context.reports
     OR NOT v_context.audit_ui THEN
    RAISE EXCEPTION 'Full tenant product context is incorrect';
  END IF;
  IF NOT public.has_tenant_entitlement('reports')
     OR public.has_tenant_entitlement('reports', 971000002)
     OR public.has_tenant_entitlement('unknown') THEN
    RAISE EXCEPTION 'Full entitlement or cross-tenant enforcement is incorrect';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '97100000-0000-4000-8000-000000000002',
  true
);

DO $$
DECLARE
  v_context record;
  v_permission_before boolean;
  v_edition_denied boolean := false;
BEGIN
  SELECT * INTO v_context FROM public.current_tenant_product_context();
  IF v_context.tenant_id <> 971000002
     OR v_context.edition <> 'simple'
     OR v_context.workspace_kind <> 'family'
     OR v_context.member_visibility <> 'private'
     OR v_context.max_users <> 5
     OR v_context.max_objects <> 100
     OR v_context.custom_categories
     OR v_context.groups
     OR v_context.advanced_transfers
     OR v_context.reports
     OR v_context.audit_ui THEN
    RAISE EXCEPTION 'Simple tenant product context is incorrect';
  END IF;
  IF public.has_tenant_entitlement('reports')
     OR public.has_tenant_entitlement('groups') THEN
    RAISE EXCEPTION 'Simple tenant received a Full entitlement';
  END IF;

  v_permission_before := public.has_permission('tenant.objects.read_assigned');
  UPDATE public.tenant
  SET workspace_kind = 'club', member_visibility = 'shared'
  WHERE id = 971000002;
  IF public.has_permission('tenant.objects.read_assigned') IS DISTINCT FROM v_permission_before THEN
    RAISE EXCEPTION 'Workspace kind or visibility changed role authorization';
  END IF;

  BEGIN
    UPDATE public.tenant SET edition = 'full' WHERE id = 971000002;
  EXCEPTION WHEN sqlstate '42501' THEN
    v_edition_denied := true;
  END;
  IF NOT v_edition_denied THEN
    RAISE EXCEPTION 'Tenant Owner changed the platform-managed edition';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '97100000-0000-4000-8000-000000000004',
  true
);

DO $$
BEGIN
  IF public.has_tenant_entitlement('groups') THEN
    RAISE EXCEPTION 'Suspended tenant retained active entitlements';
  END IF;
END;
$$;

RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM private.audit_log AS audit
    WHERE audit.tenant_id = 971000002
      AND audit.action = 'tenant.product_configuration.updated'
      AND audit.metadata->'changes' ? 'workspace_kind'
      AND audit.metadata->'changes' ? 'member_visibility'
  ) THEN
    RAISE EXCEPTION 'Workspace product configuration change was not audited';
  END IF;
END;
$$;

SET LOCAL ROLE anon;

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.current_tenant_product_context();
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Anonymous caller executed tenant product context';
  END IF;
END;
$$;

RESET ROLE;

SELECT 'phase 1 edition metadata verification passed' AS result;
ROLLBACK;
