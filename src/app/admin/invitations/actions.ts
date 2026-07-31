"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendTenantInvitationEmail } from "@/lib/email/invitations";
import { generateInvitationToken } from "@/lib/invitations/token";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";

export type InvitationActionState = {
  status: "idle" | "error" | "success" | "warning";
  message: string;
};

const createSchema = z.object({
  email: z.string().trim().email(),
  intendedRole: z.enum(["member", "admin", "owner"]),
  expiresInDays: z.coerce.number().int().min(1).max(30),
});

const invitationSchema = z.object({
  invitationId: z.string().uuid(),
});

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function actionError(error: unknown): InvitationActionState {
  return {
    status: "error",
    message: error instanceof Error ? error.message : "Invitation operation failed.",
  };
}

async function invitationUrl(token: string): Promise<string> {
  const requestHeaders = await headers();
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = configuredOrigin ?? (host ? protocol + "://" + host : null);
  if (!origin) throw new Error("Application URL is not configured.");

  const url = new URL("/invitations/accept", origin);
  url.searchParams.set("token", token);
  return url.toString();
}

async function recordDelivery(
  invitationId: string,
  succeeded: boolean,
  errorMessage?: string
) {
  const { supabase } = await requireTenantAdminAccess("tenant.users.invite");
  const { error } = await supabase.rpc("record_tenant_invitation_delivery", {
    p_invitation_id: invitationId,
    p_succeeded: succeeded,
    p_error: errorMessage,
  });
  if (error) throw new Error(error.message);
}

export async function createTenantInvitationAction(
  _previousState: InvitationActionState,
  formData: FormData
): Promise<InvitationActionState> {
  const parsed = createSchema.safeParse({
    email: formValue(formData, "email"),
    intendedRole: formValue(formData, "intendedRole"),
    expiresInDays: formValue(formData, "expiresInDays"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the invitation values.",
    };
  }

  try {
    const { token, tokenHash } = generateInvitationToken();
    const expiresAt = new Date(
      Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const { supabase } = await requireTenantAdminAccess("tenant.users.invite");
    const { data, error } = await supabase.rpc("create_tenant_invitation", {
      p_invited_email: parsed.data.email,
      p_intended_role: parsed.data.intendedRole,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);
    const invitation = data?.[0];
    if (!invitation) throw new Error("Invitation creation returned no record.");

    const delivery = await sendTenantInvitationEmail({
      to: invitation.invited_email,
      tenantName: invitation.tenant_name,
      intendedRole: invitation.intended_role,
      invitationUrl: await invitationUrl(token),
      expiresAt: invitation.expires_at,
    });
    await recordDelivery(
      invitation.invitation_id,
      delivery.ok,
      delivery.ok ? undefined : delivery.error
    );

    revalidatePath("/admin/invitations");
    return delivery.ok
      ? { status: "success", message: "Invitation created and sent." }
      : {
          status: "warning",
          message: "Invitation created, but delivery failed: " + delivery.error,
        };
  } catch (error) {
    return actionError(error);
  }
}

export async function resendTenantInvitationAction(
  _previousState: InvitationActionState,
  formData: FormData
): Promise<InvitationActionState> {
  const parsed = invitationSchema.safeParse({
    invitationId: formValue(formData, "invitationId"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Invitation ID is invalid." };
  }

  try {
    const { token, tokenHash } = generateInvitationToken();
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const { supabase } = await requireTenantAdminAccess("tenant.users.invite");
    const { data, error } = await supabase.rpc(
      "prepare_tenant_invitation_resend",
      {
        p_invitation_id: parsed.data.invitationId,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
      }
    );
    if (error) throw new Error(error.message);
    const invitation = data?.[0];
    if (!invitation) throw new Error("Pending invitation was not found.");

    const delivery = await sendTenantInvitationEmail({
      to: invitation.invited_email,
      tenantName: invitation.tenant_name,
      intendedRole: invitation.intended_role,
      invitationUrl: await invitationUrl(token),
      expiresAt: invitation.expires_at,
    });
    await recordDelivery(
      parsed.data.invitationId,
      delivery.ok,
      delivery.ok ? undefined : delivery.error
    );

    revalidatePath("/admin/invitations");
    return delivery.ok
      ? { status: "success", message: "Invitation resent." }
      : {
          status: "warning",
          message: "A new token was saved, but delivery failed: " + delivery.error,
        };
  } catch (error) {
    return actionError(error);
  }
}

export async function revokeTenantInvitationAction(
  _previousState: InvitationActionState,
  formData: FormData
): Promise<InvitationActionState> {
  const parsed = invitationSchema.safeParse({
    invitationId: formValue(formData, "invitationId"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Invitation ID is invalid." };
  }

  try {
    const { supabase } = await requireTenantAdminAccess("tenant.users.invite");
    const { error } = await supabase.rpc("revoke_tenant_invitation", {
      p_invitation_id: parsed.data.invitationId,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/invitations");
  return { status: "success", message: "Invitation revoked." };
}
