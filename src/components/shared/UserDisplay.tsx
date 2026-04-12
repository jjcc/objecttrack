"use client";

import { Text } from "@mantine/core";

interface UserDisplayProps {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  fallback?: string;
}

export function UserDisplay({
  firstName,
  lastName,
  email,
  fallback = "—",
}: UserDisplayProps) {
  const name = [firstName, lastName].filter(Boolean).join(" ");

  if (name) {
    return <Text size="sm">{name}</Text>;
  }

  if (email) {
    return (
      <Text size="sm" c="dimmed">
        {email}
      </Text>
    );
  }

  return (
    <Text size="sm" c="dimmed">
      {fallback}
    </Text>
  );
}
