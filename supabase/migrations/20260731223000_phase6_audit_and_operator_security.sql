-- Phase 6: immutable audit access, AAL2-gated platform operations, and
-- operational security metrics.

INSERT INTO private.permission_definitions (code, description)
VALUES
  ('tenant.audit.read', 'Read sensitive audit events for the current tenant'),
  ('platform.audit.read', 'Read cross-tenant platform audit and operational metrics')
ON CONFLICT (code) DO NOTHING;

INSERT INTO private.role_permissions (role, permission)
VALUES
  ('admin', 'tenant.audit.read'),
  ('owner', 'tenant.audit.read'),
  ('platform_operator', 'platform.audit.read')
ON CONFLICT (role, permission) DO NOTHING;

CREATE OR REPLACE FUNCTION private.protect_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Audit events are append-only' USING ERRCODE = '42501';
  END IF;
  IF NEW.metadata ?| ARRAY[
    'token',
    'raw_token',
    'invitation_token',
    'password',
    'secret'
  ] THEN
    RAISE EXCEPTION 'Audit metadata contains a forbidden secret field'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_audit_log() FROM PUBLIC;

CREATE TRIGGER audit_log_append_only
BEFORE INSERT OR UPDATE OR DELETE ON private.audit_log
FOR EACH ROW EXECUTE FUNCTION private.protect_audit_log();

CREATE OR REPLACE FUNCTION public.is_platform_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND COALESCE(
      (SELECT auth.jwt() ->> 'aal'),
      NULLIF(current_setting('request.jwt.claim.aal', true), '')
    ) = 'aal2'
    AND EXISTS (
      SELECT 1
      FROM private.platform_operators AS operator
      WHERE operator.user_id = (SELECT auth.uid())
        AND operator.disabled_at IS NULL
    )
$$;

CREATE OR REPLACE FUNCTION public.tenant_audit_events(
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id bigint,
  actor_id uuid,
  actor_email text,
  action text,
  target_type text,
  target_id text,
  request_id uuid,
  metadata jsonb,
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
     OR NOT public.has_permission('tenant.audit.read', v_tenant_id) THEN
    RAISE EXCEPTION 'Audit access is not permitted' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    event.id,
    event.actor_id,
    actor.email::text,
    event.action,
    event.target_type,
    event.target_id,
    event.request_id,
    event.metadata,
    event.created_at
  FROM private.audit_log AS event
  LEFT JOIN auth.users AS actor ON actor.id = event.actor_id
  WHERE event.tenant_id = v_tenant_id
  ORDER BY event.created_at DESC, event.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 500);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_platform_operator_access(
  p_path text,
  p_target_tenant_id bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
BEGIN
  IF NOT public.is_platform_operator()
     OR NOT public.has_permission('platform.audit.read') THEN
    RAISE EXCEPTION 'AAL2 platform access is required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO private.audit_log (
    actor_id, action, target_type, target_id, metadata
  ) VALUES (
    v_actor_id,
    'platform.accessed',
    CASE WHEN p_target_tenant_id IS NULL THEN 'control_plane' ELSE 'tenant' END,
    p_target_tenant_id::text,
    jsonb_build_object('path', left(COALESCE(p_path, '/ops'), 200))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_audit_events(
  p_tenant_id bigint DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id bigint,
  actor_id uuid,
  actor_email text,
  tenant_id bigint,
  action text,
  target_type text,
  target_id text,
  request_id uuid,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_platform_operator()
     OR NOT public.has_permission('platform.audit.read') THEN
    RAISE EXCEPTION 'AAL2 platform audit access is required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    event.id,
    event.actor_id,
    actor.email::text,
    event.tenant_id,
    event.action,
    event.target_type,
    event.target_id,
    event.request_id,
    event.metadata,
    event.created_at
  FROM private.audit_log AS event
  LEFT JOIN auth.users AS actor ON actor.id = event.actor_id
  WHERE p_tenant_id IS NULL OR event.tenant_id = p_tenant_id
  ORDER BY event.created_at DESC, event.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 500);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_operational_metrics()
RETURNS TABLE (metric text, value bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_platform_operator()
     OR NOT public.has_permission('platform.audit.read') THEN
    RAISE EXCEPTION 'AAL2 platform monitoring access is required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT 'invitation_delivery_failures_24h'::text, count(*)::bigint
  FROM private.tenant_invitations AS invitation
  WHERE invitation.delivery_status = 'failed'
    AND invitation.last_sent_at >= now() - interval '24 hours'
  UNION ALL
  SELECT 'report_failures_24h'::text, count(*)::bigint
  FROM private.tenant_report_jobs AS job
  WHERE job.status = 'failed'
    AND job.failed_at >= now() - interval '24 hours'
  UNION ALL
  SELECT 'pending_work_items'::text, count(*)::bigint
  FROM private.work_queue AS work
  WHERE work.completed_at IS NULL
    AND work.failed_at IS NULL
  UNION ALL
  SELECT 'failed_work_items_24h'::text, count(*)::bigint
  FROM private.work_queue AS work
  WHERE work.failed_at >= now() - interval '24 hours';
END;
$$;

REVOKE ALL ON FUNCTION public.tenant_audit_events(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_platform_operator_access(text, bigint)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_audit_events(bigint, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_operational_metrics() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.tenant_audit_events(integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_platform_operator_access(text, bigint)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_audit_events(bigint, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_operational_metrics()
  TO authenticated, service_role;
