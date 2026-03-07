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

export default function EventList() {
  const columns = React.useMemo<ColumnDef<any>[]>(
    () => [
      { header: "ID", accessorKey: "id" },
      {
        header: "Object",
        accessorKey: "objects",
        cell: ({ getValue }) => getValue<any>()?.name,
      },
      {
        header: "Event Type",
        accessorKey: "event_types",
        cell: ({ getValue }) => getValue<any>()?.label,
      },
      {
        header: "From",
        accessorKey: "user_profiles_from",
        cell: ({ getValue }) => {
          const v = getValue<any>();
          return v ? `${v.first_name} ${v.last_name}` : "";
        },
      },
      {
        header: "To",
        accessorKey: "user_profiles_to",
        cell: ({ getValue }) => {
          const v = getValue<any>();
          return v ? `${v.first_name} ${v.last_name}` : "";
        },
      },
      { header: "Extra", accessorKey: "extra" },
      {
        header: "Timestamp",
        accessorKey: "timestamp",
        cell: ({ getValue }) => <DateField value={getValue<string>()} />,
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <Group gap="xs" wrap="nowrap">
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
      syncWithLocation: true,
      meta: {
        select:
          "*, objects(id,name), event_types(id,label), user_profiles_from:user_profiles!events_e_from_fkey(id,first_name,last_name), user_profiles_to:user_profiles!events_e_to_fkey(id,first_name,last_name)",
      },
    },
  });

  return (
    <List>
      <ScrollArea>
        <Table highlightOnHover>
          <Table.Thead>
            {getHeaderGroups().map((headerGroup) => (
              <Table.Tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Table.Th key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </Table.Th>
                ))}
              </Table.Tr>
            ))}
          </Table.Thead>
          <Table.Tbody>
            {getRowModel().rows.map((row) => (
              <Table.Tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <Table.Td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      <Pagination value={current} onChange={setCurrent} total={pageCount} mt="md" />
    </List>
  );
}