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
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { EventTypeBadge } from "@/components/shared/EventTypeBadge";
import dayjs from "dayjs";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function UserShowPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      const { data: userData } = await supabase
        .from("user_profiles")
        .select("*, groups(title)")
        .eq("id", id)
        .single();

      setRecord(userData as unknown as Record<string, unknown> | null);

      const { data: eventsData } = await supabase
        .from("events")
        .select("*, objects(name), event_types(label), from:user_profiles!events_e_from_fkey(first_name, last_name), to:user_profiles!events_e_to_fkey(first_name, last_name)")
        .or(`e_from.eq.${id},e_to.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(50);

      setEvents((eventsData ?? []) as unknown as Record<string, unknown>[]);
      setIsLoading(false);
    }

    fetchData();
  }, [id]);

  const group = record?.groups as Record<string, string> | null;

  const fullName = [record?.first_name, record?.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/users">Users</Anchor>
          <Anchor>{fullName || "Detail"}</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>{fullName || "User Detail"}</Title>
          <Button
            leftSection={<IconEdit size={16} />}
            variant="outline"
            onClick={() => router.push(`/users/${id}/edit`)}
          >
            Edit
          </Button>
        </Group>

        <Paper withBorder p="md" radius="md" pos="relative">
          <LoadingOverlay visible={isLoading} />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                First Name
              </Text>
              <Text>{(record?.first_name as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Last Name
              </Text>
              <Text>{(record?.last_name as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Email
              </Text>
              <Text>{(record?.email as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Title
              </Text>
              <Text>{(record?.title as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Group
              </Text>
              <Text>{group?.title ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Phone
              </Text>
              <Text>{(record?.phone as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                City
              </Text>
              <Text>{(record?.city as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Country
              </Text>
              <Text>{(record?.country as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                WeChat ID
              </Text>
              <Text>{(record?.wechat_id as string) ?? "—"}</Text>
            </div>
          </SimpleGrid>
        </Paper>

        <Paper withBorder p="md" radius="md" pos="relative">
          <Title order={4} mb="md">
            Event History
          </Title>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>Object</Table.Th>
                <Table.Th>Event Type</Table.Th>
                <Table.Th>From</Table.Th>
                <Table.Th>To</Table.Th>
                <Table.Th>Date</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {events.map((event: Record<string, unknown>) => {
                const obj = event.objects as Record<string, string> | null;
                const eventType = event.event_types as Record<string, string> | null;
                const fromUser = event.from as Record<string, string> | null;
                const toUser = event.to as Record<string, string> | null;

                return (
                  <Table.Tr key={event.id as number}>
                    <Table.Td>{event.id as number}</Table.Td>
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
              {events.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed">
                      No events involving this user
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
