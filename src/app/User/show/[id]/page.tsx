"use client";

import { Stack, Typography } from "@mui/material";
import { useOne, useShow } from "@refinedev/core";
import {
  DateField,
  EmailField,
  NumberField,
  Show,
  TextFieldComponent as TextField,
} from "@refinedev/mui";

export default function UserShow() {
  const { queryResult } = useShow({
    meta: {
      select:
        "id, last_name, first_name, title, created_at, city, province, country, zipcode, phone, wechat_id, group_id, email, groups(id,title)",
    },
  });

  const { data, isLoading } = queryResult;

  const record = data?.data;

  const { data: groupData, isLoading: groupIsLoading } = useOne({
    resource: "groups",
    id: record?.groups?.id || "",
    queryOptions: {
      enabled: !!record,
    },
  });

  return (
    <Show isLoading={isLoading}>
      <Stack gap={1}>
        <Typography variant="body1" fontWeight="bold">
          ID
        </Typography>
        <NumberField value={record?.id ?? ""} />
        <Typography variant="body1" fontWeight="bold">
          Last Name
        </Typography>
        <TextField value={record?.last_name} />
        <Typography variant="body1" fontWeight="bold">
          First Name
        </Typography>
        <TextField value={record?.first_name} />
        <Typography variant="body1" fontWeight="bold">
          Title
        </Typography>
        <TextField value={record?.title} />
        <Typography variant="body1" fontWeight="bold">
          Group
        </Typography>
        {groupIsLoading ? (
          <>Loading...</>
        ) : (
          <>{groupData?.data?.title}</>
        )}
        <Typography variant="body1" fontWeight="bold">
          Email
        </Typography>
        <EmailField value={record?.email} />
        <Typography variant="body1" fontWeight="bold">
          Phone
        </Typography>
        <TextField value={record?.phone} />
        <Typography variant="body1" fontWeight="bold">
          Wechat ID
        </Typography>
        <TextField value={record?.wechat_id} />
        <Typography variant="body1" fontWeight="bold">
          Address
        </Typography>
        <TextField
          value={`${record?.city}, ${record?.province}, ${record?.country} ${record?.zipcode}`}
        />
        <Typography variant="body1" fontWeight="bold">
          Created At
        </Typography>
        <DateField value={record?.create_date} />
      </Stack>
    </Show>
  );
}