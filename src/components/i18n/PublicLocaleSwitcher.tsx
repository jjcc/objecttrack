"use client";

import {Box} from "@mantine/core";
import {usePathname} from "next/navigation";
import {LocaleSwitcher} from "./LocaleSwitcher";

const publicPaths = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/mfa",
  "/unauthorized"
]);

const appShellPaths = [
  "/dashboard",
  "/objects",
  "/users",
  "/groups",
  "/transfers",
  "/events",
  "/settings",
  "/profile",
  "/barcode",
  "/scan",
  "/admin"
];

function matchesPath(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function PublicLocaleSwitcher() {
  const pathname = usePathname();
  const usesAppShell = appShellPaths.some((path) => matchesPath(pathname, path));
  const isPublic =
    publicPaths.has(pathname) ||
    pathname.startsWith("/object-info/") ||
    pathname.startsWith("/invitations/accept") ||
    (!usesAppShell && !matchesPath(pathname, "/ops"));

  if (!isPublic) return null;

  return (
    <Box pos="fixed" top={12} right={12} style={{zIndex: 1000}}>
      <LocaleSwitcher />
    </Box>
  );
}
