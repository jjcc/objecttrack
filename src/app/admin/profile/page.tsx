import { Stack, Text, Title } from "@mantine/core";
import {
  TenantProfileForm,
  type TenantAdminProfile,
} from "@/app/admin/_components/TenantProfileForm";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function TenantAdminProfilePage() {
  const t = await getTranslations("Admin.profile");
  const { supabase } = await requireTenantAdminAccess(
    "tenant.settings.update"
  );
  const { data, error } = await supabase.rpc("tenant_admin_profile");
  if (error) throw new Error(error.message);
  const tenant = data?.[0];
  if (!tenant) throw new Error(t("unavailable"));

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed" size="sm">
          {t("description")}
        </Text>
      </div>
      <TenantProfileForm tenant={tenant as TenantAdminProfile} />
    </Stack>
  );
}
