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
  const [invitationResult, usageResult] = await Promise.all([
    supabase.rpc("tenant_invitations"),
    supabase.rpc("current_tenant_usage"),
  ]);
  if (invitationResult.error) throw new Error(invitationResult.error.message);
  if (usageResult.error) throw new Error(usageResult.error.message);
  const usage = usageResult.data?.[0] ?? null;
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
        invitations={(invitationResult.data ?? []) as TenantInvitation[]}
        allowedRoles={allowedRoles}
        activeUsers={Number(usage?.active_users ?? 0)}
        pendingInvitations={Number(usage?.pending_invitations ?? 0)}
        maxUsers={usage?.max_users ?? null}
      />
    </Stack>
  );
}
