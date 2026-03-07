"use client";

import { Stack, Text } from "@mantine/core";
import { useShow } from "@refinedev/core";
import {
  DateField,
  EmailField,
  NumberField,
  Show,
  TextField,
} from "@refinedev/mantine";

export default function UserShow() {
  const { queryResult } = useShow({
    meta: {
      select:
        "id, last_name, first_name, title, created_at, city, province, country, zipcode, phone, wechat_id, group_id, email, groups(id,title)",
    },
  });

  const { data, isLoading } = queryResult;

  const record = data?.data;

  return (
    <Show isLoading={isLoading}>
      <Stack spacing="xs">
        <Text fw={700}>ID</Text>
        <NumberField value={record?.id ?? ""} />
        <Text fw={700}>Last Name</Text>
        <TextField value={record?.last_name} />
        <Text fw={700}>First Name</Text>
        <TextField value={record?.first_name} />
        <Text fw={700}>Title</Text>
        <TextField value={record?.title} />
        <Text fw={700}>Group</Text>
        <TextField value={record?.groups?.title} />
        <Text fw={700}>Email</Text>
        <EmailField value={record?.email} />
        <Text fw={700}>Phone</Text>
        <TextField value={record?.phone} />
        <Text fw={700}>Wechat ID</Text>
        <TextField value={record?.wechat_id} />
        <Text fw={700}>Address</Text>
        <TextField
          value={`${record?.city}, ${record?.province}, ${record?.country} ${record?.zipcode}`}
        />
        <Text fw={700}>Created At</Text>
        <DateField value={record?.create_date} />
      </Stack>
    </Show>
  );
}