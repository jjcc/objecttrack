-- Rollback-only integration verification for Phase 1 tenant authorization.
--
-- Run after all migrations against a local/disposable Supabase database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/verify_tenant_authorization.sql
--
-- The connecting role must be able to seed auth.users and SET LOCAL ROLE to
-- authenticated. A successful run prints a completion message and persists no
-- fixture data.

begin;

-- Fixed IDs make the authenticated sections readable. They live in a reserved
-- high range and are rolled back at the end of this script.
insert into public.tenant (id, institution_name, description)
overriding system value
values
  (910000001, 'Tenant authorization test A', 'Rollback-only fixture'),
  (910000002, 'Tenant authorization test B', 'Rollback-only fixture');

insert into auth.users (id, aud, role, is_sso_user, is_anonymous)
values
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', false, false),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', false, false),
  ('91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', false, false),
  ('91000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', false, false),
  ('91000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', false, false),
  ('91000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', false, false);

insert into private.platform_operators (user_id)
values ('91000000-0000-4000-8000-000000000005');

insert into public.groups (id, tenant_id, title)
overriding system value
values
  (910000001, 910000001, 'Tenant A group'),
  (910000002, 910000002, 'Tenant B group');

insert into public.user_profiles (
  id,
  tenant_id,
  tenant_role,
  group_id,
  first_name
)
values
  ('91000000-0000-4000-8000-000000000001', 910000001, 'member', 910000001, 'Member A'),
  ('91000000-0000-4000-8000-000000000002', 910000001, 'admin', 910000001, 'Admin A'),
  ('91000000-0000-4000-8000-000000000003', 910000001, 'owner', 910000001, 'Owner A'),
  ('91000000-0000-4000-8000-000000000004', 910000002, 'admin', 910000002, 'Admin B'),
  ('91000000-0000-4000-8000-000000000006', 910000002, 'member', 910000002, 'Member B');

insert into public.categories (id, tenant_id, name)
overriding system value
values
  (910000001, 910000001, 'Tenant A category'),
  (910000002, 910000002, 'Tenant B category');

insert into public.event_types (id, tenant_id, label)
overriding system value
values
  (910000001, 910000001, 'tenant-authorization-test-a'),
  (910000002, 910000002, 'tenant-authorization-test-b');

insert into public.objects (id, tenant_id, name, category_id, current_owner_id)
overriding system value
values
  (
    910000001,
    910000001,
    'Tenant A object',
    910000001,
    '91000000-0000-4000-8000-000000000001'
  ),
  (
    910000002,
    910000002,
    'Tenant B object',
    910000002,
    '91000000-0000-4000-8000-000000000004'
  );

insert into public.events (
  id,
  tenant_id,
  group_id,
  object_id,
  event_type_id,
  e_from,
  extra
)
overriding system value
values
  (
    910000001,
    910000001,
    910000001,
    910000001,
    910000001,
    '91000000-0000-4000-8000-000000000001',
    '{"test":true}'::jsonb
  ),
  (
    910000002,
    910000002,
    910000002,
    910000002,
    910000002,
    '91000000-0000-4000-8000-000000000004',
    '{"test":true}'::jsonb
  );

insert into public.object_custom_schemas (id, tenant_id, fields)
overriding system value
values
  (910000001, 910000001, '[]'::jsonb),
  (910000002, 910000002, '[]'::jsonb);

