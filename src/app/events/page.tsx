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
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { DataTable } from "mantine-datatable";
import { IconPlus } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { EventTypeBadge } from "@/components/shared/EventTypeBadge";
import dayjs from "dayjs";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function EventsListPage() {
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
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    async function fetchFilters() {
      const supabase = getSupabaseClient();

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
      const supabase = getSupabaseClient();

      let query = supabase
        .from("events")
        .select("*, objects(name), event_types(label), groups(title), from:user_profiles!events_e_from_fkey(first_name, last_name), to:user_profiles!events_e_to_fkey(first_name, last_name)", { count: "exact" });

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

      if (!error) {
        setRecords((data ?? []) as unknown as Record<string, unknown>[]);
        setTotalRecords(count ?? 0);
      }
      setIsLoading(false);
    }

    fetchEvents();
  }, [eventTypeFilter, groupFilter, dateFrom, dateTo, page]);

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/events">Events</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>Events (Audit Log)</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => router.push("/events/create")}
          >
            Record Event
          </Button>
        </Group>

        <Paper withBorder p="md" radius="md">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            <Select
              label="Event Type"
              placeholder="All types"
              data={eventTypeOptions}
              clearable
              value={eventTypeFilter}
              onChange={setEventTypeFilter}
            />
            <Select
              label="Group"
              placeholder="All groups"
              data={groupOptions}
              clearable
              value={groupFilter}
              onChange={setGroupFilter}
            />
            <DatePickerInput
              label="Date From"
              placeholder="Start date"
              clearable
              value={dateFrom}
              onChange={(val) => setDateFrom(val as Date | null)}
            />
            <DatePickerInput
              label="Date To"
              placeholder="End date"
              clearable
              value={dateTo}
              onChange={(val) => setDateTo(val as Date | null)}
            />
          </SimpleGrid>
        </Paper>

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
              title: "Object",
              render: (record) => {
                const obj = (record as Record<string, unknown>).objects as Record<string, string> | null;
                return <Text size="sm">{obj?.name ?? "—"}</Text>;
              },
            },
            {
              accessor: "event_types.label",
              title: "Type",
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
              title: "Group",
              render: (record) => {
                const g = (record as Record<string, unknown>).groups as Record<string, string> | null;
                return <Text size="sm">{g?.title ?? "—"}</Text>;
              },
            },
            {
              accessor: "from",
              title: "From",
              render: (record) => {
                const fromUser = (record as Record<string, unknown>).from as Record<string, string> | null;
                return (
                  <Text size="sm">
                    {fromUser
                      ? `${fromUser.first_name ?? ""} ${fromUser.last_name ?? ""}`.trim() || "—"
                      : "— (initial)"}
                  </Text>
                );
              },
            },
            {
              accessor: "to",
              title: "To",
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
              title: "Date",
              render: (record) =>
                dayjs((record as Record<string, string>).created_at).format("YYYY-MM-DD HH:mm"),
            },
          ]}
          totalRecords={totalRecords}
          recordsPerPage={pageSize}
          page={page}
          onPageChange={setPage}
          paginationSize="sm"
          noRecordsText="No events found"
        />
      </Stack>
    </AppShell>
  );
}
