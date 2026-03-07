"use client";

import { Autocomplete, Box, TextField } from "@mui/material";
import { Create, useAutocomplete } from "@refinedev/mui";
import { useForm } from "@refinedev/react-hook-form";
import React from "react";
import { Controller } from "react-hook-form";

export default function UserCreate() {
  const {
    saveButtonProps,
    refineCore: { formLoading },
    register,
    control,
    formState: { errors },
  } = useForm({});

  const { autocompleteProps: groupAutocompleteProps } = useAutocomplete({
    resource: "groups",
  });

  return (
    <Create isLoading={formLoading} saveButtonProps={saveButtonProps}>
      <Box
        component="form"
        sx={{ display: "flex", flexDirection: "column" }}
        autoComplete="off"
      >
        <TextField
          {...register("last_name", {
            required: "This field is required",
          })}
          error={!!(errors as any)?.last_name}
          helperText={(errors as any)?.last_name?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="text"
          label={"Last Name"}
          name="last_name"
        />
        <TextField
          {...register("first_name", {
            required: "This field is required",
          })}
          error={!!(errors as any)?.first_name}
          helperText={(errors as any)?.first_name?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="text"
          label={"First Name"}
          name="first_name"
        />
        <TextField
          {...register("title")}
          error={!!(errors as any)?.title}
          helperText={(errors as any)?.title?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="text"
          label={"Title"}
          name="title"
        />
        <TextField
          {...register("city")}
          error={!!(errors as any)?.city}
          helperText={(errors as any)?.city?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="text"
          label={"City"}
          name="city"
        />
        <TextField
          {...register("province")}
          error={!!(errors as any)?.province}
          helperText={(errors as any)?.province?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="text"
          label={"Province"}
          name="province"
        />
        <TextField
          {...register("country")}
          error={!!(errors as any)?.country}
          helperText={(errors as any)?.country?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="text"
          label={"Country"}
          name="country"
        />
        <TextField
          {...register("zipcode")}
          error={!!(errors as any)?.zipcode}
          helperText={(errors as any)?.zipcode?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="text"
          label={"Zipcode"}
          name="zipcode"
        />
        <TextField
          {...register("phone")}
          error={!!(errors as any)?.phone}
          helperText={(errors as any)?.phone?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="text"
          label={"Phone"}
          name="phone"
        />
        <TextField
          {...register("wechat_id")}
          error={!!(errors as any)?.wechat_id}
          helperText={(errors as any)?.wechat_id?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="text"
          label={"Wechat ID"}
          name="wechat_id"
        />
        <Controller
          control={control}
          name={"group_id"}
          defaultValue={null as any}
          render={({ field }) => (
            <Autocomplete
              {...groupAutocompleteProps}
              {...field}
              onChange={(_, value) => {
                field.onChange(value.id);
              }}
              getOptionLabel={(item) => {
                return (
                  groupAutocompleteProps?.options?.find((p) => {
                    const itemId =
                      typeof item === "object"
                        ? item?.id?.toString()
                        : item?.toString();
                    const pId = p?.id?.toString();
                    return itemId === pId;
                  })?.title ?? ""
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
                  label={"Group"}
                  margin="normal"
                  variant="outlined"
                  error={!!(errors as any)?.group_id}
                  helperText={(errors as any)?.group_id?.message}
                />
              )}
            />
          )}
        />
        <TextField
          {...register("email")}
          error={!!(errors as any)?.email}
          helperText={(errors as any)?.email?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="email"
          label={"Email"}
          name="email"
        />
      </Box>
    </Create>
  );
}