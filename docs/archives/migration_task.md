# migration_task.md — Remove Refine, keep Next.js + Mantine + Supabase

Status: Complete

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

## Result summary
- All 10 phases completed.
- Web app builds and deploys successfully.
- Transfers flow uses atomic database RPCs and a single display view.
