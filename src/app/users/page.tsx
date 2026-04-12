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

export default function UsersListPage() {
  const router = useRouter();

  const {
    tableQuery,
    result: tableResult,
    currentPage,
    setCurrentPage,
    pageSize,
  } = useTable({
    resource: "user_profiles",
    pagination: { currentPage: 1, pageSize: 20 },
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    meta: {
      select: "*, groups(title)",
    },
  });

  const records = tableResult.data;

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/users">Users</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>Users</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => router.push("/users/create")}
          >
            Create User
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
            {
              accessor: "name",
              title: "Name",
              render: (record) => {
                const r = record as Record<string, string>;
                const name = [r.first_name, r.last_name].filter(Boolean).join(" ");
                return <Text size="sm">{name || "—"}</Text>;
              },
            },
            { accessor: "title", title: "Title", render: (r) => (r as Record<string, string>).title ?? "—" },
            {
              accessor: "groups.title",
              title: "Group",
              render: (record) => {
                const g = (record as Record<string, unknown>).groups as Record<string, string> | null;
                return <Text size="sm">{g?.title ?? "—"}</Text>;
              },
            },
            { accessor: "email", title: "Email" },
            { accessor: "phone", title: "Phone", render: (r) => (r as Record<string, string>).phone ?? "—" },
            {
              accessor: "location",
              title: "Location",
              render: (record) => {
                const r = record as Record<string, string>;
                return (
                  <Text size="sm">
                    {[r.city, r.country].filter(Boolean).join(", ") || "—"}
                  </Text>
                );
              },
            },
            {
              accessor: "actions",
              title: "Actions",
              width: 100,
              render: (record) => (
                <Group gap={4}>
                  <ActionIcon
                    variant="subtle"
                    onClick={() => router.push(`/users/${(record as Record<string, unknown>).id}`)}
                  >
                    <IconEye size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    onClick={() =>
                      router.push(`/users/${(record as Record<string, unknown>).id}/edit`)
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
          noRecordsText="No users found"
        />
      </Stack>
    </AppShell>
  );
}
