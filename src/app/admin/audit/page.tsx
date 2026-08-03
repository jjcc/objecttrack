import { Stack, Text, Title } from "@mantine/core";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";
import { TenantAuditTable } from "../_components/TenantAuditTable";
import { getTranslations } from "next-intl/server";

export default async function TenantAuditPage() {
  const t = await getTranslations("Admin.audit");
  const { supabase } = await requireTenantAdminAccess("tenant.audit.read");
  const { data: events, error } = await supabase.rpc("tenant_audit_events", {
    p_limit: 100,
  });
  if (error) throw new Error(error.message);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed" size="sm">
          {t("description")}
        </Text>
      </div>
      <TenantAuditTable events={events ?? []} />
    </Stack>
  );
}
