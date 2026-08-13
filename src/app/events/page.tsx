"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Group,
  Button,
  Text,
  Select,
  SimpleGrid,
  Paper,
  Alert,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { DataTable } from "mantine-datatable";
import { IconPlus } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { EventTypeBadge } from "@/components/shared/EventTypeBadge";
import dayjs from "dayjs";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function EventsListPage() {
  const t = useTranslations("Events.list");
  const format = useFormatter();
  const router = useRouter();

  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  const [eventTypeOptions, setEventTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [groupOptions, setGroupOptions] = useState<{ value: string; label: string }[]>([]);

  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [canRecordEvents, setCanRecordEvents] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    async function fetchFilters() {
      const supabase = getSupabaseClient();

      const { data: role } = await supabase.rpc("current_tenant_role");
      setCanRecordEvents(role === "admin" || role === "owner");

      const { data: eventTypes } = await supabase
        .from("event_types")
        .select("id, label")
        .order("label") as unknown as { data: { id: number; label: string }[] };
      setEventTypeOptions((eventTypes ?? []).map((et) => ({ value: String(et.id), label: et.label })));

      const { data: groups } = await supabase
        .from("groups")
        .select("id, title")
        .order("title") as unknown as { data: { id: number; title: string }[] };
      setGroupOptions((groups ?? []).map((g) => ({ value: String(g.id), label: g.title })));
    }

    fetchFilters();
  }, []);

  useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true);
      setLoadError(null);
      const supabase = getSupabaseClient();

      let query = supabase
        .from("events")
        .select("*, objects!events_object_tenant_fkey(name), event_types!events_event_type_tenant_fkey(label), groups!events_group_tenant_fkey(title), from:user_profiles!events_from_profile_tenant_fkey(first_name, last_name), to:user_profiles!events_to_profile_tenant_fkey(first_name, last_name)", { count: "exact" });

      if (eventTypeFilter) {
        query = query.eq("event_type_id", Number(eventTypeFilter));
      }
      if (groupFilter) {
        query = query.eq("group_id", Number(groupFilter));
      }
      if (dateFrom) {
        query = query.gte("created_at", dayjs(dateFrom).startOf("day").toISOString());
      }
      if (dateTo) {
        query = query.lte("created_at", dayjs(dateTo).endOf("day").toISOString());
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        setRecords([]);
        setTotalRecords(0);
        setLoadError(t("loadFailed"));
      } else {
        setRecords((data ?? []) as unknown as Record<string, unknown>[]);
        setTotalRecords(count ?? 0);
      }
      setIsLoading(false);
    }

    fetchEvents();
  }, [eventTypeFilter, groupFilter, dateFrom, dateTo, page, t]);

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/events">{t("events")}</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>{t("title")}</Title>
          {canRecordEvents ? (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => router.push("/events/create")}
            >
              {t("record")}
            </Button>
          ) : null}
        </Group>

        <Paper withBorder p="md" radius="md">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            <Select
              label={t("eventType")}
              placeholder={t("allTypes")}
              data={eventTypeOptions}
              clearable
              value={eventTypeFilter}
              onChange={setEventTypeFilter}
            />
            <Select
              label={t("group")}
              placeholder={t("allGroups")}
              data={groupOptions}
              clearable
              value={groupFilter}
              onChange={setGroupFilter}
            />
            <DatePickerInput
              label={t("dateFrom")}
              placeholder={t("startDate")}
              clearable
              value={dateFrom}
              onChange={(val) => setDateFrom(val as Date | null)}
            />
            <DatePickerInput
              label={t("dateTo")}
              placeholder={t("endDate")}
              clearable
              value={dateTo}
              onChange={(val) => setDateTo(val as Date | null)}
            />
          </SimpleGrid>
        </Paper>

        {loadError ? <Alert color="red">{loadError}</Alert> : null}

        <DataTable
          withTableBorder
          borderRadius="md"
          striped
          highlightOnHover
          fetching={isLoading}
          records={records}
          columns={[
            { accessor: "id", title: "ID", width: 70 },
            {
              accessor: "objects.name",
              title: t("object"),
              render: (record) => {
                const obj = (record as Record<string, unknown>).objects as Record<string, string> | null;
                return <Text size="sm">{obj?.name ?? "—"}</Text>;
              },
            },
            {
              accessor: "event_types.label",
              title: t("type"),
              render: (record) => {
                const et = (record as Record<string, unknown>).event_types as Record<string, string> | null;
                return et?.label ? (
                  <EventTypeBadge label={et.label} />
                ) : (
                  <Text size="sm">—</Text>
                );
              },
            },
            {
              accessor: "groups.title",
              title: t("group"),
              render: (record) => {
                const g = (record as Record<string, unknown>).groups as Record<string, string> | null;
                return <Text size="sm">{g?.title ?? "—"}</Text>;
              },
            },
            {
              accessor: "from",
              title: t("from"),
              render: (record) => {
                const fromUser = (record as Record<string, unknown>).from as Record<string, string> | null;
                return (
                  <Text size="sm">
                    {fromUser
                      ? `${fromUser.first_name ?? ""} ${fromUser.last_name ?? ""}`.trim() || "—"
                      : t("initial")}
                  </Text>
                );
              },
            },
            {
              accessor: "to",
              title: t("to"),
              render: (record) => {
                const toUser = (record as Record<string, unknown>).to as Record<string, string> | null;
                return (
                  <Text size="sm">
                    {toUser
                      ? `${toUser.first_name ?? ""} ${toUser.last_name ?? ""}`.trim() || "—"
                      : "—"}
                  </Text>
                );
              },
            },
            {
              accessor: "created_at",
              title: t("date"),
              render: (record) =>
                format.dateTime(new Date((record as Record<string, string>).created_at), "dateTime"),
            },
          ]}
          totalRecords={totalRecords}
          recordsPerPage={pageSize}
          page={page}
          onPageChange={setPage}
          paginationSize="sm"
          noRecordsText={t("noEvents")}
        />
      </Stack>
    </AppShell>
  );
}
