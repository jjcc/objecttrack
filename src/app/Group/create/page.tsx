"use client";

import { Stack, Textarea, TextInput } from "@mantine/core";
import { Create } from "@refinedev/mantine";
import { useForm } from "@refinedev/react-hook-form";

export default function GroupCreate() {
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
    </Create>
  );
}