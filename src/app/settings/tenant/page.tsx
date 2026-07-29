"use client";

import {
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import { IconAlertCircle } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

type TenantForm = {
  institution_name: string;
  description: string;
  address: string;
  contact: string;
  phone: string;
  email: string;
  website: string;
  social_media: string;
};

const emptyValues: TenantForm = {
  institution_name: "",
  description: "",
  address: "",
  contact: "",
  phone: "",
  email: "",
  website: "",
  social_media: "",
};

export default function TenantSettingsPage() {
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const form = useForm<TenantForm>({
    initialValues: emptyValues,
    validate: {
      institution_name: (value) => value.trim() ? null : "Institution name is required",
      email: (value) =>
        value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
          ? "Enter a valid email"
          : null,
      social_media: (value) => {
        if (!value.trim()) return null;
        try {
          const parsed = JSON.parse(value);
          return parsed && !Array.isArray(parsed) && typeof parsed === "object"
            ? null
            : "Use a JSON object, for example {\"linkedin\":\"https://...\"}";
        } catch {
          return "Social media must be valid JSON";
        }
      },
    },
  });

  useEffect(() => {
    async function fetchTenant() {
      const supabase = getSupabaseClient();
      const { data, error } = await (supabase as any).from("tenant")
        .select("*")
        .single();

      if (error) {
        setLoadError(error.message);
      } else if (data) {
        setTenantId(data.id);
        form.setValues({
          institution_name: data.institution_name ?? "",
          description: data.description ?? "",
          address: data.address ?? "",
          contact: data.contact ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          website: data.website ?? "",
          social_media:
            data.social_media && Object.keys(data.social_media).length
              ? JSON.stringify(data.social_media, null, 2)
              : "",
        });
        form.resetDirty();
      }
      setIsLoading(false);
    }
    fetchTenant();
  }, []);

  const handleSubmit = async (values: TenantForm) => {
    if (tenantId === null) return;
    setIsSaving(true);
    const supabase = getSupabaseClient();
    const { error } = await (supabase as any).from("tenant")
      .update({
        institution_name: values.institution_name.trim(),
        description: values.description.trim() || null,
        address: values.address.trim() || null,
        contact: values.contact.trim() || null,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        website: values.website.trim() || null,
        social_media: values.social_media.trim()
          ? JSON.parse(values.social_media)
          : {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);
    setIsSaving(false);

    showNotification({
      color: error ? "red" : "green",
      title: error ? "Unable to save institution" : "Institution saved",
      message: error?.message ?? "Tenant information was updated successfully.",
    });
    if (!error) form.resetDirty();
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/settings">Settings</Anchor>
          <Text>Institution</Text>
        </Breadcrumbs>
        <div>
          <Title order={2}>Institution</Title>
          <Text c="dimmed" size="sm">Manage information for your tenant.</Text>
        </div>
        {loadError && (
          <Alert color="red" title="Unable to load institution" icon={<IconAlertCircle size={18} />}>
            {loadError}
          </Alert>
        )}
        <Paper withBorder p="md" radius="md" maw={800}>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput label="Institution name" required disabled={isLoading} {...form.getInputProps("institution_name")} />
              <Textarea label="Description" rows={3} disabled={isLoading} {...form.getInputProps("description")} />
              <Textarea label="Address" rows={2} disabled={isLoading} {...form.getInputProps("address")} />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Contact" disabled={isLoading} {...form.getInputProps("contact")} />
                <TextInput label="Phone" disabled={isLoading} {...form.getInputProps("phone")} />
                <TextInput label="Email" type="email" disabled={isLoading} {...form.getInputProps("email")} />
                <TextInput label="Website" type="url" disabled={isLoading} {...form.getInputProps("website")} />
              </SimpleGrid>
              <Textarea
                label="Social media"
                description='JSON object, for example {"linkedin":"https://linkedin.com/company/example"}'
                rows={4}
                disabled={isLoading}
                {...form.getInputProps("social_media")}
              />
              <Button type="submit" loading={isSaving} disabled={isLoading || tenantId === null}>
                Save
              </Button>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </AppShell>
  );
}
