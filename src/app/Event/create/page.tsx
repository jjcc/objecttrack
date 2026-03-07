"use client";

import { Select, Stack, Textarea } from "@mantine/core";
import { Create } from "@refinedev/mantine";
import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Controller } from "react-hook-form";

export default function EventCreate() {
  const {
    saveButtonProps,
    refineCore: { formLoading },
    register,
    control,
    formState: { errors },
  } = useForm({});

  const { options: objectOptions } = useSelect({
    resource: "objects",
    optionLabel: "name",
    optionValue: "id",
  });

  const { options: eventTypeOptions } = useSelect({
    resource: "event_types",
    optionLabel: "label",
    optionValue: "id",
  });

  const { options: userOptions } = useSelect({
    resource: "user_profiles",
    optionLabel: (item: any) => `${item.first_name} ${item.last_name}`,
    optionValue: (item: any) => item.id,
  });

  return (
    <Create isLoading={formLoading} saveButtonProps={saveButtonProps}>
      <Stack>
        <Controller
          control={control}
          name="object_id"
          rules={{ required: "This field is required" }}
          defaultValue={null}
          render={({ field }) => (
            <Select
              label="Object"
              data={objectOptions}
              value={field.value?.toString() ?? null}
              onChange={(val: string | null) => field.onChange(val ? Number(val) : null)}
              error={(errors as any)?.object_id?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="e_type"
          rules={{ required: "This field is required" }}
          defaultValue={null}
          render={({ field }) => (
            <Select
              label="Event Type"
              data={eventTypeOptions}
              value={field.value?.toString() ?? null}
              onChange={(val: string | null) => field.onChange(val ? Number(val) : null)}
              error={(errors as any)?.e_type?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="e_from"
          rules={{ required: "This field is required" }}
          defaultValue={null}
          render={({ field }) => (
            <Select
              label="From"
              data={userOptions}
              value={field.value?.toString() ?? null}
              onChange={(val: string | null) => field.onChange(val ?? null)}
              error={(errors as any)?.e_from?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="e_to"
          rules={{ required: "This field is required" }}
          defaultValue={null}
          render={({ field }) => (
            <Select
              label="To"
              data={userOptions}
              value={field.value?.toString() ?? null}
              onChange={(val: string | null) => field.onChange(val ?? null)}
              error={(errors as any)?.e_to?.message}
              required
            />
          )}
        />
        <Textarea
          {...register("extra")}
          error={(errors as any)?.extra?.message}
          label="Extra"
        />
      </Stack>
    </Create>
  );
}