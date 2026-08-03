import { Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { requirePlatformAccess } from "@/lib/ops/access";
import { PlatformAuditTable } from "../_components/PlatformAuditTable";
import { getTranslations } from "next-intl/server";

const metricKeys = {
  invitation_delivery_failures_24h: "invitationDeliveryFailures24h",
  report_failures_24h: "reportFailures24h",
  pending_work_items: "pendingWorkItems",
  failed_work_items_24h: "failedWorkItems24h",
} as const;

export default async function PlatformAuditPage() {
  const t = await getTranslations("Ops.audit");
  const { supabase } = await requirePlatformAccess("platform.audit.read");
  const [metricsResult, auditResult] = await Promise.all([
    supabase.rpc("platform_operational_metrics"),
    supabase.rpc("platform_audit_events", { p_limit: 100 }),
  ]);
  if (metricsResult.error) throw new Error(metricsResult.error.message);
  if (auditResult.error) throw new Error(auditResult.error.message);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed" size="sm">
          {t("description")}
        </Text>
      </div>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {(metricsResult.data ?? []).map((metric) => (
          <Paper withBorder p="md" radius="md" key={metric.metric}>
            <Text size="xs" c="dimmed">
              {metric.metric in metricKeys
                ? t(`metrics.${metricKeys[metric.metric as keyof typeof metricKeys]}`)
                : metric.metric.replaceAll("_", " ")}
            </Text>
            <Text fw={700} size="xl">
              {metric.value}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      <PlatformAuditTable events={auditResult.data ?? []} />
    </Stack>
  );
}
