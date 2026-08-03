"use client";

import {
  Title,
  SimpleGrid,
  Paper,
  Text,
  Group,
  Table,
  Breadcrumbs,
  Anchor,
  Stack,
  Badge,
  Alert,
} from "@mantine/core";
import {
  IconBox,
  IconUsers,
  IconCategory,
  IconTransfer,
} from "@tabler/icons-react";
import { AppShell } from "@/components/layout/AppShell";
import { EventTypeBadge } from "@/components/shared/EventTypeBadge";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { getSupabaseClient } from "@/lib/supabase/client";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            {title}
          </Text>
          <Text size="xl" fw={700} mt={4}>
            {value}
          </Text>
        </div>
        <Badge size="xl" radius="md" variant="light" color={color} p="xs">
          {icon}
        </Badge>
      </Group>
    </Paper>
  );
}

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const format = useFormatter();
  const [totalObjects, setTotalObjects] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pendingTransfers, setPendingTransfers] = useState(0);
  const [recentEvents, setRecentEvents] = useState<Record<string, unknown>[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const supabase = getSupabaseClient();
      setLoadError(null);
      const weekStart = dayjs().subtract(7, "day").toISOString();

      const [objectsResult, usersResult, transfersResult, eventsResult] =
        await Promise.all([
          supabase.from("objects").select("*", { count: "exact", head: true }),
          supabase.from("user_profiles").select("*", { count: "exact", head: true }),
          supabase
            .from("transfer_requests")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase
            .from("events")
            .select("*, objects!events_object_tenant_fkey(name), event_types!events_event_type_tenant_fkey(label), from:user_profiles!events_from_profile_tenant_fkey(first_name, last_name), to:user_profiles!events_to_profile_tenant_fkey(first_name, last_name)")
            .gte("created_at", weekStart)
            .order("created_at", { ascending: false })
            .limit(15),
        ]);

      if (
        objectsResult.error ||
        usersResult.error ||
        transfersResult.error ||
        eventsResult.error
      ) {
        setLoadError(t("loadFailed"));
      }
      setTotalObjects(objectsResult.count ?? 0);
      setTotalUsers(usersResult.count ?? 0);
      setPendingTransfers(transfersResult.count ?? 0);
      setRecentEvents(
        eventsResult.error
          ? []
          : ((eventsResult.data ?? []) as unknown as Record<string, unknown>[])
      );
    }

    fetchData();
  }, [t]);

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("title")}</Anchor>
        </Breadcrumbs>

        <Title order={2}>{t("title")}</Title>

        {loadError ? <Alert color="red">{loadError}</Alert> : null}

        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
          <StatCard
            title={t("totalObjects")}
            value={totalObjects}
            icon={<IconBox size={24} />}
            color="blue"
          />
          <StatCard
            title={t("totalUsers")}
            value={totalUsers}
            icon={<IconUsers size={24} />}
            color="green"
          />
          <StatCard
            title={t("pendingTransfers")}
            value={pendingTransfers}
            icon={<IconTransfer size={24} />}
            color="orange"
          />
          <StatCard
            title={t("recentEventsDays", { days: 7 })}
            value={recentEvents.length}
            icon={<IconTransfer size={24} />}
            color="teal"
          />
        </SimpleGrid>

        <Paper withBorder p="md" radius="md">
          <Title order={4} mb="md">
            {t("recentEvents")}
          </Title>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("object")}</Table.Th>
                <Table.Th>{t("eventType")}</Table.Th>
                <Table.Th>{t("from")}</Table.Th>
                <Table.Th>{t("to")}</Table.Th>
                <Table.Th>{t("date")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {recentEvents.map((event: Record<string, unknown>) => {
                const obj = event.objects as Record<string, string> | null;
                const eventType = event.event_types as Record<string, string> | null;
                const fromUser = event.from as Record<string, string> | null;
                const toUser = event.to as Record<string, string> | null;

                return (
                  <Table.Tr key={event.id as number}>
                    <Table.Td>{obj?.name ?? "—"}</Table.Td>
                    <Table.Td>
                      {eventType?.label ? (
                        <EventTypeBadge label={eventType.label} />
                      ) : (
                        "—"
                      )}
                    </Table.Td>
                    <Table.Td>
                      {fromUser
                        ? `${fromUser.first_name ?? ""} ${fromUser.last_name ?? ""}`.trim() || "—"
                        : "—"}
                    </Table.Td>
                    <Table.Td>
                      {toUser
                        ? `${toUser.first_name ?? ""} ${toUser.last_name ?? ""}`.trim() || "—"
                        : "—"}
                    </Table.Td>
                    <Table.Td>
                      {format.dateTime(new Date(event.created_at as string), "dateTime")}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {recentEvents.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed">
                      {t("noEvents")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      </Stack>
    </AppShell>
  );
}
