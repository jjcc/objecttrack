"use client";

import { Stack, Text } from "@mantine/core";
import { useShow } from "@refinedev/core";
import { DateField, NumberField, Show, TextField } from "@refinedev/mantine";

export default function ObjectShow() {
  const { queryResult } = useShow({
    meta: { select: "id, name, description, created_at, model, categories(id, name)" },
  });
  const { data, isLoading } = queryResult;
  const record = data?.data;

  return (
    <Show isLoading={isLoading}>
      <Stack gap="sm">
        <Text fw={700}>ID</Text>
        <NumberField value={record?.id ?? ""} />
        <Text fw={700}>Name</Text>
        <TextField value={record?.name} />
        <Text fw={700}>Description</Text>
        <TextField value={record?.description} />
        <Text fw={700}>Category</Text>
        <Text>{record?.categories?.name}</Text>
        <Text fw={700}>Model</Text>
        <TextField value={record?.model} />
        <Text fw={700}>Created At</Text>
        <DateField value={record?.create_date} />
      </Stack>
    </Show>
  );
}