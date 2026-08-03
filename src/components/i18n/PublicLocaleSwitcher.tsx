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

export function PublicLocaleSwitcher() {
  const pathname = usePathname();
  const isPublic = publicPaths.has(pathname) || pathname.startsWith("/object-info/") || pathname.startsWith("/invitations/accept");

  if (!isPublic) return null;

  return (
    <Box pos="fixed" top={12} right={12} style={{zIndex: 1000}}>
      <LocaleSwitcher />
    </Box>
  );
}
