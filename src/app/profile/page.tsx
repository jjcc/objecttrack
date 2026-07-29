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
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

const profileSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().email("Enter a valid contact email").or(z.literal("")),
  title: z.string(),
  phone: z.string(),
  city: z.string(),
  province: z.string(),
  country: z.string(),
  zipcode: z.string(),
  wechat_id: z.string(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileMetadata {
  id: string;
  authEmail: string;
  groupName: string;
  createdAt: string;
}

function errorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

export default function ProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ProfileMetadata | null>(null);

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
        if (!user) throw new Error("Your session has expired. Please sign in again.");

        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select(
            "id, group_id, first_name, last_name, title, city, province, country, zipcode, phone, wechat_id, email, created_at, groups(title)",
          )
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) throw new Error("No profile record exists for this account.");
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
          groupName: profile.groups?.title ?? "Not assigned",
          createdAt: new Date(profile.created_at).toLocaleString(),
        });
      } catch (error) {
        if (!ignore) {
          setLoadError(errorMessage(error, "Unable to load your profile."));
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadProfile();

    return () => {
      ignore = true;
    };
  }, []);

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
        title: "Profile saved",
        message: "Your profile information was updated successfully.",
      });
    } catch (error) {
      showNotification({
        color: "red",
        title: "Unable to save profile",
        message: errorMessage(error, "Your profile could not be updated."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Text>Profile</Text>
        </Breadcrumbs>

        <div>
          <Title order={2}>My Profile</Title>
          <Text c="dimmed" size="sm">
            Update your personal and contact information.
          </Text>
        </div>

        {loadError && (
          <Alert
            color="red"
            title="Unable to load profile"
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
                  label="Account ID"
                  value={metadata?.id ?? ""}
                  readOnly
                  description="Managed by authentication"
                />
                <TextInput
                  label="Authentication Email"
                  value={metadata?.authEmail ?? ""}
                  readOnly
                  description="Used to sign in"
                />
                <TextInput
                  label="Group"
                  value={metadata?.groupName ?? ""}
                  readOnly
                  description="Managed by an administrator"
                />
                <TextInput
                  label="Profile Created"
                  value={metadata?.createdAt ?? ""}
                  readOnly
                />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label="First Name"
                  placeholder="First name"
                  {...form.getInputProps("first_name")}
                />
                <TextInput
                  label="Last Name"
                  placeholder="Last name"
                  {...form.getInputProps("last_name")}
                />
                <TextInput
                  label="Contact Email"
                  placeholder="Contact email"
                  {...form.getInputProps("email")}
                />
                <TextInput
                  label="Title"
                  placeholder="Job title"
                  {...form.getInputProps("title")}
                />
                <TextInput
                  label="Phone"
                  placeholder="Phone number"
                  {...form.getInputProps("phone")}
                />
                <TextInput
                  label="WeChat ID"
                  placeholder="WeChat ID"
                  {...form.getInputProps("wechat_id")}
                />
                <TextInput
                  label="City"
                  placeholder="City"
                  {...form.getInputProps("city")}
                />
                <TextInput
                  label="Province / State"
                  placeholder="Province or state"
                  {...form.getInputProps("province")}
                />
                <TextInput
                  label="Country"
                  placeholder="Country"
                  {...form.getInputProps("country")}
                />
                <TextInput
                  label="Zip / Postal Code"
                  placeholder="Zip or postal code"
                  {...form.getInputProps("zipcode")}
                />
              </SimpleGrid>

              <Group>
                <Button
                  type="submit"
                  loading={isSaving}
                  disabled={isLoading || Boolean(loadError) || !form.isDirty()}
                >
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </AppShell>
  );
}
