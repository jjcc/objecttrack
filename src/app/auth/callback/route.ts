import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (nextPath === "/onboarding") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const workspaceName = user?.user_metadata.workspace_name;
        const workspaceKind = user?.user_metadata.workspace_kind;

        if (typeof workspaceName === "string") {
          const { data, error: provisioningError } = await supabase.rpc(
            "create_simple_workspace",
            {
              p_workspace_name: workspaceName,
              p_workspace_kind:
                typeof workspaceKind === "string" ? workspaceKind : "other",
            }
          );
          const result = data?.[0];
          const onboardingUrl = new URL("/onboarding", request.url);
          if (
            !provisioningError &&
            result &&
            ["created", "existing"].includes(result.result_code)
          ) {
            onboardingUrl.searchParams.set("created", "1");
          } else {
            onboardingUrl.searchParams.set(
              "provisioning",
              result?.result_code ?? "failed"
            );
          }
          return NextResponse.redirect(onboardingUrl);
        }
      }
      return NextResponse.redirect(new URL(nextPath, request.url));
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", nextPath);
  loginUrl.searchParams.set("confirmation", "failed");
  return NextResponse.redirect(loginUrl);
}
