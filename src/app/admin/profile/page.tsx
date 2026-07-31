import { Stack, Text, Title } from "@mantine/core";
import {
  TenantProfileForm,
  type TenantAdminProfile,
} from "@/app/admin/_components/TenantProfileForm";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";

export const dynamic = "force-dynamic";

export default async function TenantAdminProfilePage() {
  const { supabase } = await requireTenantAdminAccess(
    "tenant.settings.update"
  );
  const { data, error } = await supabase.rpc("tenant_admin_profile");
  if (error) throw new Error(error.message);
  const tenant = data?.[0];
  if (!tenant) throw new Error("Tenant profile is unavailable.");

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Profile & settings</Title>
        <Text c="dimmed" size="sm">
          Platform-controlled status, defaults version, and billing ownership
          cannot be changed here.
        </Text>
      </div>
      <TenantProfileForm tenant={tenant as TenantAdminProfile} />
    </Stack>
  );
}
