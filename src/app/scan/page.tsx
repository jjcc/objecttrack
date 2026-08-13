import { Anchor, Breadcrumbs, Stack, Title, Paper, Text } from "@mantine/core";
import { AppShell } from "@/components/layout/AppShell";
import { getTranslations } from "next-intl/server";
import { HolderLookup } from "@/components/objects/HolderLookup";

export default async function ScanPage() {
  const t = await getTranslations("Scan");
  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/scan">{t("scan")}</Anchor>
        </Breadcrumbs>

        <Title order={2}>{t("title")}</Title>

        <Paper withBorder p="xl" radius="md">
          <Stack align="center" gap="md">
            <Text size="lg" ta="center">
              {t("description")}
            </Text>
          </Stack>
        </Paper>
        <HolderLookup />
      </Stack>
    </AppShell>
  );
}
