"use client";

import {
  ActionIcon,
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { showNotification } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type EventType = Database["public"]["Tables"]["event_types"]["Row"];
type EventTypeFormValues = { label: string };

export default function EventTypeSettingsPage() {
  const t = useTranslations("Settings.eventTypes");
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const eventTypeSchema = z.object({ label: z.string().trim().min(1, t("labelRequired")) });

  const form = useForm<EventTypeFormValues>({
    initialValues: { label: "" },
    validate: zodResolver(eventTypeSchema),
  });

  const fetchEventTypes = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("event_types")
      .select("*")
      .order("label");

    if (error) {
      setLoadError(t("loadFailed"));
      setEventTypes([]);
    } else {
      setEventTypes(data ?? []);
    }
    setIsLoading(false);
  }, [t]);

  useEffect(() => {
    fetchEventTypes();
  }, [fetchEventTypes]);

  const openCreate = () => {
    setEditingId(null);
    form.reset();
    open();
  };

  const openEdit = (eventType: EventType) => {
    setEditingId(eventType.id);
    form.setValues({ label: eventType.label });
    form.resetDirty();
    open();
  };

  const handleSubmit = async (values: EventTypeFormValues) => {
    setIsSaving(true);
    const supabase = getSupabaseClient();
    const payload = { label: values.label.trim() };

    const { error } =
      editingId === null
        ? await (supabase.from("event_types") as any).insert(payload)
        : await supabase.from("event_types").update(payload).eq("id", editingId);

    setIsSaving(false);

    if (error) {
      showNotification({
        color: "red",
        title: t("saveFailed"),
        message: t("saveFailedMessage"),
      });
      return;
    }

    showNotification({
      color: "green",
      title: editingId === null ? t("created") : t("updated"),
      message: t("saved", { label: payload.label }),
    });
    close();
    await fetchEventTypes();
  };

  const handleDelete = async (eventType: EventType) => {
    setDeletingId(eventType.id);
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("event_types")
      .delete()
      .eq("id", eventType.id);
    setDeletingId(null);

    if (error) {
      showNotification({
        color: "red",
        title: t("deleteFailed"),
        message: t("deleteFailedMessage"),
      });
      return;
    }

    showNotification({
      color: "green",
      title: t("deleted"),
      message: t("deletedMessage", { label: eventType.label }),
    });
    await fetchEventTypes();
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/settings">{t("settings")}</Anchor>
          <Text>{t("title")}</Text>
        </Breadcrumbs>

        <Group justify="space-between">
          <div>
            <Title order={2}>{t("title")}</Title>
            <Text c="dimmed" size="sm">
              {t("description")}
            </Text>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            {t("add")}
          </Button>
        </Group>

        {loadError && (
          <Alert
            color="red"
            title={t("loadFailed")}
            icon={<IconAlertCircle size={18} />}
          >
            {loadError}
          </Alert>
        )}

        <Paper withBorder p="md" radius="md">
          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
            </Group>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ID</Table.Th>
                  <Table.Th>{t("label")}</Table.Th>
                  <Table.Th w={100}>{t("actions")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {eventTypes.map((eventType) => (
                  <Table.Tr key={eventType.id}>
                    <Table.Td>{eventType.id}</Table.Td>
                    <Table.Td>{eventType.label}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <ActionIcon
                          variant="subtle"
                          aria-label={t("editLabel", { label: eventType.label })}
                          onClick={() => openEdit(eventType)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={t("deleteLabel", { label: eventType.label })}
                          loading={deletingId === eventType.id}
                          disabled={deletingId !== null}
                          onClick={() => handleDelete(eventType)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {eventTypes.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      <Text ta="center" c="dimmed">
                        {t("none")}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>

      <Modal
        opened={opened}
        onClose={close}
        title={editingId === null ? t("add") : t("edit")}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label={t("label")}
              placeholder={t("labelPlaceholder")}
              required
              {...form.getInputProps("label")}
            />
            <Group justify="flex-end">
              <Button type="button" variant="outline" onClick={close}>
                {t("cancel")}
              </Button>
              <Button type="submit" loading={isSaving}>
                {editingId === null ? t("create") : t("save")}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </AppShell>
  );
}
