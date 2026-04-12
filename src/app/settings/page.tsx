"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Paper,
  TextInput,
  Button,
  Group,
  Table,
  ActionIcon,
  Modal,
  Text,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { showNotification } from "@mantine/notifications";
import { useList, useCreate, useUpdate, useDelete } from "@refinedev/core";
import { IconEdit, IconTrash, IconPlus } from "@tabler/icons-react";
import { z } from "zod";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

const eventTypeSchema = z.object({
  label: z.string().min(1, "Label is required"),
});

type CategoryFormValues = z.infer<typeof categorySchema>;
type EventTypeFormValues = z.infer<typeof eventTypeSchema>;

export default function SettingsPage() {
  // Categories
  const { query: categoriesQuery, result: categoriesResult } = useList({
    resource: "categories",
    pagination: { currentPage: 1, pageSize: 100 },
    sorters: [{ field: "name", order: "asc" }],
  });
  const refetchCategories = categoriesQuery.refetch;

  const { mutate: createCategory } = useCreate();
  const { mutate: updateCategory } = useUpdate();
  const { mutate: deleteCategory } = useDelete();

  const [catModalOpened, { open: openCatModal, close: closeCatModal }] =
    useDisclosure(false);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);

  const categoryForm = useForm<CategoryFormValues>({
    initialValues: { name: "", description: "" },
    validate: zodResolver(categorySchema),
  });

  const openCategoryCreate = () => {
    setEditingCatId(null);
    categoryForm.reset();
    openCatModal();
  };

  const openCategoryEdit = (cat: Record<string, unknown>) => {
    setEditingCatId(cat.id as number);
    categoryForm.setValues({
      name: (cat.name as string) ?? "",
      description: (cat.description as string) ?? "",
    });
    openCatModal();
  };

  const handleCategorySubmit = (values: CategoryFormValues) => {
    if (editingCatId) {
      updateCategory(
        { resource: "categories", id: editingCatId, values },
        {
          onSuccess: () => {
            showNotification({ color: "green", title: "Success", message: "Category updated" });
            closeCatModal();
            refetchCategories();
          },
          onError: (err) => {
            showNotification({ color: "red", title: "Error", message: err?.message ?? "Failed to update category" });
          },
        }
      );
    } else {
      createCategory(
        { resource: "categories", values },
        {
          onSuccess: () => {
            showNotification({ color: "green", title: "Success", message: "Category created" });
            closeCatModal();
            refetchCategories();
          },
          onError: (err) => {
            showNotification({ color: "red", title: "Error", message: err?.message ?? "Failed to create category" });
          },
        }
      );
    }
  };

  const handleDeleteCategory = (id: number) => {
    deleteCategory(
      { resource: "categories", id },
      {
        onSuccess: () => {
          showNotification({ color: "green", title: "Success", message: "Category deleted" });
          refetchCategories();
        },
        onError: (err) => {
          showNotification({ color: "red", title: "Error", message: err?.message ?? "Failed to delete category" });
        },
      }
    );
  };

  // Event Types
  const { query: eventTypesQuery, result: eventTypesResult } = useList({
    resource: "event_types",
    pagination: { currentPage: 1, pageSize: 100 },
    sorters: [{ field: "label", order: "asc" }],
  });
  const refetchEventTypes = eventTypesQuery.refetch;

  const { mutate: createEventType } = useCreate();
  const { mutate: updateEventType } = useUpdate();
  const { mutate: deleteEventType } = useDelete();

  const [etModalOpened, { open: openEtModal, close: closeEtModal }] =
    useDisclosure(false);
  const [editingEtId, setEditingEtId] = useState<number | null>(null);

  const eventTypeForm = useForm<EventTypeFormValues>({
    initialValues: { label: "" },
    validate: zodResolver(eventTypeSchema),
  });

  const openEventTypeCreate = () => {
    setEditingEtId(null);
    eventTypeForm.reset();
    openEtModal();
  };

  const openEventTypeEdit = (et: Record<string, unknown>) => {
    setEditingEtId(et.id as number);
    eventTypeForm.setValues({ label: (et.label as string) ?? "" });
    openEtModal();
  };

  const handleEventTypeSubmit = (values: EventTypeFormValues) => {
    if (editingEtId) {
      updateEventType(
        { resource: "event_types", id: editingEtId, values },
        {
          onSuccess: () => {
            showNotification({ color: "green", title: "Success", message: "Event type updated" });
            closeEtModal();
            refetchEventTypes();
          },
          onError: (err) => {
            showNotification({ color: "red", title: "Error", message: err?.message ?? "Failed to update event type" });
          },
        }
      );
    } else {
      createEventType(
        { resource: "event_types", values },
        {
          onSuccess: () => {
            showNotification({ color: "green", title: "Success", message: "Event type created" });
            closeEtModal();
            refetchEventTypes();
          },
          onError: (err) => {
            showNotification({ color: "red", title: "Error", message: err?.message ?? "Failed to create event type" });
          },
        }
      );
    }
  };

  const handleDeleteEventType = (id: number) => {
    deleteEventType(
      { resource: "event_types", id },
      {
        onSuccess: () => {
          showNotification({ color: "green", title: "Success", message: "Event type deleted" });
          refetchEventTypes();
        },
        onError: (err) => {
          showNotification({ color: "red", title: "Error", message: err?.message ?? "Failed to delete event type" });
        },
      }
    );
  };

  const categories = categoriesResult.data;
  const eventTypes = eventTypesResult.data;

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/settings">Settings</Anchor>
        </Breadcrumbs>

        <Title order={2}>Settings</Title>

        {/* Categories Section */}
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="md">
            <Title order={4}>Categories</Title>
            <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              onClick={openCategoryCreate}
            >
              Add Category
            </Button>
          </Group>

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
              {categories.map((cat: Record<string, unknown>) => (
                <Table.Tr key={cat.id as number}>
                  <Table.Td>{cat.id as number}</Table.Td>
                  <Table.Td>{cat.name as string}</Table.Td>
                  <Table.Td>{(cat.description as string) ?? "—"}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon
                        variant="subtle"
                        onClick={() => openCategoryEdit(cat)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDeleteCategory(cat.id as number)}
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
                    <Text ta="center" c="dimmed">No categories</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Event Types Section */}
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="md">
            <Title order={4}>Event Types</Title>
            <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              onClick={openEventTypeCreate}
            >
              Add Event Type
            </Button>
          </Group>

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>Label</Table.Th>
                <Table.Th w={100}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {eventTypes.map((et: Record<string, unknown>) => (
                <Table.Tr key={et.id as number}>
                  <Table.Td>{et.id as number}</Table.Td>
                  <Table.Td>{et.label as string}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon
                        variant="subtle"
                        onClick={() => openEventTypeEdit(et)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDeleteEventType(et.id as number)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {eventTypes.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={3}>
                    <Text ta="center" c="dimmed">No event types</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      </Stack>

      {/* Category Modal */}
      <Modal
        opened={catModalOpened}
        onClose={closeCatModal}
        title={editingCatId ? "Edit Category" : "Add Category"}
      >
        <form onSubmit={categoryForm.onSubmit(handleCategorySubmit)}>
          <Stack>
            <TextInput
              label="Name"
              placeholder="Category name"
              required
              {...categoryForm.getInputProps("name")}
            />
            <TextInput
              label="Description"
              placeholder="Description (optional)"
              {...categoryForm.getInputProps("description")}
            />
            <Group justify="flex-end">
              <Button variant="outline" onClick={closeCatModal}>
                Cancel
              </Button>
              <Button type="submit">
                {editingCatId ? "Save" : "Create"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Event Type Modal */}
      <Modal
        opened={etModalOpened}
        onClose={closeEtModal}
        title={editingEtId ? "Edit Event Type" : "Add Event Type"}
      >
        <form onSubmit={eventTypeForm.onSubmit(handleEventTypeSubmit)}>
          <Stack>
            <TextInput
              label="Label"
              placeholder="Event type label"
              required
              {...eventTypeForm.getInputProps("label")}
            />
            <Group justify="flex-end">
              <Button variant="outline" onClick={closeEtModal}>
                Cancel
              </Button>
              <Button type="submit">
                {editingEtId ? "Save" : "Create"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </AppShell>
  );
}
