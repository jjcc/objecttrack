import { Stack, Text, Title } from "@mantine/core";
import {
  InvitationManager,
  type TenantInvitation,
} from "@/app/admin/invitations/_components/InvitationManager";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";
import { getTranslations } from "next-intl/server";
import type { TenantRole } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function TenantInvitationsPage() {
  const t = await getTranslations("Admin.invitations");
  const { supabase, context } = await requireTenantAdminAccess(
    "tenant.users.invite"
  );
  const { data, error } = await supabase.rpc("tenant_invitations");
  if (error) throw new Error(error.message);
  const allowedRoles: TenantRole[] = context.tenantEdition === "simple"
    ? ["member", "owner"]
    : context.tenantRole === "owner"
      ? ["viewer", "member", "admin", "owner"]
      : ["viewer", "member", "admin"];

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed" size="sm">
          {t("description")}
        </Text>
      </div>
      <InvitationManager
        invitations={(data ?? []) as TenantInvitation[]}
        allowedRoles={allowedRoles}
      />
    </Stack>
  );
}
