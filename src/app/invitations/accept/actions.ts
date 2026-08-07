"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashInvitationToken } from "@/lib/invitations/token";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AcceptInvitationState = {
  status: "idle" | "error";
  code:
    | ""
    | "invalid"
    | "signInRequired"
    | "wrongEmail"
    | "alreadyMember"
    | "failed";
};

export async function acceptInvitationAction(
  _previousState: AcceptInvitationState,
  formData: FormData
): Promise<AcceptInvitationState> {
  const parsed = z.string().min(20).max(500).safeParse(formData.get("token"));
  if (!parsed.success) {
    return { status: "error", code: "invalid" };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { status: "error", code: "signInRequired" };
    }

    const { error } = await supabase.rpc("accept_tenant_invitation", {
      p_token_hash: hashInvitationToken(parsed.data),
    });
    if (error) {
      if (error.message.includes("Sign in with the invited email address")) {
        return { status: "error", code: "wrongEmail" };
      }
      if (error.message.includes("already has a tenant membership")) {
        return { status: "error", code: "alreadyMember" };
      }
      return { status: "error", code: "failed" };
    }
  } catch {
    return {
      status: "error",
      code: "failed",
    };
  }

  redirect("/dashboard?invitation=accepted");
}
