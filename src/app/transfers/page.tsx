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
} from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { DataTable } from "mantine-datatable";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";
import { logTransferApproved, logTransferRejected } from "@/lib/supabase/events";
import dayjs from "dayjs";

export default function TransfersListPage() {
  const router = useRouter();

  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>("pending");
  const pageSize = 20;

  useEffect(() => {
    async function fetchTransfers() {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      let query = (supabase.from("transfer_requests") as any)
        .select(
          "*, objects(name), from:user_profiles!transfer_requests_from_user_id_fkey(first_name, last_name), to:user_profiles!transfer_requests_to_user_id_fkey(first_name, last_name)",
          { count: "exact" },
        );

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (!error) {
        setRecords((data ?? []) as unknown as Record<string, unknown>[]);
        setTotalRecords(count ?? 0);
      }
      setIsLoading(false);
    }

    fetchTransfers();
  }, [statusFilter, page]);

  const handleApprove = async (requestId: number) => {
    const supabase = getSupabaseClient();

    const { data: request } = await (supabase.from("transfer_requests") as any)
      .select("*")
      .eq("id", requestId)
      .single();

    if (!request) {
      showNotification({ color: "red", title: "Error", message: "Transfer request not found" });
      return;
    }

    const { error: updateError } = await (supabase.from("objects") as any)
      .update({ current_owner_id: request.to_user_id })
      .eq("id", request.object_id);

    if (updateError) {
      showNotification({ color: "red", title: "Error", message: updateError.message });
      return;
    }

    const { error: statusError } = await (supabase.from("transfer_requests") as any)
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", requestId);

    if (statusError) {
      showNotification({ color: "red", title: "Error", message: statusError.message });
      return;
    }

    await logTransferApproved(request.object_id, request.from_user_id, request.to_user_id);

    showNotification({ color: "green", title: "Success", message: "Transfer approved" });
    setPage(1);
  };

  const handleReject = async (requestId: number) => {
    const supabase = getSupabaseClient();

    const { data: request } = await (supabase.from("transfer_requests") as any)
      .select("*")
      .eq("id", requestId)
      .single();

    if (!request) {
      showNotification({ color: "red", title: "Error", message: "Transfer request not found" });
      return;
    }

    const { error: statusError } = await (supabase.from("transfer_requests") as any)
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", requestId);

    if (statusError) {
      showNotification({ color: "red", title: "Error", message: statusError.message });
      return;
    }

    await logTransferRejected(request.object_id, request.from_user_id, request.to_user_id, null);

    showNotification({ color: "green", title: "Success", message: "Transfer rejected" });
    setPage(1);
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
                render: (record) => {
                  const obj = (record as Record<string, unknown>).objects as Record<string, string> | null;
                  return <Text size="sm">{obj?.name ?? "—"}</Text>;
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
                        : "—"}
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
                accessor: "status",
                title: "Status",
                render: (record) => statusBadge((record as Record<string, string>).status),
              },
              {
                accessor: "created_at",
                title: "Requested At",
                render: (record) =>
                  dayjs((record as Record<string, string>).created_at).format("YYYY-MM-DD HH:mm"),
              },
              {
                accessor: "actions",
                title: "Actions",
                width: 140,
                render: (record) => {
                  const r = record as Record<string, string>;
                  if (r.status !== "pending") return null;
                  return (
                    <Group gap={4}>
                      <Button
                        size="xs"
                        color="green"
                        leftSection={<IconCheck size={14} />}
                        onClick={() => handleApprove(Number(r.id))}
                      >
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        color="red"
                        leftSection={<IconX size={14} />}
                        onClick={() => handleReject(Number(r.id))}
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
