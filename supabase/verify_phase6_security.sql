BEGIN;

INSERT INTO public.tenant (id, institution_name) OVERRIDING SYSTEM VALUE
VALUES
  (960000001, 'Phase 6 Tenant A'),
  (960000002, 'Phase 6 Tenant B');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('96000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-a@example.test', '', now(), now(), now(), '', '', '', ''),
  ('96000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'member-a@example.test', '', now(), now(), now(), '', '', '', ''),
  ('96000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'owner-b@example.test', '', now(), now(), now(), '', '', '', ''),
  ('96000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'operator@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
VALUES
  ('96000000-0000-4000-8000-000000000001', 960000001, 'owner', 'owner-a@example.test'),
  ('96000000-0000-4000-8000-000000000002', 960000001, 'member', 'member-a@example.test'),
  ('96000000-0000-4000-8000-000000000003', 960000002, 'owner', 'owner-b@example.test');

INSERT INTO private.platform_operators (user_id)
VALUES ('96000000-0000-4000-8000-000000000004');

INSERT INTO private.audit_log (
  actor_id, tenant_id, action, target_type, target_id, metadata
) VALUES
  ('96000000-0000-4000-8000-000000000001', 960000001, 'tenant.settings.updated', 'tenant', '960000001', '{"field":"name"}'),
  ('96000000-0000-4000-8000-000000000003', 960000002, 'tenant.settings.updated', 'tenant', '960000002', '{"field":"name"}');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal1', true);
SELECT set_config(
  'request.jwt.claim.sub',
  '96000000-0000-4000-8000-000000000004',
  true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  IF public.is_platform_operator() THEN
    RAISE EXCEPTION 'AAL1 operator was recognized as privileged';
  END IF;
  BEGIN
    PERFORM public.record_platform_operator_access('/ops', NULL);
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'AAL1 operator accessed the control plane';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.aal', 'aal2', true);

DO $$
BEGIN
  IF NOT public.is_platform_operator()
     OR NOT public.has_permission('platform.audit.read') THEN
    RAISE EXCEPTION 'AAL2 operator did not receive least-privilege audit access';
  END IF;
  PERFORM public.record_platform_operator_access('/ops', 960000001);
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_audit_events(NULL, 100)
    WHERE action = 'platform.accessed'
      AND actor_id = '96000000-0000-4000-8000-000000000004'
  ) THEN
    RAISE EXCEPTION 'Platform access was not audited';
  END IF;
  IF (SELECT count(*) FROM public.platform_operational_metrics()) <> 4 THEN
    RAISE EXCEPTION 'Operational metrics catalog is incomplete';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '96000000-0000-4000-8000-000000000002',
  true
);
SELECT set_config('request.jwt.claim.aal', 'aal1', true);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.tenant_audit_events(100);
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Regular member read sensitive tenant audit events';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '96000000-0000-4000-8000-000000000001',
  true
);

DO $$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.tenant_audit_events(100);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tenant owner audit scope leaked or omitted rows: %', v_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tenant_audit_events(100)
    WHERE target_id = '960000002'
  ) THEN
    RAISE EXCEPTION 'Cross-tenant audit event was exposed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tenant_audit_events(100)
    WHERE request_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Audit event is missing request correlation';
  END IF;
END;
$$;

RESET ROLE;

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    UPDATE private.audit_log
    SET action = 'tampered'
    WHERE tenant_id = 960000001;
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Audit event was mutable';
  END IF;

  v_denied := false;
  BEGIN
    DELETE FROM private.audit_log WHERE tenant_id = 960000001;
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Audit event was deletable';
  END IF;

  v_denied := false;
  BEGIN
    INSERT INTO private.audit_log (
      tenant_id, action, target_type, metadata
    ) VALUES (
      960000001, 'unsafe', 'test', '{"password":"do-not-store"}'
    );
  EXCEPTION WHEN sqlstate '22023' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Secret-bearing audit metadata was accepted';
  END IF;
END;
$$;

SELECT 'phase 6 security verification passed' AS result;
ROLLBACK;
