"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Group,
  Button,
  ActionIcon,
  Text,
} from "@mantine/core";
import { DataTable } from "mantine-datatable";
import { IconEdit, IconEye, IconPlus } from "@tabler/icons-react";
import { useTable } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import dayjs from "dayjs";

export default function ObjectsListPage() {
  const router = useRouter();

  const {
    tableQuery,
    result: tableResult,
    currentPage,
    setCurrentPage,
    pageSize,
  } = useTable({
    resource: "objects",
    pagination: { currentPage: 1, pageSize: 20 },
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    meta: {
      select: "*, categories(name)",
    },
  });

  const records = tableResult.data;

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/objects">Objects</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>Objects</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => router.push("/objects/create")}
          >
            Create Object
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
            { accessor: "name", title: "Name" },
            {
              accessor: "categories.name",
              title: "Category",
              render: (record) => {
                const cat = (record as Record<string, unknown>).categories as Record<string, string> | null;
                return <Text size="sm">{cat?.name ?? "—"}</Text>;
              },
            },
            { accessor: "model", title: "Model", render: (r) => (r as Record<string, string>).model ?? "—" },
            {
              accessor: "created_at",
              title: "Created",
              render: (record) =>
                dayjs((record as Record<string, string>).created_at).format("YYYY-MM-DD"),
            },
            {
              accessor: "actions",
              title: "Actions",
              width: 100,
              render: (record) => (
                <Group gap={4}>
                  <ActionIcon
                    variant="subtle"
                    onClick={() => router.push(`/objects/${(record as Record<string, unknown>).id}`)}
                  >
                    <IconEye size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    onClick={() =>
                      router.push(`/objects/${(record as Record<string, unknown>).id}/edit`)
                    }
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                </Group>
              ),
            },
          ]}
          totalRecords={tableResult.total ?? 0}
          recordsPerPage={pageSize}
          page={currentPage}
          onPageChange={setCurrentPage}
          paginationSize="sm"
          noRecordsText="No objects found"
        />
      </Stack>
    </AppShell>
  );
}
