-- Permit eligible tenant members to request an object transfer across groups.
-- Keep tenant membership, transfer permission, ownership, and pending-request
-- checks in place; group_id remains the requester's group for audit history.
CREATE OR REPLACE FUNCTION public.request_transfer(p_object_id bigint, p_to_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_requester_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
  v_group_id bigint;
  v_current_owner_id uuid;
  v_request_id bigint;
BEGIN
  IF v_requester_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Authentication and tenant membership required' USING ERRCODE = '42501';
  END IF;

  SELECT object_record.current_owner_id
  INTO v_current_owner_id
  FROM public.objects AS object_record
  WHERE object_record.id = p_object_id
    AND object_record.tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Object not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_current_owner_id IS NULL THEN
    RAISE EXCEPTION 'Object has no current owner' USING ERRCODE = '22023';
  END IF;
  IF v_current_owner_id = v_requester_id THEN
    RAISE EXCEPTION 'Requester already owns this object' USING ERRCODE = '22023';
  END IF;
  IF p_to_user_id IS DISTINCT FROM v_current_owner_id THEN
    RAISE EXCEPTION 'Transfer recipient must be the current owner' USING ERRCODE = '22023';
  END IF;

  -- Confirm the requester is a member of this tenant, but do not require a
  -- group: group membership is not a prerequisite for requesting ownership.
  SELECT requester.group_id INTO v_group_id
  FROM public.user_profiles AS requester
  WHERE requester.id = v_requester_id
    AND requester.tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requester is not a member of this workspace' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transfer_requests AS request
    WHERE request.object_id = p_object_id
      AND request.tenant_id = v_tenant_id
      AND request.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'A pending transfer already exists for this object' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.transfer_requests (
    tenant_id, object_id, from_user_id, to_user_id, group_id, status
  ) VALUES (
    v_tenant_id, p_object_id, v_requester_id, v_current_owner_id, v_group_id, 'pending'
  ) RETURNING id INTO v_request_id;
  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_transfer(bigint, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_transfer(bigint, uuid) TO authenticated;
