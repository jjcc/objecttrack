"use client";

import {
  ActionIcon,
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
import dayjs from "dayjs";
import { ObjectQrCode } from "@/components/shared/ObjectQrCode";
import { getSupabaseClient } from "@/lib/supabase/client";

export function ObjectBarcodeGenerator() {
  const router = useRouter();
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);

  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    async function fetchObjects() {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      const { data, count, error } = await supabase
        .from("objects")
        .select("*, categories(name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (!error) {
        setRecords((data ?? []) as unknown as Record<string, unknown>[]);
        setTotalRecords(count ?? 0);
      }
      setIsLoading(false);
    }

    fetchObjects();
  }, [page]);

  return (
    <Stack gap="lg">
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
            title: "QR",
            width: 60,
            render: (record) => {
              const objectId = (record as Record<string, number>).id;

              return (
                <Radio
                  aria-label={`Select object ${objectId} for barcode generation`}
                  checked={selectedObjectId === objectId}
                  onChange={() => setSelectedObjectId(objectId)}
                />
              );
            },
          },
          { accessor: "id", title: "ID", width: 80 },
          { accessor: "name", title: "Name" },
          {
            accessor: "categories.name",
            title: "Category",
            render: (record) => {
              const category = (record as Record<string, unknown>).categories as
                | Record<string, string>
                | null;

              return <Text size="sm">{category?.name ?? "-"}</Text>;
            },
          },
          {
            accessor: "model",
            title: "Model",
            render: (record) => (
              <Text size="sm">{(record as Record<string, string>).model ?? "-"}</Text>
            ),
          },
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
        totalRecords={totalRecords}
        recordsPerPage={pageSize}
        page={page}
        onPageChange={setPage}
        paginationSize="sm"
        noRecordsText="No objects found"
      />

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Text fw={600}>2D Barcode</Text>
          <Text c="dimmed" size="sm">
            Select an object from the table to generate its 16-digit 2D barcode.
          </Text>

          {selectedObjectId ? (
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <ObjectQrCode objectId={selectedObjectId} />
              <Paper withBorder p="md" radius="md">
                <Stack gap="xs">
                  <Text fw={600}>Barcode Details</Text>
                  <Text size="sm">Selected object ID: {selectedObjectId}</Text>
                  <Text size="sm">
                    Encoded value: {selectedObjectId.toString().padStart(16, "0")}
                  </Text>
                </Stack>
              </Paper>
            </SimpleGrid>
          ) : (
            <Text size="sm" c="dimmed">
              No object selected yet.
            </Text>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
