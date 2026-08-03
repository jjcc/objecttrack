"use client";

import { Anchor, Breadcrumbs, Stack, Title } from "@mantine/core";
import { AppShell } from "@/components/layout/AppShell";
import { ObjectBarcodeGenerator } from "@/components/shared/ObjectBarcodeGenerator";
import { useTranslations } from "next-intl";

export default function BarcodePage() {
  const t = useTranslations("Barcode");
  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/barcode">{t("title")}</Anchor>
        </Breadcrumbs>

        <Title order={2}>{t("title")}</Title>

        <ObjectBarcodeGenerator />
      </Stack>
    </AppShell>
  );
}
