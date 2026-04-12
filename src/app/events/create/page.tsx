"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Paper,
  Select,
  Button,
  Group,
  JsonInput,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import { useCreate, useList } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";

const eventSchema = z.object({
  group_id: z.string().min(1, "Group is required"),
  object_id: z.string().min(1, "Object is required"),
  event_type_id: z.string().min(1, "Event type is required"),
  e_from: z.string().optional(),
  e_to: z.string().optional(),
  extra: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventSchema>;

export default function EventCreatePage() {
  const router = useRouter();
  const { mutate: create, mutation: createMutation } = useCreate();

  const { result: groupsResult } = useList({
    resource: "groups",
    pagination: { currentPage: 1, pageSize: 100 },
  });

  const { result: objectsResult } = useList({
    resource: "objects",
    pagination: { currentPage: 1, pageSize: 200 },
  });

  const { result: eventTypesResult } = useList({
    resource: "event_types",
    pagination: { currentPage: 1, pageSize: 100 },
  });

  const { result: usersResult } = useList({
    resource: "user_profiles",
    pagination: { currentPage: 1, pageSize: 200 },
  });

  const groupOptions = groupsResult.data.map((g) => ({
    value: String((g as Record<string, unknown>).id),
    label: (g as Record<string, string>).title,
  }));

  const objectOptions = objectsResult.data.map((o) => ({
    value: String((o as Record<string, unknown>).id),
    label: (o as Record<string, string>).name,
  }));

  const eventTypeOptions = eventTypesResult.data.map((et) => ({
    value: String((et as Record<string, unknown>).id),
    label: (et as Record<string, string>).label,
  }));

  const userOptions = usersResult.data.map((u) => {
    const r = u as Record<string, string>;
    const name = [r.first_name, r.last_name].filter(Boolean).join(" ");
    return {
      value: r.id,
      label: name || r.email || r.id,
    };
  });

  const form = useForm<EventFormValues>({
    initialValues: {
      group_id: "",
      object_id: "",
      event_type_id: "",
      e_from: "",
      e_to: "",
      extra: "",
    },
    validate: zodResolver(eventSchema),
  });

  const handleSubmit = (values: EventFormValues) => {
    let extraJson: Record<string, unknown> | null = null;
    if (values.extra) {
      try {
        extraJson = JSON.parse(values.extra) as Record<string, unknown>;
      } catch {
        showNotification({
          color: "red",
          title: "Error",
          message: "Extra data must be valid JSON",
        });
        return;
      }
    }

    create(
      {
        resource: "events",
        values: {
          group_id: Number(values.group_id),
          object_id: Number(values.object_id),
          event_type_id: Number(values.event_type_id),
          e_from: values.e_from || null,
          e_to: values.e_to || null,
          extra: extraJson,
        },
      },
      {
        onSuccess: () => {
          showNotification({
            color: "green",
            title: "Success",
            message: "Event recorded successfully",
          });
          router.push("/events");
        },
        onError: (error) => {
          showNotification({
            color: "red",
            title: "Error",
            message: error?.message ?? "Failed to record event",
          });
        },
      }
    );
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/events">Events</Anchor>
          <Anchor>Record Event</Anchor>
        </Breadcrumbs>

        <Title order={2}>Record Event</Title>

        <Paper withBorder p="md" radius="md" maw={600}>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <Select
                label="Group"
                placeholder="Select group"
                data={groupOptions}
                required
                searchable
                {...form.getInputProps("group_id")}
              />
              <Select
                label="Object"
                placeholder="Select object"
                data={objectOptions}
                required
                searchable
                {...form.getInputProps("object_id")}
              />
              <Select
                label="Event Type"
                placeholder="Select event type"
                data={eventTypeOptions}
                required
                searchable
                {...form.getInputProps("event_type_id")}
              />
              <Select
                label="From User (optional)"
                placeholder="Leave empty for initial assignment"
                data={userOptions}
                clearable
                searchable
                {...form.getInputProps("e_from")}
              />
              <Select
                label="To User (optional)"
                placeholder="Select receiving user"
                data={userOptions}
                clearable
                searchable
                {...form.getInputProps("e_to")}
              />
              <JsonInput
                label="Extra Data (JSON, optional)"
                placeholder='{"notes": "..."}'
                formatOnBlur
                autosize
                minRows={3}
                {...form.getInputProps("extra")}
              />
              <Group>
                <Button type="submit" loading={createMutation.isPending}>
                  Record Event
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/events")}
                >
                  Cancel
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </AppShell>
  );
}
