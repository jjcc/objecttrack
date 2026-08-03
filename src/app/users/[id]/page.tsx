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
  Alert,
} from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { EventTypeBadge } from "@/components/shared/EventTypeBadge";
import dayjs from "dayjs";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function UserShowPage() {
  const t = useTranslations("Users.detail");
  const format = useFormatter();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setLoadError(null);
      const supabase = getSupabaseClient();

      try {
        const [userResult, eventsResult] = await Promise.all([
          supabase
            .from("user_profiles")
            .select("*, groups!user_profiles_group_tenant_fkey(title)")
            .eq("id", id)
            .single(),
          supabase
            .from("events")
            .select("*, objects!events_object_tenant_fkey(name), event_types!events_event_type_tenant_fkey(label), from:user_profiles!events_from_profile_tenant_fkey(first_name, last_name), to:user_profiles!events_to_profile_tenant_fkey(first_name, last_name)")
            .or(`e_from.eq.${id},e_to.eq.${id}`)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

        if (userResult.error || eventsResult.error) {
          setLoadError(t("loadFailed"));
        }
        setRecord(
          userResult.error
            ? null
            : (userResult.data as unknown as Record<string, unknown> | null)
        );
        setEvents(
          eventsResult.error
            ? []
            : ((eventsResult.data ?? []) as unknown as Record<string, unknown>[])
        );
      } catch {
        setRecord(null);
        setEvents([]);
        setLoadError(t("loadFailed"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [id, t]);

  const group = record?.groups as Record<string, string> | null;

  const fullName = [record?.first_name, record?.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/users">{t("users")}</Anchor>
          <Anchor>{fullName || t("detail")}</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>{fullName || t("title")}</Title>
          <Button
            leftSection={<IconEdit size={16} />}
            variant="outline"
            onClick={() => router.push(`/users/${id}/edit`)}
          >
            {t("edit")}
          </Button>
        </Group>

        {loadError ? <Alert color="red">{loadError}</Alert> : null}

        <Paper withBorder p="md" radius="md" pos="relative">
          <LoadingOverlay visible={isLoading} />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {t("firstName")}
              </Text>
              <Text>{(record?.first_name as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {t("lastName")}
              </Text>
              <Text>{(record?.last_name as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {t("email")}
              </Text>
              <Text>{(record?.email as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {t("jobTitle")}
              </Text>
              <Text>{(record?.title as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {t("group")}
              </Text>
              <Text>{group?.title ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {t("phone")}
              </Text>
              <Text>{(record?.phone as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {t("city")}
              </Text>
              <Text>{(record?.city as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {t("country")}
              </Text>
              <Text>{(record?.country as string) ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {t("wechatId")}
              </Text>
              <Text>{(record?.wechat_id as string) ?? "—"}</Text>
            </div>
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
                <Table.Th>{t("object")}</Table.Th>
                <Table.Th>{t("eventType")}</Table.Th>
                <Table.Th>{t("from")}</Table.Th>
                <Table.Th>{t("to")}</Table.Th>
                <Table.Th>{t("date")}</Table.Th>
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
