"use client";

import {
  ActionIcon,
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { showNotification } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Category = Database["public"]["Tables"]["categories"]["Row"];
type CategoryFormValues = { name: string; description: string };

export default function CategorySettingsPage() {
  const t = useTranslations("Settings.categories");
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const categorySchema = z.object({ name: z.string().trim().min(1, t("nameRequired")), description: z.string() });

  const form = useForm<CategoryFormValues>({
    initialValues: { name: "", description: "" },
    validate: zodResolver(categorySchema),
  });

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");

    if (error) {
      setLoadError(t("loadFailed"));
      setCategories([]);
    } else {
      setCategories(data ?? []);
    }
    setIsLoading(false);
  }, [t]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openCreate = () => {
    setEditingId(null);
    form.reset();
    open();
  };

  const openEdit = (category: Category) => {
    setEditingId(category.id);
    form.setValues({
      name: category.name,
      description: category.description ?? "",
    });
    form.resetDirty();
    open();
  };

  const handleSubmit = async (values: CategoryFormValues) => {
    setIsSaving(true);
    const supabase = getSupabaseClient();
    const payload = {
      name: values.name.trim(),
      description: values.description.trim() || null,
    };

    const { error } =
      editingId === null
        ? await (supabase.from("categories") as any).insert(payload)
        : await supabase.from("categories").update(payload).eq("id", editingId);

    setIsSaving(false);

    if (error) {
      showNotification({
        color: "red",
        title: t("saveFailed"),
        message: t("saveFailedMessage"),
      });
      return;
    }

    showNotification({
      color: "green",
      title: editingId === null ? t("created") : t("updated"),
      message: t("saved", { name: payload.name }),
    });
    close();
    await fetchCategories();
  };

  const handleDelete = async (category: Category) => {
    setDeletingId(category.id);
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id);
    setDeletingId(null);

    if (error) {
      showNotification({
        color: "red",
        title: t("deleteFailed"),
        message: t("deleteFailedMessage"),
      });
      return;
    }

    showNotification({
      color: "green",
      title: t("deleted"),
      message: t("deletedMessage", { name: category.name }),
    });
    await fetchCategories();
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
            <Text c="dimmed" size="sm">
              {t("description")}
            </Text>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            {t("add")}
          </Button>
        </Group>

        {loadError && (
          <Alert
            color="red"
            title={t("loadFailed")}
            icon={<IconAlertCircle size={18} />}
          >
            {loadError}
          </Alert>
        )}

        <Paper withBorder p="md" radius="md">
          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
            </Group>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ID</Table.Th>
                  <Table.Th>{t("name")}</Table.Th>
                  <Table.Th>{t("fieldDescription")}</Table.Th>
                  <Table.Th w={100}>{t("actions")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {categories.map((category) => (
                  <Table.Tr key={category.id}>
                    <Table.Td>{category.id}</Table.Td>
                    <Table.Td>{category.name}</Table.Td>
                    <Table.Td>{category.description ?? "—"}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <ActionIcon
                          variant="subtle"
                          aria-label={t("editLabel", { name: category.name })}
                          onClick={() => openEdit(category)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={t("deleteLabel", { name: category.name })}
                          loading={deletingId === category.id}
                          disabled={deletingId !== null}
                          onClick={() => handleDelete(category)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {categories.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text ta="center" c="dimmed">
                        {t("none")}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>

      <Modal
        opened={opened}
        onClose={close}
        title={editingId === null ? t("add") : t("edit")}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label={t("name")}
              placeholder={t("namePlaceholder")}
              required
              {...form.getInputProps("name")}
            />
            <TextInput
              label={t("fieldDescription")}
              placeholder={t("descriptionPlaceholder")}
              {...form.getInputProps("description")}
            />
            <Group justify="flex-end">
              <Button type="button" variant="outline" onClick={close}>
                {t("cancel")}
              </Button>
              <Button type="submit" loading={isSaving}>
                {editingId === null ? t("create") : t("save")}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </AppShell>
  );
}
