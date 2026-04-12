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
  Text,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import { useCreate, useList } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";

const eventSchema = z
  .object({
    group_id: z.string().min(1, "Group is required"),
    object_id: z.string().min(1, "Object is required"),
    event_type_id: z.string().min(1, "Event type is required"),
    e_from: z.string().optional(),
    e_to: z.string().optional(),
    extra: z.string().optional(),
  })
  .superRefine((values, context) => {
    const fromUser = values.e_from?.trim();
    const toUser = values.e_to?.trim();

    if (!fromUser && !toUser) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An event must include at least a receiving user.",
        path: ["e_to"],
      });
    }

    if (fromUser && toUser && fromUser === toUser) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "From User and To User cannot be the same.",
        path: ["e_to"],
      });
    }
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

  const selectedObjectId = form.values.object_id
    ? Number(form.values.object_id)
    : 0;

  const { result: latestCustodyResult } = useList({
    resource: "events",
    filters: [
      { field: "object_id", operator: "eq", value: selectedObjectId },
      { field: "e_to", operator: "nnull", value: true },
    ],
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { currentPage: 1, pageSize: 1 },
    meta: {
      select:
        "id, object_id, e_from, e_to, created_at, to:user_profiles!events_e_to_fkey(first_name, last_name, email)",
    },
    queryOptions: {
      enabled: selectedObjectId > 0,
    },
  });

  const latestCustodyEvent = latestCustodyResult.data[0] as
    | (Record<string, unknown> & { e_to?: string | null; e_from?: string | null })
    | undefined;
  const currentCustodianId =
    typeof latestCustodyEvent?.e_to === "string" ? latestCustodyEvent.e_to : null;
  const currentCustodianProfile = latestCustodyEvent?.to as Record<string, string> | null;
  const currentCustodianLabel = currentCustodianProfile
    ? [currentCustodianProfile.first_name, currentCustodianProfile.last_name]
        .filter(Boolean)
        .join(" ") || currentCustodianProfile.email || currentCustodianId
    : currentCustodianId;

  useEffect(() => {
    if (!form.values.object_id) {
      if (form.values.e_from) {
        form.setFieldValue("e_from", "");
      }
      return;
    }

    const nextFromUser = currentCustodianId ?? "";
    if (form.values.e_from !== nextFromUser) {
      form.setFieldValue("e_from", nextFromUser);
    }
  }, [currentCustodianId, form]);

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

    const fromUser = values.e_from?.trim() || null;
    const toUser = values.e_to?.trim() || null;

    if (!currentCustodianId) {
      if (fromUser) {
        showNotification({
          color: "red",
          title: "Error",
          message:
            "Initial assignment must leave From User empty because the object has no current custodian.",
        });
        return;
      }

      if (!toUser) {
        showNotification({
          color: "red",
          title: "Error",
          message:
            "Initial assignment requires a To User so the first custodian is recorded correctly.",
        });
        return;
      }
    } else {
      if (fromUser !== currentCustodianId) {
        showNotification({
          color: "red",
          title: "Error",
          message:
            "From User must match the object's current custodian before recording a transfer.",
        });
        return;
      }

      if (!toUser) {
        showNotification({
          color: "red",
          title: "Error",
          message:
            "A transfer requires a To User so the next custodian can be derived from the latest event.",
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
              <Text size="sm" c="dimmed">
                {form.values.object_id
                  ? currentCustodianLabel
                    ? `Current custodian: ${currentCustodianLabel}`
                    : "No current custodian recorded. This event will be treated as the initial assignment."
                  : "Select an object to load its current custodian."}
              </Text>
              <Select
                label="Event Type"
                placeholder="Select event type"
                data={eventTypeOptions}
                required
                searchable
                {...form.getInputProps("event_type_id")}
              />
              <Select
                label="From User"
                placeholder="Automatically set from current custodian"
                data={userOptions}
                clearable
                searchable
                {...form.getInputProps("e_from")}
              />
              <Select
                label="To User"
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
