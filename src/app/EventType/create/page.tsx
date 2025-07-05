"use client";

import { Box, TextField } from "@mui/material";
import { Create } from "@refinedev/mui";
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
      <Box
        component="form"
        sx={{ display: "flex", flexDirection: "column" }}
        autoComplete="off"
      >
        <TextField
          {...register("label", {
            required: "This field is required",
          })}
          error={!!(errors as any)?.label}
          helperText={(errors as any)?.label?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="text"
          label={"Label"}
          name="label"
        />
        <TextField
          {...register("label_cn", {
            required: "This field is required",
          })}
          error={!!(errors as any)?.label_cn}
          helperText={(errors as any)?.label_cn?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="text"
          label={"Label (CN)"}
          name="label_cn"
        />
      </Box>
    </Create>
  );
}