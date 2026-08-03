"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Paper,
  TextInput,
  Select,
  Button,
  Group,
  SimpleGrid,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

type UserFormValues = {
  id: string; first_name?: string; last_name?: string; email?: string; title?: string;
  group_id?: string; phone?: string; city?: string; province?: string; country?: string;
  zipcode?: string; wechat_id?: string;
};

export default function UserCreatePage() {
  const t = useTranslations("Users.form");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [groupOptions, setGroupOptions] = useState<{ value: string; label: string }[]>([]);
  const userSchema = z.object({
    id: z.string().uuid(t("invalidUuid")),
    first_name: z.string().optional(), last_name: z.string().optional(),
    email: z.string().email(t("invalidEmail")).optional().or(z.literal("")),
    title: z.string().optional(), group_id: z.string().optional(), phone: z.string().optional(),
    city: z.string().optional(), province: z.string().optional(), country: z.string().optional(),
    zipcode: z.string().optional(), wechat_id: z.string().optional(),
  });

  useEffect(() => {
    async function fetchGroups() {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("groups").select("id, title").order("title") as unknown as { data: { id: number; title: string }[] };
      setGroupOptions((data ?? []).map((g) => ({ value: String(g.id), label: g.title })));
    }
    fetchGroups();
  }, []);

  const form = useForm<UserFormValues>({
    initialValues: {
      id: "",
      first_name: "",
      last_name: "",
      email: "",
      title: "",
      group_id: "",
      phone: "",
      city: "",
      province: "",
      country: "",
      zipcode: "",
      wechat_id: "",
    },
    validate: zodResolver(userSchema),
  });

  const handleSubmit = async (values: UserFormValues) => {
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from("user_profiles") as any).insert({
        id: values.id,
        first_name: values.first_name || null,
        last_name: values.last_name || null,
        email: values.email || null,
        title: values.title || null,
        group_id: values.group_id ? Number(values.group_id) : null,
        phone: values.phone || null,
        city: values.city || null,
        province: values.province || null,
        country: values.country || null,
        zipcode: values.zipcode || null,
        wechat_id: values.wechat_id || null,
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
      router.push("/users");
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
          <Anchor href="/users">{t("users")}</Anchor>
          <Anchor>{t("create")}</Anchor>
        </Breadcrumbs>

        <Title order={2}>{t("createTitle")}</Title>

        <Paper withBorder p="md" radius="md" maw={800}>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput
                label={t("authUserId")}
                placeholder={t("authUserIdPlaceholder")}
                required
                {...form.getInputProps("id")}
              />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label={t("firstName")}
                  placeholder={t("firstNamePlaceholder")}
                  {...form.getInputProps("first_name")}
                />
                <TextInput
                  label={t("lastName")}
                  placeholder={t("lastNamePlaceholder")}
                  {...form.getInputProps("last_name")}
                />
                <TextInput
                  label={t("email")}
                  placeholder={t("emailPlaceholder")}
                  {...form.getInputProps("email")}
                />
                <TextInput
                  label={t("jobTitle")}
                  placeholder={t("jobTitlePlaceholder")}
                  {...form.getInputProps("title")}
                />
                <Select
                  label={t("group")}
                  placeholder={t("groupPlaceholder")}
                  data={groupOptions}
                  clearable
                  searchable
                  {...form.getInputProps("group_id")}
                />
                <TextInput
                  label={t("phone")}
                  placeholder={t("phonePlaceholder")}
                  {...form.getInputProps("phone")}
                />
                <TextInput
                  label={t("city")}
                  placeholder={t("city")}
                  {...form.getInputProps("city")}
                />
                <TextInput
                  label={t("province")}
                  placeholder={t("provincePlaceholder")}
                  {...form.getInputProps("province")}
                />
                <TextInput
                  label={t("country")}
                  placeholder={t("country")}
                  {...form.getInputProps("country")}
                />
                <TextInput
                  label={t("zipcode")}
                  placeholder={t("zipcodePlaceholder")}
                  {...form.getInputProps("zipcode")}
                />
                <TextInput
                  label={t("wechatId")}
                  placeholder={t("wechatId")}
                  {...form.getInputProps("wechat_id")}
                />
              </SimpleGrid>
              <Group>
                <Button type="submit" loading={isPending}>
                  {t("create")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/users")}
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
