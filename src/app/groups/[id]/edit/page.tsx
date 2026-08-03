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
  LoadingOverlay,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

type GroupFormValues = { title: string; description?: string };

export default function GroupEditPage() {
  const t = useTranslations("Groups.form");
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const groupSchema = z.object({ title: z.string().min(1, t("titleRequired")), description: z.string().optional() });

  const form = useForm<GroupFormValues>({
    initialValues: {
      title: "",
      description: "",
    },
    validate: zodResolver(groupSchema),
  });

  useEffect(() => {
    async function fetchGroup() {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("groups")
        .select("*")
        .eq("id", Number(id))
        .single();

      if (data) {
        form.setValues({
          title: data.title ?? "",
          description: data.description ?? "",
        });
      }

      setIsLoading(false);
    }

    fetchGroup();
  }, [id, form]);

  const handleSubmit = async (values: GroupFormValues) => {
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from("groups") as any)
        .update({
          title: values.title,
          description: values.description || null,
        })
        .eq("id", Number(id));

      if (error) {
        showNotification({
          color: "red",
          title: t("error"),
          message: t("updateFailed"),
        });
        return;
      }

      showNotification({
        color: "green",
        title: t("success"),
        message: t("updateSuccess"),
      });
      router.push("/groups");
    } catch {
      showNotification({
        color: "red",
        title: t("error"),
        message: t("updateFailed"),
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
          <Anchor>{t("edit")}</Anchor>
        </Breadcrumbs>

        <Title order={2}>{t("editTitle")}</Title>

        <Paper withBorder p="md" radius="md" maw={600} pos="relative">
          <LoadingOverlay visible={isLoading} />
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
                  {t("save")}
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
