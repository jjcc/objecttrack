# Development Log

## 2026-07-23 — Transfer approval authorization and ownership semantics

### Confirmed decisions

- The normal transfer use case is that a requester asks to obtain ownership of
  an object.
- The recipient of that request decides whether to approve or reject it.
- Approval means that ownership of the object is assigned to the requester.
- An administrator has the highest privilege and may approve or reject a
  transfer request on the recipient's behalf.
- Approval and rejection audit records must identify the user who performed the
  action, whether that actor was the recipient or an administrator.
- The authorization rule should be implemented once in the database
  approval/rejection RPCs and shared by the web and mobile clients.

### Schema mapping to verify before implementation

The existing column names do not make the business roles unambiguous. The
intended roles are:

- `requester_user_id`: the user requesting ownership and the new owner after
  approval.
- `recipient_user_id`: the current owner who normally approves or rejects the
  request.

If the existing `from_user_id` and `to_user_id` columns are retained, their
mapping to these roles must be explicitly confirmed before changing the RPCs.
The current mobile `approve_transfer` implementation assigns ownership to
`to_user_id`, which may be the reverse of the business flow described above.

### Implementation implications

- Approval must atomically authorize the actor, lock and validate the pending
  request and object, assign ownership to the requester, update the request
  status, and insert the audit event.
- Rejection must use the same recipient-or-administrator authorization model
  and create its audit event in the same transaction as the status update.
- Audit metadata should include the transfer request ID, acting user ID, and
  whether the action was performed as the recipient or as an administrator.

## 2026-07-23 — Transfer workflow remediation

- Confirmed the transfer field contract:
  - `from_user_id` is the requester and future owner.
  - `to_user_id` is the current owner and normal approver.
- Added transactional `approve_transfer` and `reject_transfer` database RPCs.
  Both the recipient and an administrator may act, and the request, object, and
  audit event changes commit or roll back together.
- Audit events use the configured `transfer` event type and record
  `transfer_request_id`, `action`, `acted_by`, and `actor_role`.
- Direct Data API inserts, updates, and deletes on `transfer_requests` were
  revoked. Transfer mutations must use the RPC contract.
- The web transfer list and detail pages now resolve profile names through the
  restricted `profile_names` RPC and no longer use invalid PostgREST profile
  relationships.
- The web repository's `supabase/migrations` directory is the authoritative
  schema history for this workflow. Database types are generated from the
  connected live project.
- Added `supabase/verify_transfer_workflow.sql`, a rollback-only database
  integration verification covering recipient approval, administrator
  approval, unauthorized approval, repeated approval, rejection, ownership,
  status, and audit metadata.

## 2026-07-29 — Transfer display deployment reconciliation

- Diagnosed the deployed Transfers-page loading failure from live Supabase API
  logs. The frontend request to `transfer_requests_display` returned HTTP 404
  because the corresponding database migration had not been applied.
- Applied the two pending migrations to live Supabase:
  - `20260729001241_align_transfer_requests_id_identity_to_by_default.sql`
  - `20260729010000_add_transfer_requests_display_view.sql`
- Verified that local and remote migration histories match.
- Verified that `transfer_requests_display` exists and can be queried by an
  authenticated administrator.

## 2026-07-29 — Self-service profile management

- Enabled the Profile entry in the top-right user menu and linked it to the new
  `/profile` route.
- Added a profile form matching the `user_profiles` schema:
  - Editable personal fields: first name, last name, contact email, title,
    phone, WeChat ID, city, province/state, country, and zip/postal code.
  - Read-only system fields: account ID, authentication email, group, and
    profile creation time.
- Added and deployed
  `20260729145834_add_self_profile_update_rpc.sql`.
- Added the authenticated `update_own_profile` RPC. It updates only the
  caller's personal fields and cannot change identity, group membership, or
  creation metadata.
- Regenerated the Supabase TypeScript database types from the live schema.
- Verified:
  - Anonymous callers cannot execute the profile RPC.
  - Authenticated callers can execute it.
  - A rollback-only live test confirmed protected fields remain unchanged.
  - TypeScript validation and the production build completed successfully.

## 2026-07-29 — Settings navigation and route split

- Replaced the combined Categories/Event Types tables on `/settings` with two
  navigation entries:
  - Categories
  - Event Types
- Added `/settings/categories` with the existing category list, create, edit,
  and delete functionality.
- Added `/settings/event-types` with the existing event-type list, create,
  edit, and delete functionality.
- Added explicit loading, empty, error, save, and delete-in-progress states to
  both management pages.
- Added accessible labels to edit and delete action buttons.
- Verified authenticated live reads for both underlying Supabase tables.
- Verified TypeScript and the production build; all 24 application routes were
  generated successfully.
- Marked both July 29 tasks complete in `docs/new_tasks_20260729.md`.

## 2026-07-29 — Tenant architecture, object images, and custom fields

- Added and deployed the tenant/data migrations:
  - `20260729170703_add_tenants_object_images_and_custom_fields.sql`
  - `20260729171116_harden_tenant_isolation.sql`
  - `20260729171348_allow_trusted_tenant_maintenance.sql`
- Added the `tenant` table with institution name, description, address,
  contact, phone, email, website, and JSON social-media fields.
- Created a default tenant and assigned every existing profile, group,
  category, event type, and object to it so the deployed data remains usable.
- Added tenant IDs and indexes to tenant-owned records. Insert triggers assign
  the acting user's tenant and reject cross-tenant Data API writes.
- Replaced legacy global RLS access on profiles, groups, categories, event
  types, objects, events, and transfer requests with tenant-scoped policies.
- Changed `transfer_requests_display` to a security-invoker view so its base
  table RLS policies are honored.
- Added `/settings/tenant` for editing the current tenant's institution and
  contact information, plus an Institution entry on `/settings`.
- Added an `image` path field to objects and a private `object-images` Storage
  bucket. The bucket enforces a 2 MB maximum and accepts JPEG, PNG, WebP, and
  GIF files. Storage policies restrict reads and writes to the current tenant.
- Added image selection and client-side 2 MB validation to object create/edit
  forms. Images use unique paths, and object details load them with temporary
  signed URLs.
- Added the JSONB `objects.extra` field and a one-schema-per-tenant
  `object_custom_schemas` table.
- Added `/settings/custom-fields`, where administrators can add unique field
  names and optional notes/comments, and linked it from `/settings`.
- Object create/edit forms load the current tenant's custom schema, append its
  fields to the normal form, and store entered values in `objects.extra`.
  Object details display the saved custom values.
- Regenerated `src/types/database.ts` from the deployed Supabase schema.
- Verification completed:
  - Applied all three migrations to the linked project and confirmed local and
    remote migration histories.
  - Confirmed all existing tenant-owned records have a tenant assignment.
  - Confirmed the private image bucket has the 2,097,152-byte limit.
  - Confirmed the object `image` and `extra` columns, tenant policies, and
    security-invoker transfer view exist.
  - Ran a rollback-only live SQL test that created a tenant, its custom schema,
    and an object with custom JSON successfully.
  - Supabase security advisors report no errors introduced by this work.
  - TypeScript validation and the production build completed successfully; all
    26 application pages were generated.
- Marked the tenant, object image, and custom-object-field tasks complete in
  `docs/new_tasks_20260729.md`.
