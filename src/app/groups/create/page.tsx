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
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

const groupSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

type GroupFormValues = z.infer<typeof groupSchema>;

export default function GroupCreatePage() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const form = useForm<GroupFormValues>({
    initialValues: {
      title: "",
      description: "",
    },
    validate: zodResolver(groupSchema),
  });

  const handleSubmit = async (values: GroupFormValues) => {
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from("groups") as any).insert({
        title: values.title,
        description: values.description || null,
      });

      if (error) {
        showNotification({
          color: "red",
          title: "Error",
          message: error.message ?? "Failed to create group",
        });
        return;
      }

      showNotification({
        color: "green",
        title: "Success",
        message: "Group created successfully",
      });
      router.push("/groups");
    } catch (err) {
      showNotification({
        color: "red",
        title: "Error",
        message: (err as Error)?.message ?? "Failed to create group",
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
          <Anchor>Create</Anchor>
        </Breadcrumbs>

        <Title order={2}>Create Group</Title>

        <Paper withBorder p="md" radius="md" maw={600}>
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
                  Create
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
