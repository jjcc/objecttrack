import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  isTenantRole,
  permissionsForRoles,
  toAppTenantRole,
  type AppRole,
  type Permission,
  type TenantRole,
} from "./permissions";

export const TENANT_EDITIONS = ["simple", "full"] as const;
export type TenantEdition = (typeof TENANT_EDITIONS)[number];

export const WORKSPACE_KINDS = [
  "family",
  "business",
  "club",
  "collector",
  "other",
] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export const MEMBER_VISIBILITIES = ["private", "shared"] as const;
export type MemberVisibility = (typeof MEMBER_VISIBILITIES)[number];

export type TenantStatus = "active" | "suspended";

export interface TenantEntitlements {
  maxUsers: number | null;
  maxObjects: number | null;
  customCategories: boolean;
  groups: boolean;
  advancedTransfers: boolean;
  reports: boolean;
  auditUi: boolean;
}

const NO_TENANT_ENTITLEMENTS: TenantEntitlements = {
  maxUsers: null,
  maxObjects: null,
  customCategories: false,
  groups: false,
  advancedTransfers: false,
  reports: false,
  auditUi: false,
};

function includesValue<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function validatedValue<T extends string>(
  values: readonly T[],
  value: unknown,
  message: string
): T {
  if (!includesValue(values, value)) {
    throw new Error(message);
  }
  return value;
}

export type AuthorizationErrorCode =
  | "unauthenticated"
  | "membership_required"
  | "forbidden"
  | "tenant_mismatch"
  | "mfa_required";

export class AuthorizationError extends Error {
  readonly status: 401 | 403;
  readonly code: AuthorizationErrorCode;

  constructor(code: AuthorizationErrorCode, message: string) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
    this.status = code === "unauthenticated" ? 401 : 403;
  }
}

export interface AccessContext {
  userId: string;
  tenantId: number | null;
  tenantRole: TenantRole | null;
  tenantEdition: TenantEdition | null;
  workspaceKind: WorkspaceKind | null;
  memberVisibility: MemberVisibility | null;
  tenantStatus: TenantStatus | null;
  entitlements: TenantEntitlements;
  isPlatformOperator: boolean;
  roles: readonly AppRole[];
  permissions: ReadonlySet<Permission>;
}

type ServerSupabaseClient = SupabaseClient<Database>;

export async function getAuthenticatedAccessContext(
  supabase: ServerSupabaseClient,
  authenticatedUser?: User
): Promise<AccessContext> {
  let user = authenticatedUser;

  if (!user) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new AuthorizationError("unauthenticated", "Authentication is required.");
    }
    user = data.user;
  }

  const [operatorResult, profileResult, productResult] = await Promise.all([
    supabase.rpc("is_platform_operator"),
    supabase
      .from("user_profiles")
      .select("tenant_id, tenant_role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("current_tenant_product_context"),
  ]);

  if (operatorResult.error) {
    throw new Error(`Unable to resolve platform access: ${operatorResult.error.message}`);
  }
  if (profileResult.error) {
    throw new Error(`Unable to resolve tenant membership: ${profileResult.error.message}`);
  }
  if (productResult.error) {
    throw new Error(`Unable to resolve tenant product context: ${productResult.error.message}`);
  }

  const rawTenantRole = profileResult.data?.tenant_role;
  if (rawTenantRole !== undefined && rawTenantRole !== null && !isTenantRole(rawTenantRole)) {
    throw new Error("The authenticated user has an unsupported tenant role.");
  }

  const tenantRole = rawTenantRole ?? null;
  const product = productResult.data?.[0] ?? null;

  if (tenantRole && !product) {
    throw new Error("The tenant product context is unavailable.");
  }
  const tenantEdition = product
    ? validatedValue(
        TENANT_EDITIONS,
        product.edition,
        "The tenant has an unsupported product edition."
      )
    : null;
  const workspaceKind = product?.workspace_kind == null
    ? null
    : validatedValue(
        WORKSPACE_KINDS,
        product.workspace_kind,
        "The tenant has an unsupported workspace kind."
      );
  const memberVisibility = product
    ? validatedValue(
        MEMBER_VISIBILITIES,
        product.member_visibility,
        "The tenant has an unsupported member visibility."
      )
    : null;
  const tenantStatus = product
    ? validatedValue(
        ["active", "suspended"] as const,
        product.tenant_status,
        "The tenant has an unsupported status."
      )
    : null;

  const isPlatformOperator = operatorResult.data === true;
  const roles: AppRole[] = [];

  if (tenantRole) roles.push(toAppTenantRole(tenantRole));
  if (isPlatformOperator) roles.push("platform_operator");

  if (roles.length === 0) {
    throw new AuthorizationError(
      "membership_required",
      "An active tenant membership or platform-operator assignment is required."
    );
  }

  const entitlements: TenantEntitlements = product
    ? {
        maxUsers: product.max_users ?? null,
        maxObjects: product.max_objects ?? null,
        customCategories: product.custom_categories,
        groups: product.groups,
        advancedTransfers: product.advanced_transfers,
        reports: product.reports,
        auditUi: product.audit_ui,
      }
    : NO_TENANT_ENTITLEMENTS;
  const permissions = new Set(permissionsForRoles(roles));
  if (!entitlements.customCategories) permissions.delete("tenant.categories.manage");
  if (!entitlements.groups) permissions.delete("tenant.groups.manage");
  if (!entitlements.advancedTransfers) {
    permissions.delete("tenant.transfers.participate");
    permissions.delete("tenant.transfers.manage");
  }
  if (!entitlements.reports) permissions.delete("tenant.reports.generate");
  if (!entitlements.auditUi) permissions.delete("tenant.audit.read");

  return {
    userId: user.id,
    tenantId: profileResult.data?.tenant_id ?? null,
    tenantRole,
    tenantEdition,
    workspaceKind,
    memberVisibility,
    tenantStatus,
    entitlements,
    isPlatformOperator,
    roles,
    permissions,
  };
}

export function requirePermission(
  context: AccessContext,
  permission: Permission
): void {
  if (!context.permissions.has(permission)) {
    throw new AuthorizationError("forbidden", "You do not have permission to perform this action.");
  }
}

export function requireTenantPermission(
  context: AccessContext,
  permission: Extract<Permission, `tenant.${string}`>,
  requestedTenantId?: number | null
): number {
  requirePermission(context, permission);

  if (context.tenantId === null) {
    throw new AuthorizationError("membership_required", "A tenant membership is required.");
  }

  if (requestedTenantId != null && requestedTenantId !== context.tenantId) {
    throw new AuthorizationError("tenant_mismatch", "Cross-tenant access is forbidden.");
  }

  return context.tenantId;
}

export function requirePlatformPermission(
  context: AccessContext,
  permission: Extract<Permission, `platform.${string}`>
): void {
  requirePermission(context, permission);
}
