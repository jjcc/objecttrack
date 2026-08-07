"use client";

import {
  Alert,
  Anchor,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase/client";

type RegisterFormValues = { email: string; password: string; confirmPassword: string };

export function RegisterForm({
  invitedEmail,
  tenantName,
  nextPath,
}: {
  invitedEmail: string;
  tenantName: string;
  nextPath: string;
}) {
  const t = useTranslations("Auth.register");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const registerSchema = z
    .object({
      email: z.string().email(t("invalidEmail")),
      password: z.string().min(8, t("passwordMin", { count: 8 })),
      confirmPassword: z.string().min(8, t("passwordMin", { count: 8 })),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: t("passwordMismatch"),
      path: ["confirmPassword"],
    });

  const form = useForm<RegisterFormValues>({
    initialValues: {
      email: invitedEmail,
      password: "",
      confirmPassword: "",
    },
    validate: zodResolver(registerSchema),
  });

  const handleSubmit = async (values: RegisterFormValues) => {
    setError(null);
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const confirmationUrl = new URL("/auth/callback", window.location.origin);
      confirmationUrl.searchParams.set("next", nextPath);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: confirmationUrl.toString(),
          data: {
            email: values.email,
          },
        },
      });

      if (signUpError) {
        setError(t("failed"));
        return;
      }

      if (data.session) {
        router.replace(nextPath);
        router.refresh();
        return;
      }

      setSuccess(true);
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
          {t("invitationTitle")}
        </Title>
        <Text size="sm" c="dimmed" ta="center" mb="lg">
          {t("invitationDescription", { email: invitedEmail, tenant: tenantName })}
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

        {success ? (
          <Stack>
            <Alert color="green" mb="md">
              {t("success")}
            </Alert>
            <Anchor
              component={Link}
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              size="sm"
              ta="center"
            >
              {t("continueSignIn")}
            </Anchor>
          </Stack>
        ) : (
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput
                label={t("email")}
                placeholder="name@example.com"
                required
                {...form.getInputProps("email")}
                readOnly
              />
              <PasswordInput
                label={t("password")}
                placeholder={t("passwordPlaceholder")}
                required
                {...form.getInputProps("password")}
              />
              <PasswordInput
                label={t("confirmPassword")}
                placeholder={t("confirmPasswordPlaceholder")}
                required
                {...form.getInputProps("confirmPassword")}
              />
              <Button type="submit" fullWidth loading={isPending}>
                {t("submit")}
              </Button>
              <Anchor
                component={Link}
                href={`/login?next=${encodeURIComponent(nextPath)}`}
                size="sm"
                ta="center"
              >
                {t("backToLogin")}
              </Anchor>
            </Stack>
          </form>
        )}
      </Paper>
    </Center>
  );
}
