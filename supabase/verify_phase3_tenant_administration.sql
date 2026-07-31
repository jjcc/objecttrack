-- Rollback-only integration verification for Phase 3 tenant administration.

BEGIN;

INSERT INTO public.tenant (
  id, institution_name, description, status, defaults_version
)
OVERRIDING SYSTEM VALUE
VALUES
  (930000001, 'Phase 3 tenant A', 'Original description', 'active', 0),
  (930000002, 'Phase 3 tenant B', 'Cross-tenant fixture', 'active', 0);

INSERT INTO auth.users (id, aud, role, email, is_sso_user, is_anonymous)
VALUES
  ('93000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner1@example.test', false, false),
  ('93000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'owner2@example.test', false, false),
  ('93000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'admin@example.test', false, false),
  ('93000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'member@example.test', false, false),
  ('93000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'cross-owner@example.test', false, false);

INSERT INTO public.user_profiles (
  id, tenant_id, tenant_role, first_name, last_name, email
)
VALUES
  ('93000000-0000-4000-8000-000000000001', 930000001, 'owner', 'Owner', 'One', 'owner1@example.test'),
  ('93000000-0000-4000-8000-000000000002', 930000001, 'owner', 'Owner', 'Two', 'owner2@example.test'),
  ('93000000-0000-4000-8000-000000000003', 930000001, 'admin', 'Tenant', 'Admin', 'admin@example.test'),
  ('93000000-0000-4000-8000-000000000004', 930000001, 'member', 'Tenant', 'Member', 'member@example.test'),
  ('93000000-0000-4000-8000-000000000005', 930000002, 'owner', 'Cross', 'Owner', 'cross-owner@example.test');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub',
  '93000000-0000-4000-8000-000000000004',
  true
);

DO $$
DECLARE
  v_count bigint;
  v_denied boolean := false;
BEGIN
  SELECT count(*) INTO v_count FROM public.tenant_admin_profile();
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Member accessed the tenant administration profile';
  END IF;
  SELECT count(*) INTO v_count FROM public.tenant_members();
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Member accessed the tenant member administration list';
  END IF;
  BEGIN
    PERFORM public.update_current_tenant_profile(
      'Forged member update',
      NULL, NULL, NULL, NULL, NULL, NULL, '{}'::jsonb, true
    );
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Member updated tenant settings';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '93000000-0000-4000-8000-000000000003',
  true
);

DO $$
DECLARE
  v_count bigint;
  v_denied boolean;
BEGIN
  SELECT count(*) INTO v_count FROM public.tenant_members();
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Admin member list is not scoped to its tenant';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.tenant_members()
    WHERE id = '93000000-0000-4000-8000-000000000005'
  ) THEN
    RAISE EXCEPTION 'Admin member list exposed another tenant';
  END IF;

  PERFORM public.update_current_tenant_profile(
    'Phase 3 tenant A updated',
    'Updated and audited',
    '300 Admin Street',
    'Admin Contact',
    '+1 555 0300',
    'phase3@example.test',
    'https://phase3.example.test',
    '{"linkedin":"https://linkedin.example.test/phase3"}'::jsonb,
    false
  );

  PERFORM public.update_tenant_member_role(
    '93000000-0000-4000-8000-000000000004',
    'admin'
  );

  v_denied := false;
  BEGIN
    PERFORM public.update_tenant_member_role(
      '93000000-0000-4000-8000-000000000004',
      'owner'
    );
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Tenant admin granted the owner role';
  END IF;

  v_denied := false;
  BEGIN
    UPDATE public.user_profiles
    SET tenant_role = 'admin'
    WHERE id = '93000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Tenant admin directly demoted an owner';
  END IF;

  v_denied := false;
  BEGIN
    PERFORM public.update_tenant_member_role(
      '93000000-0000-4000-8000-000000000005',
      'admin'
    );
  EXCEPTION WHEN sqlstate 'P0002' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Tenant admin changed another tenant member';
  END IF;

  PERFORM public.remove_tenant_member(
    '93000000-0000-4000-8000-000000000004'
  );

  v_denied := false;
  BEGIN
    PERFORM public.remove_tenant_member(
      '93000000-0000-4000-8000-000000000002'
    );
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Tenant admin removed an owner';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '93000000-0000-4000-8000-000000000001',
  true
);

DO $$
DECLARE
  v_denied boolean := false;
  v_rows bigint;
BEGIN
  PERFORM public.update_tenant_member_role(
    '93000000-0000-4000-8000-000000000002',
    'admin'
  );

  BEGIN
    PERFORM public.update_tenant_member_role(
      '93000000-0000-4000-8000-000000000001',
      'admin'
    );
  EXCEPTION WHEN sqlstate '23514' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'The last owner was demoted';
  END IF;

  DELETE FROM public.user_profiles
  WHERE id = '93000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'The last owner was directly removed';
  END IF;
END;
$$;

RESET ROLE;

DO $$
DECLARE
  v_count bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.tenant
    WHERE id = 930000001
      AND institution_name = 'Phase 3 tenant A updated'
      AND description = 'Updated and audited'
      AND show_object_info_without_authentication = false
      AND status = 'active'
      AND defaults_version = 0
  ) THEN
    RAISE EXCEPTION 'Tenant profile update failed or changed platform-only fields';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = '93000000-0000-4000-8000-000000000004'
  ) THEN
    RAISE EXCEPTION 'Tenant member removal did not persist';
  END IF;

  IF (
    SELECT tenant_role
    FROM public.user_profiles
    WHERE id = '93000000-0000-4000-8000-000000000002'
  ) <> 'admin' THEN
    RAISE EXCEPTION 'Owner-authorized role change did not persist';
  END IF;

  SELECT count(*) INTO v_count
  FROM private.audit_log
  WHERE tenant_id = 930000001
    AND action IN (
      'tenant.settings.updated',
      'tenant.member.role.updated',
      'tenant.member.removed'
    );
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Tenant administration audit events are incomplete';
  END IF;
END;
$$;

SELECT 'phase 3 tenant administration verification passed' AS result;
ROLLBACK;
