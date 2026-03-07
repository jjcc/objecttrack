"use client";

import { Select, Stack, Textarea, TextInput } from "@mantine/core";
import { Create } from "@refinedev/mantine";
import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Controller } from "react-hook-form";

export default function ObjectCreate() {
  const {
    saveButtonProps,
    refineCore: { formLoading },
    register,
    control,
    formState: { errors },
  } = useForm({});

  const { options: categoryOptions } = useSelect({
    resource: "categories",
    optionLabel: "name",
    optionValue: "id",
  });

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
        <Controller
          control={control}
          name="category_id"
          rules={{ required: "This field is required" }}
          defaultValue={null}
          render={({ field }) => (
            <Select
              label="Category"
              data={categoryOptions}
              value={field.value?.toString() ?? null}
              onChange={(val) => field.onChange(val ? Number(val) : null)}
              error={(errors as any)?.category_id?.message}
              required
            />
          )}
        />
        <TextInput
          {...register("model")}
          error={(errors as any)?.model?.message}
          label="Model"
        />
      </Stack>
    </Create>
  );
}