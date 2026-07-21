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
  LoadingOverlay,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseClient } from "@/lib/supabase/client";

const userSchema = z.object({
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

export default function UserEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [groupOptions, setGroupOptions] = useState<{ value: string; label: string }[]>([]);

  const form = useForm<UserFormValues>({
    initialValues: {
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

  useEffect(() => {
    async function fetchData() {
      const supabase = getSupabaseClient();

      const { data: groups } = await supabase.from("groups").select("id, title").order("title") as unknown as { data: { id: number; title: string }[] };
      setGroupOptions((groups ?? []).map((g) => ({ value: String(g.id), label: g.title })));

      const { data: userData } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (userData) {
        const record = userData as Record<string, unknown>;
        form.setValues({
          first_name: (record.first_name as string) ?? "",
          last_name: (record.last_name as string) ?? "",
          email: (record.email as string) ?? "",
          title: (record.title as string) ?? "",
          group_id: record.group_id ? String(record.group_id) : "",
          phone: (record.phone as string) ?? "",
          city: (record.city as string) ?? "",
          province: (record.province as string) ?? "",
          country: (record.country as string) ?? "",
          zipcode: (record.zipcode as string) ?? "",
          wechat_id: (record.wechat_id as string) ?? "",
        });
      }

      setIsLoading(false);
    }

    fetchData();
  }, [id, form]);

  const handleSubmit = async (values: UserFormValues) => {
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from("user_profiles") as any)
        .update({
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
        })
        .eq("id", id);

      if (error) {
        showNotification({
          color: "red",
          title: "Error",
          message: error.message ?? "Failed to update user profile",
        });
        return;
      }

      showNotification({
        color: "green",
        title: "Success",
        message: "User profile updated successfully",
      });
      router.push("/users");
    } catch (err) {
      showNotification({
        color: "red",
        title: "Error",
        message: (err as Error)?.message ?? "Failed to update user profile",
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
          <Anchor href="/users">Users</Anchor>
          <Anchor>Edit</Anchor>
        </Breadcrumbs>

        <Title order={2}>Edit User Profile</Title>

        <Paper withBorder p="md" radius="md" maw={800} pos="relative">
          <LoadingOverlay visible={isLoading} />
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
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
                <Button type="submit" loading={isPending}>
                  Save
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
