"use client";

import { Stack, Text } from "@mantine/core";
import { useShow } from "@refinedev/core";
import { DateField, NumberField, Show, TextField } from "@refinedev/mantine";

export default function GroupShow() {
  const { queryResult } = useShow({});
  const { data, isLoading } = queryResult;
  const record = data?.data;

  return (
    <Show isLoading={isLoading}>
      <Stack spacing="sm">
        <Text fw={700}>ID</Text>
        <NumberField value={record?.id ?? ""} />
        <Text fw={700}>Group Title</Text>
        <TextField value={record?.group_title} />
        <Text fw={700}>Description</Text>
        <TextField value={record?.description} />
        <Text fw={700}>Created At</Text>
        <DateField value={record?.create_date} />
      </Stack>
    </Show>
  );
}