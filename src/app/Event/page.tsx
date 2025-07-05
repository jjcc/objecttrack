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
        "*, Object(id,name), EventType(id,label), User_e_from:User!Event_e_from_fkey(id,first_name,last_name), User_e_to:User!Event_e_to_fkey(id,first_name,last_name)",
    },
  });

  const { data: objectData, isLoading: objectIsLoading } = useMany({
    resource: "Object",
    ids:
      dataGridProps?.rows
        ?.map((item: any) => item?.Object?.id)
        .filter(Boolean) ?? [],
    queryOptions: {
      enabled: !!dataGridProps?.rows,
    },
  });

  const { data: eventTypeData, isLoading: eventTypeIsLoading } = useMany({
    resource: "EventType",
    ids:
      dataGridProps?.rows
        ?.map((item: any) => item?.EventType?.id)
        .filter(Boolean) ?? [],
    queryOptions: {
      enabled: !!dataGridProps?.rows,
    },
  });

  const { data: fromUserData, isLoading: fromUserIsLoading } = useMany({
    resource: "User",
    ids:
      dataGridProps?.rows
        ?.map((item: any) => item?.User_e_from?.id)
        .filter(Boolean) ?? [],
    queryOptions: {
      enabled: !!dataGridProps?.rows,
    },
  });

  const { data: toUserData, isLoading: toUserIsLoading } = useMany({
    resource: "User",
    ids:
      dataGridProps?.rows
        ?.map((item: any) => item?.User_e_to?.id)
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
        field: "Object",
        headerName: "Object",
        minWidth: 160,
        valueGetter: (_, row) => {
          const value = row?.Object;
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
        field: "EventType",
        headerName: "Event Type",
        minWidth: 160,
        valueGetter: (_, row) => {
          const value = row?.EventType;
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
        field: "User_e_from",
        headerName: "From",
        minWidth: 160,
        valueGetter: (_, row) => {
          const value = row?.User_e_from;
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
        field: "User_e_to",
        headerName: "To",
        minWidth: 160,
        valueGetter: (_, row) => {
          const value = row?.User_e_to;
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