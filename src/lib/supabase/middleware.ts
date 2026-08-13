import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, getAuthenticatedAccessContext } from "@/lib/auth/tenant-context";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  function redirectPreservingCookies(url: URL) {
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      response.cookies.set(cookie)
    );
    return response;
  }

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isRegisterPage = request.nextUrl.pathname === "/register";
  const isForgotPasswordPage = request.nextUrl.pathname === "/forgot-password";
  const isUnauthorizedPage = request.nextUrl.pathname === "/unauthorized";
  const isOnboardingPage = request.nextUrl.pathname === "/onboarding";
  const isPublicAuthPage =
    isLoginPage || isRegisterPage || isForgotPasswordPage;
  const isPublicResource =
    request.nextUrl.pathname.startsWith("/object-info/") ||
    request.nextUrl.pathname.startsWith("/api/qr/") ||
    request.nextUrl.pathname.startsWith("/invitations/accept") ||
    request.nextUrl.pathname.startsWith("/auth/callback");

  if (!user && !isPublicAuthPage && !isPublicResource) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return redirectPreservingCookies(url);
  }

  let accessError: AuthorizationError | null = null;
  if (user && !request.nextUrl.pathname.startsWith("/auth/callback")) {
    try {
      await getAuthenticatedAccessContext(supabase, user);
    } catch (error) {
      if (!(error instanceof AuthorizationError)) throw error;
      accessError = error;
    }
  }

  if (user && isPublicAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = accessError?.code === "membership_required"
      ? "/onboarding"
      : "/dashboard";
    return redirectPreservingCookies(url);
  }

  if (
    user &&
    accessError?.code === "membership_required" &&
    !isOnboardingPage &&
    !isPublicResource
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return redirectPreservingCookies(url);
  }

  if (
    user &&
    accessError &&
    accessError.code !== "membership_required" &&
    !isUnauthorizedPage &&
    !isPublicResource
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    return redirectPreservingCookies(url);
  }

  return supabaseResponse;
}
