"use client";

import {
  Title,
  Stack,
  Breadcrumbs,
  Anchor,
  Paper,
  TextInput,
  Select,
  Button,
  Group,
  SimpleGrid,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import { useCreate, useList } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";

const userSchema = z.object({
  id: z.string().uuid("Must be a valid UUID (matching auth.users id)"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  title: z.string().optional(),
  group_id: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  zipcode: z.string().optional(),
  wechat_id: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function UserCreatePage() {
  const router = useRouter();
  const { mutate: create, mutation: createMutation } = useCreate();

  const { result: groupsResult } = useList({
    resource: "groups",
    pagination: { currentPage: 1, pageSize: 100 },
  });

  const groupOptions = groupsResult.data.map((g) => ({
    value: String((g as Record<string, unknown>).id),
    label: (g as Record<string, string>).title,
  }));

  const form = useForm<UserFormValues>({
    initialValues: {
      id: "",
      first_name: "",
      last_name: "",
      email: "",
      title: "",
      group_id: "",
      phone: "",
      city: "",
      province: "",
      country: "",
      zipcode: "",
      wechat_id: "",
    },
    validate: zodResolver(userSchema),
  });

  const handleSubmit = (values: UserFormValues) => {
    create(
      {
        resource: "user_profiles",
        values: {
          id: values.id,
          first_name: values.first_name || null,
          last_name: values.last_name || null,
          email: values.email || null,
          title: values.title || null,
          group_id: values.group_id ? Number(values.group_id) : null,
          phone: values.phone || null,
          city: values.city || null,
          province: values.province || null,
          country: values.country || null,
          zipcode: values.zipcode || null,
          wechat_id: values.wechat_id || null,
        },
      },
      {
        onSuccess: () => {
          showNotification({
            color: "green",
            title: "Success",
            message: "User profile created successfully",
          });
          router.push("/users");
        },
        onError: (error) => {
          showNotification({
            color: "red",
            title: "Error",
            message: error?.message ?? "Failed to create user profile",
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
          <Anchor href="/users">Users</Anchor>
          <Anchor>Create</Anchor>
        </Breadcrumbs>

        <Title order={2}>Create User Profile</Title>

        <Paper withBorder p="md" radius="md" maw={800}>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput
                label="Auth User ID (UUID)"
                placeholder="UUID from Supabase auth.users"
                required
                {...form.getInputProps("id")}
              />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label="First Name"
                  placeholder="First name"
                  {...form.getInputProps("first_name")}
                />
                <TextInput
                  label="Last Name"
                  placeholder="Last name"
                  {...form.getInputProps("last_name")}
                />
                <TextInput
                  label="Email"
                  placeholder="Email address"
                  {...form.getInputProps("email")}
                />
                <TextInput
                  label="Title"
                  placeholder="Job title"
                  {...form.getInputProps("title")}
                />
                <Select
                  label="Group"
                  placeholder="Select group"
                  data={groupOptions}
                  clearable
                  searchable
                  {...form.getInputProps("group_id")}
                />
                <TextInput
                  label="Phone"
                  placeholder="Phone number"
                  {...form.getInputProps("phone")}
                />
                <TextInput
                  label="City"
                  placeholder="City"
                  {...form.getInputProps("city")}
                />
                <TextInput
                  label="Province"
                  placeholder="Province / State"
                  {...form.getInputProps("province")}
                />
                <TextInput
                  label="Country"
                  placeholder="Country"
                  {...form.getInputProps("country")}
                />
                <TextInput
                  label="Zipcode"
                  placeholder="Zip / postal code"
                  {...form.getInputProps("zipcode")}
                />
                <TextInput
                  label="WeChat ID"
                  placeholder="WeChat ID"
                  {...form.getInputProps("wechat_id")}
                />
              </SimpleGrid>
              <Group>
                <Button type="submit" loading={createMutation.isPending}>
                  Create
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/users")}
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
