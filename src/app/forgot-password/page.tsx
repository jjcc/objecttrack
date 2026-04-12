"use client";

import {
  Alert,
  Anchor,
  Button,
  Center,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import { useForgotPassword } from "@refinedev/core";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { mutate: forgotPassword, isPending } =
    useForgotPassword<ForgotPasswordFormValues>();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    initialValues: {
      email: "",
    },
    validate: zodResolver(forgotPasswordSchema),
  });

  const handleSubmit = (values: ForgotPasswordFormValues) => {
    setError(null);
    forgotPassword(values, {
      onError: (err) => {
        setError(err?.message ?? "Password reset failed. Please try again.");
      },
    });
  };

  return (
    <Center h="100vh" bg="gray.1" px="md">
      <Paper shadow="md" p={30} radius="md" w={420}>
        <Title order={2} ta="center" mb="lg">
          Object Tracking
        </Title>
        <Title order={4} ta="center" mb="xs" c="dimmed">
          Reset Password
        </Title>
        <Text size="sm" c="dimmed" ta="center" mb="lg">
          Enter your email address and we&apos;ll send you a password reset link.
        </Text>

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            mb="md"
            onClose={() => setError(null)}
            withCloseButton
          >
            {error}
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="name@example.com"
              required
              {...form.getInputProps("email")}
            />
            <Button type="submit" fullWidth loading={isPending}>
              Send reset link
            </Button>
            <Anchor component={Link} href="/login" size="sm" ta="center">
              Back to login
            </Anchor>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
