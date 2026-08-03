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
  Modal,
  Textarea,
} from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { DataTable } from "mantine-datatable";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  approveTransfer,
  rejectTransfer,
  transferDisplayClient,
  type TransferDisplayRecord,
  type TransferStatus,
} from "@/lib/supabase/transfers";
import dayjs from "dayjs";

export default function TransfersListPage() {
  const t = useTranslations("Transfers");
  const format = useFormatter();
  const router = useRouter();

  const [records, setRecords] = useState<TransferDisplayRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const [rejectRequestId, setRejectRequestId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TransferStatus | null>("pending");
  const pageSize = 20;

  const fetchTransfers = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    const supabase = getSupabaseClient();

    let query = transferDisplayClient(supabase).from("transfer_requests_display").select(
      "id, status, reason, created_at, updated_at, object_name, object_description, object_model, from_user_full_name, to_user_full_name",
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

      setRecords(data ?? []);
      setTotalRecords(count ?? 0);
    } catch (error) {
      setRecords([]);
      setTotalRecords(0);
      setFetchError(t("loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, t]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const handleApprove = async (requestId: number) => {
    const supabase = getSupabaseClient();
    setActiveRequestId(requestId);
    try {
      await approveTransfer(supabase, requestId);

      showNotification({ color: "green", title: t("success"), message: t("approvedMessage") });
      if (page !== 1) {
        setPage(1);
      } else {
        await fetchTransfers();
      }
    } catch {
      showNotification({
        color: "red",
        title: t("approvalFailed"),
        message: t("approveFailedMessage"),
      });
    } finally {
      setActiveRequestId(null);
    }
  };

  const handleReject = async () => {
    if (rejectRequestId === null) return;
    const supabase = getSupabaseClient();
    setActiveRequestId(rejectRequestId);
    try {
      await rejectTransfer(supabase, rejectRequestId, rejectReason.trim() || null);

      showNotification({ color: "green", title: t("success"), message: t("rejectedMessage") });
      setRejectRequestId(null);
      setRejectReason("");
      if (page !== 1) {
        setPage(1);
      } else {
        await fetchTransfers();
      }
    } catch {
      showNotification({
        color: "red",
        title: t("rejectionFailed"),
        message: t("rejectFailedMessage"),
      });
    } finally {
      setActiveRequestId(null);
    }
  };

  const statusBadge = (status: TransferStatus) => {
    const colorMap: Record<TransferStatus, string> = {
      pending: "yellow",
      approved: "green",
      rejected: "red",
    };
    return (
      <Badge color={colorMap[status] ?? "gray"} variant="light">
        {t(`statuses.${status}`)}
      </Badge>
    );
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/transfers">{t("transfers")}</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>{t("title")}</Title>
          <Group>
            <Button
              variant={statusFilter === "pending" ? "filled" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("pending")}
            >
              {t("statuses.pending")}
            </Button>
            <Button
              variant={statusFilter === null ? "filled" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(null)}
            >
              {t("all")}
            </Button>
            <Button
              variant={statusFilter === "approved" ? "filled" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("approved")}
            >
              {t("statuses.approved")}
            </Button>
            <Button
              variant={statusFilter === "rejected" ? "filled" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("rejected")}
            >
              {t("statuses.rejected")}
            </Button>
          </Group>
        </Group>

        {fetchError && (
          <Alert color="red" title={t("loadFailed")}>
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
                accessor: "object_name",
                title: t("object"),
                render: (record) => <Text size="sm">{record.object_name}</Text>,
              },
              {
                accessor: "from_user_full_name",
                title: t("requester"),
                render: (record) => <Text size="sm">{record.from_user_full_name ?? "—"}</Text>,
              },
              {
                accessor: "to_user_full_name",
                title: t("currentOwner"),
                render: (record) => <Text size="sm">{record.to_user_full_name ?? "—"}</Text>,
              },
              {
                accessor: "status",
                title: t("status"),
                render: (record) => statusBadge(record.status),
              },
              {
                accessor: "created_at",
                title: t("requestedAt"),
                render: (record) => format.dateTime(new Date(record.created_at), "dateTime"),
              },
              {
                accessor: "actions",
                title: t("actions"),
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
                        {t("approve")}
                      </Button>
                      <Button
                        size="xs"
                        color="red"
                        leftSection={<IconX size={14} />}
                        disabled={activeRequestId !== null}
                        onClick={() => {
                          setRejectRequestId(record.id);
                          setRejectReason("");
                        }}
                      >
                        {t("reject")}
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
            noRecordsText={t("noTransfers")}
          />
        </Paper>

        <Modal
          opened={rejectRequestId !== null}
          onClose={() => {
            setRejectRequestId(null);
            setRejectReason("");
          }}
          title={t("rejectTitle", { id: rejectRequestId ?? "" })}
          centered
        >
          <Stack>
            <Textarea
              label={t("rejectionReason")}
              placeholder={t("rejectionPlaceholder")}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.currentTarget.value)}
              autosize
              minRows={3}
            />
            <Group justify="flex-end">
              <Button
                variant="default"
                onClick={() => {
                  setRejectRequestId(null);
                  setRejectReason("");
                }}
              >
                {t("cancel")}
              </Button>
              <Button
                color="red"
                loading={activeRequestId === rejectRequestId}
                onClick={handleReject}
              >
                {t("rejectTransfer")}
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </AppShell>
  );
}
