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

export default function UserList() {
  const { dataGridProps } = useDataGrid({
    syncWithLocation: true,
    meta: {
      select: "*, groups(id,title)",
    },
  });

  const { data: groupData, isLoading: groupIsLoading } = useMany({
    resource: "groups",
    ids:
      dataGridProps?.rows
        ?.map((item: any) => item?.groups?.id)
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
        field: "last_name",
        headerName: "Last Name",
        minWidth: 150,
      },
      {
        field: "first_name",
        headerName: "First Name",
        minWidth: 150,
      },
      {
        field: "title",
        headerName: "Title",
        minWidth: 150,
      },
      {
        field: "groups",
        headerName: "Group",
        minWidth: 160,
        valueGetter: (_, row) => {
          const value = row?.groups;
          return value;
        },
        renderCell: function render({ value }) {
          return groupIsLoading ? (
            <>Loading...</>
          ) : (
            groupData?.data?.find((item) => item.id === value?.id)?.title
          );
        },
      },
      {
        field: "email",
        headerName: "Email",
        minWidth: 200,
      },
      {
        field: "phone",
        headerName: "Phone",
        minWidth: 150,
      },
      {
        field: "create_date",
        headerName: "Created at",
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
    [groupData, groupIsLoading]
  );

  return (
    <List>
      <DataGrid {...dataGridProps} columns={columns} autoHeight />
    </List>
  );
}