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

  const [operatorResult, profileResult] = await Promise.all([
    supabase.rpc("is_platform_operator"),
    supabase
      .from("user_profiles")
      .select("tenant_id, tenant_role")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (operatorResult.error) {
    throw new Error(`Unable to resolve platform access: ${operatorResult.error.message}`);
  }
  if (profileResult.error) {
    throw new Error(`Unable to resolve tenant membership: ${profileResult.error.message}`);
  }

  const rawTenantRole = profileResult.data?.tenant_role;
  if (rawTenantRole !== undefined && rawTenantRole !== null && !isTenantRole(rawTenantRole)) {
    throw new Error("The authenticated user has an unsupported tenant role.");
  }

  const tenantRole = rawTenantRole ?? null;
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

  return {
    userId: user.id,
    tenantId: profileResult.data?.tenant_id ?? null,
    tenantRole,
    isPlatformOperator,
    roles,
    permissions: permissionsForRoles(roles),
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
