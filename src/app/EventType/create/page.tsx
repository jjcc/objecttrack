"use client";

import { Stack, TextInput } from "@mantine/core";
import { Create } from "@refinedev/mantine";
import { useForm } from "@refinedev/react-hook-form";

export default function EventTypeCreate() {
  const {
    saveButtonProps,
    refineCore: { formLoading },
    register,
    formState: { errors },
  } = useForm({});

  return (
    <Create isLoading={formLoading} saveButtonProps={saveButtonProps}>
      <Stack>
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
    </Create>
  );
}