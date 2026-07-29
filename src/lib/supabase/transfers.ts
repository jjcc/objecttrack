import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type TransferStatus = "pending" | "approved" | "rejected";

export interface TransferDisplayRecord {
  id: number;
  status: TransferStatus;
  reason: string | null;
  created_at: string;
  updated_at: string;
  object_name: string;
  object_description: string | null;
  object_model: string | null;
  from_user_full_name: string | null;
  to_user_full_name: string | null;
}

type TransferDisplayDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Views"> & {
    Views: Database["public"]["Views"] & {
      transfer_requests_display: {
        Row: TransferDisplayRecord;
        Relationships: [];
      };
    };
  };
};

export function transferDisplayClient(
  supabase: SupabaseClient<Database>,
): SupabaseClient<TransferDisplayDatabase> {
  return supabase as unknown as SupabaseClient<TransferDisplayDatabase>;
}

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
