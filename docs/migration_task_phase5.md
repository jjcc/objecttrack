# migration_task_phase5.md — Transfer approval flow + dashboard KPIs

## Goal
Add the missing transfer-request approval UI and fill in the empty dashboard.
Keep the current auth, Supabase client helpers, Mantine layout, and existing pages intact.

## Database status (already created)
- `public.transfer_requests` exists with columns:
  - `id`, `object_id`, `from_user_id`, `to_user_id`, `status`, `reason`, `created_at`, `updated_at`
- RLS: admins can manage transfer requests
- Indexes on `object_id` and `status`

---

## Phase 5.1 — `/transfers` page (list + actions)
Files to create/modify:
- Create `src/app/transfers/page.tsx`

Requirements:
- Admin-only page, protected by AuthGate.
- Show only `pending` requests by default.
- Columns:
  - id
  - object: read `objects.name`
  - from: read `user_profiles.first_name` + `last_name`
  - to: read `user_profiles.first_name` + `last_name`
  - status
  - requested at: `created_at` formatted
  - actions: Approve / Reject buttons for `pending`
- Approve:
  - Run `supabase.rpc("approve_transfer", { p_request_id })`
  - If RPC does not exist yet, fall back to:
    - Update `objects.current_owner_id = to_user_id`
    - Update `events` record for audit trail: insert into `events` with `event_type_id` of type "Transfer Approved"
- Reject:
  - Update `transfer_requests.status = "rejected"` and set `reason`
  - Insert into `events` with type "Transfer Rejected"
- Keep using `mantine-datatable` and existing `AppShell` / `Breadcrumbs` / `Header`.
- After approve/reject, refresh the table.

## Phase 5.2 — `/transfers/[id]` page (show detail)
Files to create:
- Create `src/app/transfers/[id]/page.tsx`

Requirements:
- Detail of one transfer request.
- Show object info, from/to user names, status, reason, timestamps.
- If pending, show same Approve / Reject actions as inline buttons.

## Phase 5.3 — Dashboard KPIs
Modify:
- `src/app/dashboard/page.tsx`

Requirements:
- KPI cards (Mantine `Paper` grid):
  - Total Objects
  - Total Users
  - Pending Transfers
  - Recent Events (last 7 days)
- Query counts with `supabase.from(...).select("*", { count: "exact", head: true })`
- Keep existing card navigation to objects/users/events/transfers if any, otherwise add.

## Phase 5.4 — Event-seeding helper
Files to create/modify:
- Create `src/lib/supabase/events.ts` helper:
  - `logTransferApproved(objectId, fromUserId, toUserId)`
  - `logTransferRejected(objectId, fromUserId, toUserId, reason)`
- Both insert into `public.events` with required fields.
- Reuse this in transfers approve/reject handlers.

## Non-negotiables
- Do NOT modify `supabase/` migrations/schema tables other than DML in RPC calls.
- Do NOT modify `.env.local`.
- Keep Mantine + mantine-datatable + AppShell usage.
- Every page must still authenticate through `AuthGate`.
- After edits, run `npm run build` and stop only on 0 errors.

## Verification checklist
```bash
npm run build
```
Then:
- `/dashboard` shows 4 KPI cards
- `/transfers` loads even when empty
- `/transfers/[id]` loads with approve/reject when pending
- Approve button updates `transfer_requests.status` and inserts event row
- Reject button updates `transfer_requests.status` and inserts event row
- All other pages still load and build passes
