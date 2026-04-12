"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Group,
  Button,
  ActionIcon,
} from "@mantine/core";
import { DataTable } from "mantine-datatable";
import { IconEdit, IconPlus } from "@tabler/icons-react";
import { useTable } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import dayjs from "dayjs";

export default function GroupsListPage() {
  const router = useRouter();

  const {
    tableQuery,
    result: tableResult,
    currentPage,
    setCurrentPage,
    pageSize,
    pageCount,
  } = useTable({
    resource: "groups",
    pagination: { currentPage: 1, pageSize: 20 },
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
  });

  const records = tableResult.data;

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/groups">Groups</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>Groups</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => router.push("/groups/create")}
          >
            Create Group
          </Button>
        </Group>

        <DataTable
          withTableBorder
          borderRadius="md"
          striped
          highlightOnHover
          fetching={tableQuery.isLoading}
          records={records}
          columns={[
            { accessor: "id", title: "ID", width: 80 },
            { accessor: "title", title: "Title" },
            {
              accessor: "description",
              title: "Description",
              ellipsis: true,
            },
            {
              accessor: "created_at",
              title: "Created",
              render: (record) =>
                dayjs(record.created_at as string).format("YYYY-MM-DD"),
            },
            {
              accessor: "actions",
              title: "Actions",
              width: 80,
              render: (record) => (
                <ActionIcon
                  variant="subtle"
                  onClick={() => router.push(`/groups/${record.id}/edit`)}
                >
                  <IconEdit size={16} />
                </ActionIcon>
              ),
            },
          ]}
          totalRecords={tableResult.total ?? 0}
          recordsPerPage={pageSize}
          page={currentPage}
          onPageChange={setCurrentPage}
          paginationSize="sm"
          noRecordsText="No groups found"
        />
      </Stack>
    </AppShell>
  );
}
