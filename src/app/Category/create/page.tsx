"use client";

import { Stack, Textarea, TextInput } from "@mantine/core";
import { Create } from "@refinedev/mantine";
import { useForm } from "@refinedev/react-hook-form";

export default function CategoryCreate() {
  const {
    saveButtonProps,
    refineCore: { formLoading },
    register,
    formState: { errors },
  } = useForm({});

  return (
    <Create isLoading={formLoading} saveButtonProps={saveButtonProps}>
      <Stack component="form" autoComplete="off">
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
    </Create>
  );
}