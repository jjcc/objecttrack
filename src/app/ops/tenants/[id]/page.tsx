import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  TenantOperationsForm,
  type PlatformTenantDetails,
} from "@/app/ops/_components/TenantOperationsForm";
import { requirePlatformAccess } from "@/lib/ops/access";

export const dynamic = "force-dynamic";

export default async function TenantOperationsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { created?: string };
}) {
  const tenantId = Number(params.id);
  if (!Number.isSafeInteger(tenantId) || tenantId <= 0) notFound();

  const { supabase } = await requirePlatformAccess("platform.tenants.update");
  const { data, error } = await supabase.rpc("platform_tenant", {
    p_tenant_id: tenantId,
  });
  if (error) throw new Error(error.message);

  const tenant = data?.[0];
  if (!tenant) notFound();

  return (
    <Stack gap="lg">
      <Breadcrumbs>
        <Anchor component={Link} href="/ops">
          Tenants
        </Anchor>
        <Text>{tenant.institution_name}</Text>
      </Breadcrumbs>

      {searchParams?.created === "1" && (
        <Alert color="green" title="Tenant provisioned">
          The transaction committed successfully and initial owner email work is queued.
        </Alert>
      )}

      <Group justify="space-between" align="start">
        <div>
          <Title order={2}>{tenant.institution_name}</Title>
          <Text c="dimmed" size="sm">
            Tenant #{tenant.id}
          </Text>
        </div>
        <Badge color={tenant.status === "active" ? "green" : "red"} size="lg">
          {tenant.status}
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Paper withBorder p="md">
          <Text size="xs" c="dimmed">
            Defaults version
          </Text>
          <Text fw={600}>v{tenant.defaults_version}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="xs" c="dimmed">
            Initial owner
          </Text>
          <Text fw={600}>{tenant.initial_owner_email ?? "Legacy tenant"}</Text>
          <Text size="xs">{tenant.initial_owner_status ?? "Not queued"}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="xs" c="dimmed">
            Last status reason
          </Text>
          <Text fw={600}>{tenant.status_reason ?? "None"}</Text>
        </Paper>
      </SimpleGrid>

      <TenantOperationsForm tenant={tenant as PlatformTenantDetails} />
    </Stack>
  );
}
