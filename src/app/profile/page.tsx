"use client";

import {
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Group,
  LoadingOverlay,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import { IconAlertCircle } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

type ProfileFormValues = { first_name: string; last_name: string; email: string; title: string; phone: string; city: string; province: string; country: string; zipcode: string; wechat_id: string };

interface ProfileMetadata {
  id: string;
  authEmail: string;
  groupName: string;
  createdAt: string;
}

export default function ProfilePage() {
  const t = useTranslations("Profile");
  const format = useFormatter();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ProfileMetadata | null>(null);
  const profileSchema = z.object({
    first_name: z.string(), last_name: z.string(), email: z.string().email(t("invalidEmail")).or(z.literal("")),
    title: z.string(), phone: z.string(), city: z.string(), province: z.string(), country: z.string(), zipcode: z.string(), wechat_id: z.string(),
  });

  const form = useForm<ProfileFormValues>({
    initialValues: {
      first_name: "",
      last_name: "",
      email: "",
      title: "",
      phone: "",
      city: "",
      province: "",
      country: "",
      zipcode: "",
      wechat_id: "",
    },
    validate: zodResolver(profileSchema),
  });

  useEffect(() => {
    let ignore = false;

    async function loadProfile() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const supabase = getSupabaseClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!user) throw new Error("session_expired");

        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select(
            "id, group_id, first_name, last_name, title, city, province, country, zipcode, phone, wechat_id, email, created_at, groups!user_profiles_group_id_fkey(title)",
          )
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) throw new Error("profile_missing");
        if (ignore) return;

        form.setValues({
          first_name: profile.first_name ?? "",
          last_name: profile.last_name ?? "",
          email: profile.email ?? user.email ?? "",
          title: profile.title ?? "",
          phone: profile.phone ?? "",
          city: profile.city ?? "",
          province: profile.province ?? "",
          country: profile.country ?? "",
          zipcode: profile.zipcode ?? "",
          wechat_id: profile.wechat_id ?? "",
        });
        form.resetDirty();

        setMetadata({
          id: profile.id,
          authEmail: user.email ?? "—",
          groupName: profile.groups?.title ?? t("notAssigned"),
          createdAt: profile.created_at,
        });
      } catch (error) {
        if (!ignore) {
          setLoadError(error instanceof Error && error.message === "session_expired" ? t("sessionExpired") : error instanceof Error && error.message === "profile_missing" ? t("profileMissing") : t("loadFailedMessage"));
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadProfile();

    return () => {
      ignore = true;
    };
  }, [t]);

  const handleSubmit = async (values: ProfileFormValues) => {
    setIsSaving(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.rpc("update_own_profile", {
        p_first_name: values.first_name,
        p_last_name: values.last_name,
        p_email: values.email,
        p_title: values.title,
        p_phone: values.phone,
        p_city: values.city,
        p_province: values.province,
        p_country: values.country,
        p_zipcode: values.zipcode,
        p_wechat_id: values.wechat_id,
      });

      if (error) throw error;

      form.resetDirty();
      showNotification({
        color: "green",
        title: t("saved"),
        message: t("savedMessage"),
      });
    } catch {
      showNotification({
        color: "red",
        title: t("saveFailed"),
        message: t("saveFailedMessage"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Text>{t("profile")}</Text>
        </Breadcrumbs>

        <div>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed" size="sm">
            {t("description")}
          </Text>
        </div>

        {loadError && (
          <Alert
            color="red"
            title={t("loadFailed")}
            icon={<IconAlertCircle size={18} />}
          >
            {loadError}
          </Alert>
        )}

        <Paper withBorder p="md" radius="md" maw={900} pos="relative">
          <LoadingOverlay visible={isLoading} />

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="lg">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label={t("accountId")}
                  value={metadata?.id ?? ""}
                  readOnly
                  description={t("managedByAuth")}
                />
                <TextInput
                  label={t("authEmail")}
                  value={metadata?.authEmail ?? ""}
                  readOnly
                  description={t("usedToSignIn")}
                />
                <TextInput
                  label={t("group")}
                  value={metadata?.groupName ?? ""}
                  readOnly
                  description={t("managedByAdmin")}
                />
                <TextInput
                  label={t("profileCreated")}
                  value={metadata?.createdAt ? format.dateTime(new Date(metadata.createdAt), "dateTime") : ""}
                  readOnly
                />
              </SimpleGrid>

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
                  label={t("contactEmail")}
                  placeholder={t("contactEmailPlaceholder")}
                  {...form.getInputProps("email")}
                />
                <TextInput
                  label={t("jobTitle")}
                  placeholder={t("jobTitlePlaceholder")}
                  {...form.getInputProps("title")}
                />
                <TextInput
                  label={t("phone")}
                  placeholder={t("phonePlaceholder")}
                  {...form.getInputProps("phone")}
                />
                <TextInput
                  label={t("wechatId")}
                  placeholder={t("wechatId")}
                  {...form.getInputProps("wechat_id")}
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
              </SimpleGrid>

              <Group>
                <Button
                  type="submit"
                  loading={isSaving}
                  disabled={isLoading || Boolean(loadError) || !form.isDirty()}
                >
                  {t("saveChanges")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                  disabled={isSaving}
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
