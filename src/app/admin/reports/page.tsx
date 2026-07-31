import { Stack, Text, Title } from "@mantine/core";
import {
  ReportManager,
  type TenantReportJob,
} from "@/app/admin/reports/_components/ReportManager";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";

export default async function TenantReportsPage() {
  const { supabase } = await requireTenantAdminAccess(
    "tenant.reports.generate"
  );
  const { data, error } = await supabase.rpc("tenant_report_jobs");
  if (error) throw new Error(error.message);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Reports</Title>
        <Text c="dimmed" size="sm">
          Tenant-scoped report generation and downloads.
        </Text>
      </div>
      <ReportManager jobs={(data ?? []) as TenantReportJob[]} />
    </Stack>
  );
}
