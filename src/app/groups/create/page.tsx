"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Paper,
  TextInput,
  Textarea,
  Button,
  Group,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

type GroupFormValues = { title: string; description?: string };

export default function GroupCreatePage() {
  const t = useTranslations("Groups.form");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const groupSchema = z.object({ title: z.string().min(1, t("titleRequired")), description: z.string().optional() });

  const form = useForm<GroupFormValues>({
    initialValues: {
      title: "",
      description: "",
    },
    validate: zodResolver(groupSchema),
  });

  const handleSubmit = async (values: GroupFormValues) => {
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from("groups") as any).insert({
        title: values.title,
        description: values.description || null,
      });

      if (error) {
        showNotification({
          color: "red",
          title: t("error"),
          message: t("createFailed"),
        });
        return;
      }

      showNotification({
        color: "green",
        title: t("success"),
        message: t("createSuccess"),
      });
      router.push("/groups");
    } catch {
      showNotification({
        color: "red",
        title: t("error"),
        message: t("createFailed"),
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/groups">{t("groups")}</Anchor>
          <Anchor>{t("create")}</Anchor>
        </Breadcrumbs>

        <Title order={2}>{t("createTitle")}</Title>

        <Paper withBorder p="md" radius="md" maw={600}>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput
                label={t("groupTitle")}
                placeholder={t("titlePlaceholder")}
                required
                {...form.getInputProps("title")}
              />
              <Textarea
                label={t("description")}
                placeholder={t("descriptionPlaceholder")}
                rows={3}
                {...form.getInputProps("description")}
              />
              <Group>
                <Button type="submit" loading={isPending}>
                  {t("create")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/groups")}
                >
                  {t("cancel")}
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </AppShell>
  );
}
