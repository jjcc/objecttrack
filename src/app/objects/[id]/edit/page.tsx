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
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

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

  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);

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
    async function fetchData() {
      const supabase = getSupabaseClient();

      const { data: categories } = await supabase.from("categories").select("id, name").order("name") as unknown as { data: { id: number; name: string }[] };
      setCategoryOptions((categories ?? []).map((cat) => ({ value: String(cat.id), label: cat.name })));

      const { data: objectData } = await supabase
        .from("objects")
        .select("*")
        .eq("id", Number(id))
        .single();

      if (objectData) {
        const record = objectData as Record<string, unknown>;
        form.setValues({
          name: (record.name as string) ?? "",
          description: (record.description as string) ?? "",
          category_id: record.category_id ? String(record.category_id) : "",
          model: (record.model as string) ?? "",
        });
      }

      setIsLoading(false);
    }

    fetchData();
  }, [id, form]);

  const handleSubmit = async (values: ObjectFormValues) => {
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from("objects") as any)
        .update({
          name: values.name,
          description: values.description || null,
          category_id: values.category_id ? Number(values.category_id) : null,
          model: values.model || null,
        })
        .eq("id", Number(id));

      if (error) {
        showNotification({
          color: "red",
          title: "Error",
          message: error.message ?? "Failed to update object",
        });
        return;
      }

      showNotification({
        color: "green",
        title: "Success",
        message: "Object updated successfully",
      });
      router.push("/objects");
    } catch (err) {
      showNotification({
        color: "red",
        title: "Error",
        message: (err as Error)?.message ?? "Failed to update object",
      });
    } finally {
      setIsPending(false);
    }
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
          <LoadingOverlay visible={isLoading} />
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
                <Button type="submit" loading={isPending}>
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
