"use client";

import { Select, Stack, TextInput } from "@mantine/core";
import { Create } from "@refinedev/mantine";
import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Controller } from "react-hook-form";

export default function UserCreate() {
  const {
    saveButtonProps,
    refineCore: { formLoading },
    register,
    control,
    formState: { errors },
  } = useForm({});

  const { options: groupOptions } = useSelect({
    resource: "groups",
    optionLabel: "title",
    optionValue: "id",
  });

  return (
    <Create isLoading={formLoading} saveButtonProps={saveButtonProps}>
      <Stack component="form" autoComplete="off">
        <TextInput
          {...register("last_name", { required: "This field is required" })}
          error={(errors as any)?.last_name?.message}
          label="Last Name"
        />
        <TextInput
          {...register("first_name", { required: "This field is required" })}
          error={(errors as any)?.first_name?.message}
          label="First Name"
        />
        <TextInput {...register("title")} error={(errors as any)?.title?.message} label="Title" />
        <TextInput {...register("city")} error={(errors as any)?.city?.message} label="City" />
        <TextInput {...register("province")} error={(errors as any)?.province?.message} label="Province" />
        <TextInput {...register("country")} error={(errors as any)?.country?.message} label="Country" />
        <TextInput {...register("zipcode")} error={(errors as any)?.zipcode?.message} label="Zipcode" />
        <TextInput {...register("phone")} error={(errors as any)?.phone?.message} label="Phone" />
        <TextInput {...register("wechat_id")} error={(errors as any)?.wechat_id?.message} label="Wechat ID" />
        <Controller
          control={control}
          name="group_id"
          defaultValue={null}
          render={({ field }) => (
            <Select
              label="Group"
              data={groupOptions}
              value={field.value?.toString() ?? null}
              onChange={(val: string | null) => field.onChange(val ? Number(val) : null)}
              error={(errors as any)?.group_id?.message}
            />
          )}
        />
        <TextInput
          {...register("email")}
          error={(errors as any)?.email?.message}
          type="email"
          label="Email"
        />
      </Stack>
    </Create>
  );
}