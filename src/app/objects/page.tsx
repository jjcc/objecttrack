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
import { AppShell } from "@/components/layout/AppShell";
import { ObjectBarcodeGenerator } from "@/components/shared/ObjectBarcodeGenerator";

export default function ObjectsListPage() {
  const router = useRouter();

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/objects">Objects</Anchor>
        </Breadcrumbs>

        <Group justify="space-between">
          <Title order={2}>Objects</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => router.push("/objects/create")}
          >
            Create Object
          </Button>
        </Group>

        <ObjectBarcodeGenerator />
      </Stack>
    </AppShell>
  );
}
