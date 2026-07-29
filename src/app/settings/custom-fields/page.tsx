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
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

export type CustomFieldDefinition = { name: string; note: string };

export default function CustomFieldsSettingsPage() {
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
        setLoadError(profileError?.message ?? "Your profile is not assigned to a tenant.");
        setIsLoading(false);
        return;
      }
      setTenantId(profile.tenant_id);
      const { data, error } = await (supabase as any).from("object_custom_schemas")
        .select("id, fields")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();
      if (error) setLoadError(error.message);
      if (data) {
        setSchemaId(data.id);
        setFields(Array.isArray(data.fields) ? data.fields : []);
      }
      setIsLoading(false);
    }
    fetchSchema();
  }, []);

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
      showNotification({ color: "red", title: "Missing field name", message: "Every custom field needs a name." });
      return;
    }
    const names = normalized.map((field) => field.name.toLocaleLowerCase());
    if (new Set(names).size !== names.length) {
      showNotification({ color: "red", title: "Duplicate field name", message: "Custom field names must be unique." });
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
      title: error ? "Unable to save custom fields" : "Custom fields saved",
      message: error?.message ?? "New object forms will use this schema.",
    });
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/settings">Settings</Anchor>
          <Text>Custom Object Fields</Text>
        </Breadcrumbs>
        <Group justify="space-between">
          <div>
            <Title order={2}>Custom Object Fields</Title>
            <Text c="dimmed" size="sm">Define one tenant-wide schema appended to object forms.</Text>
          </div>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setFields((current) => [...current, { name: "", note: "" }])}
            disabled={isLoading}
          >
            Add Field
          </Button>
        </Group>
        {loadError && (
          <Alert color="red" title="Unable to load custom fields" icon={<IconAlertCircle size={18} />}>
            {loadError}
          </Alert>
        )}
        <Paper withBorder p="md" radius="md">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Field name</Table.Th>
                <Table.Th>Note or comment</Table.Th>
                <Table.Th w={60}>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {fields.map((field, index) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    <TextInput
                      aria-label={`Custom field ${index + 1} name`}
                      value={field.name}
                      onChange={(event) => updateField(index, "name", event.currentTarget.value)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      aria-label={`Custom field ${index + 1} note`}
                      value={field.note}
                      onChange={(event) => updateField(index, "note", event.currentTarget.value)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      aria-label={`Remove custom field ${index + 1}`}
                      onClick={() => setFields((current) => current.filter((_, i) => i !== index))}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
              {!fields.length && (
                <Table.Tr>
                  <Table.Td colSpan={3}><Text ta="center" c="dimmed">No custom fields</Text></Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          <Group justify="flex-end" mt="md">
            <Button onClick={handleSave} loading={isSaving} disabled={isLoading || tenantId === null}>
              Save Schema
            </Button>
          </Group>
        </Paper>
      </Stack>
    </AppShell>
  );
}
