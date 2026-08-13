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
  type PlatformTenantProductContext,
} from "@/app/ops/_components/TenantOperationsForm";
import { requirePlatformAccess } from "@/lib/ops/access";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function TenantOperationsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { created?: string };
}) {
  const t = await getTranslations("Ops.tenantDetails");
  const tenantId = Number(params.id);
  if (!Number.isSafeInteger(tenantId) || tenantId <= 0) notFound();

  const { supabase } = await requirePlatformAccess("platform.tenants.update");
  const [tenantResult, productResult] = await Promise.all([
    supabase.rpc("platform_tenant", { p_tenant_id: tenantId }),
    supabase.rpc("platform_tenant_product_context", { p_tenant_id: tenantId }),
  ]);
  if (tenantResult.error) throw new Error(tenantResult.error.message);
  if (productResult.error) throw new Error(productResult.error.message);

  const tenant = tenantResult.data?.[0];
  const product = productResult.data?.[0];
  if (!tenant || !product) notFound();

  return (
    <Stack gap="lg">
      <Breadcrumbs>
        <Anchor component={Link} href="/ops">
          {t("tenants")}
        </Anchor>
        <Text>{tenant.institution_name}</Text>
      </Breadcrumbs>

      {searchParams?.created === "1" && (
        <Alert color="green" title={t("provisionedTitle")}>
          {t("provisioned")}
        </Alert>
      )}

      <Group justify="space-between" align="start">
        <div>
          <Title order={2}>{tenant.institution_name}</Title>
          <Text c="dimmed" size="sm">
            {t("tenantNumber", { id: tenant.id })}
          </Text>
        </div>
        <Badge color={tenant.status === "active" ? "green" : "red"} size="lg">
          {t(
            tenant.status === "active"
              ? "statuses.active"
              : "statuses.suspended"
          )}
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Paper withBorder p="md">
          <Text size="xs" c="dimmed">
            {t("defaultsVersion")}
          </Text>
          <Text fw={600}>v{tenant.defaults_version}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="xs" c="dimmed">
            {t("initialOwner")}
          </Text>
          <Text fw={600}>{tenant.initial_owner_email ?? t("legacyTenant")}</Text>
          <Text size="xs">{tenant.initial_owner_status ?? t("notQueued")}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="xs" c="dimmed">
            {t("lastStatusReason")}
          </Text>
          <Text fw={600}>{tenant.status_reason ?? t("none")}</Text>
        </Paper>
      </SimpleGrid>

      <TenantOperationsForm
        tenant={tenant as PlatformTenantDetails}
        product={product as PlatformTenantProductContext}
      />
    </Stack>
  );
}
