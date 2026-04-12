"use client";

import { Center, Loader } from "@mantine/core";
import { useIsAuthenticated } from "@refinedev/core";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

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
  const { data, isLoading } = useIsAuthenticated();

  const isPublicPath = pathname ? publicPaths.has(pathname) : false;

  useEffect(() => {
    if (!isLoading && !isPublicPath && data?.authenticated === false) {
      router.replace(data.redirectTo ?? "/login");
    }
  }, [data, isLoading, isPublicPath, router]);

  if (isPublicPath) {
    return <>{children}</>;
  }

  if (isLoading || data?.authenticated === false) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  return <>{children}</>;
}
