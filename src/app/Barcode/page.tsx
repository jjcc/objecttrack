"use client";

import React, { useState } from "react";
import { useTable } from "@refinedev/react-table";
import { DateField, List } from "@refinedev/mantine";
import { Button, Group, Pagination, Radio, ScrollArea, Table } from "@mantine/core";
import { ColumnDef, flexRender } from "@tanstack/react-table";
import QrCode from "@components/qr-code";

export default function ObjectList() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [qrCodeValue, setQrCodeValue] = useState("");

  const handleGenerateBarcode = () => {
    if (selectedId) {
      const paddedId = selectedId.toString().padStart(16, "0");
      setQrCodeValue(paddedId);
    }
  };

  const columns = React.useMemo<ColumnDef<any>[]>(
    () => [
      { header: "ID", accessorKey: "id" },
      { header: "Name", accessorKey: "name" },
      { header: "Description", accessorKey: "description" },
      {
        header: "Category",
        accessorKey: "categories",
        cell: (params: any) => params.getValue()?.name,
      },
      { header: "Model", accessorKey: "model" },
      {
        header: "Created at",
        accessorKey: "create_date",
        cell: (params: any) => <DateField value={params.getValue()} />,
      },
      {
        header: "Choose",
        id: "actions",
        cell: (params: any) => (
          <Radio
            checked={selectedId === params.row.original.id}
            onChange={() => setSelectedId(params.row.original.id)}
            value={String(params.row.original.id)}
          />
        ),
      },
    ],
    [selectedId]
  );

  const {
    getHeaderGroups,
    getRowModel,
    refineCore: { current, setCurrent, pageCount },
  } = useTable({
      columns,
      syncWithLocation: true,
      refineCoreProps: {
        resource: "objects",
        meta: { select: "*, categories(id,name)" },
        pagination: { pageSize: 25 },
      },
    });

  return (
    <List>
      <ScrollArea>
        <Table highlightOnHover>
          <Table.Thead>
            {getHeaderGroups().map((hg: any) => (
              <Table.Tr key={hg.id}>
                {hg.headers.map((h: any) => (
                  <Table.Th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</Table.Th>
                ))}
              </Table.Tr>
            ))}
          </Table.Thead>
          <Table.Tbody>
            {getRowModel().rows.map((row: any) => (
              <Table.Tr key={row.id}>
                {row.getVisibleCells().map((cell: any) => (
                  <Table.Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      <Pagination value={current} onChange={setCurrent} total={pageCount} mt="md" />
      <Group mt="xl" justify="space-between">
        <Button onClick={handleGenerateBarcode} disabled={!selectedId}>
          生成二维码
        </Button>
        <div style={{ textAlign: "center", width: "80%" }}>
          {qrCodeValue && <QrCode value={qrCodeValue} size={256} />}
        </div>
      </Group>
    </List>
  );
}