"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Paper,
  Text,
  Group,
  Button,
  Badge,
  SimpleGrid,
  Alert,
} from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { IconCheck, IconX, IconArrowBack } from "@tabler/icons-react";
import { useParams, useRouter } from "next/navigation";
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

export default function TransferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [record, setRecord] = useState<TransferRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | null>(null);

  const fetchTransfer = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase.from("transfer_requests")
        .select("id, object_id, from_user_id, to_user_id, group_id, status, reason, created_at, updated_at, objects(name, description, model)")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setRecord(null);
        return;
      }

      const [resolvedRecord] = await resolveTransferProfiles(
        supabase,
        [data as TransferQueryRecord],
      );
      setRecord(resolvedRecord);
    } catch (error) {
      setRecord(null);
      setFetchError(error instanceof Error ? error.message : "Unable to load transfer request");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTransfer();
  }, [fetchTransfer]);

  const handleApprove = async () => {
    if (!record) return;
    const supabase = getSupabaseClient();
    setActiveAction("approve");
    try {
      await approveTransfer(supabase, id);

      showNotification({ color: "green", title: "Success", message: "Transfer approved" });
      await fetchTransfer();
    } catch (error) {
      showNotification({
        color: "red",
        title: "Approval failed",
        message: error instanceof Error ? error.message : "Unable to approve transfer",
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handleReject = async () => {
    if (!record) return;
    const supabase = getSupabaseClient();
    setActiveAction("reject");
    try {
      await rejectTransfer(supabase, id);

      showNotification({ color: "green", title: "Success", message: "Transfer rejected" });
      await fetchTransfer();
    } catch (error) {
      showNotification({
        color: "red",
        title: "Rejection failed",
        message: error instanceof Error ? error.message : "Unable to reject transfer",
      });
    } finally {
      setActiveAction(null);
    }
  };

  const status = record?.status ?? "";
  const obj = record?.objects;

  const statusColorMap: Record<string, string> = {
    pending: "yellow",
    approved: "green",
    rejected: "red",
  };

  if (isLoading) {
    return (
      <AppShell>
        <Text>Loading...</Text>
      </AppShell>
    );
  }

  if (!record) {
    return (
      <AppShell>
        <Stack gap="lg">
          <Breadcrumbs>
            <Anchor href="/dashboard">Dashboard</Anchor>
            <Anchor href="/transfers">Transfers</Anchor>
            <Anchor>Not Found</Anchor>
          </Breadcrumbs>
          {fetchError ? (
            <Alert color="red" title="Unable to load transfer request">
              {fetchError}
            </Alert>
          ) : (
            <Title order={2}>Transfer Request Not Found</Title>
          )}
          <Button
            variant="outline"
            leftSection={<IconArrowBack size={16} />}
            onClick={() => router.push("/transfers")}
          >
            Back to Transfers
          </Button>
        </Stack>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/transfers">Transfers</Anchor>
          <Anchor>Transfer #{id}</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>Transfer Request #{id}</Title>
          <Group>
            <Button
              variant="outline"
              leftSection={<IconArrowBack size={16} />}
              onClick={() => router.push("/transfers")}
            >
              Back
            </Button>
            {status === "pending" && (
              <>
                <Button
                  color="green"
                  leftSection={<IconCheck size={16} />}
                  loading={activeAction === "approve"}
                  disabled={activeAction !== null}
                  onClick={handleApprove}
                >
                  Approve
                </Button>
                <Button
                  color="red"
                  leftSection={<IconX size={16} />}
                  loading={activeAction === "reject"}
                  disabled={activeAction !== null}
                  onClick={handleReject}
                >
                  Reject
                </Button>
              </>
            )}
          </Group>
        </Group>

        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            <Group>
              <Text fw={600}>Status:</Text>
              <Badge color={statusColorMap[status] ?? "gray"} variant="light" size="lg">
                {status}
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <div>
                <Text size="sm" c="dimmed">Object</Text>
                <Text fw={500}>{obj?.name ?? "—"}</Text>
                {obj?.description && (
                  <Text size="sm" c="dimmed">{obj.description}</Text>
                )}
                {obj?.model && (
                  <Text size="sm" c="dimmed">Model: {obj.model}</Text>
                )}
              </div>

              <div>
                <Text size="sm" c="dimmed">Requester / New Owner</Text>
                <Text fw={500}>{formatTransferProfile(record.from)}</Text>
              </div>

              <div>
                <Text size="sm" c="dimmed">Current Owner / Recipient</Text>
                <Text fw={500}>{formatTransferProfile(record.to)}</Text>
              </div>

              {record.reason && (
                <div>
                  <Text size="sm" c="dimmed">Reason</Text>
                  <Text fw={500}>{record.reason}</Text>
                </div>
              )}

              <div>
                <Text size="sm" c="dimmed">Requested At</Text>
                <Text fw={500}>{dayjs(record.created_at).format("YYYY-MM-DD HH:mm")}</Text>
              </div>

              <div>
                <Text size="sm" c="dimmed">Last Updated</Text>
                <Text fw={500}>{dayjs(record.updated_at).format("YYYY-MM-DD HH:mm")}</Text>
              </div>
            </SimpleGrid>
          </Stack>
        </Paper>
      </Stack>
    </AppShell>
  );
}
