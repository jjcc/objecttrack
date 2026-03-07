"use client";

import { Stack, Text } from "@mantine/core";
import { useShow } from "@refinedev/core";
import { NumberField, Show, TextField } from "@refinedev/mantine";

export default function EventTypeShow() {
  const { queryResult } = useShow({});
  const { data, isLoading } = queryResult;
  const record = data?.data;

  return (
    <Show isLoading={isLoading}>
      <Stack spacing="sm">
        <Text fw={700}>ID</Text>
        <NumberField value={record?.id ?? ""} />
        <Text fw={700}>Label</Text>
        <TextField value={record?.label} />
        <Text fw={700}>Label (CN)</Text>
        <TextField value={record?.label_cn} />
      </Stack>
    </Show>
  );
}