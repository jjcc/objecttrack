import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: expiredJobs, error: expiryError } = await supabase.rpc(
  "expire_tenant_report_jobs"
);
if (expiryError) throw expiryError;
const expiredPaths = (expiredJobs ?? [])
  .map((job) => job.storage_path)
  .filter(Boolean);
if (expiredPaths.length > 0) {
  const { error: removalError } = await supabase.storage
    .from("tenant-reports")
    .remove(expiredPaths);
  if (removalError) throw removalError;
}

function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function inventoryCsv(rows) {
  const columns = [
    "id",
    "name",
    "description",
    "model",
    "category_id",
    "current_owner_id",
    "created_at",
  ];
  return [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((column) => escapeCsv(row[column])).join(",")
    ),
  ].join("\n");
}

const { data: jobs, error: claimError } = await supabase.rpc(
  "claim_tenant_report_jobs",
  { p_limit: 5 }
);
if (claimError) throw claimError;

for (const job of jobs ?? []) {
  try {
    if (job.report_type !== "inventory") {
      throw new Error(`Unsupported report type: ${job.report_type}`);
    }

    const { data: rows, error: rowsError } = await supabase
      .from("objects")
      .select(
        "id,name,description,model,category_id,current_owner_id,created_at"
      )
      .eq("tenant_id", job.tenant_id)
      .order("id");
    if (rowsError) throw rowsError;

    const csv = inventoryCsv(rows ?? []);
    const bytes = Buffer.from(csv, "utf8");
    const storagePath = `${job.tenant_id}/${job.id}.csv`;
    const checksum = createHash("sha256").update(bytes).digest("hex");

    const { error: uploadError } = await supabase.storage
      .from("tenant-reports")
      .upload(storagePath, bytes, {
        contentType: "text/csv",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { error: completeError } = await supabase.rpc(
      "complete_tenant_report_job",
      {
        p_report_job_id: job.id,
        p_storage_path: storagePath,
        p_row_count: rows?.length ?? 0,
        p_file_size_bytes: bytes.byteLength,
        p_checksum_sha256: checksum,
      }
    );
    if (completeError) throw completeError;
  } catch (error) {
    const { error: failError } = await supabase.rpc("fail_tenant_report_job", {
      p_report_job_id: job.id,
      p_failure_message:
        error instanceof Error ? error.message : "Unknown report worker failure",
    });
    if (failError) console.error(failError);
  }
}

console.log(
  `Expired ${expiredPaths.length} and processed ${jobs?.length ?? 0} report job(s).`
);
