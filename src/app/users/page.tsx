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
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function UsersListPage() {
  const router = useRouter();

  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    async function fetchUsers() {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      const { data, count, error } = await supabase
        .from("user_profiles")
        .select("*, groups(title)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (!error) {
        setRecords((data ?? []) as unknown as Record<string, unknown>[]);
        setTotalRecords(count ?? 0);
      }
      setIsLoading(false);
    }

    fetchUsers();
  }, [page]);

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
          fetching={isLoading}
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
          totalRecords={totalRecords}
          recordsPerPage={pageSize}
          page={page}
          onPageChange={setPage}
          paginationSize="sm"
          noRecordsText="No users found"
        />
      </Stack>
    </AppShell>
  );
}
