-- Rollback-only verification for Phase 2 granular tenant roles.

BEGIN;

INSERT INTO public.tenant (id, institution_name, edition, workspace_kind)
OVERRIDING SYSTEM VALUE
VALUES
  (972000001, 'Phase 2 Full', 'full', 'business'),
  (972000002, 'Phase 2 Simple', 'simple', 'family');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) VALUES
  ('97200000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97200000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'admin@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97200000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'member@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97200000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'viewer@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97200000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'simple-owner@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
VALUES
  ('97200000-0000-4000-8000-000000000001', 972000001, 'owner', 'owner@example.test'),
  ('97200000-0000-4000-8000-000000000002', 972000001, 'admin', 'admin@example.test'),
  ('97200000-0000-4000-8000-000000000003', 972000001, 'member', 'member@example.test'),
  ('97200000-0000-4000-8000-000000000004', 972000001, 'viewer', 'viewer@example.test'),
  ('97200000-0000-4000-8000-000000000005', 972000002, 'owner', 'simple-owner@example.test');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal1', true);

SELECT set_config('request.jwt.claim.sub', '97200000-0000-4000-8000-000000000002', true);
DO $$
DECLARE permission_name text;
BEGIN
  FOREACH permission_name IN ARRAY ARRAY[
    'tenant.admin.access', 'tenant.users.read', 'tenant.users.invite',
    'tenant.users.roles.update', 'tenant.objects.read_all',
    'tenant.objects.manage', 'tenant.categories.manage',
    'tenant.event_types.manage', 'tenant.custom_fields.manage',
    'tenant.transfers.participate', 'tenant.transfers.manage',
    'tenant.holder.lookup',
    -- Operational permissions moved from Owner to Admin on 2026-08-14.
    'tenant.groups.manage', 'tenant.reports.generate'
  ] LOOP
    IF NOT public.has_permission(permission_name) THEN
      RAISE EXCEPTION 'Admin permission missing: %', permission_name;
    END IF;
  END LOOP;
  -- The remaining Owner governance core stays exclusive.
  FOREACH permission_name IN ARRAY ARRAY[
    'tenant.settings.update', 'tenant.billing.manage',
    'tenant.owners.manage', 'tenant.audit.read'
  ] LOOP
    IF public.has_permission(permission_name) THEN
      RAISE EXCEPTION 'Admin received Owner permission: %', permission_name;
    END IF;
  END LOOP;
  IF public.can_assign_tenant_role(972000001, 'owner')
     OR NOT public.can_assign_tenant_role(972000001, 'viewer') THEN
    RAISE EXCEPTION 'Admin role assignment boundary is incorrect';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '97200000-0000-4000-8000-000000000003', true);
DO $$
BEGIN
  IF NOT public.has_permission('tenant.objects.read_assigned')
     OR NOT public.has_permission('tenant.transfers.participate')
     OR public.has_permission('tenant.objects.read_all')
     OR public.has_permission('tenant.admin.access') THEN
    RAISE EXCEPTION 'Member permission boundary is incorrect';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '97200000-0000-4000-8000-000000000004', true);
DO $$
BEGIN
  IF NOT public.has_permission('tenant.objects.read_assigned')
     OR NOT public.has_permission('tenant.holder.lookup')
     OR public.has_permission('tenant.transfers.participate')
     OR public.has_permission('tenant.users.read') THEN
    RAISE EXCEPTION 'Viewer permission boundary is incorrect';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '97200000-0000-4000-8000-000000000001', true);
DO $$
BEGIN
  IF NOT public.has_permission('tenant.settings.update')
     OR NOT public.has_permission('tenant.owners.manage')
     OR NOT public.has_permission('tenant.groups.manage')
     OR NOT public.can_assign_tenant_role(972000001, 'owner') THEN
    RAISE EXCEPTION 'Owner governance permission is missing';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '97200000-0000-4000-8000-000000000005', true);
DO $$
DECLARE rejected boolean := false;
BEGIN
  IF public.can_assign_tenant_role(972000002, 'admin')
     OR public.can_assign_tenant_role(972000002, 'viewer')
     OR NOT public.can_assign_tenant_role(972000002, 'member') THEN
    RAISE EXCEPTION 'Simple-edition role boundary is incorrect';
  END IF;
  BEGIN
    INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
    VALUES ('97200000-0000-4000-8000-000000000006', 972000002, 'admin', 'blocked@example.test');
  EXCEPTION WHEN sqlstate '22023' THEN
    rejected := true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'Simple tenant accepted an Admin profile';
  END IF;
END;
$$;

RESET ROLE;
SELECT 'phase 2 granular roles verification passed' AS result;
ROLLBACK;
