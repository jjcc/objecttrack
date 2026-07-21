"use client";

import { Center, Loader } from "@mantine/core";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface AuthGateProps {
  children: React.ReactNode;
}

const publicPaths = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/unauthorized",
]);

export function AuthGate({ children }: AuthGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const isPublicPath = pathname ? publicPaths.has(pathname) : false;

  useEffect(() => {
    async function checkAuth() {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setIsAuthenticated(false);
        setIsLoading(false);
        if (!isPublicPath) {
          router.replace("/login");
        }
        return;
      }

      const { data: adminData } = await supabase
        .from("admin_users")
        .select("id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!adminData) {
        setIsAuthenticated(false);
        setIsLoading(false);
        if (!isPublicPath) {
          router.replace("/unauthorized");
        }
        return;
      }

      setIsAuthenticated(true);
      setIsLoading(false);
    }

    checkAuth();
  }, [pathname, isPublicPath, router]);

  if (isPublicPath) {
    return <>{children}</>;
  }

  if (isLoading || !isAuthenticated) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  return <>{children}</>;
}
