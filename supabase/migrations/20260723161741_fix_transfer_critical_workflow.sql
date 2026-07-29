-- Critical transfer workflow reconciliation.
--
-- Business roles:
--   from_user_id = requester and future owner
--   to_user_id   = current owner and normal approver

alter table public.objects
  add column if not exists current_owner_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'objects_current_owner_id_fkey'
      and conrelid = 'public.objects'::regclass
  ) then
    alter table public.objects
      add constraint objects_current_owner_id_fkey
      foreign key (current_owner_id) references public.user_profiles(id);
  end if;
end;
$$;

create table if not exists public.transfer_requests (
  id bigint generated always as identity primary key,
  object_id bigint not null references public.objects(id),
  from_user_id uuid not null references auth.users(id),
  to_user_id uuid not null references auth.users(id),
  group_id bigint references public.groups(id),
  status text not null default 'pending',
  reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint transfer_requests_distinct_users_check
    check (from_user_id <> to_user_id),
  constraint transfer_requests_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

alter table public.transfer_requests
  add column if not exists group_id bigint references public.groups(id);

alter table public.transfer_requests enable row level security;

drop policy if exists "Admins manage transfer_requests"
  on public.transfer_requests;
create policy "Admins manage transfer_requests"
  on public.transfer_requests
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as admin_user
      where admin_user.id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users as admin_user
      where admin_user.id = (select auth.uid())
    )
  );

drop policy if exists "Users read related transfer requests"
  on public.transfer_requests;
create policy "Users read related transfer requests"
  on public.transfer_requests
  for select
  to authenticated
  using (
    (select auth.uid()) = from_user_id
    or (select auth.uid()) = to_user_id
  );

create index if not exists transfer_requests_from_user_id_idx
  on public.transfer_requests (from_user_id);

create index if not exists transfer_requests_to_user_id_status_idx
  on public.transfer_requests (to_user_id, status);

create unique index if not exists transfer_requests_one_pending_per_object_idx
  on public.transfer_requests (object_id)
  where status = 'pending';

create index if not exists objects_current_owner_id_idx
  on public.objects (current_owner_id);

