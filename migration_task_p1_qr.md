# migration_task_p1_qr.md — Dynamic QR API

## Goal
Add a server-side QR generation API so any phone/tablet can open an image URL and scan it. Do NOT store QR images in Storage; generate on demand.

## Database
- `objects` table does NOT have a `qr_code` column.
- Use `objects.id` and `objects.name` to form the QR payload, e.g. `/objects/{id}` or `objecttrack://object/{id}`.

## Packages
- Install `qrcode` if not present. Keep `qrcode.react` for existing client usage.

## Phase 1 — Create `/api/qr/[id]` route
Files to create:
- `src/app/api/qr/[id]/route.ts`

Requirements:
- Route handler reads `objectId` from params.
- Query `public.objects(id, name)` for that id.
- If found, generate QR image (PNG) encoding one of:
  - `https://objecttrack.vercel.app/objects/{id}` (preferred for web)
  - fallback: `objecttrack://object/{id}`
- Return image with `content-type: image/png`.
- If not found, return `404` with plain text "Object not found".
- Cache control: add `Cache-Control: public, max-age=86400` so browsers/CDN cache QR images for 24h.

## Phase 2 — Update QR component to prefer API link
Files to modify:
- `src/components/shared/ObjectQrCode.tsx`

Requirements:
- In addition to client-side QR display, show a "Share / Print" link to `/api/qr/{id}`.
- Keep existing React QR preview.
- Add a copy-link button for the API URL.

## Phase 3 — Add `/scan` conceptual page (optional stub)
Files to create:
- `src/app/scan/page.tsx`

Requirements:
- Stub page with a message: "Use mobile browser to open an object's QR image, or use the device camera to scan the API link."
- Do NOT implement camera scanning yet; that belongs to the future Flutter app or a PWA using `html5-qrcode`.

## Non-negotiables
- Do NOT modify `supabase/` schema.
- Do NOT modify `.env.local`.
- Do NOT break existing `/barcode` page.
- Run `npm run build` and confirm 0 errors.

## Verification checklist
```bash
npm run build
```
Then:
- `/api/qr/1` returns a PNG when object 1 exists
- `/api/qr/9999` returns 404 when missing
- `/barcode` still loads and can select an object
- `/scan` loads as a stub
