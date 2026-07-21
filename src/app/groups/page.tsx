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
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import dayjs from "dayjs";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function GroupsListPage() {
  const router = useRouter();

  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    async function fetchGroups() {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      const { data, count, error } = await supabase
        .from("groups")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (!error) {
        setRecords((data ?? []) as unknown as Record<string, unknown>[]);
        setTotalRecords(count ?? 0);
      }
      setIsLoading(false);
    }

    fetchGroups();
  }, [page]);

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
          fetching={isLoading}
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
          totalRecords={totalRecords}
          recordsPerPage={pageSize}
          page={page}
          onPageChange={setPage}
          paginationSize="sm"
          noRecordsText="No groups found"
        />
      </Stack>
    </AppShell>
  );
}
