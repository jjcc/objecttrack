import "server-only";

import type { Permission } from "@/lib/auth/permissions";
import {
  getAuthenticatedAccessContext,
  requirePlatformPermission,
} from "@/lib/auth/tenant-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PlatformPermission = Extract<Permission, `platform.${string}`>;

export async function requirePlatformAccess(permission: PlatformPermission) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Authentication is required.");
  }

  const context = await getAuthenticatedAccessContext(supabase, user);
  requirePlatformPermission(context, permission);

  return { supabase, context };
}
