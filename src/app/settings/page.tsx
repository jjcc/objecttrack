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
import { AppShell } from "@/components/layout/AppShell";

const settingEntries = [
  {
    title: "Categories",
    description: "Manage the categories used to classify tracked objects.",
    href: "/settings/categories",
    icon: IconCategory,
  },
  {
    title: "Event Types",
    description: "Manage the event labels available throughout the system.",
    href: "/settings/event-types",
    icon: IconTimelineEvent,
  },
  {
    title: "Custom Object Fields",
    description: "Define additional fields collected for objects in your tenant.",
    href: "/settings/custom-fields",
    icon: IconForms,
  },
];

export default function SettingsPage() {
  const router = useRouter();

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Text>Settings</Text>
        </Breadcrumbs>

        <div>
          <Title order={2}>Settings</Title>
          <Text c="dimmed" size="sm">
            Choose the configuration area you want to manage.
          </Text>
        </div>

        <Paper withBorder radius="md" maw={760} style={{ overflow: "hidden" }}>
          {settingEntries.map((entry) => (
            <NavLink
              key={entry.href}
              label={entry.title}
              description={entry.description}
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
