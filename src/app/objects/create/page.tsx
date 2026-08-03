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
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import {
  ObjectExtendedFields,
  type CustomFieldDefinition,
} from "@/components/objects/ObjectExtendedFields";
import { getSupabaseClient } from "@/lib/supabase/client";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

type ObjectFormValues = { name: string; description?: string; category_id?: string; model?: string };

export default function ObjectCreatePage() {
  const t = useTranslations("Objects.form");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});
  const [image, setImage] = useState<File | null>(null);
  const objectSchema = z.object({
    name: z.string().min(1, t("nameRequired")),
    description: z.string().optional(),
    category_id: z.string().optional(),
    model: z.string().optional(),
  });

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
      showNotification({ color: "red", title: t("imageTooLarge"), message: t("imageSizeHelp") });
      return;
    }
    if (tenantId === null) {
      showNotification({ color: "red", title: t("tenantUnavailable"), message: t("tenantMissing") });
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
          title: t("error"),
          message: t("createFailed"),
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
          showNotification({ color: "red", title: t("imageUploadFailed"), message: t("imageUploadFailedMessage") });
          return;
        }
        const { error: imageUpdateError } = await (supabase.from("objects") as any)
          .update({ image: path })
          .eq("id", objectData.id);
        if (imageUpdateError) {
          await supabase.storage.from("object-images").remove([path]);
          showNotification({ color: "red", title: t("imageAttachFailed"), message: t("imageAttachFailedMessage") });
          return;
        }
      }

      showNotification({
        color: "green",
        title: t("success"),
        message: t("createSuccess"),
      });
      router.push("/objects");
    } catch {
      showNotification({
        color: "red",
        title: t("error"),
        message: t("createFailed"),
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">{t("dashboard")}</Anchor>
          <Anchor href="/objects">{t("objects")}</Anchor>
          <Anchor>{t("create")}</Anchor>
        </Breadcrumbs>

        <Title order={2}>{t("createTitle")}</Title>

        <Paper withBorder p="md" radius="md" maw={600}>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput
                label={t("name")}
                placeholder={t("namePlaceholder")}
                required
                {...form.getInputProps("name")}
              />
              <Select
                label={t("category")}
                placeholder={t("categoryPlaceholder")}
                data={categoryOptions}
                clearable
                searchable
                {...form.getInputProps("category_id")}
              />
              <TextInput
                label={t("model")}
                placeholder={t("modelPlaceholder")}
                {...form.getInputProps("model")}
              />
              <Textarea
                label={t("description")}
                placeholder={t("descriptionPlaceholder")}
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
                  {t("create")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/objects")}
                >
                  {t("cancel")}
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </AppShell>
  );
}
