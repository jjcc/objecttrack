import { Stack, Text, Title } from "@mantine/core";
import {
  ReportManager,
  type TenantReportJob,
} from "@/app/admin/reports/_components/ReportManager";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";
import { getTranslations } from "next-intl/server";

export default async function TenantReportsPage() {
  const t = await getTranslations("Admin.reports");
  const { supabase } = await requireTenantAdminAccess(
    "tenant.reports.generate"
  );
  const { data, error } = await supabase.rpc("tenant_report_jobs");
  if (error) throw new Error(error.message);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed" size="sm">
          {t("description")}
        </Text>
      </div>
      <ReportManager jobs={(data ?? []) as TenantReportJob[]} />
    </Stack>
  );
}
