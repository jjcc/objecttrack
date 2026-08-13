"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type WorkspaceProvisioningState = {
  status: "idle" | "error";
  code:
    | ""
    | "invalid"
    | "signInRequired"
    | "emailUnconfirmed"
    | "alreadyMember"
    | "rateLimited"
    | "failed";
};

const workspaceSchema = z.object({
  workspaceName: z.string().trim().min(2).max(200),
  workspaceKind: z.enum(["family", "business", "club", "collector", "other"]),
});

export async function createSimpleWorkspaceAction(
  _previousState: WorkspaceProvisioningState,
  formData: FormData
): Promise<WorkspaceProvisioningState> {
  const parsed = workspaceSchema.safeParse({
    workspaceName: formData.get("workspaceName"),
    workspaceKind: formData.get("workspaceKind"),
  });
  if (!parsed.success) return { status: "error", code: "invalid" };

  let destination: string | null = null;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { status: "error", code: "signInRequired" };
    }

    const { data, error } = await supabase.rpc("create_simple_workspace", {
      p_workspace_name: parsed.data.workspaceName,
      p_workspace_kind: parsed.data.workspaceKind,
    });
    if (error) return { status: "error", code: "failed" };

    const result = data?.[0];
    switch (result?.result_code) {
      case "created":
      case "existing":
        destination = "/onboarding?created=1";
        break;
      case "already_member":
        destination = "/dashboard";
        break;
      case "email_unconfirmed":
        return { status: "error", code: "emailUnconfirmed" };
      case "rate_limited":
        return { status: "error", code: "rateLimited" };
      case "invalid_name":
      case "invalid_kind":
        return { status: "error", code: "invalid" };
      default:
        return { status: "error", code: "failed" };
    }
  } catch {
    return { status: "error", code: "failed" };
  }

  redirect(destination);
}
