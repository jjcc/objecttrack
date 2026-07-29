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
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

const eventTypeSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
});

type EventType = Database["public"]["Tables"]["event_types"]["Row"];
type EventTypeFormValues = z.infer<typeof eventTypeSchema>;

export default function EventTypeSettingsPage() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [opened, { open, close }] = useDisclosure(false);

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
      setLoadError(error.message);
      setEventTypes([]);
    } else {
      setEventTypes(data ?? []);
    }
    setIsLoading(false);
  }, []);

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
        title: "Unable to save event type",
        message: error.message,
      });
      return;
    }

    showNotification({
      color: "green",
      title: editingId === null ? "Event type created" : "Event type updated",
      message: `${payload.label} was saved successfully.`,
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
        title: "Unable to delete event type",
        message: error.message,
      });
      return;
    }

    showNotification({
      color: "green",
      title: "Event type deleted",
      message: `${eventType.label} was deleted.`,
    });
    await fetchEventTypes();
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/settings">Settings</Anchor>
          <Text>Event Types</Text>
        </Breadcrumbs>

        <Group justify="space-between">
          <div>
            <Title order={2}>Event Types</Title>
            <Text c="dimmed" size="sm">
              Manage labels used for object history events.
            </Text>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Event Type
          </Button>
        </Group>

        {loadError && (
          <Alert
            color="red"
            title="Unable to load event types"
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
                  <Table.Th>Label</Table.Th>
                  <Table.Th w={100}>Actions</Table.Th>
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
                          aria-label={`Edit ${eventType.label}`}
                          onClick={() => openEdit(eventType)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={`Delete ${eventType.label}`}
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
                        No event types
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
        title={editingId === null ? "Add Event Type" : "Edit Event Type"}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Label"
              placeholder="Event type label"
              required
              {...form.getInputProps("label")}
            />
            <Group justify="flex-end">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={isSaving}>
                {editingId === null ? "Create" : "Save"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </AppShell>
  );
}
