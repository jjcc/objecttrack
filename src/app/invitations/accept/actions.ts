"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashInvitationToken } from "@/lib/invitations/token";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AcceptInvitationState = {
  status: "idle" | "error";
  code: "" | "invalid" | "signInRequired" | "failed";
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
    if (error) throw new Error(error.message);
  } catch {
    return {
      status: "error",
      code: "failed",
    };
  }

  redirect("/dashboard?invitation=accepted");
}
