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
import Radio from "@mui/material/Radio";
import QrCode from "@components/qr-code";

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

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [qrCodeValue, setQrCodeValue] = useState("");

  const handleGenerateBarcode = () => {
    if (selectedId) {
      const paddedId = selectedId.toString().padStart(16, "0");
      setQrCodeValue(paddedId);
    }
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
        headerName: "Choose",
        sortable: false,
        renderCell: function render({ row }) {
          return (
            <Radio
              checked={selectedId === row.id}
              onChange={() => setSelectedId(row.id)}
              value={row.id}
            />
          );
        },
        align: "center",
        headerAlign: "center",
        minWidth: 120,
      },
    ],
    [categoryData, categoryIsLoading, selectedId]
  );

  return (
    <List>
      <DataGrid {...dataGridProps} columns={columns} />
      <Box sx={{ mt: 4, display: "flex", justifyContent: "space-between" }}>
        <Box>
          <Button
            variant="contained"
            onClick={handleGenerateBarcode}
            disabled={!selectedId}
          >
           生成二维码 
          </Button>
        </Box>
        <Box sx={{ textAlign: "center", width: "80%" }}>
          {qrCodeValue && <QrCode value={qrCodeValue} size={256} />}
        </Box>
      </Box>
    </List>
  );
}