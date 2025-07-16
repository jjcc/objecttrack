"use client";

import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import {
  DateField,
  List,
  useDataGrid,
} from "@refinedev/mui";
import React, { useState } from "react";
import { useMany } from "@refinedev/core";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import dynamic from "next/dynamic";

const QRCode = dynamic(() => import("qrcode.react"), {
  ssr: false,
  loading: () => <p>Loading QR Code...</p>,
});

export default function ObjectList() {
  const { dataGridProps } = useDataGrid({
    syncWithLocation: true,
    resource: "Object",
    meta: {
      select: "*, Category(id,name)",
    },
    pagination: {
      pageSize: 25,
    },
  });

  const [qrCodeValue, setQrCodeValue] = useState("");

  const handleGenerateBarcode = (id: number) => {
    const paddedId = id.toString().padStart(16, "0");
    setQrCodeValue(paddedId);
  };

  const { data: categoryData, isLoading: categoryIsLoading } = useMany({
    resource: "Category",
    ids:
      dataGridProps?.rows
        ?.map((item: any) => item?.Category?.id)
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
        field: "name",
        headerName: "Name",
        minWidth: 200,
        flex: 1,
      },
      {
        field: "description",
        headerName: "Description",
        minWidth: 250,
        flex: 1,
      },
      {
        field: "Category",
        headerName: "Category",
        minWidth: 160,
        valueGetter: (_, row) => {
          const value = row?.Category;
          return value;
        },
        renderCell: function render({ value }) {
          return categoryIsLoading ? (
            <>Loading...</>
          ) : (
            categoryData?.data?.find((item) => item.id === value?.id)?.name
          );
        },
      },
      {
        field: "model",
        headerName: "Model",
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
            <Button onClick={() => handleGenerateBarcode(row.id)}>
              Generate Barcode
            </Button>
          );
        },
        align: "center",
        headerAlign: "center",
        minWidth: 120,
      },
    ],
    [categoryData, categoryIsLoading]
  );

  return (
    <List create={false}>
      <DataGrid {...dataGridProps} columns={columns} autoHeight />
      {qrCodeValue && (
        <Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
          <QRCode value={qrCodeValue} size={256} />
        </Box>
      )}
    </List>
  );
}