import Link from "next/link";
import { Anchor, Breadcrumbs, Stack, Text, Title } from "@mantine/core";
import { ProvisionTenantForm } from "@/app/ops/_components/ProvisionTenantForm";
import { requirePlatformAccess } from "@/lib/ops/access";
import { getTranslations } from "next-intl/server";

export default async function NewTenantPage() {
  await requirePlatformAccess("platform.tenants.create");
  const t = await getTranslations("Ops.newTenant");

  return (
    <Stack gap="lg">
      <Breadcrumbs>
        <Anchor component={Link} href="/ops">
          {t("tenants")}
        </Anchor>
        <Text>{t("newTenant")}</Text>
      </Breadcrumbs>
      <div>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed" size="sm">
          {t("description")}
        </Text>
      </div>
      <ProvisionTenantForm />
    </Stack>
  );
}
