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
import { useOne, useUpdate } from "@refinedev/core";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";

const groupSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

type GroupFormValues = z.infer<typeof groupSchema>;

export default function GroupEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { query: groupQuery, result: groupResult } = useOne({
    resource: "groups",
    id,
  });

  const { mutate: update, mutation: updateMutation } = useUpdate();

  const form = useForm<GroupFormValues>({
    initialValues: {
      title: "",
      description: "",
    },
    validate: zodResolver(groupSchema),
  });

  useEffect(() => {
    if (groupResult) {
      form.setValues({
        title: (groupResult as Record<string, string>).title ?? "",
        description: (groupResult as Record<string, string>).description ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupResult]);

  const handleSubmit = (values: GroupFormValues) => {
    update(
      {
        resource: "groups",
        id,
        values,
      },
      {
        onSuccess: () => {
          showNotification({
            color: "green",
            title: "Success",
            message: "Group updated successfully",
          });
          router.push("/groups");
        },
        onError: (error) => {
          showNotification({
            color: "red",
            title: "Error",
            message: error?.message ?? "Failed to update group",
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
          <Anchor href="/groups">Groups</Anchor>
          <Anchor>Edit</Anchor>
        </Breadcrumbs>

        <Title order={2}>Edit Group</Title>

        <Paper withBorder p="md" radius="md" maw={600} pos="relative">
          <LoadingOverlay visible={groupQuery.isLoading} />
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
                <Button type="submit" loading={updateMutation.isPending}>
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
