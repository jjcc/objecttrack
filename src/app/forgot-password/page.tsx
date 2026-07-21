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
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase/client";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isPending, setIsPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    initialValues: {
      email: "",
    },
    validate: zodResolver(forgotPasswordSchema),
  });

  const handleSubmit = async (values: ForgotPasswordFormValues) => {
    setError(null);
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        values.email,
        { redirectTo: `${window.location.origin}/login` }
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSent(true);
    } catch (err) {
      setError((err as Error)?.message ?? "Password reset failed. Please try again.");
    } finally {
      setIsPending(false);
    }
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

        {sent ? (
          <Alert color="green" mb="md">
            Check your email for a password reset link.
          </Alert>
        ) : (
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
        )}
      </Paper>
    </Center>
  );
}
