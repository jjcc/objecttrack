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
import { useTranslations } from "next-intl";
import { z } from "zod";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  ObjectExtendedFields,
  type CustomFieldDefinition,
} from "@/components/objects/ObjectExtendedFields";
import { getSupabaseClient } from "@/lib/supabase/client";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

type ObjectFormValues = { name: string; description?: string; category_id?: string; model?: string };

export default function ObjectEditPage() {
  const t = useTranslations("Objects.form");
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});
  const [image, setImage] = useState<File | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const objectSchema = z.object({
    name: z.string().min(1, t("nameRequired")),
    description: z.string().optional(),
    category_id: z.string().optional(),
    model: z.string().optional(),
  });

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

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("tenant_id")
        .single() as any;
      if (profile?.tenant_id) {
        setTenantId(profile.tenant_id);
        const { data: schema } = await (supabase as any).from("object_custom_schemas")
          .select("fields")
          .eq("tenant_id", profile.tenant_id)
          .maybeSingle();
        setCustomFields(Array.isArray(schema?.fields) ? schema.fields : []);
      }

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
        setExtraValues((record.extra as Record<string, string> | null) ?? {});
        setCurrentImage((record.image as string | null) ?? null);
      }

      setIsLoading(false);
    }

    fetchData();
  }, [id]);

  const handleSubmit = async (values: ObjectFormValues) => {
    if (image && image.size > MAX_IMAGE_SIZE) {
      showNotification({ color: "red", title: t("imageTooLarge"), message: t("imageSizeHelp") });
      return;
    }
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const extra = Object.fromEntries(
        customFields.map((field) => [field.name, extraValues[field.name] ?? ""])
      );
      let imagePath = currentImage;
      if (image) {
        if (tenantId === null) throw new Error("tenant_missing");
        const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
        imagePath = `${tenantId}/${id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("object-images")
          .upload(imagePath, image, { contentType: image.type });
        if (uploadError) throw uploadError;
      }
      const { error } = await (supabase.from("objects") as any)
        .update({
          name: values.name,
          description: values.description || null,
          category_id: values.category_id ? Number(values.category_id) : null,
          model: values.model || null,
          extra,
          image: imagePath,
        })
        .eq("id", Number(id));

      if (error) {
        showNotification({
          color: "red",
          title: t("error"),
          message: t("updateFailed"),
        });
        return;
      }

      if (image && currentImage) {
        await supabase.storage.from("object-images").remove([currentImage]);
      }

      showNotification({
        color: "green",
        title: t("success"),
        message: t("updateSuccess"),
      });
      router.push("/objects");
    } catch (error) {
      showNotification({
        color: "red",
        title: t("error"),
        message: error instanceof Error && error.message === "tenant_missing" ? t("tenantMissing") : t("updateFailed"),
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
          <Anchor>{t("edit")}</Anchor>
        </Breadcrumbs>

        <Title order={2}>{t("editTitle")}</Title>

        <Paper withBorder p="md" radius="md" maw={600} pos="relative">
          <LoadingOverlay visible={isLoading} />
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
                currentImage={currentImage}
              />
              <Group>
                <Button type="submit" loading={isPending}>
                  {t("save")}
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
