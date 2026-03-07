"use client";

import { Stack, Textarea, TextInput } from "@mantine/core";
import { Edit } from "@refinedev/mantine";
import { useForm } from "@refinedev/react-hook-form";

export default function CategoryEdit() {
  const {
    saveButtonProps,
    register,
    formState: { errors },
  } = useForm({
    refineCoreProps: { meta: { select: "id, name, description" } },
  });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Stack component="form" autoComplete="off">
        <TextInput {...register("id")} disabled label="ID" type="number" />
        <TextInput
          {...register("name", { required: "This field is required" })}
          error={(errors as any)?.name?.message}
          label="Name"
        />
        <Textarea
          {...register("description")}
          error={(errors as any)?.description?.message}
          label="Description"
        />
      </Stack>
    </Edit>
  );
}