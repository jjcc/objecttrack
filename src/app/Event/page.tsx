"use client";

import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import {
  DateField,
  DeleteButton,
  EditButton,
  List,
  ShowButton,
  useDataGrid,
} from "@refinedev/mui";
import React from "react";
import { useMany } from "@refinedev/core";

export default function EventList() {
  const { dataGridProps } = useDataGrid({
    syncWithLocation: true,
    meta: {
      select:
        "*, objects(id,name), event_types(id,label), user_profiles_from:user_profiles!events_e_from_fkey(id,first_name,last_name), user_profiles_to:user_profiles!events_e_to_fkey(id,first_name,last_name)",
    },
  });

  const { data: objectData, isLoading: objectIsLoading } = useMany({
    resource: "objects",
    ids:
      dataGridProps?.rows
        ?.map((item: any) => item?.objects?.id)
        .filter(Boolean) ?? [],
    queryOptions: {
      enabled: !!dataGridProps?.rows,
    },
  });

  const { data: eventTypeData, isLoading: eventTypeIsLoading } = useMany({
    resource: "event_types",
    ids:
      dataGridProps?.rows
        ?.map((item: any) => item?.event_types?.id)
        .filter(Boolean) ?? [],
    queryOptions: {
      enabled: !!dataGridProps?.rows,
    },
  });

  const { data: fromUserData, isLoading: fromUserIsLoading } = useMany({
    resource: "user_profiles",
    ids:
      dataGridProps?.rows
        ?.map((item: any) => item?.user_profiles_from?.id)
        .filter(Boolean) ?? [],
    queryOptions: {
      enabled: !!dataGridProps?.rows,
    },
  });

  const { data: toUserData, isLoading: toUserIsLoading } = useMany({
    resource: "user_profiles",
    ids:
      dataGridProps?.rows
        ?.map((item: any) => item?.user_profiles_to?.id)
        .filter(Boolean) ?? [],
    queryOptions: {
      enabled: !!dataGridProps?.rows,
    },
  });

  const columns = React.useMemo<GridColDef[]>(
    () => [
      {
        field: "id",
        headerName: "ID",
        type: "number",
        minWidth: 50,
      },
      {
        field: "objects",
        headerName: "Object",
        minWidth: 160,
        valueGetter: (_, row) => {
          const value = row?.objects;
          return value;
        },
        renderCell: function render({ value }) {
          return objectIsLoading ? (
            <>Loading...</>
          ) : (
            objectData?.data?.find((item) => item.id === value?.id)?.name
          );
        },
      },
      {
        field: "event_types",
        headerName: "Event Type",
        minWidth: 160,
        valueGetter: (_, row) => {
          const value = row?.event_types;
          return value;
        },
        renderCell: function render({ value }) {
          return eventTypeIsLoading ? (
            <>Loading...</>
          ) : (
            eventTypeData?.data?.find((item) => item.id === value?.id)?.label
          );
        },
      },
      {
        field: "user_profiles_from",
        headerName: "From",
        minWidth: 160,
        valueGetter: (_, row) => {
          const value = row?.user_profiles_from;
          return value;
        },
        renderCell: function render({ value }) {
          return fromUserIsLoading ? (
            <>Loading...</>
          ) : (
            `${
              fromUserData?.data?.find((item) => item.id === value?.id)
                ?.first_name
            } ${
              fromUserData?.data?.find((item) => item.id === value?.id)
                ?.last_name
            }`
          );
        },
      },
      {
        field: "user_profiles_to",
        headerName: "To",
        minWidth: 160,
        valueGetter: (_, row) => {
          const value = row?.user_profiles_to;
          return value;
        },
        renderCell: function render({ value }) {
          return toUserIsLoading ? (
            <>Loading...</>
          ) : (
            `${
              toUserData?.data?.find((item) => item.id === value?.id)
                ?.first_name
            } ${
              toUserData?.data?.find((item) => item.id === value?.id)
                ?.last_name
            }`
          );
        },
      },
      {
        field: "extra",
        headerName: "Extra",
        minWidth: 250,
        flex: 1,
      },
      {
        field: "timestamp",
        headerName: "Timestamp",
        minWidth: 120,
        renderCell: function render({ value }) {
          return <DateField value={value} />;
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        sortable: false,
        renderCell: function render({ row }) {
          return (
            <>
              <EditButton hideText recordItemId={row.id} />
              <ShowButton hideText recordItemId={row.id} />
              <DeleteButton hideText recordItemId={row.id} />
            </>
          );
        },
        align: "center",
        headerAlign: "center",
        minWidth: 120,
      },
    ],
    [
      objectData,
      objectIsLoading,
      eventTypeData,
      eventTypeIsLoading,
      fromUserData,
      fromUserIsLoading,
      toUserData,
      toUserIsLoading,
    ]
  );

  return (
    <List>
      <DataGrid {...dataGridProps} columns={columns} autoHeight />
    </List>
  );
}