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
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ObjectBarcodeGenerator } from "@/components/shared/ObjectBarcodeGenerator";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function ObjectsListPage() {
  const t = useTranslations("Objects");
  const router = useRouter();
  const [canManageObjects, setCanManageObjects] = useState(false);

  useEffect(() => {
    async function resolveAccess() {
      const { data: role } = await getSupabaseClient().rpc(
        "current_tenant_role"
      );
      setCanManageObjects(role === "admin" || role === "owner");
    }
    void resolveAccess();
  }, []);

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/objects">{t("title")}</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>{t("title")}</Title>
          {canManageObjects ? (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => router.push("/objects/create")}
            >
              {t("create")}
            </Button>
          ) : null}
        </Group>

        <ObjectBarcodeGenerator canManageObjects={canManageObjects} />
      </Stack>
    </AppShell>
  );
}
