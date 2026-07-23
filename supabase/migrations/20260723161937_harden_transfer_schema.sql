do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transfer_requests_distinct_users_check'
      and conrelid = 'public.transfer_requests'::regclass
  ) then
    alter table public.transfer_requests
      add constraint transfer_requests_distinct_users_check
      check (from_user_id <> to_user_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'transfer_requests_status_check'
      and conrelid = 'public.transfer_requests'::regclass
  ) then
    alter table public.transfer_requests
      add constraint transfer_requests_status_check
      check (status in ('pending', 'approved', 'rejected'));
  end if;
end;
$$;

create unique index if not exists transfer_requests_one_pending_per_object_idx
  on public.transfer_requests (object_id)
  where status = 'pending';

create index if not exists objects_current_owner_id_idx
  on public.objects (current_owner_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users as admin_user
    where admin_user.id = (select auth.uid())
  );
$$;

drop policy if exists "Admins full access" on public.user_profiles;
create policy "Admins full access"
  on public.user_profiles
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Users see own profile" on public.user_profiles;
create policy "Users see own profile"
  on public.user_profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Admins full access" on public.groups;
create policy "Admins full access"
  on public.groups
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Users see own group" on public.groups;
create policy "Users see own group"
  on public.groups
  for select
  to authenticated
  using (
    id in (
      select profile.group_id
      from public.user_profiles as profile
      where profile.id = (select auth.uid())
    )
  );

drop policy if exists "Admins full access" on public.categories;
create policy "Admins full access"
  on public.categories
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Authenticated read" on public.categories;
create policy "Authenticated read"
  on public.categories
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Admins full access" on public.event_types;
create policy "Admins full access"
  on public.event_types
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Authenticated read" on public.event_types;
create policy "Authenticated read"
  on public.event_types
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Admins full access" on public.objects;
create policy "Admins full access"
  on public.objects
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Users see group objects" on public.objects;
create policy "Users see group objects"
  on public.objects
  for select
  to authenticated
  using (
    id in (
      select event.object_id
      from public.events as event
      where event.group_id in (
        select profile.group_id
        from public.user_profiles as profile
        where profile.id = (select auth.uid())
      )
    )
    or (select auth.uid()) is not null
  );

drop policy if exists "Admins full access" on public.events;
create policy "Admins full access"
  on public.events
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Users see group events" on public.events;
create policy "Users see group events"
  on public.events
  for select
  to authenticated
  using (
    group_id in (
      select profile.group_id
      from public.user_profiles as profile
      where profile.id = (select auth.uid())
    )
  );

drop policy if exists "Users insert own events" on public.events;
create policy "Users insert own events"
  on public.events
  for insert
  to authenticated
  with check (
    group_id in (
      select profile.group_id
      from public.user_profiles as profile
      where profile.id = (select auth.uid())
    )
    and e_from = (select auth.uid())
  );

drop policy if exists "Admins can read admin_users" on public.admin_users;
create policy "Admins can read admin_users"
  on public.admin_users
  for select
  to authenticated
  using ((select auth.uid()) is not null);
