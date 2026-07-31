import { Stack, Text, Title } from "@mantine/core";
import {
  TenantMembersTable,
  type TenantMember,
} from "@/app/admin/_components/TenantMembersTable";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";

export const dynamic = "force-dynamic";

export default async function TenantMembersPage() {
  const { supabase, context } = await requireTenantAdminAccess(
    "tenant.users.roles.update"
  );
  const { data, error } = await supabase.rpc("tenant_members");
  if (error) throw new Error(error.message);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Members</Title>
        <Text c="dimmed" size="sm">
          Role changes and removals are tenant-scoped and audited. The final
          owner cannot be demoted or removed.
        </Text>
      </div>
      <TenantMembersTable
        members={(data ?? []) as TenantMember[]}
        actorRole={context.tenantRole === "owner" ? "owner" : "admin"}
        actorId={context.userId}
      />
    </Stack>
  );
}
