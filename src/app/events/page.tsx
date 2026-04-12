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
import { useTable, useList, type CrudFilter } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { EventTypeBadge } from "@/components/shared/EventTypeBadge";
import dayjs from "dayjs";

export default function EventsListPage() {
  const router = useRouter();

  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  const { result: eventTypesResult } = useList({
    resource: "event_types",
    pagination: { currentPage: 1, pageSize: 100 },
  });

  const { result: groupsResult } = useList({
    resource: "groups",
    pagination: { currentPage: 1, pageSize: 100 },
  });

  const eventTypeOptions = eventTypesResult.data.map((et) => ({
    value: String((et as Record<string, unknown>).id),
    label: (et as Record<string, string>).label,
  }));

  const groupOptions = groupsResult.data.map((g) => ({
    value: String((g as Record<string, unknown>).id),
    label: (g as Record<string, string>).title,
  }));

  const filters: CrudFilter[] = [];
  if (eventTypeFilter) {
    filters.push({
      field: "event_type_id",
      operator: "eq",
      value: Number(eventTypeFilter),
    });
  }
  if (groupFilter) {
    filters.push({
      field: "group_id",
      operator: "eq",
      value: Number(groupFilter),
    });
  }
  if (dateFrom) {
    filters.push({
      field: "created_at",
      operator: "gte",
      value: dayjs(dateFrom).startOf("day").toISOString(),
    });
  }
  if (dateTo) {
    filters.push({
      field: "created_at",
      operator: "lte",
      value: dayjs(dateTo).endOf("day").toISOString(),
    });
  }

  const {
    tableQuery,
    result: tableResult,
    currentPage,
    setCurrentPage,
    pageSize,
  } = useTable({
    resource: "events",
    pagination: { currentPage: 1, pageSize: 20 },
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    filters: { permanent: filters },
    meta: {
      select:
        "*, objects(name), event_types(label), groups(title), from:user_profiles!events_e_from_fkey(first_name, last_name), to:user_profiles!events_e_to_fkey(first_name, last_name)",
    },
  });

  const records = tableResult.data;

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
          fetching={tableQuery.isLoading}
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
          totalRecords={tableResult.total ?? 0}
          recordsPerPage={pageSize}
          page={currentPage}
          onPageChange={setCurrentPage}
          paginationSize="sm"
          noRecordsText="No events found"
        />
      </Stack>
    </AppShell>
  );
}
