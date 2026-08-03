"use client";

import {
  ActionIcon,
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { IconAlertCircle, IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

export type CustomFieldDefinition = { name: string; note: string };

export default function CustomFieldsSettingsPage() {
  const t = useTranslations("Settings.customFields");
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [schemaId, setSchemaId] = useState<number | null>(null);
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSchema() {
      const supabase = getSupabaseClient();
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("tenant_id")
        .single() as any;
      if (profileError || !profile?.tenant_id) {
        setLoadError(t("tenantMissing"));
        setIsLoading(false);
        return;
      }
      setTenantId(profile.tenant_id);
      const { data, error } = await (supabase as any).from("object_custom_schemas")
        .select("id, fields")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();
      if (error) setLoadError(t("loadFailed"));
      if (data) {
        setSchemaId(data.id);
        setFields(Array.isArray(data.fields) ? data.fields : []);
      }
      setIsLoading(false);
    }
    fetchSchema();
  }, [t]);

  const updateField = (index: number, key: keyof CustomFieldDefinition, value: string) => {
    setFields((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, [key]: value } : field
      )
    );
  };

  const handleSave = async () => {
    const normalized = fields.map((field) => ({
      name: field.name.trim(),
      note: field.note.trim(),
    }));
    if (normalized.some((field) => !field.name)) {
      showNotification({ color: "red", title: t("missingName"), message: t("missingNameMessage") });
      return;
    }
    const names = normalized.map((field) => field.name.toLocaleLowerCase());
    if (new Set(names).size !== names.length) {
      showNotification({ color: "red", title: t("duplicateName"), message: t("duplicateNameMessage") });
      return;
    }
    if (tenantId === null) return;

    setIsSaving(true);
    const supabase = getSupabaseClient();
    const query = schemaId === null
      ? (supabase as any).from("object_custom_schemas")
          .insert({ tenant_id: tenantId, fields: normalized })
          .select("id")
          .single()
      : (supabase as any).from("object_custom_schemas")
          .update({ fields: normalized, updated_at: new Date().toISOString() })
          .eq("id", schemaId)
          .select("id")
          .single();
    const { data, error } = await query;
    setIsSaving(false);
    if (!error && data) setSchemaId(data.id);
    showNotification({
      color: error ? "red" : "green",
      title: error ? t("saveFailed") : t("saved"),
      message: error ? t("saveFailedMessage") : t("savedMessage"),
    });
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/settings">{t("settings")}</Anchor>
          <Text>{t("title")}</Text>
        </Breadcrumbs>
        <Group justify="space-between">
          <div>
            <Title order={2}>{t("title")}</Title>
            <Text c="dimmed" size="sm">{t("description")}</Text>
          </div>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setFields((current) => [...current, { name: "", note: "" }])}
            disabled={isLoading}
          >
            {t("add")}
          </Button>
        </Group>
        {loadError && (
          <Alert color="red" title={t("loadFailed")} icon={<IconAlertCircle size={18} />}>
            {loadError}
          </Alert>
        )}
        <Paper withBorder p="md" radius="md">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("fieldName")}</Table.Th>
                <Table.Th>{t("note")}</Table.Th>
                <Table.Th w={60}>{t("action")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {fields.map((field, index) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    <TextInput
                      aria-label={t("fieldNameLabel", { number: index + 1 })}
                      value={field.name}
                      onChange={(event) => updateField(index, "name", event.currentTarget.value)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      aria-label={t("fieldNoteLabel", { number: index + 1 })}
                      value={field.note}
                      onChange={(event) => updateField(index, "note", event.currentTarget.value)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      aria-label={t("removeLabel", { number: index + 1 })}
                      onClick={() => setFields((current) => current.filter((_, i) => i !== index))}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
              {!fields.length && (
                <Table.Tr>
                  <Table.Td colSpan={3}><Text ta="center" c="dimmed">{t("none")}</Text></Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          <Group justify="flex-end" mt="md">
            <Button onClick={handleSave} loading={isSaving} disabled={isLoading || tenantId === null}>
              {t("save")}
            </Button>
          </Group>
        </Paper>
      </Stack>
    </AppShell>
  );
}
