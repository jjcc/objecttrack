"use client";

import {
  Alert,
  Anchor,
  Button,
  Center,
  Paper,
  PasswordInput,
  Select,
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

type RegisterFormValues = {
  email: string;
  password: string;
  confirmPassword: string;
  workspaceName: string;
  workspaceKind: "family" | "business" | "club" | "collector" | "other";
};

export function RegisterForm({
  invitedEmail,
  tenantName,
  nextPath,
  mode,
}: {
  invitedEmail?: string;
  tenantName?: string;
  nextPath: string;
  mode: "invitation" | "selfService";
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
      workspaceName: z.string().trim(),
      workspaceKind: z.enum(["family", "business", "club", "collector", "other"]),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: t("passwordMismatch"),
      path: ["confirmPassword"],
    })
    .refine(
      (values) => mode === "invitation" || values.workspaceName.length >= 2,
      { message: t("workspaceNameMin"), path: ["workspaceName"] }
    );

  const form = useForm<RegisterFormValues>({
    initialValues: {
      email: invitedEmail ?? "",
      password: "",
      confirmPassword: "",
      workspaceName: "",
      workspaceKind: "family",
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
            registration_mode:
              mode === "selfService" ? "self_service" : "invitation",
            ...(mode === "selfService"
              ? {
                  workspace_name: values.workspaceName.trim(),
                  workspace_kind: values.workspaceKind,
                }
              : {}),
          },
        },
      });

      if (signUpError) {
        setError(t("failed"));
        return;
      }

      if (data.session) {
        if (mode === "selfService") {
          const { data: provisioning, error: provisioningError } =
            await supabase.rpc("create_simple_workspace", {
              p_workspace_name: values.workspaceName.trim(),
              p_workspace_kind: values.workspaceKind,
            });
          const result = provisioning?.[0];
          if (
            provisioningError ||
            !result ||
            !["created", "existing"].includes(result.result_code)
          ) {
            router.replace("/onboarding?provisioning=failed");
            router.refresh();
            return;
          }
          router.replace("/onboarding?created=1");
          router.refresh();
          return;
        }
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
          {t(mode === "invitation" ? "invitationTitle" : "selfServiceTitle")}
        </Title>
        <Text size="sm" c="dimmed" ta="center" mb="lg">
          {mode === "invitation"
            ? t("invitationDescription", {
                email: invitedEmail ?? "",
                tenant: tenantName ?? "",
              })
            : t("selfServiceDescription")}
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
              {t(mode === "invitation" ? "success" : "successSelfService")}
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
                readOnly={mode === "invitation"}
              />
              {mode === "selfService" ? (
                <>
                  <TextInput
                    label={t("workspaceName")}
                    placeholder={t("workspaceNamePlaceholder")}
                    required
                    {...form.getInputProps("workspaceName")}
                  />
                  <Select
                    label={t("workspaceKind")}
                    data={[
                      { value: "family", label: t("workspaceKinds.family") },
                      { value: "business", label: t("workspaceKinds.business") },
                      { value: "club", label: t("workspaceKinds.club") },
                      { value: "collector", label: t("workspaceKinds.collector") },
                      { value: "other", label: t("workspaceKinds.other") },
                    ]}
                    allowDeselect={false}
                    {...form.getInputProps("workspaceKind")}
                  />
                </>
              ) : null}
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
                {t(mode === "invitation" ? "submit" : "createWorkspace")}
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
