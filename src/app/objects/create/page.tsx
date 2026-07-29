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
import {
  ObjectExtendedFields,
  type CustomFieldDefinition,
} from "@/components/objects/ObjectExtendedFields";
import { getSupabaseClient } from "@/lib/supabase/client";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

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
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});
  const [image, setImage] = useState<File | null>(null);

  useEffect(() => {
    async function fetchCategories() {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("categories").select("id, name").order("name") as unknown as { data: { id: number; name: string }[] };
      setCategoryOptions((data ?? []).map((cat) => ({ value: String(cat.id), label: cat.name })));
    }
    fetchCategories();
    async function fetchTenantSchema() {
      const supabase = getSupabaseClient();
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("tenant_id")
        .single() as any;
      if (!profile?.tenant_id) return;
      setTenantId(profile.tenant_id);
      const { data } = await (supabase as any).from("object_custom_schemas")
        .select("fields")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();
      setCustomFields(Array.isArray(data?.fields) ? data.fields : []);
    }
    fetchTenantSchema();
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
    if (image && image.size > MAX_IMAGE_SIZE) {
      showNotification({ color: "red", title: "Image too large", message: "Choose an image no larger than 2 MB." });
      return;
    }
    if (tenantId === null) {
      showNotification({ color: "red", title: "Tenant unavailable", message: "Your profile is not assigned to a tenant." });
      return;
    }
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const extra = Object.fromEntries(
        customFields.map((field) => [field.name, extraValues[field.name] ?? ""])
      );
      const { data: objectData, error } = await (supabase.from("objects") as any).insert({
        name: values.name,
        description: values.description || null,
        category_id: values.category_id ? Number(values.category_id) : null,
        model: values.model || null,
        tenant_id: tenantId,
        extra,
      }).select("id").single();

      if (error) {
        showNotification({
          color: "red",
          title: "Error",
          message: error.message ?? "Failed to create object",
        });
        return;
      }

      if (image) {
        const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${tenantId}/${objectData.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("object-images")
          .upload(path, image, { contentType: image.type });
        if (uploadError) {
          await (supabase.from("objects") as any).delete().eq("id", objectData.id);
          showNotification({ color: "red", title: "Image upload failed", message: uploadError.message });
          return;
        }
        const { error: imageUpdateError } = await (supabase.from("objects") as any)
          .update({ image: path })
          .eq("id", objectData.id);
        if (imageUpdateError) {
          await supabase.storage.from("object-images").remove([path]);
          showNotification({ color: "red", title: "Unable to attach image", message: imageUpdateError.message });
          return;
        }
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
              <ObjectExtendedFields
                fields={customFields}
                values={extraValues}
                onValueChange={(name, value) =>
                  setExtraValues((current) => ({ ...current, [name]: value }))
                }
                image={image}
                onImageChange={setImage}
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
