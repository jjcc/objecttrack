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
import { useTranslations } from "next-intl";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase/client";

type ForgotPasswordFormValues = { email: string };

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth.forgotPassword");
  const [isPending, setIsPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const forgotPasswordSchema = z.object({ email: z.string().email(t("invalidEmail")) });

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
        setError(t("failed"));
        return;
      }

      setSent(true);
    } catch {
      setError(t("failed"));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Center h="100vh" bg="gray.1" px="md">
      <Paper shadow="md" p={30} radius="md" w={420}>
        <Title order={2} ta="center" mb="lg">
          {t("appTitle")}
        </Title>
        <Title order={4} ta="center" mb="xs" c="dimmed">
          {t("title")}
        </Title>
        <Text size="sm" c="dimmed" ta="center" mb="lg">
          {t("description")}
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
            {t("sent")}
          </Alert>
        ) : (
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput
                label={t("email")}
                placeholder="name@example.com"
                required
                {...form.getInputProps("email")}
              />
              <Button type="submit" fullWidth loading={isPending}>
                {t("submit")}
              </Button>
              <Anchor component={Link} href="/login" size="sm" ta="center">
                {t("backToLogin")}
              </Anchor>
            </Stack>
          </form>
        )}
      </Paper>
    </Center>
  );
}
