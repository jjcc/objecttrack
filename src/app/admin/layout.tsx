import Link from "next/link";
import { redirect } from "next/navigation";
import { Anchor, Group, Stack } from "@mantine/core";
import { AppShell } from "@/components/layout/AppShell";
import { AuthorizationError } from "@/lib/auth/tenant-context";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";
import { getTranslations } from "next-intl/server";
import type { Permission } from "@/lib/auth/permissions";

const adminLinks = [
  { href: "/admin", key: "overview", permission: "tenant.admin.access" },
  { href: "/admin/profile", key: "profile", permission: "tenant.settings.update" },
  { href: "/admin/members", key: "members", permission: "tenant.users.roles.update" },
  { href: "/admin/invitations", key: "invitations", permission: "tenant.users.invite" },
  { href: "/admin/reports", key: "reports", permission: "tenant.reports.generate" },
  { href: "/admin/audit", key: "audit", permission: "tenant.audit.read" },
] as const;

export default async function TenantAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("Admin.nav");
  let permissions: ReadonlySet<Permission> | null = null;
  try {
    const { context } = await requireTenantAdminAccess("tenant.admin.access");
    permissions = context.permissions;
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
  }

  if (!permissions) redirect("/unauthorized");

  return (
    <AppShell>
      <Stack gap="lg">
        <Group gap="lg">
          {adminLinks.filter((link) => permissions.has(link.permission)).map((link) => (
            <Anchor component={Link} href={link.href} key={link.href}>
              {t(link.key)}
            </Anchor>
          ))}
        </Group>
        {children}
      </Stack>
    </AppShell>
  );
}
