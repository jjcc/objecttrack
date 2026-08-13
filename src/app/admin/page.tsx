import Link from "next/link";
import {
  Anchor,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { getTranslations } from "next-intl/server";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";

const areas = [
  {
    href: "/admin/profile",
    key: "profile",
    permission: "tenant.settings.update",
  },
  {
    href: "/admin/members",
    key: "members",
    permission: "tenant.users.roles.update",
  },
  {
    href: "/admin/invitations",
    key: "invitations",
    permission: "tenant.users.invite",
  },
  {
    href: "/admin/reports",
    key: "reports",
    permission: "tenant.reports.generate",
  },
] as const;

export default async function TenantAdminPage() {
  const t = await getTranslations("Admin.home");
  const { context } = await requireTenantAdminAccess("tenant.admin.access");
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed" size="sm">
          {t("description")}
        </Text>
      </div>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {areas.filter((area) => context.permissions.has(area.permission)).map((area) => (
          <Paper withBorder p="lg" radius="md" key={area.href}>
            <Anchor component={Link} href={area.href} fw={600}>
              {t(`${area.key}.title`)}
            </Anchor>
            <Text size="sm" c="dimmed" mt="xs">
              {t(`${area.key}.description`)}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
