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
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

type EventFormValues = { group_id: string; object_id: string; event_type_id: string; e_from?: string; e_to?: string; extra?: string };

export default function EventCreatePage() {
  const t = useTranslations("Events.form");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const [groupOptions, setGroupOptions] = useState<{ value: string; label: string }[]>([]);
  const [objectOptions, setObjectOptions] = useState<{ value: string; label: string }[]>([]);
  const [eventTypeOptions, setEventTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([]);
  const [currentCustodianId, setCurrentCustodianId] = useState<string | null>(null);
  const [currentCustodianLabel, setCurrentCustodianLabel] = useState<string | null>(null);
  const eventSchema = z.object({
    group_id: z.string().min(1, t("groupRequired")),
    object_id: z.string().min(1, t("objectRequired")),
    event_type_id: z.string().min(1, t("eventTypeRequired")),
    e_from: z.string().optional(), e_to: z.string().optional(), extra: z.string().optional(),
  }).superRefine((values, context) => {
    const fromUser = values.e_from?.trim();
    const toUser = values.e_to?.trim();
    if (!fromUser && !toUser) context.addIssue({ code: z.ZodIssueCode.custom, message: t("receiverRequired"), path: ["e_to"] });
    if (fromUser && toUser && fromUser === toUser) context.addIssue({ code: z.ZodIssueCode.custom, message: t("usersMustDiffer"), path: ["e_to"] });
  });

  useEffect(() => {
    async function fetchFilters() {
      const supabase = getSupabaseClient();

      const { data: groups } = await supabase.from("groups").select("id, title").order("title") as unknown as { data: { id: number; title: string }[] };
      setGroupOptions((groups ?? []).map((g) => ({ value: String(g.id), label: g.title })));

      const { data: objects } = await supabase.from("objects").select("id, name").order("name").limit(200) as unknown as { data: { id: number; name: string }[] };
      setObjectOptions((objects ?? []).map((o) => ({ value: String(o.id), label: o.name })));

      const { data: eventTypes } = await supabase.from("event_types").select("id, label").order("label") as unknown as { data: { id: number; label: string }[] };
      setEventTypeOptions((eventTypes ?? []).map((et) => ({ value: String(et.id), label: et.label })));

      const { data: users } = await supabase.from("user_profiles").select("id, first_name, last_name, email").limit(200) as unknown as { data: { id: string; first_name: string | null; last_name: string | null; email: string | null }[] };
      setUserOptions((users ?? []).map((u) => {
        const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
        return { value: u.id, label: name || u.email || u.id };
      }));
    }

    fetchFilters();
  }, []);

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

  useEffect(() => {
    async function fetchLatestCustody() {
      if (selectedObjectId <= 0) {
        setCurrentCustodianId(null);
        setCurrentCustodianLabel(null);
        return;
      }

      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("events")
        .select("id, object_id, e_from, e_to, created_at, to:user_profiles!events_e_to_fkey(first_name, last_name, email)")
        .eq("object_id", selectedObjectId)
        .not("e_to", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      const latestCustodyEvent = (data ?? [])[0] as
        | (Record<string, unknown> & { e_to?: string | null; e_from?: string | null })
        | undefined;

      const custodianId = typeof latestCustodyEvent?.e_to === "string" ? latestCustodyEvent.e_to : null;
      setCurrentCustodianId(custodianId);

      const custodianProfile = latestCustodyEvent?.to as Record<string, string> | null;
      const label = custodianProfile
        ? [custodianProfile.first_name, custodianProfile.last_name]
            .filter(Boolean)
            .join(" ") || custodianProfile.email || custodianId
        : custodianId;
      setCurrentCustodianLabel(label);
    }

    fetchLatestCustody();
  }, [selectedObjectId]);

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

  const handleSubmit = async (values: EventFormValues) => {
    let extraJson: Record<string, unknown> | null = null;
    if (values.extra) {
      try {
        extraJson = JSON.parse(values.extra) as Record<string, unknown>;
      } catch {
        showNotification({
          color: "red",
          title: t("error"),
          message: t("invalidJson"),
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
          title: t("error"),
          message: t("initialFromEmpty"),
        });
        return;
      }

      if (!toUser) {
        showNotification({
          color: "red",
          title: t("error"),
          message: t("initialToRequired"),
        });
        return;
      }
    } else {
      if (fromUser !== currentCustodianId) {
        showNotification({
          color: "red",
          title: t("error"),
          message: t("fromMustMatch"),
        });
        return;
      }

      if (!toUser) {
        showNotification({
          color: "red",
          title: t("error"),
          message: t("transferToRequired"),
        });
        return;
      }
    }

    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from("events") as any).insert({
        group_id: Number(values.group_id),
        object_id: Number(values.object_id),
        event_type_id: Number(values.event_type_id),
        e_from: values.e_from || null,
        e_to: values.e_to || null,
        extra: extraJson,
      });

      if (error) {
        showNotification({
          color: "red",
          title: t("error"),
          message: t("recordFailed"),
        });
        return;
      }

      showNotification({
        color: "green",
        title: t("success"),
        message: t("recordSuccess"),
      });
      router.push("/events");
    } catch {
      showNotification({
        color: "red",
        title: t("error"),
        message: t("recordFailed"),
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/events">{t("events")}</Anchor>
          <Anchor>{t("record")}</Anchor>
        </Breadcrumbs>

        <Title order={2}>{t("record")}</Title>

        <Paper withBorder p="md" radius="md" maw={600}>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <Select
                label={t("group")}
                placeholder={t("selectGroup")}
                data={groupOptions}
                required
                searchable
                {...form.getInputProps("group_id")}
              />
              <Select
                label={t("object")}
                placeholder={t("selectObject")}
                data={objectOptions}
                required
                searchable
                {...form.getInputProps("object_id")}
              />
              <Text size="sm" c="dimmed">
                {form.values.object_id
                  ? currentCustodianLabel
                    ? t("currentCustodian", { name: currentCustodianLabel })
                    : t("noCustodian")
                  : t("selectObjectHelp")}
              </Text>
              <Select
                label={t("eventType")}
                placeholder={t("selectEventType")}
                data={eventTypeOptions}
                required
                searchable
                {...form.getInputProps("event_type_id")}
              />
              <Select
                label={t("fromUser")}
                placeholder={t("fromPlaceholder")}
                data={userOptions}
                clearable
                searchable
                {...form.getInputProps("e_from")}
              />
              <Select
                label={t("toUser")}
                placeholder={t("toPlaceholder")}
                data={userOptions}
                clearable
                searchable
                {...form.getInputProps("e_to")}
              />
              <JsonInput
                label={t("extraData")}
                placeholder='{"notes": "..."}'
                formatOnBlur
                autosize
                minRows={3}
                {...form.getInputProps("extra")}
              />
              <Group>
                <Button type="submit" loading={isPending}>
                  {t("record")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/events")}
                >
                  {t("cancel")}
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </AppShell>
  );
}
