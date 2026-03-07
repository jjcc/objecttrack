"use client";

import React from "react";
import { useTable } from "@refinedev/react-table";
import {
  DateField,
  DeleteButton,
  EditButton,
  List,
  ShowButton,
} from "@refinedev/mantine";
import { Group, Pagination, ScrollArea, Table } from "@mantine/core";
import { ColumnDef, flexRender } from "@tanstack/react-table";

export default function UserList() {
  const columns = React.useMemo<ColumnDef<any>[]>(
    () => [
      { header: "ID", accessorKey: "id" },
      { header: "Last Name", accessorKey: "last_name" },
      { header: "First Name", accessorKey: "first_name" },
      { header: "Title", accessorKey: "title" },
      {
        header: "Group",
        accessorKey: "groups",
        cell: ({ getValue }) => getValue<any>()?.title,
      },
      { header: "Email", accessorKey: "email" },
      { header: "Phone", accessorKey: "phone" },
      {
        header: "Created at",
        accessorKey: "create_date",
        cell: ({ getValue }) => <DateField value={getValue<string>()} />,
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <Group spacing="xs">
            <EditButton hideText recordItemId={row.original.id} />
            <ShowButton hideText recordItemId={row.original.id} />
            <DeleteButton hideText recordItemId={row.original.id} />
          </Group>
        ),
      },
    ],
    []
  );

  const {
    getHeaderGroups,
    getRowModel,
    refineCore: { current, setCurrent, pageCount },
  } = useTable({
    columns,
    refineCoreProps: {
      syncWithLocation: true, meta: { select: "*, groups(id,title)" } },
  });

  return (
    <List>
      <ScrollArea>
        <Table highlightOnHover>
          <thead>
            {getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </ScrollArea>
      <Pagination value={current} onChange={setCurrent} total={pageCount} mt="md" />
    </List>
  );
}