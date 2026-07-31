import { Stack, Text, Title } from "@mantine/core";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";
import { TenantAuditTable } from "../_components/TenantAuditTable";

export default async function TenantAuditPage() {
  const { supabase } = await requireTenantAdminAccess("tenant.audit.read");
  const { data: events, error } = await supabase.rpc("tenant_audit_events", {
    p_limit: 100,
  });
  if (error) throw new Error(error.message);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Tenant audit</Title>
        <Text c="dimmed" size="sm">
          Append-only sensitive actions for your current tenant.
        </Text>
      </div>
      <TenantAuditTable events={events ?? []} />
    </Stack>
  );
}
