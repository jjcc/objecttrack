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
import { useList } from "@refinedev/core";
import { AppShell } from "@/components/layout/AppShell";
import { EventTypeBadge } from "@/components/shared/EventTypeBadge";
import dayjs from "dayjs";

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
  const { result: objectsResult } = useList({
    resource: "objects",
    pagination: { currentPage: 1, pageSize: 1 },
  });

  const { result: usersResult } = useList({
    resource: "user_profiles",
    pagination: { currentPage: 1, pageSize: 1 },
  });

  const { result: groupsResult } = useList({
    resource: "groups",
    pagination: { currentPage: 1, pageSize: 1 },
  });

  const todayStart = dayjs().startOf("day").toISOString();
  const weekStart = dayjs().startOf("week").toISOString();

  const { result: todayEventsResult } = useList({
    resource: "events",
    filters: [
      { field: "created_at", operator: "gte", value: todayStart },
    ],
    pagination: { currentPage: 1, pageSize: 1 },
  });

  const { result: weekEventsResult } = useList({
    resource: "events",
    filters: [
      { field: "created_at", operator: "gte", value: weekStart },
    ],
    pagination: { currentPage: 1, pageSize: 1 },
  });

  const { result: recentEventsResult } = useList({
    resource: "events",
    pagination: { currentPage: 1, pageSize: 15 },
    sorters: [{ field: "created_at", order: "desc" }],
    meta: {
      select: "*, objects(name), event_types(label), from:user_profiles!events_e_from_fkey(first_name, last_name), to:user_profiles!events_e_to_fkey(first_name, last_name)",
    },
  });

  const totalObjects = objectsResult.total ?? 0;
  const totalUsers = usersResult.total ?? 0;
  const totalGroups = groupsResult.total ?? 0;
  const eventsToday = todayEventsResult.total ?? 0;
  const eventsThisWeek = weekEventsResult.total ?? 0;

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
        </Breadcrumbs>

        <Title order={2}>Dashboard</Title>

        <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }}>
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
            title="Total Groups"
            value={totalGroups}
            icon={<IconCategory size={24} />}
            color="violet"
          />
          <StatCard
            title="Events Today"
            value={eventsToday}
            icon={<IconTransfer size={24} />}
            color="orange"
          />
          <StatCard
            title="Events This Week"
            value={eventsThisWeek}
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
              {recentEventsResult.data.map((event: Record<string, unknown>) => {
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
              {recentEventsResult.data.length === 0 && (
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
