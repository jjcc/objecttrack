export const TENANT_ROLES = ["member", "admin", "owner"] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export const APP_ROLES = [
  "tenant_member",
  "tenant_admin",
  "tenant_owner",
  "platform_operator",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const PERMISSIONS = [
  "tenant.settings.update",
  "tenant.users.read",
  "tenant.users.invite",
  "tenant.users.roles.update",
  "tenant.data.read",
  "tenant.data.update",
  "tenant.reports.generate",
  "platform.tenants.create",
  "platform.tenants.suspend",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const tenantMemberPermissions = [
  "tenant.users.read",
  "tenant.data.read",
] as const satisfies readonly Permission[];

const tenantAdminPermissions = [
  ...tenantMemberPermissions,
  "tenant.settings.update",
  "tenant.users.invite",
  "tenant.users.roles.update",
  "tenant.data.update",
  "tenant.reports.generate",
] as const satisfies readonly Permission[];

export const ROLE_PERMISSIONS = {
  tenant_member: tenantMemberPermissions,
  tenant_admin: tenantAdminPermissions,
  tenant_owner: tenantAdminPermissions,
  platform_operator: ["platform.tenants.create", "platform.tenants.suspend"],
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
