"use client";

import { FileInput, Stack, Text, TextInput } from "@mantine/core";

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
  return (
    <Stack gap="sm">
      <FileInput
        label="Image"
        description={
          currentImage
            ? "Choose a new image to replace the current one. Maximum 2 MB."
            : "JPEG, PNG, WebP, or GIF. Maximum 2 MB."
        }
        placeholder="Choose image"
        accept="image/jpeg,image/png,image/webp,image/gif"
        value={image}
        onChange={onImageChange}
        clearable
      />
      {fields.length > 0 && (
        <Text fw={600} mt="xs">Custom fields</Text>
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
