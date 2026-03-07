"use client";

import React from "react";
import { useTable } from "@refinedev/react-table";
import { DeleteButton, EditButton, List, ShowButton } from "@refinedev/mantine";
import { Group, Pagination, ScrollArea, Table } from "@mantine/core";
import { ColumnDef, flexRender } from "@tanstack/react-table";

export default function EventTypeList() {
  const columns = React.useMemo<ColumnDef<any>[]>(
    () => [
      { header: "ID", accessorKey: "id" },
      { header: "Label", accessorKey: "label" },
      { header: "Label (CN)", accessorKey: "label_cn" },
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
  } = useTable({ columns, refineCoreProps: { syncWithLocation: true } });

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