"use client";

import { Center } from "@mantine/core";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <Center h="100vh" bg="gray.1">
      <LoginForm />
    </Center>
  );
}
