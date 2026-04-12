"use client";

import { Anchor, Breadcrumbs, Stack, Title } from "@mantine/core";
import { AppShell } from "@/components/layout/AppShell";
import { ObjectBarcodeGenerator } from "@/components/shared/ObjectBarcodeGenerator";

export default function BarcodePage() {
  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/barcode">Barcode</Anchor>
        </Breadcrumbs>

        <Title order={2}>Barcode</Title>

        <ObjectBarcodeGenerator />
      </Stack>
    </AppShell>
  );
}
