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
  Textarea,
} from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { IconCheck, IconX, IconArrowBack } from "@tabler/icons-react";
import { useParams, useRouter } from "next/navigation";
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

export default function TransferDetailPage() {
  const t = useTranslations("Transfers");
  const format = useFormatter();
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [record, setRecord] = useState<TransferDisplayRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchTransfer = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await transferDisplayClient(supabase)
        .from("transfer_requests_display")
        .select("id, status, reason, created_at, updated_at, object_name, object_description, object_model, from_user_full_name, to_user_full_name")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setRecord(null);
        return;
      }

      setRecord(data);
    } catch (error) {
      setRecord(null);
      setFetchError(t("loadOneFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchTransfer();
  }, [fetchTransfer]);

  const handleApprove = async () => {
    if (!record) return;
    const supabase = getSupabaseClient();
    setActiveAction("approve");
    try {
      await approveTransfer(supabase, id);

      showNotification({ color: "green", title: t("success"), message: t("approvedMessage") });
      await fetchTransfer();
    } catch {
      showNotification({
        color: "red",
        title: t("approvalFailed"),
        message: t("approveFailedMessage"),
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
      await rejectTransfer(supabase, id, rejectReason.trim() || null);

      showNotification({ color: "green", title: t("success"), message: t("rejectedMessage") });
      await fetchTransfer();
    } catch {
      showNotification({
        color: "red",
        title: t("rejectionFailed"),
        message: t("rejectFailedMessage"),
      });
    } finally {
      setActiveAction(null);
    }
  };

  const status = record?.status ?? "";
  const statusColorMap: Record<TransferStatus, string> = {
    pending: "yellow",
    approved: "green",
    rejected: "red",
  };

  if (isLoading) {
    return (
      <AppShell>
        <Text>{t("loading")}</Text>
      </AppShell>
    );
  }

  if (!record) {
    return (
      <AppShell>
        <Stack gap="lg">
          <Breadcrumbs>
            <Anchor href="/dashboard">{t("dashboard")}</Anchor>
            <Anchor href="/transfers">{t("transfers")}</Anchor>
            <Anchor>{t("notFound")}</Anchor>
          </Breadcrumbs>
          {fetchError ? (
            <Alert color="red" title={t("loadOneFailed")}>
              {fetchError}
            </Alert>
          ) : (
            <Title order={2}>{t("notFoundTitle")}</Title>
          )}
          <Button
            variant="outline"
            leftSection={<IconArrowBack size={16} />}
            onClick={() => router.push("/transfers")}
          >
            {t("backToTransfers")}
          </Button>
        </Stack>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/transfers">{t("transfers")}</Anchor>
          <Anchor>{t("transferNumber", { id })}</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>{t("requestNumber", { id })}</Title>
          <Group>
            <Button
              variant="outline"
              leftSection={<IconArrowBack size={16} />}
              onClick={() => router.push("/transfers")}
            >
              {t("back")}
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
                  {t("approve")}
                </Button>
                <Button
                  color="red"
                  leftSection={<IconX size={16} />}
                  loading={activeAction === "reject"}
                  disabled={activeAction !== null}
                  onClick={handleReject}
                >
                  {t("reject")}
                </Button>
              </>
            )}
          </Group>
        </Group>

        {status === "pending" && (
          <Textarea
            label={t("rejectionReason")}
            placeholder={t("rejectionBeforePlaceholder")}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.currentTarget.value)}
            autosize
            minRows={3}
          />
        )}

        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            <Group>
              <Text fw={600}>{t("status")}:</Text>
              <Badge color={statusColorMap[record.status] ?? "gray"} variant="light" size="lg">
                {t(`statuses.${record.status}`)}
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <div>
                <Text size="sm" c="dimmed">{t("object")}</Text>
                <Text fw={500}>{record.object_name}</Text>
                {record.object_description && (
                  <Text size="sm" c="dimmed">{record.object_description}</Text>
                )}
                {record.object_model && (
                  <Text size="sm" c="dimmed">{t("model", { model: record.object_model })}</Text>
                )}
              </div>

              <div>
                <Text size="sm" c="dimmed">{t("requesterNewOwner")}</Text>
                <Text fw={500}>{record.from_user_full_name ?? "—"}</Text>
              </div>

              <div>
                <Text size="sm" c="dimmed">{t("currentOwnerRecipient")}</Text>
                <Text fw={500}>{record.to_user_full_name ?? "—"}</Text>
              </div>

              {record.reason && (
                <div>
                  <Text size="sm" c="dimmed">{t("reason")}</Text>
                  <Text fw={500}>{record.reason}</Text>
                </div>
              )}

              <div>
                <Text size="sm" c="dimmed">{t("requestedAt")}</Text>
                <Text fw={500}>{format.dateTime(new Date(record.created_at), "dateTime")}</Text>
              </div>

              <div>
                <Text size="sm" c="dimmed">{t("lastUpdated")}</Text>
                <Text fw={500}>{format.dateTime(new Date(record.updated_at), "dateTime")}</Text>
              </div>
            </SimpleGrid>
          </Stack>
        </Paper>
      </Stack>
    </AppShell>
  );
}
