import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/tenant-context";
import { inventoryRowsToCsv, type InventoryReportRow } from "@/lib/reports/csv";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";

const requestSchema = z.object({
  reportType: z.literal("inventory"),
  forceBackground: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const { supabase } = await requireTenantAdminAccess(
      "tenant.reports.generate"
    );
    const { data: requestResult, error: requestError } = await supabase.rpc(
      "request_tenant_report",
      {
        p_report_type: input.reportType,
        p_force_background: input.forceBackground,
      }
    );
    if (requestError) throw new Error(requestError.message);

    const result = requestResult?.[0];
    if (!result) throw new Error("The report request returned no result.");

    if (result.delivery_mode === "background") {
      return NextResponse.json(
        {
          mode: "background",
          jobId: result.report_job_id,
          rowCount: result.report_row_count,
        },
        { status: 202 }
      );
    }

    const { data: rows, error: rowsError } = await supabase.rpc(
      "tenant_inventory_report"
    );
    if (rowsError) throw new Error(rowsError.message);

    const csv = inventoryRowsToCsv((rows ?? []) as InventoryReportRow[]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventory-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const status =
      error instanceof AuthorizationError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Report request failed." },
      { status }
    );
  }
}
