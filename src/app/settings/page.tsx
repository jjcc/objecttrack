"use client";

import {
  Anchor,
  Breadcrumbs,
  NavLink,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconArrowRight,
  IconCategory,
  IconForms,
  IconTimelineEvent,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";

const settingEntries = [
  {
    key: "categories",
    href: "/settings/categories",
    icon: IconCategory,
  },
  {
    key: "eventTypes",
    href: "/settings/event-types",
    icon: IconTimelineEvent,
  },
  {
    key: "customFields",
    href: "/settings/custom-fields",
    icon: IconForms,
  },
] as const;

export default function SettingsPage() {
  const t = useTranslations("Settings.home");
  const router = useRouter();

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Text>{t("title")}</Text>
        </Breadcrumbs>

        <div>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed" size="sm">
            {t("description")}
          </Text>
        </div>

        <Paper withBorder radius="md" maw={760} style={{ overflow: "hidden" }}>
          {settingEntries.map((entry) => (
            <NavLink
              key={entry.href}
              label={t(`${entry.key}.title`)}
              description={t(`${entry.key}.description`)}
              leftSection={<entry.icon size={22} stroke={1.5} />}
              rightSection={<IconArrowRight size={18} />}
              onClick={() => router.push(entry.href)}
              py="lg"
            />
          ))}
        </Paper>
      </Stack>
    </AppShell>
  );
}
