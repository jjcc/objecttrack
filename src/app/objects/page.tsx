"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Group,
  Button,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { ObjectBarcodeGenerator } from "@/components/shared/ObjectBarcodeGenerator";

export default function ObjectsListPage() {
  const t = useTranslations("Objects");
  const router = useRouter();

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/objects">{t("title")}</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>{t("title")}</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => router.push("/objects/create")}
          >
            {t("create")}
          </Button>
        </Group>

        <ObjectBarcodeGenerator />
      </Stack>
    </AppShell>
  );
}
