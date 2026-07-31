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
        setFeedback({ color: "green", message: "Inventory report downloaded." });
        return;
      }

      const result = (await response.json()) as {
        error?: string;
        jobId?: string;
        rowCount?: number;
      };
      if (!response.ok) throw new Error(result.error ?? "Report request failed.");

      setFeedback({
        color: "blue",
        message: `Background report queued for ${result.rowCount ?? 0} rows.`,
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        color: "red",
        message: error instanceof Error ? error.message : "Report request failed.",
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
            <Title order={3}>Inventory export</Title>
            <Text c="dimmed" size="sm">
              Small exports download immediately. Background exports are retained
              for seven days and use a newly authorized 60-second download link.
            </Text>
          </div>
          {feedback && <Alert color={feedback.color}>{feedback.message}</Alert>}
          <Group>
            <Button
              loading={pendingMode === "small"}
              disabled={pendingMode !== null}
              onClick={() => requestReport(false)}
            >
              Download inventory CSV
            </Button>
            <Button
              variant="light"
              loading={pendingMode === "background"}
              disabled={pendingMode !== null}
              onClick={() => requestReport(true)}
            >
              Queue background export
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Report</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Rows</Table.Th>
                <Table.Th>Requested</Table.Th>
                <Table.Th>Retention</Table.Th>
                <Table.Th>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {jobs.map((job) => (
                <Table.Tr key={job.id}>
                  <Table.Td>{job.report_type}</Table.Td>
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
                      {job.status}
                    </Badge>
                    {job.failure_message && (
                      <Text size="xs" c="red" mt="xs">
                        {job.failure_message}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{job.row_count ?? "—"}</Table.Td>
                  <Table.Td>
                    {new Date(job.requested_at).toLocaleString()}
                  </Table.Td>
                  <Table.Td>
                    {new Date(job.retention_until).toLocaleString()}
                  </Table.Td>
                  <Table.Td>
                    {job.status === "completed" ? (
                      <Button
                        component="a"
                        href={`/api/admin/reports/${job.id}/download`}
                        size="xs"
                        variant="light"
                      >
                        Download
                      </Button>
                    ) : (
                      <Text size="sm" c="dimmed">
                        Not available
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
              {jobs.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed" py="xl">
                      No background reports yet.
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
