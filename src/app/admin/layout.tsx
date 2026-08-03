import Link from "next/link";
import { redirect } from "next/navigation";
import { Anchor, Group, Stack } from "@mantine/core";
import { AppShell } from "@/components/layout/AppShell";
import { AuthorizationError } from "@/lib/auth/tenant-context";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";
import { getTranslations } from "next-intl/server";

const adminLinks = [
  { href: "/admin", key: "overview" }, { href: "/admin/profile", key: "profile" },
  { href: "/admin/members", key: "members" }, { href: "/admin/invitations", key: "invitations" },
  { href: "/admin/reports", key: "reports" }, { href: "/admin/audit", key: "audit" },
] as const;

export default async function TenantAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("Admin.nav");
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
              {t(link.key)}
            </Anchor>
          ))}
        </Group>
        {children}
      </Stack>
    </AppShell>
  );
}
