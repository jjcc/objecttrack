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
  const [totalObjects, setTotalObjects] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pendingTransfers, setPendingTransfers] = useState(0);
  const [recentEvents, setRecentEvents] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    async function fetchData() {
      const supabase = getSupabaseClient();

      const { count: objCount } = await supabase
        .from("objects")
        .select("*", { count: "exact", head: true });
      setTotalObjects(objCount ?? 0);

      const { count: userCount } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true });
      setTotalUsers(userCount ?? 0);

      const { count: transferCount } = await supabase
        .from("transfer_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      setPendingTransfers(transferCount ?? 0);

      const weekStart = dayjs().subtract(7, "day").toISOString();

      const { data: events } = await supabase
        .from("events")
        .select("*, objects(name), event_types(label), from:user_profiles!events_e_from_fkey(first_name, last_name), to:user_profiles!events_e_to_fkey(first_name, last_name)")
        .gte("created_at", weekStart)
        .order("created_at", { ascending: false })
        .limit(15);

      setRecentEvents((events ?? []) as unknown as Record<string, unknown>[]);
    }

    fetchData();
  }, []);

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
        </Breadcrumbs>

        <Title order={2}>Dashboard</Title>

        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
          <StatCard
            title="Total Objects"
            value={totalObjects}
            icon={<IconBox size={24} />}
            color="blue"
          />
          <StatCard
            title="Total Users"
            value={totalUsers}
            icon={<IconUsers size={24} />}
            color="green"
          />
          <StatCard
            title="Pending Transfers"
            value={pendingTransfers}
            icon={<IconTransfer size={24} />}
            color="orange"
          />
          <StatCard
            title="Recent Events (7 days)"
            value={recentEvents.length}
            icon={<IconTransfer size={24} />}
            color="teal"
          />
        </SimpleGrid>

        <Paper withBorder p="md" radius="md">
          <Title order={4} mb="md">
            Recent Events
          </Title>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Object</Table.Th>
                <Table.Th>Event Type</Table.Th>
                <Table.Th>From</Table.Th>
                <Table.Th>To</Table.Th>
                <Table.Th>Date</Table.Th>
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
                      {dayjs(event.created_at as string).format("YYYY-MM-DD HH:mm")}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {recentEvents.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed">
                      No events yet
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
