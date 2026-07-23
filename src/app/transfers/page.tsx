"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Group,
  Button,
  Text,
  Badge,
  Paper,
  Alert,
} from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { DataTable } from "mantine-datatable";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  approveTransfer,
  formatTransferProfile,
  rejectTransfer,
  resolveTransferProfiles,
  type TransferQueryRecord,
  type TransferRecord,
} from "@/lib/supabase/transfers";
import dayjs from "dayjs";

export default function TransfersListPage() {
  const router = useRouter();

  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>("pending");
  const pageSize = 20;

  const fetchTransfers = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    const supabase = getSupabaseClient();

    let query = supabase.from("transfer_requests").select(
      "id, object_id, from_user_id, to_user_id, group_id, status, reason, created_at, updated_at, objects(name)",
      { count: "exact" },
    );

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    try {
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) throw error;

      const resolvedRecords = await resolveTransferProfiles(
        supabase,
        (data ?? []) as TransferQueryRecord[],
      );
      setRecords(resolvedRecords);
      setTotalRecords(count ?? 0);
    } catch (error) {
      setRecords([]);
      setTotalRecords(0);
      setFetchError(error instanceof Error ? error.message : "Unable to load transfer requests");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const handleApprove = async (requestId: number) => {
    const supabase = getSupabaseClient();
    setActiveRequestId(requestId);
    try {
      await approveTransfer(supabase, requestId);

      showNotification({ color: "green", title: "Success", message: "Transfer approved" });
      if (page !== 1) {
        setPage(1);
      } else {
        await fetchTransfers();
      }
    } catch (error) {
      showNotification({
        color: "red",
        title: "Approval failed",
        message: error instanceof Error ? error.message : "Unable to approve transfer",
      });
    } finally {
      setActiveRequestId(null);
    }
  };

  const handleReject = async (requestId: number) => {
    const supabase = getSupabaseClient();
    setActiveRequestId(requestId);
    try {
      await rejectTransfer(supabase, requestId);

      showNotification({ color: "green", title: "Success", message: "Transfer rejected" });
      if (page !== 1) {
        setPage(1);
      } else {
        await fetchTransfers();
      }
    } catch (error) {
      showNotification({
        color: "red",
        title: "Rejection failed",
        message: error instanceof Error ? error.message : "Unable to reject transfer",
      });
    } finally {
      setActiveRequestId(null);
    }
  };

  const statusBadge = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: "yellow",
      approved: "green",
      rejected: "red",
    };
    return (
      <Badge color={colorMap[status] ?? "gray"} variant="light">
        {status}
      </Badge>
    );
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/transfers">Transfers</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>Transfer Requests</Title>
          <Group>
            <Button
              variant={statusFilter === "pending" ? "filled" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("pending")}
            >
              Pending
            </Button>
            <Button
              variant={statusFilter === null ? "filled" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(null)}
            >
              All
            </Button>
            <Button
              variant={statusFilter === "approved" ? "filled" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("approved")}
            >
              Approved
            </Button>
            <Button
              variant={statusFilter === "rejected" ? "filled" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("rejected")}
            >
              Rejected
            </Button>
          </Group>
        </Group>

        {fetchError && (
          <Alert color="red" title="Unable to load transfer requests">
            {fetchError}
          </Alert>
        )}

        <Paper withBorder p="md" radius="md">
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
                render: (record) => <Text size="sm">{record.objects?.name ?? "—"}</Text>,
              },
              {
                accessor: "from",
                title: "Requester",
                render: (record) => <Text size="sm">{formatTransferProfile(record.from)}</Text>,
              },
              {
                accessor: "to",
                title: "Current Owner",
                render: (record) => <Text size="sm">{formatTransferProfile(record.to)}</Text>,
              },
              {
                accessor: "status",
                title: "Status",
                render: (record) => statusBadge(record.status),
              },
              {
                accessor: "created_at",
                title: "Requested At",
                render: (record) => dayjs(record.created_at).format("YYYY-MM-DD HH:mm"),
              },
              {
                accessor: "actions",
                title: "Actions",
                width: 140,
                render: (record) => {
                  if (record.status !== "pending") return null;
                  return (
                    <Group gap={4}>
                      <Button
                        size="xs"
                        color="green"
                        leftSection={<IconCheck size={14} />}
                        loading={activeRequestId === record.id}
                        disabled={activeRequestId !== null}
                        onClick={() => handleApprove(record.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        color="red"
                        leftSection={<IconX size={14} />}
                        disabled={activeRequestId !== null}
                        onClick={() => handleReject(record.id)}
                      >
                        Reject
                      </Button>
                    </Group>
                  );
                },
              },
            ]}
            totalRecords={totalRecords}
            recordsPerPage={pageSize}
            page={page}
            onPageChange={setPage}
            paginationSize="sm"
            noRecordsText="No transfer requests found"
          />
        </Paper>
      </Stack>
    </AppShell>
  );
}
