import { Stack, Text, Title } from "@mantine/core";
import {
  InvitationManager,
  type TenantInvitation,
} from "@/app/admin/invitations/_components/InvitationManager";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";

export const dynamic = "force-dynamic";

export default async function TenantInvitationsPage() {
  const { supabase, context } = await requireTenantAdminAccess(
    "tenant.users.invite"
  );
  const { data, error } = await supabase.rpc("tenant_invitations");
  if (error) throw new Error(error.message);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Invitations</Title>
        <Text c="dimmed" size="sm">
          Single-use links are email-bound, expire automatically, and can be
          revoked or rate-limited before acceptance.
        </Text>
      </div>
      <InvitationManager
        invitations={(data ?? []) as TenantInvitation[]}
        actorRole={context.tenantRole === "owner" ? "owner" : "admin"}
      />
    </Stack>
  );
}
