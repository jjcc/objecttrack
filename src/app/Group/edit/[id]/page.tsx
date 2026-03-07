"use client";

import { Stack, Textarea, TextInput } from "@mantine/core";
import { Edit } from "@refinedev/mantine";
import { useForm } from "@refinedev/react-hook-form";

export default function GroupEdit() {
  const {
    saveButtonProps,
    register,
    formState: { errors },
  } = useForm({
    refineCoreProps: { meta: { select: "id, group_title, description" } },
  });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Stack component="form" autoComplete="off">
        <TextInput {...register("id")} disabled label="ID" type="number" />
        <TextInput
          {...register("group_title", { required: "This field is required" })}
          error={(errors as any)?.group_title?.message}
          label="Group Title"
        />
        <Textarea
          {...register("description", { required: "This field is required" })}
          error={(errors as any)?.description?.message}
          label="Description"
        />
      </Stack>
    </Edit>
  );
}