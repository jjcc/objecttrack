-- Phase 5: tenant-scoped synchronous exports and durable background report jobs.

CREATE TABLE private.tenant_report_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id bigint NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  report_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  storage_path text,
  row_count bigint,
  file_size_bytes bigint,
  checksum_sha256 text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_message text,
  retention_until timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  download_count integer NOT NULL DEFAULT 0,
  last_downloaded_at timestamptz,
  CONSTRAINT tenant_report_jobs_type_check
    CHECK (report_type IN ('inventory')),
  CONSTRAINT tenant_report_jobs_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  CONSTRAINT tenant_report_jobs_storage_path_check
    CHECK (
      storage_path IS NULL
      OR storage_path = tenant_id::text || '/' || id::text || '.csv'
    ),
  CONSTRAINT tenant_report_jobs_row_count_check
    CHECK (row_count IS NULL OR row_count >= 0),
  CONSTRAINT tenant_report_jobs_file_size_check
    CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  CONSTRAINT tenant_report_jobs_checksum_check
    CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX tenant_report_jobs_tenant_requested_idx
  ON private.tenant_report_jobs (tenant_id, requested_at DESC);
CREATE INDEX tenant_report_jobs_pending_idx
  ON private.tenant_report_jobs (requested_at)
  WHERE status = 'pending';
CREATE INDEX tenant_report_jobs_retention_idx
  ON private.tenant_report_jobs (retention_until)
  WHERE status = 'completed';
CREATE INDEX tenant_report_jobs_requested_by_idx
  ON private.tenant_report_jobs (requested_by);

