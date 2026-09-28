-- Allow tenant admins to assign, change, or remove an object's member owner.

CREATE OR REPLACE FUNCTION public.assign_object_to_member(
  p_object_id bigint,
  p_member_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
  v_object public.objects%ROWTYPE;
  v_event_group_id bigint;
  v_assignment_event_type_id bigint;
  v_action text;
BEGIN
  IF v_actor_id IS NULL OR v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.objects.manage', v_tenant_id) THEN
    RAISE EXCEPTION 'Permission denied: tenant.objects.manage'
      USING ERRCODE = '42501';
  END IF;

  SELECT object_record.* INTO v_object
  FROM public.objects AS object_record
  WHERE object_record.id = p_object_id
    AND object_record.tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Object not found in this workspace' USING ERRCODE = 'P0002';
  END IF;
  IF v_object.current_owner_id IS NOT DISTINCT FROM p_member_id THEN
    RAISE EXCEPTION 'Object already has the selected assignment state'
      USING ERRCODE = '22023';
  END IF;

  IF p_member_id IS NOT NULL THEN
    SELECT profile.group_id INTO v_event_group_id
    FROM public.user_profiles AS profile
    WHERE profile.id = p_member_id
      AND profile.tenant_id = v_tenant_id
      AND profile.tenant_role = 'member';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Select a Member in this workspace' USING ERRCODE = '22023';
    END IF;
  ELSE
    SELECT profile.group_id INTO v_event_group_id
    FROM public.user_profiles AS profile
    WHERE profile.id = v_object.current_owner_id
      AND profile.tenant_id = v_tenant_id;
  END IF;

  SELECT event_type.id INTO v_assignment_event_type_id
  FROM public.event_types AS event_type
  WHERE event_type.tenant_id = v_tenant_id
    AND lower(event_type.label) = 'assignment'
  LIMIT 1;
  IF v_assignment_event_type_id IS NULL THEN
    RAISE EXCEPTION 'Assignment event type is not configured'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transfer_requests AS request
    WHERE request.object_id = p_object_id
      AND request.tenant_id = v_tenant_id
      AND request.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Object has a pending transfer request'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.objects
  SET current_owner_id = p_member_id
  WHERE id = p_object_id
    AND tenant_id = v_tenant_id
    AND current_owner_id IS NOT DISTINCT FROM v_object.current_owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Object ownership changed before assignment'
      USING ERRCODE = '40001';
  END IF;

  v_action := CASE
    WHEN v_object.current_owner_id IS NULL THEN 'assigned'
    WHEN p_member_id IS NULL THEN 'unassigned'
    ELSE 'reassigned'
  END;

  INSERT INTO public.events (
    tenant_id, group_id, object_id, event_type_id, e_from, e_to, extra
  ) VALUES (
    v_tenant_id,
    v_event_group_id,
    p_object_id,
    v_assignment_event_type_id,
    COALESCE(v_object.current_owner_id, v_actor_id),
    p_member_id,
    jsonb_build_object(
      'action', v_action,
      'assigned_by', v_actor_id,
      'previous_owner_id', v_object.current_owner_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_object_to_member(bigint, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_object_to_member(bigint, uuid)
  TO authenticated, service_role;
