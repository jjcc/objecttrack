export const TENANT_ROLES = ["viewer", "member", "admin", "owner"] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export const APP_ROLES = [
  "tenant_viewer",
  "tenant_member",
  "tenant_admin",
  "tenant_owner",
  "platform_operator",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const PERMISSIONS = [
  "tenant.admin.access",
  "tenant.settings.update",
  "tenant.billing.manage",
  "tenant.owners.manage",
  "tenant.users.read",
  "tenant.users.invite",
  "tenant.users.roles.update",
  "tenant.objects.read_all",
  "tenant.objects.read_assigned",
  "tenant.objects.manage",
  "tenant.categories.manage",
  "tenant.event_types.manage",
  "tenant.groups.manage",
  "tenant.custom_fields.manage",
  "tenant.transfers.participate",
  "tenant.transfers.manage",
  "tenant.holder.lookup",
  "tenant.reports.generate",
  "tenant.audit.read",
  "platform.tenants.create",
  "platform.tenants.update",
  "platform.tenants.suspend",
  "platform.audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const tenantViewerPermissions = [
  "tenant.objects.read_assigned",
  "tenant.holder.lookup",
] as const satisfies readonly Permission[];

const tenantMemberPermissions = [
  ...tenantViewerPermissions,
  "tenant.transfers.participate",
] as const satisfies readonly Permission[];

const tenantAdminPermissions = [
  "tenant.admin.access",
  "tenant.users.read",
  "tenant.users.invite",
  "tenant.users.roles.update",
  "tenant.objects.read_all",
  "tenant.objects.manage",
  "tenant.categories.manage",
  "tenant.event_types.manage",
  "tenant.custom_fields.manage",
  "tenant.transfers.participate",
  "tenant.transfers.manage",
  "tenant.holder.lookup",
] as const satisfies readonly Permission[];

const tenantOwnerPermissions = [
  ...tenantAdminPermissions,
  "tenant.settings.update",
  "tenant.billing.manage",
  "tenant.owners.manage",
  "tenant.groups.manage",
  "tenant.reports.generate",
  "tenant.audit.read",
] as const satisfies readonly Permission[];

export const ROLE_PERMISSIONS = {
  tenant_viewer: tenantViewerPermissions,
  tenant_member: tenantMemberPermissions,
  tenant_admin: tenantAdminPermissions,
  tenant_owner: tenantOwnerPermissions,
  platform_operator: [
    "platform.tenants.create",
    "platform.tenants.update",
    "platform.tenants.suspend",
    "platform.audit.read",
  ],
} as const satisfies Record<AppRole, readonly Permission[]>;

export function toAppTenantRole(role: TenantRole): AppRole {
  return `tenant_${role}` as AppRole;
}

export function isTenantRole(value: unknown): value is TenantRole {
  return typeof value === "string" && TENANT_ROLES.includes(value as TenantRole);
}

export function permissionsForRoles(roles: readonly AppRole[]): ReadonlySet<Permission> {
  return new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]));
}
