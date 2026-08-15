-- Move two operational permissions from Owner-only to Admin.
--
-- Rationale: Owner was Admin plus six permissions. Two of those six are
-- day-to-day operational work rather than governance:
--
--   tenant.groups.manage     organizing groups is routine administration
--   tenant.reports.generate  running a tenant report is routine administration
--
-- Owner keeps the governance core, which is what makes the role distinct:
--
--   tenant.settings.update   how the workspace is configured
--   tenant.billing.manage    what the workspace costs
--   tenant.owners.manage     who holds authority
--   tenant.audit.read        the record of what happened
--
-- This narrows the Owner/Admin gap from six permissions to four without
-- collapsing the roles. Keeping tenant.owners.manage Owner-only preserves the
-- last-authority guarantee: an Admin cannot promote itself or demote an Owner.
-- Keeping tenant.audit.read Owner-only preserves accountability, since an actor
-- should not have sole control of the record of its own actions.
--
-- This partially amends the Phase 2 first-release decision that removed Admin
-- report access. Audit access remains removed from Admin as originally decided.
--
-- Additive and idempotent: two catalog rows plus policy renames. No schema
-- change, no function change, and no change to entitlement gating -- Simple
-- workspaces still cannot reach groups or reports because has_permission()
-- checks has_tenant_entitlement() independently of role.

INSERT INTO private.role_permissions (role, permission)
VALUES
  ('admin', 'tenant.groups.manage'),
  ('admin', 'tenant.reports.generate')
ON CONFLICT (role, permission) DO NOTHING;

-- The groups policies are already permission-driven via
-- has_permission('tenant.groups.manage', tenant_id); only their names still say
-- "owners", which is now inaccurate. Rename them to match the enforcement.
ALTER POLICY "Tenant owners create groups" ON public.groups
  RENAME TO "Tenant managers create groups";
ALTER POLICY "Tenant owners update groups" ON public.groups
  RENAME TO "Tenant managers update groups";
ALTER POLICY "Tenant owners delete groups" ON public.groups
  RENAME TO "Tenant managers delete groups";
