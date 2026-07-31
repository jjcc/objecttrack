import "server-only";

import type { Permission } from "@/lib/auth/permissions";
import {
  getAuthenticatedAccessContext,
  requireTenantPermission,
} from "@/lib/auth/tenant-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/observability/security";

type TenantPermission = Extract<
  Permission,
  | "tenant.settings.update"
  | "tenant.users.roles.update"
  | "tenant.users.invite"
  | "tenant.reports.generate"
  | "tenant.audit.read"
>;

export async function requireTenantAdminAccess(
  permission: TenantPermission = "tenant.settings.update"
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    logSecurityEvent({
      event: "authorization_denied",
      area: "tenant_admin",
      permission,
      reason: "unauthenticated",
    });
    throw new Error("Authentication is required.");
  }

  try {
    const context = await getAuthenticatedAccessContext(supabase, user);
    const tenantId = requireTenantPermission(context, permission);

    return { supabase, context, tenantId };
  } catch (accessError) {
    logSecurityEvent({
      event: "authorization_denied",
      area: "tenant_admin",
      permission,
      actorId: user.id,
      reason:
        accessError instanceof Error ? accessError.message : "access denied",
    });
    throw accessError;
  }
}
