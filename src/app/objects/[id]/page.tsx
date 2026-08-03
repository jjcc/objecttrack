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
  Image,
} from "@mantine/core";
import { IconEdit, IconExternalLink } from "@tabler/icons-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { EventTypeBadge } from "@/components/shared/EventTypeBadge";
import dayjs from "dayjs";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function ObjectShowPage() {
  const t = useTranslations("Objects.detail");
  const format = useFormatter();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      const { data: objectData } = await supabase
        .from("objects")
        .select("*, categories(name)")
        .eq("id", Number(id))
        .single();

      setRecord(objectData as unknown as Record<string, unknown> | null);
      const imagePath = (objectData as unknown as Record<string, unknown> | null)?.image;
      if (typeof imagePath === "string" && imagePath) {
        const { data } = await supabase.storage
          .from("object-images")
          .createSignedUrl(imagePath, 60 * 60);
        setImageUrl(data?.signedUrl ?? null);
      }

      const { data: eventsData } = await supabase
        .from("events")
        .select("*, event_types(label), from:user_profiles!events_e_from_fkey(first_name, last_name), to:user_profiles!events_e_to_fkey(first_name, last_name), groups(title)")
        .eq("object_id", Number(id))
        .order("created_at", { ascending: false })
        .limit(50);

      setEvents((eventsData ?? []) as unknown as Record<string, unknown>[]);
      setIsLoading(false);
    }

    fetchData();
  }, [id]);

  const category = record?.categories as Record<string, string> | null;
  const extra = (record?.extra as Record<string, unknown> | null) ?? {};

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/objects">{t("objects")}</Anchor>
          <Anchor>{record?.name as string ?? t("detail")}</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>{record?.name as string ?? t("title")}</Title>
          <Group>
            <Button
              leftSection={<IconExternalLink size={16} />}
              variant="subtle"
              onClick={() => router.push(`/object-info/${id}`)}
            >
              {t("objectInfo")}
            </Button>
            <Button
              leftSection={<IconEdit size={16} />}
              variant="outline"
              onClick={() => router.push(`/objects/${id}/edit`)}
            >
              {t("edit")}
            </Button>
          </Group>
        </Group>

        <Paper withBorder p="md" radius="md" pos="relative">
          <LoadingOverlay visible={isLoading} />
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={t("imageAlt", { name: (record?.name as string) ?? t("object") })}
              maw={360}
              mah={260}
              fit="contain"
              mb="lg"
            />
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t("name")}</Text>
              <Text>{record?.name as string ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t("category")}</Text>
              <Text>{category?.name ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t("model")}</Text>
              <Text>{(record?.model as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t("created")}</Text>
              <Text>
                {record?.created_at
                  ? format.dateTime(new Date(record.created_at as string), "dateTime")
                  : "—"}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t("description")}</Text>
              <Text>{(record?.description as string) ?? "—"}</Text>
            </div>
            {Object.entries(extra).map(([name, value]) => (
              <div key={name}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{name}</Text>
                <Text>{String(value || "—")}</Text>
              </div>
            ))}
          </SimpleGrid>
        </Paper>

        <Paper withBorder p="md" radius="md" pos="relative">
          <Title order={4} mb="md">
            {t("eventHistory")}
          </Title>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>{t("eventType")}</Table.Th>
                <Table.Th>{t("group")}</Table.Th>
                <Table.Th>{t("from")}</Table.Th>
                <Table.Th>{t("to")}</Table.Th>
                <Table.Th>{t("date")}</Table.Th>
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
                        : t("initial")}
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
              {events.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
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
