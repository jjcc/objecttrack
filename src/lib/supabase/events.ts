"use client";

import { getSupabaseClient } from "./client";

async function getEventTypeId(label: string): Promise<number | null> {
  const supabase = getSupabaseClient();
  const { data } = await (supabase.from("event_types") as any)
    .select("id")
    .eq("label", label)
    .maybeSingle();
  return (data as { id?: number } | null)?.id ?? null;
}

async function getGroupIdForUser(userId: string): Promise<number | null> {
  const supabase = getSupabaseClient();
  const { data } = await (supabase.from("user_profiles") as any)
    .select("group_id")
    .eq("id", userId)
    .maybeSingle();
  return (data as { group_id?: number } | null)?.group_id ?? null;
}

export async function logTransferApproved(
  objectId: number,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const eventTypeId = await getEventTypeId("Transfer Approved");
  if (!eventTypeId) return;

  const groupId = await getGroupIdForUser(fromUserId);
  if (!groupId) return;

  await (supabase.from("events") as any).insert({
    group_id: groupId,
    object_id: objectId,
    event_type_id: eventTypeId,
    e_from: fromUserId,
    e_to: toUserId,
  });
}

export async function logTransferRejected(
  objectId: number,
  fromUserId: string,
  toUserId: string,
  reason: string | null,
): Promise<void> {
  const supabase = getSupabaseClient();
  const eventTypeId = await getEventTypeId("Transfer Rejected");
  if (!eventTypeId) return;

  const groupId = await getGroupIdForUser(fromUserId);
  if (!groupId) return;

  await (supabase.from("events") as any).insert({
    group_id: groupId,
    object_id: objectId,
    event_type_id: eventTypeId,
    e_from: fromUserId,
    e_to: toUserId,
    extra: reason ? { reason } : null,
  });
}
