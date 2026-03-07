"use client";

import { Stack, Text } from "@mantine/core";
import { useShow } from "@refinedev/core";
import { DateField, NumberField, Show, TextField } from "@refinedev/mantine";

export default function EventShow() {
  const { queryResult } = useShow({
    meta: {
      select:
        "id, extra, created_at, objects(id,name), event_types(id,label), user_profiles_from:user_profiles!events_e_from_fkey(id,first_name,last_name), user_profiles_to:user_profiles!events_e_to_fkey(id,first_name,last_name)",
    },
  });
  const { data, isLoading } = queryResult;
  const record = data?.data;

  return (
    <Show isLoading={isLoading}>
      <Stack spacing="sm">
        <Text fw={700}>ID</Text>
        <NumberField value={record?.id ?? ""} />
        <Text fw={700}>Object</Text>
        <Text>{record?.objects?.name}</Text>
        <Text fw={700}>Event Type</Text>
        <Text>{record?.event_types?.label}</Text>
        <Text fw={700}>From</Text>
        <Text>
          {record?.user_profiles_from?.first_name}{" "}
          {record?.user_profiles_from?.last_name}
        </Text>
        <Text fw={700}>To</Text>
        <Text>
          {record?.user_profiles_to?.first_name}{" "}
          {record?.user_profiles_to?.last_name}
        </Text>
        <Text fw={700}>Extra</Text>
        <TextField value={record?.extra} />
        <Text fw={700}>Timestamp</Text>
        <DateField value={record?.timestamp} />
      </Stack>
    </Show>
  );
}