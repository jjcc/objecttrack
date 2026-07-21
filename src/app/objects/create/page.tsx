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
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

const objectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category_id: z.string().optional(),
  model: z.string().optional(),
});

type ObjectFormValues = z.infer<typeof objectSchema>;

export default function ObjectCreatePage() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    async function fetchCategories() {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("categories").select("id, name").order("name") as unknown as { data: { id: number; name: string }[] };
      setCategoryOptions((data ?? []).map((cat) => ({ value: String(cat.id), label: cat.name })));
    }
    fetchCategories();
  }, []);

  const form = useForm<ObjectFormValues>({
    initialValues: {
      name: "",
      description: "",
      category_id: "",
      model: "",
    },
    validate: zodResolver(objectSchema),
  });

  const handleSubmit = async (values: ObjectFormValues) => {
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from("objects") as any).insert({
        name: values.name,
        description: values.description || null,
        category_id: values.category_id ? Number(values.category_id) : null,
        model: values.model || null,
      });

      if (error) {
        showNotification({
          color: "red",
          title: "Error",
          message: error.message ?? "Failed to create object",
        });
        return;
      }

      showNotification({
        color: "green",
        title: "Success",
        message: "Object created successfully",
      });
      router.push("/objects");
    } catch (err) {
      showNotification({
        color: "red",
        title: "Error",
        message: (err as Error)?.message ?? "Failed to create object",
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
                <Button type="submit" loading={isPending}>
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
