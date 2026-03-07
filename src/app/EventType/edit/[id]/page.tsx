"use client";

import { Stack, TextInput } from "@mantine/core";
import { Edit } from "@refinedev/mantine";
import { useForm } from "@refinedev/react-hook-form";

export default function EventTypeEdit() {
  const {
    saveButtonProps,
    register,
    formState: { errors },
  } = useForm({
    refineCoreProps: { meta: { select: "id, label, label_cn" } },
  });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Stack>
        <TextInput {...register("id")} disabled label="ID" type="number" />
        <TextInput
          {...register("label", { required: "This field is required" })}
          error={(errors as any)?.label?.message}
          label="Label"
        />
        <TextInput
          {...register("label_cn", { required: "This field is required" })}
          error={(errors as any)?.label_cn?.message}
          label="Label (CN)"
        />
      </Stack>
    </Edit>
  );
}