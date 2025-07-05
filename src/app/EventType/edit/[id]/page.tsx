"use client";

import { Box, TextField } from "@mui/material";
import { Edit } from "@refinedev/mui";
import { useForm } from "@refinedev/react-hook-form";

export default function EventTypeEdit() {
  const {
    saveButtonProps,
    refineCore: { queryResult },
    register,
    formState: { errors },
  } = useForm({
    refineCoreProps: {
      meta: {
        select: "id, label, label_cn",
      },
    },
  });

  const eventTypeData = queryResult?.data?.data;

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
    </Edit>
  );
}