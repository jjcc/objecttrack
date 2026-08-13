-- Phase 7: close rollout gaps found during release verification.

CREATE OR REPLACE FUNCTION public.update_current_tenant_workspace(
  p_workspace_kind text,
  p_member_visibility text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id bigint := public.current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.settings.update', v_tenant_id) THEN
    RAISE EXCEPTION 'Permission denied: tenant.settings.update'
      USING ERRCODE = '42501';
  END IF;
  IF p_workspace_kind NOT IN (
    'family', 'business', 'club', 'collector', 'other'
  ) THEN
    RAISE EXCEPTION 'Invalid workspace kind' USING ERRCODE = '22023';
  END IF;
  IF p_member_visibility NOT IN ('private', 'shared') THEN
    RAISE EXCEPTION 'Invalid member visibility' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tenant
  SET
    workspace_kind = p_workspace_kind,
    member_visibility = p_member_visibility,
    updated_at = now()
  WHERE id = v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_current_tenant_workspace(text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_current_tenant_workspace(text, text)
  TO authenticated, service_role;
