"use client";

import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

export type TenantReportJob = {
  id: string;
  report_type: string;
  status: string;
  row_count: number | null;
  requested_at: string;
  completed_at: string | null;
  retention_until: string;
  failure_message: string | null;
  download_count: number;
};

export function ReportManager({ jobs }: { jobs: TenantReportJob[] }) {
  const t = useTranslations("Admin.reportManager");
  const format = useFormatter();
  const router = useRouter();
  const [pendingMode, setPendingMode] = useState<"small" | "background" | null>(
    null
  );
  const [feedback, setFeedback] = useState<{
    color: "green" | "red" | "blue";
    message: string;
  } | null>(null);

  async function requestReport(forceBackground: boolean) {
    setPendingMode(forceBackground ? "background" : "small");
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: "inventory",
          forceBackground,
        }),
      });

      if (response.headers.get("content-type")?.includes("text/csv")) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "inventory.csv";
        anchor.click();
        URL.revokeObjectURL(url);
        setFeedback({ color: "green", message: t("downloaded") });
        return;
      }

      const result = (await response.json()) as {
        error?: string;
        jobId?: string;
        rowCount?: number;
      };
      if (!response.ok) throw new Error("request_failed");

      setFeedback({
        color: "blue",
        message: t("queued", { count: result.rowCount ?? 0 }),
      });
      router.refresh();
    } catch {
      setFeedback({
        color: "red",
        message: t("requestFailed"),
      });
    } finally {
      setPendingMode(null);
    }
  }

  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" radius="md">
        <Stack>
          <div>
            <Title order={3}>{t("title")}</Title>
            <Text c="dimmed" size="sm">
              {t("description")}
            </Text>
          </div>
          {feedback && <Alert color={feedback.color}>{feedback.message}</Alert>}
          <Group>
            <Button
              loading={pendingMode === "small"}
              disabled={pendingMode !== null}
              onClick={() => requestReport(false)}
            >
              {t("downloadCsv")}
            </Button>
            <Button
              variant="light"
              loading={pendingMode === "background"}
              disabled={pendingMode !== null}
              onClick={() => requestReport(true)}
            >
              {t("queue")}
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("report")}</Table.Th><Table.Th>{t("status")}</Table.Th>
                <Table.Th>{t("rows")}</Table.Th><Table.Th>{t("requested")}</Table.Th>
                <Table.Th>{t("retention")}</Table.Th><Table.Th>{t("action")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {jobs.map((job) => (
                <Table.Tr key={job.id}>
                  <Table.Td>{job.report_type === "inventory" ? t("inventory") : job.report_type}</Table.Td>
                  <Table.Td>
                    <Badge
                      color={
                        job.status === "completed"
                          ? "green"
                          : job.status === "failed"
                            ? "red"
                            : job.status === "expired"
                              ? "gray"
                              : "blue"
                      }
                    >
                      {job.status === "completed" || job.status === "failed" || job.status === "expired" || job.status === "pending" || job.status === "processing" ? t(`statuses.${job.status}`) : job.status}
                    </Badge>
                    {job.failure_message && (
                      <Text size="xs" c="red" mt="xs">
                        {t("jobFailed")}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{job.row_count ?? "—"}</Table.Td>
                  <Table.Td>
                    {format.dateTime(new Date(job.requested_at), "dateTime")}
                  </Table.Td>
                  <Table.Td>
                    {format.dateTime(new Date(job.retention_until), "dateTime")}
                  </Table.Td>
                  <Table.Td>
                    {job.status === "completed" ? (
                      <Button
                        component="a"
                        href={`/api/admin/reports/${job.id}/download`}
                        size="xs"
                        variant="light"
                      >
                        {t("download")}
                      </Button>
                    ) : (
                      <Text size="sm" c="dimmed">
                        {t("notAvailable")}
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
              {jobs.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed" py="xl">
                      {t("none")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}
