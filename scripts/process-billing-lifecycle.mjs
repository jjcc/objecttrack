import { createClient } from "@supabase/supabase-js";

// Scheduled billing worker. Run it on a daily schedule.
//
// Two jobs, in this order:
//   1. send any due dunning reminders for workspaces in the grace window;
//   2. downgrade workspaces whose 30-day grace window has expired.
//
// Reminders go first so that the day-29 notice is always delivered before the
// day-30 downgrade.
//
// This is the one place the service role key legitimately lives, alongside the
// report worker. It must never be imported into application code.

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.INVITATION_FROM_EMAIL;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

function daysLeft(graceUntil) {
  const ms = new Date(graceUntil).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function reminderCopy(row) {
  const remaining = daysLeft(row.grace_until);
  const subject =
    row.stage_day === 0
      ? `Payment failed for ${row.workspace_name}`
      : remaining <= 1
        ? `Final notice: ${row.workspace_name} loses its plan tomorrow`
        : `${remaining} days left to update payment for ${row.workspace_name}`;

  const body = [
    `<p>We could not process the latest payment for <strong>${row.workspace_name}</strong>.</p>`,
    `<p>Your workspace keeps its current plan for now. If payment is not updated within ${remaining} day(s), it moves to the Free plan.</p>`,
    `<p><strong>Nothing is deleted.</strong> Every object and record stays exactly where it is. On Free you simply cannot create new objects beyond the Free limit until you are back under it or subscribe again.</p>`,
    appUrl ? `<p><a href="${appUrl}/admin/billing">Update payment</a></p>` : "",
  ].join("\n");

  return { subject, body };
}

async function sendEmail(to, subject, html) {
  if (!resendApiKey || !fromAddress) {
    console.warn(
      "[billing] RESEND_API_KEY or INVITATION_FROM_EMAIL missing; skipping send to",
      to
    );
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromAddress, to, subject, html }),
  });

  if (!response.ok) {
    console.error(
      "[billing] Resend rejected a reminder:",
      response.status,
      await response.text()
    );
    return false;
  }
  return true;
}

// 1. Dunning reminders.
const { data: due, error: dueError } = await supabase.rpc(
  "billing_dunning_due"
);
if (dueError) throw dueError;

let sent = 0;
let skipped = 0;

for (const row of due ?? []) {
  if (!row.owner_email) {
    console.warn("[billing] no owner email for tenant", row.tenant_id);
    skipped += 1;
    continue;
  }

  const { subject, body } = reminderCopy(row);
  const delivered = await sendEmail(row.owner_email, subject, body);

  // Only record a reminder that actually went out, so a transient Resend
  // failure retries on the next run instead of being silently swallowed.
  if (!delivered) {
    skipped += 1;
    continue;
  }

  const { error: recordError } = await supabase.rpc(
    "record_billing_dunning_sent",
    {
      p_tenant_id: row.tenant_id,
      p_grace_started_at: row.grace_started_at,
      p_stage_day: row.stage_day,
    }
  );
  if (recordError) throw recordError;
  sent += 1;
}

// 2. Expire grace windows that have run out.
const { data: expired, error: expireError } = await supabase.rpc(
  "expire_billing_grace"
);
if (expireError) throw expireError;

for (const row of expired ?? []) {
  console.log(
    `[billing] tenant ${row.tenant_id} downgraded from ${row.previous_plan} to free after grace expiry`
  );
}

console.log(
  `[billing] reminders sent: ${sent}, skipped: ${skipped}, downgrades: ${(expired ?? []).length}`
);
