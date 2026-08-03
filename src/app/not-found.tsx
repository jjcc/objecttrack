"use client";

import { Anchor, Button, Center, Paper, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconSearchOff } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("NotFound");
  const router = useRouter();

  return (
    <Center h="100vh" bg="gray.1" px="md">
      <Paper shadow="md" p="xl" radius="md" maw={480} w="100%">
        <Stack align="center" gap="md">
          <IconSearchOff size={48} />
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed" ta="center">
            {t("description")}
          </Text>
          <Button
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.push("/dashboard")}
          >
            {t("backToDashboard")}
          </Button>
          <Anchor href="/dashboard" size="sm">
            {t("manualLink")}
          </Anchor>
        </Stack>
      </Paper>
    </Center>
  );
}
