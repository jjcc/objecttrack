"use client";

import {
  Alert,
  Center,
  Container,
  Image,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

type ObjectInfo = {
  id: number;
  name: string;
  description: string | null;
  category_name: string | null;
  model: string | null;
  image: string | null;
  extra: Json | null;
  institution_name: string;
  owner_name: string | null;
  created_at: string;
};

type ObjectInfoEvent = {
  id: number;
  event_type_label: string | null;
  group_name: string | null;
  from_user_name: string | null;
  to_user_name: string | null;
  created_at: string;
};

function InfoField({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
      <Text>{value === null || value === "" ? "—" : value}</Text>
    </div>
  );
}

export default function PublicObjectInfoPage() {
  const t = useTranslations("Objects.publicInfo");
  const format = useFormatter();
  const params = useParams();
  const id = Number(params.id);
  const [record, setRecord] = useState<ObjectInfo | null>(null);
  const [events, setEvents] = useState<ObjectInfoEvent[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchObjectInfo() {
      if (!Number.isSafeInteger(id) || id < 1) {
        setError(t("invalid"));
        setIsLoading(false);
        return;
      }

      const supabase = getSupabaseClient();
      const { data, error: loadError } = await supabase
        .rpc("object_info", { p_object_id: id });
      const objectInfo = data?.[0] as ObjectInfo | undefined;

      if (loadError) {
        setError(t("unavailable"));
      } else if (!objectInfo) {
        setError(t("notFound"));
      } else {
        setRecord(objectInfo);
        const { data: eventData, error: eventError } = await supabase
          .rpc("object_info_events", { p_object_id: id });
        if (eventError) {
          setError(t("eventsFailed"));
          setIsLoading(false);
          return;
        }
        setEvents((eventData ?? []) as ObjectInfoEvent[]);
        if (objectInfo.image) {
          const { data: signedImage } = await supabase.storage
            .from("object-images")
            .createSignedUrl(objectInfo.image, 60 * 60);
          setImageUrl(signedImage?.signedUrl ?? null);
        }
      }
      setIsLoading(false);
    }
    fetchObjectInfo();
  }, [id, t]);

  if (isLoading) {
    return <Center mih="100vh"><Loader /></Center>;
  }

  if (error || !record) {
    return (
      <Container size="sm" py="xl">
        <Alert color="red" title={t("unavailableTitle")} icon={<IconAlertCircle size={18} />}>
          {error}
        </Alert>
      </Container>
    );
  }

  const extra =
    record.extra && !Array.isArray(record.extra) && typeof record.extra === "object"
      ? record.extra
      : {};

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>{record.name}</Title>
          <Text c="dimmed">{record.institution_name}</Text>
        </div>
        <Paper withBorder p="lg" radius="md">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={t("imageAlt", { name: record.name })}
              maw={420}
              mah={300}
              fit="contain"
              mb="xl"
            />
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <InfoField label={t("objectId")} value={record.id} />
            <InfoField label={t("institution")} value={record.institution_name} />
            <InfoField label={t("owner")} value={record.owner_name} />
            <InfoField label={t("category")} value={record.category_name} />
            <InfoField label={t("model")} value={record.model} />
            <InfoField
              label={t("created")}
              value={format.dateTime(new Date(record.created_at), "dateTime")}
            />
            <InfoField label={t("description")} value={record.description} />
            {Object.entries(extra).map(([name, value]) => (
              <InfoField
                key={name}
                label={name}
                value={
                  value === null || typeof value === "string" || typeof value === "number"
                    ? value
                    : JSON.stringify(value)
                }
              />
            ))}
          </SimpleGrid>
        </Paper>
        <Paper withBorder p="lg" radius="md">
          <Title order={3} mb="md">{t("eventHistory")}</Title>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("event")}</Table.Th>
                <Table.Th>{t("group")}</Table.Th>
                <Table.Th>{t("from")}</Table.Th>
                <Table.Th>{t("to")}</Table.Th>
                <Table.Th>{t("date")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {events.map((event) => (
                <Table.Tr key={event.id}>
                  <Table.Td>{event.event_type_label ?? "—"}</Table.Td>
                  <Table.Td>{event.group_name ?? "—"}</Table.Td>
                  <Table.Td>{event.from_user_name ?? t("initial")}</Table.Td>
                  <Table.Td>{event.to_user_name ?? "—"}</Table.Td>
                  <Table.Td>
                    {format.dateTime(new Date(event.created_at), "dateTime")}
                  </Table.Td>
                </Table.Tr>
              ))}
              {events.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed">{t("noEvents")}</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      </Stack>
    </Container>
  );
}
