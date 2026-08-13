-- Rollback-only integration verification for Phase 2 tenant operations.
-- Run with psql as local postgres after all migrations.

BEGIN;

CREATE TEMP TABLE phase2_result (tenant_id bigint NOT NULL);
GRANT SELECT, INSERT ON phase2_result TO authenticated;

INSERT INTO auth.users (id, aud, role, email, is_sso_user, is_anonymous)
VALUES
  (
    '92000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'operator@example.test',
    false,
    false
  ),
  (
    '92000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'regular@example.test',
    false,
    false
  ),
  (
    '92000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'tenant-admin@example.test',
    false,
    false
  );

INSERT INTO private.platform_operators (user_id)
VALUES ('92000000-0000-4000-8000-000000000001');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '92000000-0000-4000-8000-000000000002',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.provision_tenant(
      'Unauthorized tenant',
      'owner@example.test'
    );
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'A regular user provisioned a tenant';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '92000000-0000-4000-8000-000000000001',
  true
);
SELECT set_config('request.jwt.claim.aal', 'aal2', true);

INSERT INTO phase2_result (tenant_id)
SELECT public.provision_tenant(
  'Phase 2 Institution',
  'initial.owner@example.test',
  'Provisioning integration fixture',
  '100 Test Street',
  'Test Contact',
  '+1 555 0100',
  'tenant@example.test',
  'https://example.test'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

DO $$
DECLARE
  v_tenant_id bigint;
  v_count bigint;
  v_defaults_version integer;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM phase2_result;

  SELECT defaults_version INTO v_defaults_version
  FROM public.tenant
  WHERE id = v_tenant_id
    AND institution_name = 'Phase 2 Institution'
    AND status = 'active'
    AND suspended_at IS NULL;
  IF v_defaults_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Provisioning did not apply defaults version 1';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.event_types
  WHERE tenant_id = v_tenant_id;
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'Provisioning did not create six default event types';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.categories
  WHERE tenant_id = v_tenant_id;
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'Provisioning did not create six default categories';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.object_custom_schemas
  WHERE tenant_id = v_tenant_id AND fields = '[]'::jsonb;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Provisioning did not create the tenant custom schema';
  END IF;

  SELECT count(*) INTO v_count
  FROM private.initial_owner_invitations
  WHERE tenant_id = v_tenant_id
    AND email = 'initial.owner@example.test'
    AND intended_role = 'owner'
    AND status = 'queued';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Initial owner invitation was not queued';
  END IF;

  SELECT count(*) INTO v_count
  FROM private.work_queue
  WHERE tenant_id = v_tenant_id
    AND kind = 'tenant.initial_owner_invitation'
    AND completed_at IS NULL;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Initial owner email work was not queued';
  END IF;

  SELECT count(*) INTO v_count
  FROM private.audit_log
  WHERE tenant_id = v_tenant_id
    AND action = 'tenant.provisioned';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Provisioning audit event was not recorded';
  END IF;
END;
$$;

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
SELECT
  '92000000-0000-4000-8000-000000000003',
  tenant_id,
  'admin',
  'tenant-admin@example.test'
FROM phase2_result;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '92000000-0000-4000-8000-000000000003',
  true
);

DO $$
DECLARE
  v_tenant_id bigint;
  v_denied boolean := false;
  v_rows bigint := 0;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM phase2_result;
  BEGIN
    UPDATE public.tenant
    SET status = 'suspended',
        status_reason = 'forged tenant-admin status',
        suspended_at = now()
    WHERE id = v_tenant_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied AND v_rows <> 0 THEN
    RAISE EXCEPTION 'Tenant administrator changed platform-managed fields';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '92000000-0000-4000-8000-000000000001',
  true
);

DO $$
DECLARE
  v_tenant_id bigint;
  v_count bigint;
  v_denied boolean := false;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM phase2_result;

  SELECT count(*) INTO v_count
  FROM public.platform_tenants('Phase 2');
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Platform tenant search did not return the provisioned tenant';
  END IF;

  PERFORM public.update_platform_tenant(
    v_tenant_id,
    'Phase 2 Institution Updated',
    'Updated by operator verification',
    '200 Test Street',
    'Updated Contact',
    '+1 555 0101',
    'updated@example.test',
    'https://updated.example.test',
    '{"linkedin":"https://linkedin.example.test"}'::jsonb
  );

  BEGIN
    PERFORM public.set_tenant_status(v_tenant_id, 'suspended', '');
  EXCEPTION WHEN sqlstate '22023' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Tenant status changed without a reason';
  END IF;

  PERFORM public.set_tenant_status(
    v_tenant_id,
    'suspended',
    'Phase 2 verification suspension'
  );
END;
$$;

RESET ROLE;

UPDATE private.tenant_default_versions SET is_current = false WHERE is_current;
INSERT INTO private.tenant_default_versions (
  version, name, is_current, categories, event_types
)
VALUES (
  2,
  'phase-2-verification-defaults',
  true,
  '[{"name":"VersionTwoCategory","description":"Explicit migration only"}]'::jsonb,
  '["version-two-event"]'::jsonb
);

DO $$
DECLARE
  v_tenant_id bigint;
  v_count bigint;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM phase2_result;
  SELECT count(*) INTO v_count
  FROM public.categories
  WHERE tenant_id = v_tenant_id AND name = 'VersionTwoCategory';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Changing current defaults silently modified an existing tenant';
  END IF;
  IF (SELECT defaults_version FROM public.tenant WHERE id = v_tenant_id) <> 1 THEN
    RAISE EXCEPTION 'Changing current defaults silently changed the tenant version';
  END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '92000000-0000-4000-8000-000000000001',
  true
);

DO $$
DECLARE
  v_tenant_id bigint;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM phase2_result;
  PERFORM public.migrate_tenant_defaults(v_tenant_id, 2);
  PERFORM public.set_tenant_status(
    v_tenant_id,
    'active',
    'Phase 2 verification reactivation'
  );
END;
$$;

RESET ROLE;

DO $$
DECLARE
  v_tenant_id bigint;
  v_count bigint;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM phase2_result;
  IF (SELECT defaults_version FROM public.tenant WHERE id = v_tenant_id) <> 2 THEN
    RAISE EXCEPTION 'Explicit defaults migration did not update the tenant version';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.categories
  WHERE tenant_id = v_tenant_id AND name = 'VersionTwoCategory';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Explicit defaults migration did not add version 2 defaults';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant
    WHERE id = v_tenant_id
      AND institution_name = 'Phase 2 Institution Updated'
      AND status = 'active'
      AND status_reason = 'Phase 2 verification reactivation'
      AND suspended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Platform update or activation did not persist correctly';
  END IF;
  SELECT count(*) INTO v_count
  FROM private.audit_log
  WHERE tenant_id = v_tenant_id
    AND action IN (
      'tenant.profile.updated',
      'tenant.suspended',
      'tenant.activated',
      'tenant.defaults.migrated'
    );
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Expected platform-operation audit events were not recorded';
  END IF;
END;
$$;

SELECT 'phase 2 tenant operations verification passed' AS result;
ROLLBACK;
