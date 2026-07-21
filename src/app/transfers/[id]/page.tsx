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
} from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { IconCheck, IconX, IconArrowBack } from "@tabler/icons-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";
import { logTransferApproved, logTransferRejected } from "@/lib/supabase/events";
import dayjs from "dayjs";

export default function TransferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTransfer() {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      const { data } = await (supabase.from("transfer_requests") as any)
        .select(
          "*, objects(name, description, model), from:user_profiles!transfer_requests_from_user_id_fkey(first_name, last_name, email), to:user_profiles!transfer_requests_to_user_id_fkey(first_name, last_name, email)",
        )
        .eq("id", id)
        .single();

      setRecord((data ?? null) as unknown as Record<string, unknown> | null);
      setIsLoading(false);
    }

    fetchTransfer();
  }, [id]);

  const handleApprove = async () => {
    if (!record) return;
    const supabase = getSupabaseClient();

    const { error: updateError } = await (supabase.from("objects") as any)
      .update({ current_owner_id: record.to_user_id })
      .eq("id", record.object_id as number);

    if (updateError) {
      showNotification({ color: "red", title: "Error", message: updateError.message });
      return;
    }

    const { error: statusError } = await (supabase.from("transfer_requests") as any)
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (statusError) {
      showNotification({ color: "red", title: "Error", message: statusError.message });
      return;
    }

    await logTransferApproved(record.object_id as number, record.from_user_id as string, record.to_user_id as string);

    showNotification({ color: "green", title: "Success", message: "Transfer approved" });
    router.refresh();
  };

  const handleReject = async () => {
    if (!record) return;
    const supabase = getSupabaseClient();

    const { error: statusError } = await (supabase.from("transfer_requests") as any)
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (statusError) {
      showNotification({ color: "red", title: "Error", message: statusError.message });
      return;
    }

    await logTransferRejected(record.object_id as number, record.from_user_id as string, record.to_user_id as string, null);

    showNotification({ color: "green", title: "Success", message: "Transfer rejected" });
    router.refresh();
  };

  const r = record as Record<string, string> | null;
  const status = r?.status ?? "";
  const obj = record?.objects as Record<string, string> | null;
  const fromUser = record?.from as Record<string, string> | null;
  const toUser = record?.to as Record<string, string> | null;

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
          <Title order={2}>Transfer Request Not Found</Title>
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
                  onClick={handleApprove}
                >
                  Approve
                </Button>
                <Button
                  color="red"
                  leftSection={<IconX size={16} />}
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
                <Text size="sm" c="dimmed">From User</Text>
                <Text fw={500}>
                  {fromUser
                    ? `${fromUser.first_name ?? ""} ${fromUser.last_name ?? ""}`.trim() || fromUser.email || "—"
                    : "—"}
                </Text>
              </div>

              <div>
                <Text size="sm" c="dimmed">To User</Text>
                <Text fw={500}>
                  {toUser
                    ? `${toUser.first_name ?? ""} ${toUser.last_name ?? ""}`.trim() || toUser.email || "—"
                    : "—"}
                </Text>
              </div>

              {r?.reason && (
                <div>
                  <Text size="sm" c="dimmed">Reason</Text>
                  <Text fw={500}>{r.reason}</Text>
                </div>
              )}

              <div>
                <Text size="sm" c="dimmed">Requested At</Text>
                <Text fw={500}>{dayjs(r?.created_at).format("YYYY-MM-DD HH:mm")}</Text>
              </div>

              <div>
                <Text size="sm" c="dimmed">Last Updated</Text>
                <Text fw={500}>{dayjs(r?.updated_at).format("YYYY-MM-DD HH:mm")}</Text>
              </div>
            </SimpleGrid>
          </Stack>
        </Paper>
      </Stack>
    </AppShell>
  );
}
