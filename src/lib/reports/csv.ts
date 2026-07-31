export type InventoryReportRow = {
  object_id: number;
  object_name: string;
  description: string | null;
  model: string | null;
  category_name: string | null;
  owner_email: string | null;
  created_at: string;
};

const inventoryHeaders: Array<keyof InventoryReportRow> = [
  "object_id",
  "object_name",
  "description",
  "model",
  "category_name",
  "owner_email",
  "created_at",
];

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function inventoryRowsToCsv(rows: InventoryReportRow[]): string {
  return [
    inventoryHeaders.join(","),
    ...rows.map((row) =>
      inventoryHeaders.map((header) => escapeCsv(row[header])).join(",")
    ),
  ].join("\n");
}
