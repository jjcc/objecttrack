"use client";

import { Center, Paper, Title, Text, Button, Stack } from "@mantine/core";
import { IconShieldOff } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function UnauthorizedPage() {
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
          <Title order={3}>Access Denied</Title>
          <Text c="dimmed" ta="center">
            You are not authorized to access this application. Only
            administrators can use this dashboard.
          </Text>
          <Button
            variant="outline"
            color="red"
            onClick={handleLogout}
            fullWidth
          >
            Return to Login
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
