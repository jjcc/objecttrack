# migration_task.md — Remove Refine, keep Next.js + Mantine + Supabase

## Goal
Remove `@refinedev/*` from `/home/jchen/workspaces/objecttrack` and rebuild admin pages as **plain Next.js App Router + Mantine + Supabase SDK**.
Keep auth middleware, admin-only gating, and existing Supabase schema/RLS intact.
Add the missing **transfer-request approval flow** page.

## Non-negotiables
- Do NOT change `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts`.
- Do NOT change `supabase/` schema/migrations.
- Do NOT break deployed site at `https://objecttrack.vercel.app/`.
- Every page must still authenticate through `AuthGate`.
- Keep Mantine AppShell, Breadcrumbs, theme.
- After edits, run `npm run build` and confirm 0 errors before stopping.

---

## Phase 1 — Save rollback point
1. `git checkout -b remove-refine`
2. `git add -A && git commit -m "chore: pre-refine-removal snapshot"`

## Phase 2 — Remove Refine packages
1. `npm uninstall @refinedev/core @refinedev/mantine @refinedev/nextjs-router @refinedev/supabase`
2. Delete `src/lib/refine/` (`authProvider.ts`, `dataProvider.ts`)
3. Keep `/home/jchen/workspaces/objecttrack/src/lib/supabase/client.ts`, `server.ts`, `middleware.ts`.
4. Update `src/app/layout.tsx`:
   - Remove `Refine`, `routerProvider`, `dataProvider`, `authProvider` import/usage.
   - Keep MantineProvider, Notifications, Suspense, AuthGate.
   - If Refine provided a sidebar/layout, preserve it via AppShell.
5. Run `npm run build`. Fix compile errors until clean.

## Phase 3 — Rewire auth
1. Verify login still works via `AuthGate` + `/api/auth/...`.
2. Confirm admin gating: non-admin → `/unauthorized`.
3. Remove any refine-specific `useIsAuthenticated` usage inside `AuthGate` or page components; use `useAuth` checks provided by middleware instead or keep `AuthGate` if already self-contained.
4. Profile display: keep `UserDisplay` component working.

## Phase 4 — Rebuild each page with plain Supabase queries
For each page below, replace Refine hooks with direct Supabase queries using the shared `getSupabaseClient()` from `src/lib/supabase/client.ts`.

### 4.1 Objects
Files:
- `src/app/objects/page.tsx`
- `src/app/objects/create/page.tsx`
- `src/app/objects/[id]/page.tsx`
- `src/app/objects/[id]/edit/page.tsx`
- `src/components/shared/ObjectBarcodeGenerator.tsx`
- `src/components/shared/ObjectQrCode.tsx`

Requirements:
- List objects with columns: id, name, description, category, qr code, actions.
- Create/edit forms: name, description, category_id dropdown, model.
- Reuse existing ObjectBarcodeGenerator / ObjectQrCode.
- Use `supabase.from("objects").select("*, categories(name)")`.
- Client-side form state with Mantine `@mantine/form` if already present; otherwise plain `useState`.

### 4.2 Users
Files:
- `src/app/users/page.tsx`
- `src/app/users/create/page.tsx`
- `src/app/users/[id]/page.tsx`
- `src/app/users/[id]/edit/page.tsx`

Requirements:
- Read user_profiles joined to auth.users.
- Create form: first_name, last_name, email, phone, group_id dropdown.
- Edit: same fields.
- Email uniqueness handled client-side or via Postgres unique constraint.
- Do NOT expose password reset flows beyond existing `/forgot-password`.

### 4.3 Groups
Files:
- `src/app/groups/page.tsx`
- `src/app/groups/create/page.tsx`
- `src/app/groups/[id]/page.tsx`
- `src/app/groups/[id]/edit/page.tsx`

Requirements:
- Read/write `groups` table.
- List should show member count derived from `user_profiles.group_id`.

### 4.4 Events / Audit Log
Files:
- `src/app/events/page.tsx`
- `src/app/events/create/page.tsx`

Requirements:
- Remove every `useTable`, `useList`, `CrudFilter` from `@refinedev/core`.
- Query `events` with joins: `objects(name)`, `event_types(label)`, `groups(title)`, `from:user_profiles`, `to:user_profiles`.
- Preserve existing filters: event_type_id, group_id, date_from, date_to.
- Keep Mantine `DataTable` from `mantine-datatable`.
- Keep `EventTypeBadge` component.

### 4.5 Settings (read-only lookup seed page)
Files:
- `src/app/settings/page.tsx`

Requirements:
- Show `categories` and `event_types` counts or tables.
- Keep simple; no inline CRUD necessary.

## Phase 5 — Add transfer approval flow
The schema already has:
- `transfer_requests` table defined in project plan
- `admin_users`, `user_profiles`, `groups`, `objects`

**New files/modifications**:
1. Create `src/app/transfers/page.tsx` (admin only)
   - Query `transfer_requests` joined to `objects(name)`, `from_user:user_profiles`, `to_user:user_profiles`.
   - Columns: id, object, from, to, status, requested_at, actions.
   - Actions: Approve / Reject buttons for `pending` items.
   - Approve runs:
     ```ts
     await supabase.rpc("approve_transfer", { p_request_id: id })
     ```
2. Create `src/lib/supabase/transfers.ts` helper with:
   - `listPendingTransfers()`
   - `approveTransfer(requestId)`
   - `rejectTransfer(requestId, reason)`
3. Create RPC `approve_transfer()` in database if it does not exist via existing `002_rls_policies.sql` or add migration `003_transfer_flow.sql`.
4. Register `/transfers` route in `AppShell` sidebar or breadcrumb.

## Phase 6 — QR / Barcode
Files:
- `src/app/barcode/page.tsx`
- `src/components/shared/ObjectBarcodeGenerator.tsx`

Requirements:
- Input: object id or name search with Supabase dropdown.
- Generate QR from object qr_code field or render QR from `qrcode.react`.
- Keep printable layout.
- Ensure barcode label includes object name.

## Phase 7 — Dashboard
File: `src/app/dashboard/page.tsx`

Requirements:
- KPI cards: total objects, total users, pending transfers, recent events (last 7 days).
- Query counts from Supabase.
- Keep routing to objects/users/events/transfers.

## Phase 8 — Flutter client todo
Do NOT build Flutter app in this migration. Add README placeholder in `flutter/` directory:
```
Future: Flutter app for QR scan + transfer request flow.
Stack: supabase_flutter, mobile_scanner, qr_flutter
Status: Pending
```

## Phase 9 — Verification checklist
Run all of these and stop on failure:
```bash
npm run build
```
Then:
- `/login` → load
- `/register` → load
- `/forgot-password` → load
- `/dashboard` → admin only
- `/objects` → list/create/edit
- `/users` → list/create/edit
- `/groups` → list/create/edit
- `/events` → list/create, filters work
- `/settings` → counts display
- `/transfers` → list + approve/reject works
- `/barcode` → QR renders

If anything fails, revert to the commit from Phase 1 and report back.

## Phase 10 — Cleanup
1. Remove leftover `Refine` references in imports/styles.
2. Run `npm prune` if needed.
3. Ensure `.env.local` unchanged and NOT committed.
4. `git add -A && git commit -m "feat: remove refine, add transfer approval flow"`

## Notes
- Do NOT introduce new UI libraries beyond Mantine + mantine-datatable + qrcode.react.
- Keep file structure under `src/app/` and `src/components/`.
- Preserve TyperScript strictness already enabled.