create or replace function public.group_profile_directory()
returns table (
  id uuid,
  first_name text,
  last_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.first_name, profile.last_name
  from public.user_profiles as profile
  where (select auth.uid()) is not null
    and profile.group_id = (
      select caller.group_id
      from public.user_profiles as caller
      where caller.id = (select auth.uid())
    )
  order by profile.first_name nulls last,
           profile.last_name nulls last,
           profile.id;
$$;

revoke all on function public.group_profile_directory() from public, anon;
grant execute on function public.group_profile_directory() to authenticated;

create or replace function public.profile_names(p_user_ids uuid[])
returns table (
  id uuid,
  first_name text,
  last_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.first_name, profile.last_name
  from public.user_profiles as profile
  where (select auth.uid()) is not null
    and profile.id = any(coalesce(p_user_ids, array[]::uuid[]))
    and (
      exists (
        select 1
        from public.admin_users as admin_user
        where admin_user.id = (select auth.uid())
      )
      or profile.group_id = (
        select caller.group_id
        from public.user_profiles as caller
        where caller.id = (select auth.uid())
      )
    );
$$;

revoke all on function public.profile_names(uuid[]) from public, anon;
grant execute on function public.profile_names(uuid[]) to authenticated;

create or replace function public.request_transfer(
  p_object_id bigint,
  p_to_user_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester_id uuid := (select auth.uid());
  v_group_id bigint;
  v_current_owner_id uuid;
  v_request_id bigint;
begin
  if v_requester_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select object.current_owner_id
  into v_current_owner_id
  from public.objects as object
  where object.id = p_object_id
  for update;

  if not found then
    raise exception 'Object not found' using errcode = 'P0002';
  end if;

  if v_current_owner_id is null then
    raise exception 'Object has no current owner' using errcode = '22023';
  end if;

  if v_current_owner_id = v_requester_id then
    raise exception 'Requester already owns this object' using errcode = '22023';
  end if;

  if p_to_user_id <> v_current_owner_id then
    raise exception 'Transfer recipient must be the current owner'
      using errcode = '22023';
  end if;

  select requester.group_id
  into v_group_id
  from public.user_profiles as requester
  where requester.id = v_requester_id;

  if v_group_id is null then
    raise exception 'Requester has no group profile' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_profiles as owner_profile
    where owner_profile.id = v_current_owner_id
      and owner_profile.group_id = v_group_id
  ) then
    raise exception 'Current owner is not in the requester group'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.transfer_requests as request
    where request.object_id = p_object_id
      and request.status = 'pending'
  ) then
    raise exception 'A pending transfer already exists for this object'
      using errcode = '23505';
  end if;

  insert into public.transfer_requests (
    object_id,
    from_user_id,
    to_user_id,
    group_id,
    status
  )
  values (
    p_object_id,
    v_requester_id,
    v_current_owner_id,
    v_group_id,
    'pending'
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.request_transfer(bigint, uuid) from public, anon;
grant execute on function public.request_transfer(bigint, uuid) to authenticated;

create or replace function public.approve_transfer(p_request_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_request public.transfer_requests%rowtype;
  v_is_admin boolean;
  v_actor_role text;
  v_transfer_event_type_id bigint;
begin
  if v_actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select request.*
  into v_request
  from public.transfer_requests as request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'Transfer request not found' using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.admin_users as admin_user
    where admin_user.id = v_actor_id
  )
  into v_is_admin;

  if v_actor_id = v_request.to_user_id then
    v_actor_role := 'recipient';
  elsif v_is_admin then
    v_actor_role := 'administrator';
  else
    raise exception 'Only the recipient or an administrator can approve this transfer'
      using errcode = '42501';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Transfer request is not pending' using errcode = '22023';
  end if;

  perform 1
  from public.objects as object
  where object.id = v_request.object_id
  for update;

  if not found then
    raise exception 'Object not found' using errcode = 'P0002';
  end if;

  update public.objects
  set current_owner_id = v_request.from_user_id
  where id = v_request.object_id
    and current_owner_id = v_request.to_user_id;

  if not found then
    raise exception 'Object ownership changed before approval'
      using errcode = '40001';
  end if;

  update public.transfer_requests
  set status = 'approved',
      updated_at = now()
  where id = v_request.id;

  select event_type.id
  into v_transfer_event_type_id
  from public.event_types as event_type
  where event_type.label = 'transfer';

  if v_transfer_event_type_id is null then
    raise exception 'Transfer event type is not configured';
  end if;

  insert into public.events (
    group_id,
    object_id,
    event_type_id,
    e_from,
    e_to,
    extra
  )
  values (
    v_request.group_id,
    v_request.object_id,
    v_transfer_event_type_id,
    v_request.to_user_id,
    v_request.from_user_id,
    jsonb_build_object(
      'transfer_request_id', v_request.id,
      'action', 'approved',
      'acted_by', v_actor_id,
      'actor_role', v_actor_role
    )
  );
end;
$$;

revoke all on function public.approve_transfer(bigint) from public, anon;
grant execute on function public.approve_transfer(bigint) to authenticated;

create or replace function public.reject_transfer(
  p_request_id bigint,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_request public.transfer_requests%rowtype;
  v_is_admin boolean;
  v_actor_role text;
  v_transfer_event_type_id bigint;
begin
  if v_actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select request.*
  into v_request
  from public.transfer_requests as request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'Transfer request not found' using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.admin_users as admin_user
    where admin_user.id = v_actor_id
  )
  into v_is_admin;

  if v_actor_id = v_request.to_user_id then
    v_actor_role := 'recipient';
  elsif v_is_admin then
    v_actor_role := 'administrator';
  else
    raise exception 'Only the recipient or an administrator can reject this transfer'
      using errcode = '42501';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Transfer request is not pending' using errcode = '22023';
  end if;

  perform 1
  from public.objects as object
  where object.id = v_request.object_id
    and object.current_owner_id = v_request.to_user_id
  for update;

  if not found then
    raise exception 'Object ownership changed before rejection'
      using errcode = '40001';
  end if;

  update public.transfer_requests
  set status = 'rejected',
      reason = coalesce(p_reason, reason),
      updated_at = now()
  where id = v_request.id;

  select event_type.id
  into v_transfer_event_type_id
  from public.event_types as event_type
  where event_type.label = 'transfer';

  if v_transfer_event_type_id is null then
    raise exception 'Transfer event type is not configured';
  end if;

  insert into public.events (
    group_id,
    object_id,
    event_type_id,
    e_from,
    e_to,
    extra
  )
  values (
    v_request.group_id,
    v_request.object_id,
    v_transfer_event_type_id,
    v_request.to_user_id,
    v_request.from_user_id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'transfer_request_id', v_request.id,
        'action', 'rejected',
        'reason', p_reason,
        'acted_by', v_actor_id,
        'actor_role', v_actor_role
      )
    )
  );
end;
$$;

revoke all on function public.reject_transfer(bigint, text) from public, anon;
grant execute on function public.reject_transfer(bigint, text) to authenticated;
