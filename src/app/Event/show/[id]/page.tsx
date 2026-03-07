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
        "id, extra, created_at, objects(id,name), event_types(id,label), user_profiles_from:user_profiles!events_e_from_fkey(id,first_name,last_name), user_profiles_to:user_profiles!events_e_to_fkey(id,first_name,last_name)",
    },
  });

  const { data, isLoading } = queryResult;

  const record = data?.data;

  const { data: objectData, isLoading: objectIsLoading } = useOne({
    resource: "objects",
    id: record?.objects?.id || "",
    queryOptions: {
      enabled: !!record,
    },
  });

  const { data: eventTypeData, isLoading: eventTypeIsLoading } = useOne({
    resource: "event_types",
    id: record?.event_types?.id || "",
    queryOptions: {
      enabled: !!record,
    },
  });

  const { data: fromUserData, isLoading: fromUserIsLoading } = useOne({
    resource: "user_profiles",
    id: record?.user_profiles_from?.id || "",
    queryOptions: {
      enabled: !!record,
    },
  });

  const { data: toUserData, isLoading: toUserIsLoading } = useOne({
    resource: "user_profiles",
    id: record?.user_profiles_to?.id || "",
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