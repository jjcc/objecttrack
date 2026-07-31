import Link from "next/link";
import { redirect } from "next/navigation";
import { Anchor, Group, Stack } from "@mantine/core";
import { AppShell } from "@/components/layout/AppShell";
import { AuthorizationError } from "@/lib/auth/tenant-context";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/profile", label: "Profile & settings" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit", label: "Audit" },
];

export default async function TenantAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let authorized = false;
  try {
    await requireTenantAdminAccess("tenant.settings.update");
    authorized = true;
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
  }

  if (!authorized) redirect("/unauthorized");

  return (
    <AppShell>
      <Stack gap="lg">
        <Group gap="lg">
          {adminLinks.map((link) => (
            <Anchor component={Link} href={link.href} key={link.href}>
              {link.label}
            </Anchor>
          ))}
        </Group>
        {children}
      </Stack>
    </AppShell>
  );
}
