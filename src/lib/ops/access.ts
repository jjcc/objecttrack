import "server-only";

import type { Permission } from "@/lib/auth/permissions";
import {
  AuthorizationError,
  getAuthenticatedAccessContext,
  requirePlatformPermission,
} from "@/lib/auth/tenant-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/observability/security";

type PlatformPermission = Extract<Permission, `platform.${string}`>;

export async function requirePlatformAccess(permission: PlatformPermission) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    logSecurityEvent({
      event: "authorization_denied",
      area: "platform_ops",
      permission,
      reason: "unauthenticated",
    });
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
    logSecurityEvent({
      event: "mfa_required",
      area: "platform_ops",
      permission,
      actorId: user.id,
      reason: "session is below AAL2",
    });
    throw new AuthorizationError(
      "mfa_required",
      "Platform operations require multi-factor authentication at AAL2."
    );
  }

  try {
    const context = await getAuthenticatedAccessContext(supabase, user);
    requirePlatformPermission(context, permission);

    return { supabase, context };
  } catch (accessError) {
    logSecurityEvent({
      event: "authorization_denied",
      area: "platform_ops",
      permission,
      actorId: user.id,
      reason:
        accessError instanceof Error ? accessError.message : "access denied",
    });
    throw accessError;
  }
}
