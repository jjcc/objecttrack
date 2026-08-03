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

const areas = [
  {
    href: "/admin/profile",
    key: "profile",
  },
  {
    href: "/admin/members",
    key: "members",
  },
  {
    href: "/admin/invitations",
    key: "invitations",
  },
  {
    href: "/admin/reports",
    key: "reports",
  },
] as const;

export default async function TenantAdminPage() {
  const t = await getTranslations("Admin.home");
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed" size="sm">
          {t("description")}
        </Text>
      </div>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {areas.map((area) => (
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
