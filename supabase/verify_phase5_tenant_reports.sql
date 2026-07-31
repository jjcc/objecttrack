BEGIN;

CREATE TEMP TABLE phase5_result (
  report_job_id uuid
);
GRANT ALL ON phase5_result TO authenticated, service_role;

INSERT INTO public.tenant (id, institution_name) OVERRIDING SYSTEM VALUE
VALUES
  (950000001, 'Phase 5 Tenant A'),
  (950000002, 'Phase 5 Tenant B');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('95000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-a@example.test', '', now(), now(), now(), '', '', '', ''),
  ('95000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'member-a@example.test', '', now(), now(), now(), '', '', '', ''),
  ('95000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'owner-b@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
VALUES
  ('95000000-0000-4000-8000-000000000001', 950000001, 'owner', 'owner-a@example.test'),
  ('95000000-0000-4000-8000-000000000002', 950000001, 'member', 'member-a@example.test'),
  ('95000000-0000-4000-8000-000000000003', 950000002, 'owner', 'owner-b@example.test');

INSERT INTO public.categories (tenant_id, name)
VALUES
  (950000001, 'Tenant A category'),
  (950000002, 'Tenant B category');

INSERT INTO public.objects (tenant_id, name, category_id)
SELECT 950000001, 'Tenant A object 1', id
FROM public.categories WHERE tenant_id = 950000001
UNION ALL
SELECT 950000001, 'Tenant A object 2', id
FROM public.categories WHERE tenant_id = 950000001
UNION ALL
SELECT 950000002, 'Tenant B secret object', id
FROM public.categories WHERE tenant_id = 950000002;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub',
  '95000000-0000-4000-8000-000000000002',
  true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.request_tenant_report('inventory', false);
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Tenant member generated a privileged report';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '95000000-0000-4000-8000-000000000001',
  true
);

DO $$
DECLARE
  v_mode text;
  v_count bigint;
BEGIN
  SELECT delivery_mode, report_row_count INTO v_mode, v_count
  FROM public.request_tenant_report('inventory', false);
  IF v_mode <> 'synchronous' OR v_count <> 2 THEN
    RAISE EXCEPTION 'Small report did not use the synchronous tenant count';
  END IF;

  SELECT count(*) INTO v_count FROM public.tenant_inventory_report();
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Inventory report leaked or omitted tenant rows';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tenant_inventory_report()
    WHERE object_name = 'Tenant B secret object'
  ) THEN
    RAISE EXCEPTION 'Inventory report leaked cross-tenant data';
  END IF;
END;
$$;

INSERT INTO phase5_result (report_job_id)
SELECT report_job_id
FROM public.request_tenant_report('inventory', true);

RESET ROLE;
DO $$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.tenant_report_jobs();
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tenant report job was not listed';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM private.tenant_report_jobs AS job
    WHERE job.id = (SELECT report_job_id FROM phase5_result)
      AND job.tenant_id = 950000001
      AND job.requested_by = '95000000-0000-4000-8000-000000000001'
      AND job.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Background job did not capture tenant and requester';
  END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '95000000-0000-4000-8000-000000000003',
  true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  IF EXISTS (SELECT 1 FROM public.tenant_report_jobs()) THEN
    RAISE EXCEPTION 'Cross-tenant report job was listed';
  END IF;
  BEGIN
    PERFORM public.authorize_tenant_report_download(
      (SELECT report_job_id FROM phase5_result)
    );
  EXCEPTION WHEN sqlstate 'P0002' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Cross-tenant report download was authorized';
  END IF;
END;
$$;

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_job_id uuid;
  v_tenant_id bigint;
  v_denied boolean := false;
BEGIN
  SELECT id, tenant_id INTO v_job_id, v_tenant_id
  FROM public.claim_tenant_report_jobs(1);
  IF v_job_id IS DISTINCT FROM (SELECT report_job_id FROM phase5_result)
     OR v_tenant_id <> 950000001 THEN
    RAISE EXCEPTION 'Worker did not claim the expected tenant-bound job';
  END IF;

  BEGIN
    PERFORM public.complete_tenant_report_job(
      v_job_id,
      '950000002/' || v_job_id::text || '.csv',
      2,
      100,
      repeat('a', 64)
    );
  EXCEPTION WHEN sqlstate '22023' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Worker completed a report at a forged tenant path';
  END IF;

  PERFORM public.complete_tenant_report_job(
    v_job_id,
    '950000001/' || v_job_id::text || '.csv',
    2,
    100,
    repeat('a', 64)
  );
END;
$$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub',
  '95000000-0000-4000-8000-000000000001',
  true
);

DO $$
DECLARE
  v_job_id uuid := (SELECT report_job_id FROM phase5_result);
  v_path text;
BEGIN
  v_path := public.authorize_tenant_report_download(v_job_id);
  IF v_path <> '950000001/' || v_job_id::text || '.csv' THEN
    RAISE EXCEPTION 'Authorized report path is incorrect';
  END IF;
  IF NOT public.can_download_tenant_report(v_path) THEN
    RAISE EXCEPTION 'Storage authorization rejected a current tenant report';
  END IF;
END;
$$;

RESET ROLE;
UPDATE private.tenant_report_jobs
SET retention_until = now() - interval '1 minute'
WHERE id = (SELECT report_job_id FROM phase5_result);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub',
  '95000000-0000-4000-8000-000000000001',
  true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.authorize_tenant_report_download(
      (SELECT report_job_id FROM phase5_result)
    );
  EXCEPTION WHEN sqlstate 'P0002' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Expired report download was authorized';
  END IF;
END;
$$;

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT * FROM public.expire_tenant_report_jobs();

RESET ROLE;
DO $$
DECLARE
  v_count bigint;
BEGIN
  IF (SELECT status FROM private.tenant_report_jobs
      WHERE id = (SELECT report_job_id FROM phase5_result)) <> 'expired' THEN
    RAISE EXCEPTION 'Retention cleanup did not expire the report';
  END IF;

  SELECT count(*) INTO v_count
  FROM private.audit_log
  WHERE tenant_id = 950000001
    AND action IN (
      'tenant.report.generated',
      'tenant.report.requested',
      'tenant.report.completed',
      'tenant.report.downloaded'
    );
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Report audit trail is incomplete: %', v_count;
  END IF;
END;
$$;

SELECT 'phase 5 tenant reports verification passed' AS result;
ROLLBACK;
