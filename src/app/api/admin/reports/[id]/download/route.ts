import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/tenant-context";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";

const idSchema = z.string().uuid();

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const reportJobId = idSchema.parse(params.id);
    const { supabase } = await requireTenantAdminAccess(
      "tenant.reports.generate"
    );
    const { data: storagePath, error: authorizeError } = await supabase.rpc(
      "authorize_tenant_report_download",
      { p_report_job_id: reportJobId }
    );
    if (authorizeError || !storagePath) {
      return NextResponse.json(
        { error: "This report is unavailable or has expired." },
        { status: 404 }
      );
    }

    const { data, error: signedUrlError } = await supabase.storage
      .from("tenant-reports")
      .createSignedUrl(storagePath, 60, {
        download: `inventory-${reportJobId}.csv`,
      });
    if (signedUrlError) throw new Error(signedUrlError.message);

    return NextResponse.redirect(new URL(data.signedUrl, request.url));
  } catch (error) {
    const status =
      error instanceof AuthorizationError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Download failed." },
      { status }
    );
  }
}
