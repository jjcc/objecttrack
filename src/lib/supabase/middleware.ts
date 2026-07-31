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

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isRegisterPage = request.nextUrl.pathname === "/register";
  const isForgotPasswordPage = request.nextUrl.pathname === "/forgot-password";
  const isUnauthorizedPage = request.nextUrl.pathname === "/unauthorized";
  const isPublicAuthPage =
    isLoginPage || isRegisterPage || isForgotPasswordPage;
  const isPublicResource =
    request.nextUrl.pathname.startsWith("/object-info/") ||
    request.nextUrl.pathname.startsWith("/api/qr/");

  if (!user && !isPublicAuthPage && !isPublicResource) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublicAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && !isPublicAuthPage && !isUnauthorizedPage && !isPublicResource) {
    try {
      await getAuthenticatedAccessContext(supabase, user);
    } catch (error) {
      if (!(error instanceof AuthorizationError)) throw error;
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
