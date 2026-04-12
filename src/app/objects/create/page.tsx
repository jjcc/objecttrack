"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Paper,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import { useCreate, useList } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";

const objectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category_id: z.string().optional(),
  model: z.string().optional(),
});

type ObjectFormValues = z.infer<typeof objectSchema>;

export default function ObjectCreatePage() {
  const router = useRouter();
  const { mutate: create, mutation: createMutation } = useCreate();

  const { result: categoriesResult } = useList({
    resource: "categories",
    pagination: { currentPage: 1, pageSize: 100 },
  });

  const categoryOptions = categoriesResult.data.map((cat) => ({
    value: String((cat as Record<string, unknown>).id),
    label: (cat as Record<string, string>).name,
  }));

  const form = useForm<ObjectFormValues>({
    initialValues: {
      name: "",
      description: "",
      category_id: "",
      model: "",
    },
    validate: zodResolver(objectSchema),
  });

  const handleSubmit = (values: ObjectFormValues) => {
    create(
      {
        resource: "objects",
        values: {
          name: values.name,
          description: values.description || null,
          category_id: values.category_id ? Number(values.category_id) : null,
          model: values.model || null,
        },
      },
      {
        onSuccess: () => {
          showNotification({
            color: "green",
            title: "Success",
            message: "Object created successfully",
          });
          router.push("/objects");
        },
        onError: (error) => {
          showNotification({
            color: "red",
            title: "Error",
            message: error?.message ?? "Failed to create object",
          });
        },
      }
    );
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/objects">Objects</Anchor>
          <Anchor>Create</Anchor>
        </Breadcrumbs>

        <Title order={2}>Create Object</Title>

        <Paper withBorder p="md" radius="md" maw={600}>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput
                label="Name"
                placeholder="Enter object name"
                required
                {...form.getInputProps("name")}
              />
              <Select
                label="Category"
                placeholder="Select a category"
                data={categoryOptions}
                clearable
                searchable
                {...form.getInputProps("category_id")}
              />
              <TextInput
                label="Model"
                placeholder="Enter model"
                {...form.getInputProps("model")}
              />
              <Textarea
                label="Description"
                placeholder="Enter description"
                rows={3}
                {...form.getInputProps("description")}
              />
              <Group>
                <Button type="submit" loading={createMutation.isPending}>
                  Create
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/objects")}
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
