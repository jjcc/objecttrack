-- Rollback-only integration verification for the shared transfer RPC contract.
-- Run against a non-production database, or through a client that permits this
-- transaction to complete as one request. A successful run returns no rows.

begin;

do $$
declare
  v_requester uuid := '10000000-0000-4000-8000-000000000001';
  v_recipient uuid := '10000000-0000-4000-8000-000000000002';
  v_other uuid := '10000000-0000-4000-8000-000000000003';
  v_admin uuid := '10000000-0000-4000-8000-000000000004';
  v_group_id bigint;
  v_object_id bigint;
  v_request_id bigint;
  v_owner uuid;
  v_status text;
  v_extra jsonb;
begin
  insert into auth.users (id, aud, role, is_sso_user, is_anonymous)
  values
    (v_requester, 'authenticated', 'authenticated', false, false),
    (v_recipient, 'authenticated', 'authenticated', false, false),
    (v_other, 'authenticated', 'authenticated', false, false),
    (v_admin, 'authenticated', 'authenticated', false, false);

  insert into public.groups (title)
  values ('transfer-rpc-rollback-test')
  returning id into v_group_id;

  insert into public.user_profiles (id, group_id, first_name)
  values
    (v_requester, v_group_id, 'Requester'),
    (v_recipient, v_group_id, 'Recipient'),
    (v_other, v_group_id, 'Other'),
    (v_admin, v_group_id, 'Admin');

  insert into public.admin_users (id) values (v_admin);

  -- The recipient can approve and ownership moves to the requester.
  insert into public.objects (name, current_owner_id)
  values ('recipient-approval-test', v_recipient)
  returning id into v_object_id;

  perform set_config('request.jwt.claim.sub', v_requester::text, true);
  v_request_id := public.request_transfer(v_object_id, v_recipient);

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  begin
    perform public.approve_transfer(v_request_id);
    raise exception 'Unrelated user approval unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', v_recipient::text, true);
  perform public.approve_transfer(v_request_id);

  select request.status, object.current_owner_id, event.extra
  into v_status, v_owner, v_extra
  from public.transfer_requests as request
  join public.objects as object on object.id = request.object_id
  join public.events as event
    on event.object_id = request.object_id
   and event.extra->>'transfer_request_id' = request.id::text
  where request.id = v_request_id;

  if v_status <> 'approved' or v_owner <> v_requester then
    raise exception 'Recipient approval did not atomically transfer ownership';
  end if;
  if v_extra->>'acted_by' <> v_recipient::text
     or v_extra->>'actor_role' <> 'recipient' then
    raise exception 'Recipient audit metadata is incorrect';
  end if;

  begin
    perform public.approve_transfer(v_request_id);
    raise exception 'Repeated approval unexpectedly succeeded';
  exception
    when invalid_parameter_value then null;
  end;

  -- An administrator can approve on the recipient's behalf.
  insert into public.objects (name, current_owner_id)
  values ('administrator-approval-test', v_recipient)
  returning id into v_object_id;

  perform set_config('request.jwt.claim.sub', v_requester::text, true);
  v_request_id := public.request_transfer(v_object_id, v_recipient);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform public.approve_transfer(v_request_id);

  select object.current_owner_id, event.extra
  into v_owner, v_extra
  from public.objects as object
  join public.events as event on event.object_id = object.id
  where object.id = v_object_id;

  if v_owner <> v_requester
     or v_extra->>'actor_role' <> 'administrator'
     or v_extra->>'acted_by' <> v_admin::text then
    raise exception 'Administrator approval or audit metadata is incorrect';
  end if;

  -- Rejection preserves ownership and is audited in the same transaction.
  insert into public.objects (name, current_owner_id)
  values ('recipient-rejection-test', v_recipient)
  returning id into v_object_id;

  perform set_config('request.jwt.claim.sub', v_requester::text, true);
  v_request_id := public.request_transfer(v_object_id, v_recipient);
  perform set_config('request.jwt.claim.sub', v_recipient::text, true);
  perform public.reject_transfer(v_request_id, 'not available');

  select request.status, object.current_owner_id, event.extra
  into v_status, v_owner, v_extra
  from public.transfer_requests as request
  join public.objects as object on object.id = request.object_id
  join public.events as event
    on event.object_id = request.object_id
   and event.extra->>'transfer_request_id' = request.id::text
  where request.id = v_request_id;

  if v_status <> 'rejected' or v_owner <> v_recipient then
    raise exception 'Rejection changed ownership or left an invalid status';
  end if;
  if v_extra->>'action' <> 'rejected'
     or v_extra->>'reason' <> 'not available' then
    raise exception 'Rejection audit metadata is incorrect';
  end if;
end;
$$;

rollback;
