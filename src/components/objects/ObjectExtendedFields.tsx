"use client";

import { FileInput, Stack, Text, TextInput } from "@mantine/core";
import { useTranslations } from "next-intl";

export type CustomFieldDefinition = { name: string; note?: string };

type Props = {
  fields: CustomFieldDefinition[];
  values: Record<string, string>;
  onValueChange: (name: string, value: string) => void;
  image: File | null;
  onImageChange: (file: File | null) => void;
  currentImage?: string | null;
};

export function ObjectExtendedFields({
  fields,
  values,
  onValueChange,
  image,
  onImageChange,
  currentImage,
}: Props) {
  const t = useTranslations("Objects.extendedFields");
  return (
    <Stack gap="sm">
      <FileInput
        label={t("image")}
        description={
          currentImage
            ? t("replaceImageHelp")
            : t("imageHelp")
        }
        placeholder={t("chooseImage")}
        accept="image/jpeg,image/png,image/webp,image/gif"
        value={image}
        onChange={onImageChange}
        clearable
      />
      {fields.length > 0 && (
        <Text fw={600} mt="xs">{t("customFields")}</Text>
      )}
      {fields.map((field) => (
        <TextInput
          key={field.name}
          label={field.name}
          description={field.note || undefined}
          value={values[field.name] ?? ""}
          onChange={(event) => onValueChange(field.name, event.currentTarget.value)}
        />
      ))}
    </Stack>
  );
}
