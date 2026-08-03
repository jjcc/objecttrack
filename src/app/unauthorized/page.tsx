"use client";

import { Center, Paper, Title, Text, Button, Stack } from "@mantine/core";
import { IconShieldOff } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function UnauthorizedPage() {
  const t = useTranslations("Auth.unauthorized");
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <Center h="100vh" bg="gray.1">
      <Paper shadow="md" p={30} radius="md" w={400}>
        <Stack align="center" gap="md">
          <IconShieldOff size={48} color="red" />
          <Title order={3}>{t("title")}</Title>
          <Text c="dimmed" ta="center">
            {t("description")}
          </Text>
          <Button
            variant="outline"
            color="red"
            onClick={handleLogout}
            fullWidth
          >
            {t("returnToLogin")}
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
