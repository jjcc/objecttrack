"use client";

import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Stack,
  Alert,
  Anchor,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import { z } from "zod";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { getSupabaseClient } from "@/lib/supabase/client";

type LoginFormValues = { email: string; password: string };

export function LoginForm({
  selfServiceRegistrationEnabled,
}: {
  selfServiceRegistrationEnabled: boolean;
}) {
  const t = useTranslations("Auth.login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next");
  const nextPath =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/dashboard";
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginSchema = z.object({
    email: z.string().email(t("invalidEmail")),
    password: z.string().min(6, t("passwordMin", { count: 6 })),
  });

  const form = useForm<LoginFormValues>({
    initialValues: {
      email: "",
      password: "",
    },
    validate: zodResolver(loginSchema),
  });

  const handleSubmit = async (values: LoginFormValues) => {
    setError(null);
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (signInError) {
        setError(signInError.code === "invalid_credentials" ? t("invalidCredentials") : t("failed"));
        return;
      }

      router.replace(nextPath);
    } catch {
      setError(t("failed"));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Paper shadow="md" p={30} radius="md" w={400}>
      <Title order={2} ta="center" mb="lg">
        {t("appTitle")}
      </Title>
      <Title order={4} ta="center" mb="lg" c="dimmed">
        {t("title")}
      </Title>

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
            label={t("email")}
            placeholder="admin@example.com"
            required
            {...form.getInputProps("email")}
          />
          <PasswordInput
            label={t("password")}
            placeholder={t("passwordPlaceholder")}
            required
            {...form.getInputProps("password")}
          />
          <Button type="submit" fullWidth loading={isPending}>
            {t("signIn")}
          </Button>
          <Anchor component={Link} href="/forgot-password" size="sm" ta="center">
            {t("forgotPassword")}
          </Anchor>
          {selfServiceRegistrationEnabled && (
            <Anchor
              component={Link}
              href={`/register?next=${encodeURIComponent(nextPath)}`}
              size="sm"
              ta="center"
            >
              {t("needAccount")}
            </Anchor>
          )}
        </Stack>
      </form>
    </Paper>
  );
}
