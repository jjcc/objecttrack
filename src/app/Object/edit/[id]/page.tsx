"use client";

import { Select, Stack, Textarea, TextInput } from "@mantine/core";
import { Edit } from "@refinedev/mantine";
import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Controller } from "react-hook-form";

export default function ObjectEdit() {
  const {
    saveButtonProps,
    refineCore: { queryResult },
    register,
    control,
    formState: { errors },
  } = useForm({
    refineCoreProps: {
      meta: { select: "id, name, description, category_id, model, categories(id,name)" },
    },
  });

  const objectData = queryResult?.data?.data;

  const { options: categoryOptions } = useSelect({
    resource: "categories",
    optionLabel: "name",
    optionValue: "id",
    defaultValue: objectData?.category_id,
  });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Stack>
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
        <Controller
          control={control}
          name="category_id"
          rules={{ required: "This field is required" }}
          defaultValue={objectData?.category_id}
          render={({ field }) => (
            <Select
              label="Category"
              data={categoryOptions}
              value={field.value?.toString() ?? null}
              onChange={(val: string | null) => field.onChange(val ? Number(val) : null)}
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
    </Edit>
  );
}