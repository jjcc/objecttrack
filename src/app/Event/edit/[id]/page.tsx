"use client";

import { Autocomplete, Box, TextField } from "@mui/material";
import { Edit, useAutocomplete } from "@refinedev/mui";
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

  const { autocompleteProps: objectAutocompleteProps } = useAutocomplete({
    resource: "objects",
    defaultValue: eventData?.object_id,
  });

  const { autocompleteProps: eventTypeAutocompleteProps } = useAutocomplete({
    resource: "event_types",
    defaultValue: eventData?.event_type_id,
  });

  const { autocompleteProps: userAutocompleteProps } = useAutocomplete({
    resource: "user_profiles",
    defaultValue: [eventData?.e_from, eventData?.e_to],
  });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Box
        component="form"
        sx={{ display: "flex", flexDirection: "column" }}
        autoComplete="off"
      >
        <TextField
          {...register("id")}
          disabled
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="number"
          label={"ID"}
          name="id"
        />
        <Controller
          control={control}
          name="object_id"
          rules={{ required: "This field is required" }}
          defaultValue={eventData?.object_id}
          render={({ field }) => (
            <Autocomplete
              {...objectAutocompleteProps}
              {...field}
              onChange={(_, value) => {
                field.onChange(value.id);
              }}
              getOptionLabel={(item) => {
                return (
                  objectAutocompleteProps?.options?.find((p) => {
                    const itemId =
                      typeof item === "object"
                        ? item?.id?.toString()
                        : item?.toString();
                    const pId = p?.id?.toString();
                    return itemId === pId;
                  })?.name ?? ""
                );
              }}
              isOptionEqualToValue={(option, value) => {
                const optionId = option?.id?.toString();
                const valueId =
                  typeof value === "object"
                    ? value?.id?.toString()
                    : value?.toString();
                return value === undefined || optionId === valueId;
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={"Object"}
                  margin="normal"
                  variant="outlined"
                  error={!!(errors as any)?.object_id}
                  helperText={(errors as any)?.object_id?.message}
                  required
                />
              )}
            />
          )}
        />
        <Controller
          control={control}
          name="e_type"
          rules={{ required: "This field is required" }}
          defaultValue={eventData?.e_type}
          render={({ field }) => (
            <Autocomplete
              {...eventTypeAutocompleteProps}
              {...field}
              onChange={(_, value) => {
                field.onChange(value.id);
              }}
              getOptionLabel={(item) => {
                return (
                  eventTypeAutocompleteProps?.options?.find((p) => {
                    const itemId =
                      typeof item === "object"
                        ? item?.id?.toString()
                        : item?.toString();
                    const pId = p?.id?.toString();
                    return itemId === pId;
                  })?.label ?? ""
                );
              }}
              isOptionEqualToValue={(option, value) => {
                const optionId = option?.id?.toString();
                const valueId =
                  typeof value === "object"
                    ? value?.id?.toString()
                    : value?.toString();
                return value === undefined || optionId === valueId;
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={"Event Type"}
                  margin="normal"
                  variant="outlined"
                  error={!!(errors as any)?.e_type}
                  helperText={(errors as any)?.e_type?.message}
                  required
                />
              )}
            />
          )}
        />
        <Controller
          control={control}
          name="e_from"
          rules={{ required: "This field is required" }}
          defaultValue={eventData?.e_from}
          render={({ field }) => (
            <Autocomplete
              {...userAutocompleteProps}
              {...field}
              onChange={(_, value) => {
                field.onChange(value.id);
              }}
              getOptionLabel={(item) => {
                const user = userAutocompleteProps?.options?.find((p) => {
                  const itemId =
                    typeof item === "object"
                      ? item?.id?.toString()
                      : item?.toString();
                  const pId = p?.id?.toString();
                  return itemId === pId;
                });
                return user ? `${user.first_name} ${user.last_name}` : "";
              }}
              isOptionEqualToValue={(option, value) => {
                const optionId = option?.id?.toString();
                const valueId =
                  typeof value === "object"
                    ? value?.id?.toString()
                    : value?.toString();
                return value === undefined || optionId === valueId;
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={"From"}
                  margin="normal"
                  variant="outlined"
                  error={!!(errors as any)?.e_from}
                  helperText={(errors as any)?.e_from?.message}
                  required
                />
              )}
            />
          )}
        />
        <Controller
          control={control}
          name="e_to"
          rules={{ required: "This field is required" }}
          defaultValue={eventData?.e_to}
          render={({ field }) => (
            <Autocomplete
              {...userAutocompleteProps}
              {...field}
              onChange={(_, value) => {
                field.onChange(value.id);
              }}
              getOptionLabel={(item) => {
                const user = userAutocompleteProps?.options?.find((p) => {
                  const itemId =
                    typeof item === "object"
                      ? item?.id?.toString()
                      : item?.toString();
                  const pId = p?.id?.toString();
                  return itemId === pId;
                });
                return user ? `${user.first_name} ${user.last_name}` : "";
              }}
              isOptionEqualToValue={(option, value) => {
                const optionId = option?.id?.toString();
                const valueId =
                  typeof value === "object"
                    ? value?.id?.toString()
                    : value?.toString();
                return value === undefined || optionId === valueId;
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={"To"}
                  margin="normal"
                  variant="outlined"
                  error={!!(errors as any)?.e_to}
                  helperText={(errors as any)?.e_to?.message}
                  required
                />
              )}
            />
          )}
        />
        <TextField
          {...register("extra")}
          error={!!(errors as any)?.extra}
          helperText={(errors as any)?.extra?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          multiline
          label={"Extra"}
          name="extra"
        />
      </Box>
    </Edit>
  );
}