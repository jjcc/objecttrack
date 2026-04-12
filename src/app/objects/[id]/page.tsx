"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Paper,
  Text,
  Group,
  Button,
  Table,
  SimpleGrid,
  LoadingOverlay,
} from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
import { useOne, useList } from "@refinedev/core";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EventTypeBadge } from "@/components/shared/EventTypeBadge";
import dayjs from "dayjs";

export default function ObjectShowPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { query: objectQuery, result: objectResult } = useOne({
    resource: "objects",
    id,
    meta: {
      select: "*, categories(name)",
    },
  });

  const { query: eventsQuery, result: eventsResult } = useList({
    resource: "events",
    filters: [{ field: "object_id", operator: "eq", value: Number(id) }],
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { currentPage: 1, pageSize: 50 },
    meta: {
      select:
        "*, event_types(label), from:user_profiles!events_e_from_fkey(first_name, last_name), to:user_profiles!events_e_to_fkey(first_name, last_name), groups(title)",
    },
  });

  const record = objectResult as Record<string, unknown> | undefined;
  const category = record?.categories as Record<string, string> | null;
  const events = eventsResult.data;

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/objects">Objects</Anchor>
          <Anchor>{record?.name as string ?? "Detail"}</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>{record?.name as string ?? "Object Detail"}</Title>
          <Button
            leftSection={<IconEdit size={16} />}
            variant="outline"
            onClick={() => router.push(`/objects/${id}/edit`)}
          >
            Edit
          </Button>
        </Group>

        <Paper withBorder p="md" radius="md" pos="relative">
          <LoadingOverlay visible={objectQuery.isLoading} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Name
              </Text>
              <Text>{record?.name as string ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Category
              </Text>
              <Text>{category?.name ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Model
              </Text>
              <Text>{(record?.model as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Created
              </Text>
              <Text>
                {record?.created_at
                  ? dayjs(record.created_at as string).format("YYYY-MM-DD HH:mm")
                  : "—"}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Description
              </Text>
              <Text>{(record?.description as string) ?? "—"}</Text>
            </div>
          </SimpleGrid>
        </Paper>

        <Paper withBorder p="md" radius="md" pos="relative">
          <LoadingOverlay visible={eventsQuery.isLoading} />
          <Title order={4} mb="md">
            Event History
          </Title>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>Event Type</Table.Th>
                <Table.Th>Group</Table.Th>
                <Table.Th>From</Table.Th>
                <Table.Th>To</Table.Th>
                <Table.Th>Date</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {events.map((event: Record<string, unknown>) => {
                const eventType = event.event_types as Record<string, string> | null;
                const fromUser = event.from as Record<string, string> | null;
                const toUser = event.to as Record<string, string> | null;
                const group = event.groups as Record<string, string> | null;

                return (
                  <Table.Tr key={event.id as number}>
                    <Table.Td>{event.id as number}</Table.Td>
                    <Table.Td>
                      {eventType?.label ? (
                        <EventTypeBadge label={eventType.label} />
                      ) : (
                        "—"
                      )}
                    </Table.Td>
                    <Table.Td>{group?.title ?? "—"}</Table.Td>
                    <Table.Td>
                      {fromUser
                        ? `${fromUser.first_name ?? ""} ${fromUser.last_name ?? ""}`.trim() || "—"
                        : "— (initial)"}
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
              {events.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed">
                      No events recorded for this object
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
