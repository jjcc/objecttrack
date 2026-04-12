"use client";

import { Anchor, Button, Center, Paper, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconSearchOff } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <Center h="100vh" bg="gray.1" px="md">
      <Paper shadow="md" p="xl" radius="md" maw={480} w="100%">
        <Stack align="center" gap="md">
          <IconSearchOff size={48} />
          <Title order={2}>Page Not Found</Title>
          <Text c="dimmed" ta="center">
            The page you requested does not exist or may have been moved.
          </Text>
          <Button
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.push("/dashboard")}
          >
            Back to Dashboard
          </Button>
          <Anchor href="/dashboard" size="sm">
            Go to dashboard manually
          </Anchor>
        </Stack>
      </Paper>
    </Center>
  );
}