insert into public.transfer_requests (
  id,
  tenant_id,
  object_id,
  from_user_id,
  to_user_id,
  group_id,
  status
)
overriding system value
values
  (
    910000001,
    910000001,
    910000001,
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    910000001,
    'pending'
  ),
  (
    910000002,
    910000002,
    910000002,
    '91000000-0000-4000-8000-000000000006',
    '91000000-0000-4000-8000-000000000004',
    910000002,
    'pending'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- A regular member receives tenant context from their profile, sees only their
-- tenant, and receives none of the tenant-management permissions.
do $$
declare
  v_count bigint;
  v_denied boolean;
  v_rows bigint;
begin
  if public.current_tenant_id() is distinct from 910000001 then
    raise exception 'Member tenant context was not derived from membership';
  end if;
  if public.current_tenant_role() is distinct from 'member' then
    raise exception 'Member tenant role was not derived from membership';
  end if;
  if public.is_admin() or public.is_platform_operator() then
    raise exception 'Member unexpectedly received an elevated role';
  end if;

  if not public.has_permission('tenant.objects.read_assigned')
     or not public.has_permission('tenant.transfers.participate') then
    raise exception 'Member is missing a tenant read permission';
  end if;

  if public.has_permission('tenant.settings.update')
     or public.has_permission('tenant.users.invite')
     or public.has_permission('tenant.users.roles.update')
     or public.has_permission('tenant.objects.manage')
     or public.has_permission('tenant.users.read')
     or public.has_permission('tenant.reports.generate')
     or public.has_permission('platform.tenants.create')
     or public.has_permission('platform.tenants.suspend') then
    raise exception 'Member unexpectedly received a management permission';
  end if;

  select count(*) into v_count
  from public.tenant
  where id = 910000001;
  if v_count <> 1 then
    raise exception 'Member cannot read their own tenant';
  end if;

  select count(*) into v_count
  from public.tenant
  where id = 910000002;
  if v_count <> 0 then
    raise exception 'Member can read another tenant';
  end if;

  select count(*) into v_count
  from public.groups
  where id in (910000001, 910000002);
  if v_count <> 1 then
    raise exception 'Group read isolation failed for member';
  end if;

  select count(*) into v_count
  from public.user_profiles
  where id = '91000000-0000-4000-8000-000000000004';
  if v_count <> 0 then
    raise exception 'Member can read another tenant profile';
  end if;

  select count(*) into v_count
  from public.categories
  where id in (910000001, 910000002);
  if v_count <> 1 then
    raise exception 'Category read isolation failed for member';
  end if;

  select count(*) into v_count
  from public.event_types
  where id in (910000001, 910000002);
  if v_count <> 1 then
    raise exception 'Event type read isolation failed for member';
  end if;

  select count(*) into v_count
  from public.objects
  where id in (910000001, 910000002);
  if v_count <> 1 then
    raise exception 'Object read isolation failed for member';
  end if;

  select count(*) into v_count
  from public.events
  where id in (910000001, 910000002);
  if v_count <> 1 then
    raise exception 'Event read isolation failed for member';
  end if;

  select count(*) into v_count
  from public.object_custom_schemas
  where id in (910000001, 910000002);
  if v_count <> 1 then
    raise exception 'Object custom schema read isolation failed for member';
  end if;

  select count(*) into v_count
  from public.transfer_requests
  where id in (910000001, 910000002);
  if v_count <> 1 then
    raise exception 'Transfer request read isolation failed for member';
  end if;

  select count(*) into v_count
  from public.profile_names(
    array['91000000-0000-4000-8000-000000000004'::uuid]
  );
  if v_count <> 0 then
    raise exception 'Profile name helper exposed another tenant';
  end if;

  v_denied := false;
  begin
    perform public.request_transfer(
      910000002,
      '91000000-0000-4000-8000-000000000004'
    );
  exception
    when sqlstate 'P0002' then v_denied := true;
  end;
  if not v_denied then
    raise exception 'Transfer RPC accepted another tenant object';
  end if;

  update public.tenant
  set description = 'member update must not apply'
  where id = 910000001;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'Member updated tenant settings';
  end if;

  update public.user_profiles
  set tenant_role = 'owner'
  where id = '91000000-0000-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'Member escalated their tenant role';
  end if;

  v_denied := false;
  begin
    insert into public.groups (tenant_id, title)
    values (910000002, 'forged-member-tenant-id');
  exception
    when sqlstate '42501' or sqlstate 'P0001' then v_denied := true;
  end;
  if not v_denied then
    raise exception 'Member inserted a row with a forged tenant_id';
  end if;
end;
$$;

-- Tenant admins receive tenant-management permissions, but remain scoped to
-- their own tenant and receive no platform permissions.
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000002',
  true
);

do $$
declare
  v_count bigint;
  v_denied boolean;
  v_rows bigint;
begin
  if public.current_tenant_id() is distinct from 910000001
     or public.current_tenant_role() is distinct from 'admin'
     or not public.is_admin() then
    raise exception 'Tenant admin role or tenant context is incorrect';
  end if;

  if not public.has_permission('tenant.admin.access')
     or not public.has_permission('tenant.objects.read_all')
     or not public.has_permission('tenant.users.read')
     or not public.has_permission('tenant.users.invite')
     or not public.has_permission('tenant.users.roles.update')
     or not public.has_permission('tenant.objects.manage')
     or public.has_permission('tenant.settings.update')
     or public.has_permission('tenant.reports.generate') then
    raise exception 'Tenant admin is missing a tenant-management permission';
  end if;
  if public.has_permission('platform.tenants.create')
     or public.has_permission('platform.tenants.suspend')
     or public.has_permission('tenant.objects.manage', 910000002) then
    raise exception 'Tenant admin received platform or cross-tenant permission';
  end if;

  v_denied := false;
  begin
    update public.user_profiles
    set tenant_role = 'owner'
    where id = '91000000-0000-4000-8000-000000000001';
  exception
    when sqlstate '42501' then v_denied := true;
  end;
  if not v_denied then
    raise exception 'Tenant admin granted the owner role';
  end if;

  v_denied := false;
  begin
    insert into public.groups (title)
    values ('admin-own-tenant-insert');
  exception when sqlstate '42501' then v_denied := true;
  end;
  if not v_denied then
    raise exception 'Admin created an Owner-only group';
  end if;

  v_denied := false;
  begin
    insert into public.groups (tenant_id, title)
    values (910000002, 'forged-admin-tenant-id');
  exception
    when sqlstate '42501' or sqlstate 'P0001' then v_denied := true;
  end;
  if not v_denied then
    raise exception 'Admin inserted a row with a forged tenant_id';
  end if;

  update public.groups
  set title = 'cross-tenant-update-must-not-apply'
  where id = 910000002;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'Admin updated another tenant group';
  end if;

  delete from public.objects where id = 910000002;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'Admin deleted another tenant object';
  end if;

  update public.object_custom_schemas
  set fields = '[{"name":"forbidden"}]'::jsonb
  where id = 910000002;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'Admin updated another tenant object schema';
  end if;

  v_denied := false;
  begin
    update public.groups
    set tenant_id = 910000002
    where id = 910000001;
    get diagnostics v_rows = row_count;
  exception
    when sqlstate '42501' or sqlstate 'P0001' then v_denied := true;
  end;
  if not v_denied and v_rows <> 0 then
    raise exception 'Admin moved a row into another tenant';
  end if;

  update public.tenant
  set description = 'admin own-tenant update'
  where id = 910000001;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'Admin updated Owner-only tenant settings';
  end if;

  update public.tenant
  set description = 'cross-tenant update must not apply'
  where id = 910000002;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'Admin updated another tenant';
  end if;
