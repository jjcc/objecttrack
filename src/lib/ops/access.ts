import "server-only";

import type { Permission } from "@/lib/auth/permissions";
import {
  AuthorizationError,
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
    throw new AuthorizationError("unauthenticated", "Authentication is required.");
  }

  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) {
    throw new Error(
      `Unable to verify operator authentication strength: ${assuranceError.message}`
    );
  }
  if (assurance.currentLevel !== "aal2") {
    throw new AuthorizationError(
      "mfa_required",
      "Platform operations require multi-factor authentication at AAL2."
    );
  }

  const context = await getAuthenticatedAccessContext(supabase, user);
  requirePlatformPermission(context, permission);

  return { supabase, context };
}
