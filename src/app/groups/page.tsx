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
import { useFormatter, useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import dayjs from "dayjs";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function GroupsListPage() {
  const t = useTranslations("Groups.list");
  const format = useFormatter();
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
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/groups">{t("title")}</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>{t("title")}</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => router.push("/groups/create")}
          >
            {t("create")}
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
            { accessor: "title", title: t("groupTitle") },
            {
              accessor: "description",
              title: t("description"),
              ellipsis: true,
            },
            {
              accessor: "created_at",
              title: t("created"),
              render: (record) =>
                format.dateTime(new Date(record.created_at as string), "short"),
            },
            {
              accessor: "actions",
              title: t("actions"),
              width: 80,
              render: (record) => (
                <ActionIcon
                  aria-label={t("edit")}
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
          noRecordsText={t("noGroups")}
        />
      </Stack>
    </AppShell>
  );
}
