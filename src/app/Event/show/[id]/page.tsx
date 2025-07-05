"use client";

import { Stack, Typography } from "@mui/material";
import { useOne, useShow } from "@refinedev/core";
import {
  DateField,
  NumberField,
  Show,
  TextFieldComponent as TextField,
} from "@refinedev/mui";

export default function EventShow() {
  const { queryResult } = useShow({
    meta: {
      select:
        "id, extra, timestamp, Object(id,name), EventType(id,label), User_e_from:User!Event_e_from_fkey(id,first_name,last_name), User_e_to:User!Event_e_to_fkey(id,first_name,last_name)",
    },
  });

  const { data, isLoading } = queryResult;

  const record = data?.data;

  const { data: objectData, isLoading: objectIsLoading } = useOne({
    resource: "Object",
    id: record?.Object?.id || "",
    queryOptions: {
      enabled: !!record,
    },
  });

  const { data: eventTypeData, isLoading: eventTypeIsLoading } = useOne({
    resource: "EventType",
    id: record?.EventType?.id || "",
    queryOptions: {
      enabled: !!record,
    },
  });

  const { data: fromUserData, isLoading: fromUserIsLoading } = useOne({
    resource: "User",
    id: record?.User_e_from?.id || "",
    queryOptions: {
      enabled: !!record,
    },
  });

  const { data: toUserData, isLoading: toUserIsLoading } = useOne({
    resource: "User",
    id: record?.User_e_to?.id || "",
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
          Object
        </Typography>
        {objectIsLoading ? (
          <>Loading...</>
        ) : (
          <>{objectData?.data?.name}</>
        )}
        <Typography variant="body1" fontWeight="bold">
          Event Type
        </Typography>
        {eventTypeIsLoading ? (
          <>Loading...</>
        ) : (
          <>{eventTypeData?.data?.label}</>
        )}
        <Typography variant="body1" fontWeight="bold">
          From
        </Typography>
        {fromUserIsLoading ? (
          <>Loading...</>
        ) : (
          <>
            {fromUserData?.data?.first_name} {fromUserData?.data?.last_name}
          </>
        )}
        <Typography variant="body1" fontWeight="bold">
          To
        </Typography>
        {toUserIsLoading ? (
          <>Loading...</>
        ) : (
          <>
            {toUserData?.data?.first_name} {toUserData?.data?.last_name}
          </>
        )}
        <Typography variant="body1" fontWeight="bold">
          Extra
        </Typography>
        <TextField value={record?.extra} />
        <Typography variant="body1" fontWeight="bold">
          Timestamp
        </Typography>
        <DateField value={record?.timestamp} />
      </Stack>
    </Show>
  );
}