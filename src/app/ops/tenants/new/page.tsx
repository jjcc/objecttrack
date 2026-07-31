import Link from "next/link";
import { Anchor, Breadcrumbs, Stack, Text, Title } from "@mantine/core";
import { ProvisionTenantForm } from "@/app/ops/_components/ProvisionTenantForm";
import { requirePlatformAccess } from "@/lib/ops/access";

export default async function NewTenantPage() {
  await requirePlatformAccess("platform.tenants.create");

  return (
    <Stack gap="lg">
      <Breadcrumbs>
        <Anchor component={Link} href="/ops">
          Tenants
        </Anchor>
        <Text>New tenant</Text>
      </Breadcrumbs>
      <div>
        <Title order={2}>Provision tenant</Title>
        <Text c="dimmed" size="sm">
          Tenant data, versioned defaults, initial owner invitation, audit event,
          and queued email work are created in one database transaction.
        </Text>
      </div>
      <ProvisionTenantForm />
    </Stack>
  );
}
