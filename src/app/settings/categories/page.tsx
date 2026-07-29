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
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string(),
});

type Category = Database["public"]["Tables"]["categories"]["Row"];
type CategoryFormValues = z.infer<typeof categorySchema>;

export default function CategorySettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [opened, { open, close }] = useDisclosure(false);

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
      setLoadError(error.message);
      setCategories([]);
    } else {
      setCategories(data ?? []);
    }
    setIsLoading(false);
  }, []);

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
        title: "Unable to save category",
        message: error.message,
      });
      return;
    }

    showNotification({
      color: "green",
      title: editingId === null ? "Category created" : "Category updated",
      message: `${payload.name} was saved successfully.`,
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
        title: "Unable to delete category",
        message: error.message,
      });
      return;
    }

    showNotification({
      color: "green",
      title: "Category deleted",
      message: `${category.name} was deleted.`,
    });
    await fetchCategories();
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/settings">Settings</Anchor>
          <Text>Categories</Text>
        </Breadcrumbs>

        <Group justify="space-between">
          <div>
            <Title order={2}>Categories</Title>
            <Text c="dimmed" size="sm">
              Manage classifications for tracked objects.
            </Text>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Category
          </Button>
        </Group>

        {loadError && (
          <Alert
            color="red"
            title="Unable to load categories"
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
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th w={100}>Actions</Table.Th>
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
                          aria-label={`Edit ${category.name}`}
                          onClick={() => openEdit(category)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={`Delete ${category.name}`}
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
                        No categories
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
        title={editingId === null ? "Add Category" : "Edit Category"}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Name"
              placeholder="Category name"
              required
              {...form.getInputProps("name")}
            />
            <TextInput
              label="Description"
              placeholder="Description (optional)"
              {...form.getInputProps("description")}
            />
            <Group justify="flex-end">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={isSaving}>
                {editingId === null ? "Create" : "Save"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </AppShell>
  );
}
