import "server-only";

import type { Permission } from "@/lib/auth/permissions";
import {
  getAuthenticatedAccessContext,
  requireTenantPermission,
} from "@/lib/auth/tenant-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type TenantPermission = Extract<
  Permission,
  | "tenant.settings.update"
  | "tenant.users.roles.update"
  | "tenant.users.invite"
  | "tenant.reports.generate"
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
    throw new Error("Authentication is required.");
  }

  const context = await getAuthenticatedAccessContext(supabase, user);
  const tenantId = requireTenantPermission(context, permission);

  return { supabase, context, tenantId };
}