REVOKE ALL ON private.tenant_report_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON private.tenant_report_jobs TO service_role;

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) VALUES (
  'tenant-reports',
  'tenant-reports',
  false,
  26214400,
  ARRAY['text/csv']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.can_download_tenant_report(
  p_storage_path text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.current_tenant_id() IS NOT NULL
    AND public.has_permission(
      'tenant.reports.generate',
      public.current_tenant_id()
    )
    AND EXISTS (
      SELECT 1
      FROM private.tenant_report_jobs AS job
      WHERE job.storage_path = p_storage_path
        AND job.tenant_id = public.current_tenant_id()
        AND job.status = 'completed'
        AND job.retention_until > now()
    )
$$;

CREATE POLICY "Authorized tenant admins read current reports"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'tenant-reports'
  AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::text
  AND public.can_download_tenant_report(name)
);

CREATE OR REPLACE FUNCTION public.request_tenant_report(
  p_report_type text DEFAULT 'inventory',
  p_force_background boolean DEFAULT false
)
RETURNS TABLE (
  delivery_mode text,
  report_job_id uuid,
  report_row_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
  v_row_count bigint;
  v_job_id uuid;
BEGIN
  IF v_actor_id IS NULL OR v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.reports.generate', v_tenant_id) THEN
    RAISE EXCEPTION 'Report generation is not permitted'
      USING ERRCODE = '42501';
  END IF;
  IF p_report_type <> 'inventory' THEN
    RAISE EXCEPTION 'Unsupported report type' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_row_count
  FROM public.objects AS object_record
  WHERE object_record.tenant_id = v_tenant_id;

  IF NOT p_force_background AND v_row_count <= 500 THEN
    INSERT INTO private.audit_log (
      actor_id, tenant_id, action, target_type, metadata
    ) VALUES (
      v_actor_id,
      v_tenant_id,
      'tenant.report.generated',
      'report',
      jsonb_build_object(
        'report_type', p_report_type,
        'delivery_mode', 'synchronous',
        'row_count', v_row_count
      )
    );

    RETURN QUERY SELECT 'synchronous'::text, NULL::uuid, v_row_count;
    RETURN;
  END IF;

  INSERT INTO private.tenant_report_jobs (
    tenant_id, requested_by, report_type, row_count
  ) VALUES (
    v_tenant_id, v_actor_id, p_report_type, v_row_count
  )
  RETURNING id INTO v_job_id;

  INSERT INTO private.work_queue (tenant_id, kind, payload)
  VALUES (
    v_tenant_id,
    'report.generate',
    jsonb_build_object('report_job_id', v_job_id)
  );

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_actor_id,
    v_tenant_id,
    'tenant.report.requested',
    'report_job',
    v_job_id::text,
    jsonb_build_object(
      'report_type', p_report_type,
      'delivery_mode', 'background',
      'estimated_row_count', v_row_count
    )
  );

  RETURN QUERY SELECT 'background'::text, v_job_id, v_row_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_inventory_report()
RETURNS TABLE (
  object_id bigint,
  object_name text,
  description text,
  model text,
  category_name text,
  owner_email text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id bigint := public.current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.reports.generate', v_tenant_id) THEN
    RAISE EXCEPTION 'Report generation is not permitted'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    object_record.id,
    object_record.name,
    object_record.description,
    object_record.model,
    category.name,
    owner_profile.email,
    object_record.created_at
  FROM public.objects AS object_record
  LEFT JOIN public.categories AS category
    ON category.id = object_record.category_id
   AND category.tenant_id = v_tenant_id
  LEFT JOIN public.user_profiles AS owner_profile
    ON owner_profile.id = object_record.current_owner_id
   AND owner_profile.tenant_id = v_tenant_id
  WHERE object_record.tenant_id = v_tenant_id
  ORDER BY object_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_report_jobs()
RETURNS TABLE (
  id uuid,
  report_type text,
  status text,
  row_count bigint,
  requested_at timestamptz,
  completed_at timestamptz,
  retention_until timestamptz,
  failure_message text,
  download_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id bigint := public.current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.reports.generate', v_tenant_id) THEN
    RAISE EXCEPTION 'Report listing is not permitted'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    job.id,
    job.report_type,
    CASE
      WHEN job.status = 'completed' AND job.retention_until <= now() THEN 'expired'
      ELSE job.status
    END,
    job.row_count,
    job.requested_at,
    job.completed_at,
    job.retention_until,
    job.failure_message,
    job.download_count
  FROM private.tenant_report_jobs AS job
  WHERE job.tenant_id = v_tenant_id
  ORDER BY job.requested_at DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.authorize_tenant_report_download(
  p_report_job_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
  v_path text;
BEGIN
  IF v_actor_id IS NULL OR v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.reports.generate', v_tenant_id) THEN
    RAISE EXCEPTION 'Report download is not permitted'
      USING ERRCODE = '42501';
  END IF;

  UPDATE private.tenant_report_jobs AS job
  SET
    download_count = job.download_count + 1,
    last_downloaded_at = now()
  WHERE job.id = p_report_job_id
    AND job.tenant_id = v_tenant_id
    AND job.status = 'completed'
    AND job.storage_path IS NOT NULL
    AND job.retention_until > now()
  RETURNING job.storage_path INTO v_path;

  IF v_path IS NULL THEN
    RAISE EXCEPTION 'Report is unavailable' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id
  ) VALUES (
    v_actor_id,
    v_tenant_id,
    'tenant.report.downloaded',
    'report_job',
    p_report_job_id::text
  );

  RETURN v_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_tenant_report_jobs(
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  tenant_id bigint,
  requested_by uuid,
  report_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH claimed AS (
    SELECT job.id
    FROM private.tenant_report_jobs AS job
    WHERE job.status = 'pending'
    ORDER BY job.requested_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 20)
  )
  UPDATE private.tenant_report_jobs AS job
  SET status = 'processing', started_at = now()
  FROM claimed
  WHERE job.id = claimed.id
  RETURNING job.id, job.tenant_id, job.requested_by, job.report_type;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_tenant_report_job(
  p_report_job_id uuid,
  p_storage_path text,
  p_row_count bigint,
  p_file_size_bytes bigint,
  p_checksum_sha256 text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job private.tenant_report_jobs%ROWTYPE;
BEGIN
  IF (SELECT auth.role()) <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_job
  FROM private.tenant_report_jobs AS job
  WHERE job.id = p_report_job_id
    AND job.status = 'processing'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processing report job not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_storage_path <> v_job.tenant_id::text || '/' || v_job.id::text || '.csv' THEN
    RAISE EXCEPTION 'Invalid tenant report storage path' USING ERRCODE = '22023';
  END IF;

  UPDATE private.tenant_report_jobs
  SET
    status = 'completed',
    storage_path = p_storage_path,
    row_count = p_row_count,
    file_size_bytes = p_file_size_bytes,
    checksum_sha256 = lower(p_checksum_sha256),
    completed_at = now(),
    failure_message = NULL
  WHERE id = p_report_job_id;

  UPDATE private.work_queue
  SET completed_at = now()
  WHERE kind = 'report.generate'
    AND completed_at IS NULL
    AND payload ->> 'report_job_id' = p_report_job_id::text;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_job.requested_by,
    v_job.tenant_id,
    'tenant.report.completed',
    'report_job',
    v_job.id::text,
    jsonb_build_object('row_count', p_row_count)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_tenant_report_job(
  p_report_job_id uuid,
  p_failure_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job private.tenant_report_jobs%ROWTYPE;
BEGIN
  IF (SELECT auth.role()) <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  UPDATE private.tenant_report_jobs AS job
  SET
    status = 'failed',
    failed_at = now(),
    failure_message = left(COALESCE(p_failure_message, 'Unknown report failure'), 500)
  WHERE job.id = p_report_job_id
    AND job.status = 'processing'
  RETURNING job.* INTO v_job;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processing report job not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id
  ) VALUES (
    v_job.requested_by,
    v_job.tenant_id,
    'tenant.report.failed',
    'report_job',
    v_job.id::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_tenant_report_jobs()
RETURNS TABLE (report_job_id uuid, storage_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  UPDATE private.tenant_report_jobs AS job
  SET status = 'expired'
  WHERE job.status = 'completed'
    AND job.retention_until <= now()
  RETURNING job.id, job.storage_path;
END;
$$;

REVOKE ALL ON FUNCTION public.request_tenant_report(text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_download_tenant_report(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_inventory_report() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_report_jobs() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.authorize_tenant_report_download(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_tenant_report_jobs(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_tenant_report_job(uuid, text, bigint, bigint, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_tenant_report_job(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_tenant_report_jobs()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.can_download_tenant_report(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_tenant_report(text, boolean)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_inventory_report()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_report_jobs()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authorize_tenant_report_download(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_tenant_report_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_tenant_report_job(uuid, text, bigint, bigint, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_tenant_report_job(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_tenant_report_jobs() TO service_role;
