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
  LoadingOverlay,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import { useOne, useUpdate, useList } from "@refinedev/core";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";

const objectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category_id: z.string().optional(),
  model: z.string().optional(),
});

type ObjectFormValues = z.infer<typeof objectSchema>;

export default function ObjectEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { query: objectQuery, result: objectResult } = useOne({
    resource: "objects",
    id,
  });

  const { mutate: update, mutation: updateMutation } = useUpdate();

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

  useEffect(() => {
    if (objectResult) {
      const record = objectResult as Record<string, unknown>;
      form.setValues({
        name: (record.name as string) ?? "",
        description: (record.description as string) ?? "",
        category_id: record.category_id ? String(record.category_id) : "",
        model: (record.model as string) ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectResult]);

  const handleSubmit = (values: ObjectFormValues) => {
    update(
      {
        resource: "objects",
        id,
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
            message: "Object updated successfully",
          });
          router.push("/objects");
        },
        onError: (error) => {
          showNotification({
            color: "red",
            title: "Error",
            message: error?.message ?? "Failed to update object",
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
          <Anchor>Edit</Anchor>
        </Breadcrumbs>

        <Title order={2}>Edit Object</Title>

        <Paper withBorder p="md" radius="md" maw={600} pos="relative">
          <LoadingOverlay visible={objectQuery.isLoading} />
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
                <Button type="submit" loading={updateMutation.isPending}>
                  Save
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
