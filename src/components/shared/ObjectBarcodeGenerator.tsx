"use client";

import {
  ActionIcon,
  Alert,
  Group,
  Paper,
  Radio,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { DataTable } from "mantine-datatable";
import { IconEdit, IconEye } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { ObjectQrCode } from "@/components/shared/ObjectQrCode";
import { getSupabaseClient } from "@/lib/supabase/client";

export function ObjectBarcodeGenerator({
  canManageObjects,
}: {
  canManageObjects: boolean;
}) {
  const t = useTranslations("Barcode.generator");
  const format = useFormatter();
  const router = useRouter();
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);

  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    async function fetchObjects() {
      setIsLoading(true);
      setLoadError(null);
      const supabase = getSupabaseClient();

      const { data, count, error } = await supabase
        .from("objects")
        .select("*, categories!objects_category_tenant_fkey(name)", { count: "exact" })
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

    fetchObjects();
  }, [page, t]);

  return (
    <Stack gap="lg">
      {loadError ? <Alert color="red">{loadError}</Alert> : null}
      <DataTable
        withTableBorder
        borderRadius="md"
        striped
        highlightOnHover
        fetching={isLoading}
        records={records}
        columns={[
          {
            accessor: "select",
            title: t("qr"),
            width: 60,
            render: (record) => {
              const objectId = (record as Record<string, number>).id;

              return (
                <Radio
                  aria-label={t("selectObject", { id: objectId })}
                  checked={selectedObjectId === objectId}
                  onChange={() => setSelectedObjectId(objectId)}
                />
              );
            },
          },
          { accessor: "id", title: "ID", width: 80 },
          { accessor: "name", title: t("name") },
          {
            accessor: "categories.name",
            title: t("category"),
            render: (record) => {
              const category = (record as Record<string, unknown>).categories as
                | Record<string, string>
                | null;

              return <Text size="sm">{category?.name ?? "-"}</Text>;
            },
          },
          {
            accessor: "model",
            title: t("model"),
            render: (record) => (
              <Text size="sm">{(record as Record<string, string>).model ?? "-"}</Text>
            ),
          },
          {
            accessor: "created_at",
            title: t("created"),
            render: (record) =>
              format.dateTime(new Date((record as Record<string, string>).created_at), "short"),
          },
          {
            accessor: "actions",
            title: t("actions"),
            width: 100,
            render: (record) => (
              <Group gap={4}>
                <ActionIcon
                  aria-label={t("view")}
                  variant="subtle"
                  onClick={() => router.push(`/objects/${(record as Record<string, unknown>).id}`)}
                >
                  <IconEye size={16} />
                </ActionIcon>
                {canManageObjects ? (
                  <ActionIcon
                    aria-label={t("edit")}
                    variant="subtle"
                    onClick={() =>
                      router.push(`/objects/${(record as Record<string, unknown>).id}/edit`)
                    }
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                ) : null}
              </Group>
            ),
          },
        ]}
        totalRecords={totalRecords}
        recordsPerPage={pageSize}
        page={page}
        onPageChange={setPage}
        paginationSize="sm"
        noRecordsText={t("noVisibleObjects")}
      />

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Text fw={600}>{t("title")}</Text>
          <Text c="dimmed" size="sm">
            {t("description")}
          </Text>

          {selectedObjectId ? (
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <ObjectQrCode objectId={selectedObjectId} />
              <Paper withBorder p="md" radius="md">
                <Stack gap="xs">
                  <Text fw={600}>{t("details")}</Text>
                  <Text size="sm">{t("selectedId", { id: selectedObjectId })}</Text>
                  <Text size="sm">
                    {t("destination", { path: `/object-info/${selectedObjectId}` })}
                  </Text>
                </Stack>
              </Paper>
            </SimpleGrid>
          ) : (
            <Text size="sm" c="dimmed">
              {t("noneSelected")}
            </Text>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
