-- Give the public object-info page an authenticated, safe transfer context and
-- request entry point without exposing the current owner's UUID.
CREATE OR REPLACE FUNCTION public.object_transfer_context(p_object_id bigint)
RETURNS TABLE (
  can_request boolean,
  pending_request_id bigint,
  is_current_owner boolean,
  is_requester boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
  v_current_owner_id uuid;
  v_pending_id bigint;
  v_pending_requester_id uuid;
BEGIN
  IF v_actor_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Authentication and tenant membership required'
      USING ERRCODE = '42501';
  END IF;

  SELECT object_record.current_owner_id
  INTO v_current_owner_id
  FROM public.objects AS object_record
  WHERE object_record.id = p_object_id
    AND object_record.tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT request.id, request.from_user_id
  INTO v_pending_id, v_pending_requester_id
  FROM public.transfer_requests AS request
  WHERE request.object_id = p_object_id
    AND request.tenant_id = v_tenant_id
    AND request.status = 'pending'
  LIMIT 1;

  RETURN QUERY SELECT
    v_current_owner_id IS NOT NULL
      AND v_current_owner_id <> v_actor_id
      AND v_pending_id IS NULL
      AND public.has_permission('tenant.transfers.participate', v_tenant_id)
      AND public.has_tenant_entitlement('advanced_transfers', v_tenant_id),
    CASE WHEN v_current_owner_id = v_actor_id
               OR v_pending_requester_id = v_actor_id
      THEN v_pending_id ELSE NULL END,
    COALESCE(v_current_owner_id = v_actor_id, false),
    COALESCE(v_pending_requester_id = v_actor_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.object_transfer_context(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.object_transfer_context(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_transfer_for_object(p_object_id bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
  v_current_owner_id uuid;
BEGIN
  IF v_actor_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Authentication and tenant membership required'
      USING ERRCODE = '42501';
  END IF;

  SELECT object_record.current_owner_id
  INTO v_current_owner_id
  FROM public.objects AS object_record
  WHERE object_record.id = p_object_id
    AND object_record.tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Object not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_current_owner_id IS NULL THEN
    RAISE EXCEPTION 'Object has no current owner' USING ERRCODE = '22023';
  END IF;

  RETURN public.request_transfer(p_object_id, v_current_owner_id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_transfer_for_object(bigint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_transfer_for_object(bigint)
  TO authenticated;