end;
$$;

-- Owners inherit the tenant permission catalog but do not implicitly become
-- platform operators.
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000003',
  true
);

do $$
declare
  v_count bigint;
begin
  if public.current_tenant_role() is distinct from 'owner'
     or not public.is_admin() then
    raise exception 'Owner did not inherit tenant-administrator behavior';
  end if;
  if not public.has_permission('tenant.settings.update')
     or not public.has_permission('tenant.objects.read_all')
     or not public.has_permission('tenant.users.read')
     or not public.has_permission('tenant.users.invite')
     or not public.has_permission('tenant.users.roles.update')
     or not public.has_permission('tenant.objects.manage')
     or not public.has_permission('tenant.reports.generate') then
    raise exception 'Owner is missing a tenant-management permission';
  end if;
  if public.is_platform_operator()
     or public.has_permission('platform.tenants.create')
     or public.has_permission('platform.tenants.suspend') then
    raise exception 'Owner unexpectedly received platform access';
  end if;
  insert into public.groups (title) values ('owner-own-tenant-insert');
  select count(*) into v_count from public.groups
  where title = 'owner-own-tenant-insert' and tenant_id = 910000001;
  if v_count <> 1 then
    raise exception 'Owner could not create a tenant group';
  end if;
  update public.tenant set description = 'owner own-tenant update'
  where id = 910000001;
end;
$$;

-- Platform operators have a separate global grant. With no tenant membership,
-- they receive no tenant context or tenant-management permission.
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000005',
  true
);
select set_config('request.jwt.claim.aal', 'aal2', true);

do $$
declare
  v_count bigint;
  v_denied boolean := false;
begin
  if public.current_tenant_id() is not null
     or public.current_tenant_role() is not null then
    raise exception 'Platform operator unexpectedly received tenant context';
  end if;
  if not public.is_platform_operator()
     or not public.has_permission('platform.tenants.create')
     or not public.has_permission('platform.tenants.suspend') then
    raise exception 'Platform operator is missing a platform permission';
  end if;
  if public.is_admin()
     or public.has_permission('tenant.objects.read_all')
     or public.has_permission('tenant.users.read')
     or public.has_permission('tenant.settings.update')
     or public.has_permission('tenant.users.invite')
     or public.has_permission('tenant.users.roles.update')
     or public.has_permission('tenant.objects.manage')
     or public.has_permission('tenant.reports.generate') then
    raise exception 'Platform operator unexpectedly received a tenant permission';
  end if;

  select count(*) into v_count from public.tenant;
  if v_count <> 0 then
    raise exception 'Profile-less platform operator can directly read tenant rows';
  end if;

  begin
    execute 'select 1 from private.platform_operators limit 1';
  exception
    when sqlstate '42501' then v_denied := true;
  end;
  if not v_denied then
    raise exception 'Authenticated caller can query private platform operators';
  end if;
end;
$$;

reset role;

-- Defense in depth: prove the rejected forged values never reached storage.
do $$
begin
  if exists (
    select 1
    from public.groups
    where title in ('forged-member-tenant-id', 'forged-admin-tenant-id')
  ) then
    raise exception 'A forged tenant_id row persisted';
  end if;
  if exists (
    select 1
    from public.groups
    where id = 910000002
      and title = 'cross-tenant-update-must-not-apply'
  ) then
    raise exception 'A cross-tenant group update persisted';
  end if;
  if exists (
    select 1
    from public.tenant
    where id = 910000002
      and description = 'cross-tenant update must not apply'
  ) then
    raise exception 'A cross-tenant tenant update persisted';
  end if;
end;
$$;

rollback;

select 'tenant authorization verification passed' as result;
