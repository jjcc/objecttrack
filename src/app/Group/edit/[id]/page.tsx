"use client";

import { Box, TextField } from "@mui/material";
import { Edit } from "@refinedev/mui";
import { useForm } from "@refinedev/react-hook-form";

export default function GroupEdit() {
  const {
    saveButtonProps,
    refineCore: { queryResult },
    register,
    formState: { errors },
  } = useForm({
    refineCoreProps: {
      meta: {
        select: "id, group_title, description",
      },
    },
  });

  const groupData = queryResult?.data?.data;

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
          {...register("group_title", {
            required: "This field is required",
          })}
          error={!!(errors as any)?.group_title}
          helperText={(errors as any)?.group_title?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          type="text"
          label={"Group Title"}
          name="group_title"
        />
        <TextField
          {...register("description", {
            required: "This field is required",
          })}
          error={!!(errors as any)?.description}
          helperText={(errors as any)?.description?.message}
          margin="normal"
          fullWidth
          InputLabelProps={{ shrink: true }}
          multiline
          label={"Description"}
          name="description"
        />
      </Box>
    </Edit>
  );
}