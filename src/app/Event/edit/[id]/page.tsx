"use client";

import { Select, Stack, Textarea, TextInput } from "@mantine/core";
import { Edit } from "@refinedev/mantine";
import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Controller } from "react-hook-form";

export default function EventEdit() {
  const {
    saveButtonProps,
    refineCore: { queryResult },
    register,
    control,
    formState: { errors },
  } = useForm({
    refineCoreProps: {
      meta: {
        select:
          "id, object_id, event_type_id, e_from, e_to, extra, objects(id,name), event_types(id,label), user_profiles_from:user_profiles!events_e_from_fkey(id,first_name,last_name), user_profiles_to:user_profiles!events_e_to_fkey(id,first_name,last_name)",
      },
    },
  });

  const eventData = queryResult?.data?.data;

  const { options: objectOptions } = useSelect({
    resource: "objects",
    optionLabel: "name",
    optionValue: "id",
    defaultValue: eventData?.object_id,
  });

  const { options: eventTypeOptions } = useSelect({
    resource: "event_types",
    optionLabel: "label",
    optionValue: "id",
    defaultValue: eventData?.event_type_id,
  });

  const { options: userOptions } = useSelect({
    resource: "user_profiles",
    optionLabel: (item) => `${item.first_name} ${item.last_name}`,
    optionValue: "id",
    defaultValue: [eventData?.e_from, eventData?.e_to],
  });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Stack component="form" autoComplete="off">
        <TextInput {...register("id")} disabled label="ID" type="number" />
        <Controller
          control={control}
          name="object_id"
          rules={{ required: "This field is required" }}
          defaultValue={eventData?.object_id}
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
          defaultValue={eventData?.e_type}
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
          defaultValue={eventData?.e_from}
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
          defaultValue={eventData?.e_to}
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
    </Edit>
  );
}