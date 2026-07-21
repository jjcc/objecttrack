"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Paper,
  TextInput,
  Textarea,
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

const groupSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

type GroupFormValues = z.infer<typeof groupSchema>;

export default function GroupEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);

  const form = useForm<GroupFormValues>({
    initialValues: {
      title: "",
      description: "",
    },
    validate: zodResolver(groupSchema),
  });

  useEffect(() => {
    async function fetchGroup() {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("groups")
        .select("*")
        .eq("id", Number(id))
        .single();

      if (data) {
        const record = data as Record<string, string>;
        form.setValues({
          title: record.title ?? "",
          description: record.description ?? "",
        });
      }

      setIsLoading(false);
    }

    fetchGroup();
  }, [id, form]);

  const handleSubmit = async (values: GroupFormValues) => {
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from("groups") as any)
        .update({
          title: values.title,
          description: values.description || null,
        })
        .eq("id", Number(id));

      if (error) {
        showNotification({
          color: "red",
          title: "Error",
          message: error.message ?? "Failed to update group",
        });
        return;
      }

      showNotification({
        color: "green",
        title: "Success",
        message: "Group updated successfully",
      });
      router.push("/groups");
    } catch (err) {
      showNotification({
        color: "red",
        title: "Error",
        message: (err as Error)?.message ?? "Failed to update group",
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
          <Anchor href="/groups">Groups</Anchor>
          <Anchor>Edit</Anchor>
        </Breadcrumbs>

        <Title order={2}>Edit Group</Title>

        <Paper withBorder p="md" radius="md" maw={600} pos="relative">
          <LoadingOverlay visible={isLoading} />
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput
                label="Title"
                placeholder="Enter group title"
                required
                {...form.getInputProps("title")}
              />
              <Textarea
                label="Description"
                placeholder="Enter group description"
                rows={3}
                {...form.getInputProps("description")}
              />
              <Group>
                <Button type="submit" loading={isPending}>
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/groups")}
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
