import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type TransferStatus = "pending" | "approved" | "rejected";

export interface TransferProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export interface TransferRecord {
  id: number;
  object_id: number;
  from_user_id: string;
  to_user_id: string;
  group_id: number | null;
  status: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
  objects: {
    name: string;
    description?: string | null;
    model?: string | null;
  } | null;
  from: TransferProfile | null;
  to: TransferProfile | null;
}

export type TransferQueryRecord = Omit<TransferRecord, "from" | "to">;

export async function approveTransfer(
  supabase: SupabaseClient<Database>,
  requestId: number,
): Promise<void> {
  const { error } = await supabase.rpc("approve_transfer", {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function rejectTransfer(
  supabase: SupabaseClient<Database>,
  requestId: number,
  reason: string | null = null,
): Promise<void> {
  const { error } = await supabase.rpc("reject_transfer", {
    p_request_id: requestId,
    p_reason: reason ?? undefined,
  });
  if (error) throw error;
}

export async function resolveTransferProfiles(
  supabase: SupabaseClient<Database>,
  records: TransferQueryRecord[],
): Promise<TransferRecord[]> {
  const userIds = Array.from(
    new Set(records.flatMap((record) => [record.from_user_id, record.to_user_id])),
  );

  if (userIds.length === 0) {
    return records.map((record) => ({ ...record, from: null, to: null }));
  }

  const { data, error } = await supabase.rpc("profile_names", {
    p_user_ids: userIds,
  });

  if (error) throw error;

  const profiles = new Map(
    (data ?? []).map((profile) => [
      profile.id,
      {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
      },
    ]),
  );

  return records.map((record) => ({
    ...record,
    from: profiles.get(record.from_user_id) ?? null,
    to: profiles.get(record.to_user_id) ?? null,
  }));
}

export function formatTransferProfile(profile: TransferProfile | null): string {
  if (!profile) return "—";
  return `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "—";
}
