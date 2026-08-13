-- Phase 2a: add Viewer and the granular permission vocabulary.
-- Legacy mappings remain active until the following activation migration.

ALTER TABLE public.user_profiles
  DROP CONSTRAINT user_profiles_tenant_role_check,
  ADD CONSTRAINT user_profiles_tenant_role_check
    CHECK (tenant_role IN ('viewer', 'member', 'admin', 'owner'));

ALTER TABLE private.role_permissions
  DROP CONSTRAINT role_permissions_role_check,
  ADD CONSTRAINT role_permissions_role_check
    CHECK (
      role IN (
        'viewer',
        'member',
        'admin',
        'owner',
        'platform_operator'
      )
    );

ALTER TABLE private.tenant_invitations
  DROP CONSTRAINT tenant_invitations_intended_role_check,
  ADD CONSTRAINT tenant_invitations_intended_role_check
    CHECK (intended_role IN ('viewer', 'member', 'admin', 'owner'));

INSERT INTO private.permission_definitions (code, description)
VALUES
  ('tenant.admin.access', 'Access tenant-administration workflows'),
  ('tenant.billing.manage', 'Manage tenant billing and plan selection'),
  ('tenant.owners.manage', 'Grant, demote, or remove tenant Owners'),
  ('tenant.objects.read_all', 'Read every object in the current tenant'),
  ('tenant.objects.read_assigned', 'Read objects assigned to the caller'),
  ('tenant.objects.manage', 'Create, update, and delete tenant objects'),
  ('tenant.categories.manage', 'Manage tenant object categories'),
  ('tenant.event_types.manage', 'Manage tenant event types'),
  ('tenant.groups.manage', 'Manage tenant groups'),
  ('tenant.custom_fields.manage', 'Manage tenant object custom fields'),
  ('tenant.transfers.participate', 'Participate in an eligible object transfer'),
  ('tenant.transfers.manage', 'Administer tenant object transfers'),
  ('tenant.holder.lookup', 'Use controlled current-holder lookup')
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO private.role_permissions (role, permission)
VALUES
  ('viewer', 'tenant.objects.read_assigned'),
  ('viewer', 'tenant.holder.lookup'),
  ('member', 'tenant.objects.read_assigned'),
  ('member', 'tenant.transfers.participate'),
  ('member', 'tenant.holder.lookup'),
  ('admin', 'tenant.admin.access'),
  ('admin', 'tenant.users.read'),
  ('admin', 'tenant.users.invite'),
  ('admin', 'tenant.users.roles.update'),
  ('admin', 'tenant.objects.read_all'),
  ('admin', 'tenant.objects.manage'),
  ('admin', 'tenant.categories.manage'),
  ('admin', 'tenant.event_types.manage'),
  ('admin', 'tenant.custom_fields.manage'),
  ('admin', 'tenant.transfers.participate'),
  ('admin', 'tenant.transfers.manage'),
  ('admin', 'tenant.holder.lookup'),
  ('owner', 'tenant.admin.access'),
  ('owner', 'tenant.settings.update'),
  ('owner', 'tenant.billing.manage'),
  ('owner', 'tenant.owners.manage'),
  ('owner', 'tenant.users.read'),
  ('owner', 'tenant.users.invite'),
  ('owner', 'tenant.users.roles.update'),
  ('owner', 'tenant.objects.read_all'),
  ('owner', 'tenant.objects.manage'),
  ('owner', 'tenant.categories.manage'),
  ('owner', 'tenant.event_types.manage'),
  ('owner', 'tenant.groups.manage'),
  ('owner', 'tenant.custom_fields.manage'),
  ('owner', 'tenant.transfers.participate'),
  ('owner', 'tenant.transfers.manage'),
  ('owner', 'tenant.holder.lookup'),
  ('owner', 'tenant.reports.generate'),
  ('owner', 'tenant.audit.read')
ON CONFLICT (role, permission) DO NOTHING;
