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

## 2026-07-29 — Shareable object information page

- Added and deployed
  `20260729214459_add_public_object_info.sql`.
- Added the tenant setting
  `show_object_info_without_authentication`, defaulting to `true`.
- Added the “Show Object Info Without Authentication” checkbox to
  `/settings/tenant`. Administrators can enable or disable anonymous object
  information for their tenant.
- Added the display-safe `object_info` RPC:
  - Returns the object ID, name, category, model, creation date, institution,
    current owner's display name, image path, description, and custom fields.
  - Truncates descriptions longer than 100 characters to 100 characters plus
    an ellipsis.
  - Returns public data only when the object's tenant has anonymous sharing
    enabled.
  - When public sharing is disabled, only an authenticated member of the same
    tenant can retrieve the record.
- Added a narrowly scoped object-image access function and Storage read policy
  so images on shareable records can be loaded from the private
  `object-images` bucket without exposing unrelated tenant images.
- Added `/object-info/[id]` as a standalone public-capable page. It displays
  institution and owner information, normal object fields, the image, and all
  JSON custom fields after the normal fields.
- Added `/object-info/*` to the authentication gate's public route handling.
  The database RPC remains the source of truth for whether the requested
  record is actually public.
- Added an “Object Info” link to the authenticated object detail page.
- Regenerated `src/types/database.ts` from the deployed schema.
- Verification completed:
  - An anonymous rollback-only database test received the object when sharing
    was enabled.
  - The returned 120-character test description was truncated to 101 display
    characters: 100 content characters and one ellipsis.
  - The same test returned the institution and JSON custom-field value.
  - An anonymous test returned zero rows after sharing was disabled.
  - TypeScript validation and the production build completed successfully,
    including the new dynamic `/object-info/[id]` route.
  - Supabase security advisors reported no errors. The warnings for the two
    anonymous display helper functions are intentional because their internal
    visibility checks implement this public-sharing feature.
- Marked the shareable object-information task complete in
  `docs/new_tasks_20260729.md`.

## 2026-07-29 — Custom object field edit stability

- Fixed custom field inputs on `/objects/[id]/edit` clearing immediately after
  each keystroke.
- The edit page's loading effect incorrectly depended on the Mantine form
  object. Because that object changes during renders, typing a custom value
  retriggered the database fetch and restored the previously saved JSON.
- Restricted the loading effect to the object ID, so the record is loaded when
  navigation selects an object but local form edits no longer cause a refetch.

## 2026-07-30 — Object-info QR destinations

- Changed the interactive 2D barcode payload from a padded object ID to the
  absolute `/object-info/[id]` URL.
- Changed the QR “Open” and “Copy link” actions to use the same object
  information page. Copied links are absolute and use the current deployment
  origin.
- Updated the downloadable PNG QR endpoint at `/api/qr/[id]` so its encoded
  destination is also `/object-info/[id]`, derived from the request origin
  instead of a hard-coded object-detail URL.
- Updated the barcode screen's explanatory text and destination details to
  describe the shareable object-information behavior.
- Marked the QR object-information destination task complete in
  `docs/new_tasks_20260729.md`.

## 2026-07-30 — Object Info event history

- Kept the authenticated `/objects/[id]` detail page in its original layout.
- Added `object_info_events`, a display-only RPC returning the latest 50 object
  events with event type, group, from/to display names, and timestamp.
- Applied the same tenant visibility rule as `object_info`: anonymous history
  is available only when the tenant enables unauthenticated Object Info;
  otherwise the caller must be an authenticated member of the object's tenant.
- Added an Event History card to `/object-info/[id]` below the object
  information card, including an explicit empty state.
- Deployed `20260730041056_add_object_info_event_history.sql` and regenerated
  the live Supabase TypeScript types.
- Verified with a rollback-only anonymous database test that a publicly
  shareable object returns its event type and group through the new RPC.
- TypeScript validation and the production build completed successfully.

## 2026-08-13 — Simple/Full editions and granular workspace roles

- Completed local implementation Phases 0-6 and local Phase 7 acceptance for
  the role-and-edition program. Existing workspaces were preserved as Full and
  no remote database was changed.
- Added durable Simple/Full editions, optional workspace kind, private/shared
  Simple visibility, protected product context, configurable entitlements, and
  database-enforced quotas.
- Backfilled existing workspaces without changing tenant data or existing
  identifiers.
- Added the Full Viewer role and granular permissions. Admin handles supported
  operations while governance, billing, Owner management, reports, and audit
  remain Owner-only.
- Added recoverable self-service Simple registration that transactionally
  creates one workspace, its Owner membership, and versioned predefined
  categories while preserving invitation-bound registration.
- Enforced immutable Simple categories, five-user and 100-object limits, and
  Full-only feature boundaries in the database.
- Implemented Simple private/shared access, Full Member assigned/group scope,
  Viewer assigned-only reads, and a limited holder lookup without directory
  exposure.
- Added Owner-facing edition and quota administration plus a locked, audited,
  idempotent AAL2 Platform Operator Simple-to-Full upgrade that preserves IDs.
- Added the fail-closed `SELF_SERVICE_REGISTRATION_ENABLED` flag. Disabling
  direct registration does not block invitation-bound registration.
- Verification applied migrations through
  `20260813231938_phase7_registration_rollout_hardening.sql`; all fourteen SQL
  suites, database lint, generated types, TypeScript, i18n parity (875
  messages), `git diff --check`, and the 40-route production build passed. Local
  browser acceptance covered both registration paths, Simple Owner/Member, and
  Full Owner/Admin/Member/Viewer sessions.

## 2026-08-14 — Phase 7 hosted staging and production rollout

- Restored the disposable free `ObjectTrack-stage` project and applied all nine
  migrations missing from it. All fourteen rollback-only SQL suites passed
  against hosted staging. Browser acceptance passed for Simple family
  provisioning and Member invitation acceptance.
- Confirmed the free hosted Auth email limit can return HTTP 429 during rapid
  signup testing. This was an email-capacity limit, not an invitation workflow
  failure; confirmation and acceptance passed when tested independently.
- Vercel automatically deployed the Phase 7 commits from `main` before the
  production database was migrated. Production `/admin` then reported the
  missing `current_tenant_product_context()` RPC.
- After explicit production approval, applied all eight staged migrations
  missing from `ObjectTrack2`. The existing tenant remained Full and active,
  permission and entitlement catalogs matched staging, and production-context
  RPC plus anonymous browser smoke tests passed.
- Enabled `SELF_SERVICE_REGISTRATION_ENABLED=true` in Vercel Production and
  redeployed the existing Phase 7 build. The production login registration link
  and direct `/register` Household/Small business form both passed browser smoke
  verification, with no new runtime errors during the observation check.

## 2026-08-14 — Production migration history repair

- Found that `ObjectTrack2` had registered the eight Phase 1-7 migrations under
  fresh version stamps (`20260814024312`-`20260814024409`) instead of their
  local filenames (`20260813193842`-`20260813231938`). A remote query confirmed
  the eight rows carried the same phase names in the same order, so the applied
  schema was correct and only the history table had diverged.
- Left uncorrected, the next `supabase db push` would have treated all eight
  local migrations as pending and attempted to re-apply them to production.
- Repaired the history with `supabase migration repair --linked`: the eight
  local versions marked `applied` and the eight re-stamped versions marked
  `reverted`. This wrote only to `supabase_migrations.schema_migrations`; no
  schema, policy, or tenant data changed.
- `supabase migration list --linked` now reports all 28 migrations with matching
  local and remote versions and nothing pending.
- The equivalent CLI check on `ObjectTrack-stage` could not run: it failed to
  provision its temporary `cli_login_postgres` login role with `permission
  denied to alter role`. The Supabase MCP connector reached the project
  instead and confirmed the same drift: nine migrations stamped
  `20260814021536`-`20260814021614` and named with a `stage_` prefix
  (`stage_invitation_first_registration`, `stage_phase1_*` through
  `stage_phase7_*`) stand in for the local `20260805052328` and Phase 1-7
  files. Staging was left unrepaired: it is disposable and not the linked
  project, so no `db push` targets it.
- The prefixed staging names indicate the root cause of both divergences:
  the rollout applied purpose-built copies of the migrations rather than the
  original files, so each copy received a fresh version stamp.
- Production security advisors reported no ERROR-level findings. The 57
  `SECURITY DEFINER` warnings cover the intended RPC surface, including the
  five deliberately anon-executable functions (`object_info`,
  `object_info_events`, `can_view_object_image`, `invitation_link_status`,
  `invitation_registration_context`). `private.edition_entitlements` having
  RLS enabled with no policy is the intended deny-all posture for a
  non-API-exposed schema.
- Supabase Auth leaked-password protection (HaveIBeenPwned) cannot currently be
  enabled: the `MicroMacro` organization is on the `free` plan and the feature
  requires Pro or above. The advisor warning is therefore an accepted, plan-
  gated item rather than a pending fix. Password length and character
  requirements remain available on the free plan if stronger password policy is
  wanted without upgrading.

## 2026-08-14 — Narrow the Owner/Admin permission gap

- Moved `tenant.groups.manage` and `tenant.reports.generate` from Owner to Admin
  in `20260815023231_admin_operational_permissions.sql`. Both are routine
  operations rather than governance.
- Owner keeps a four-permission governance core: `tenant.settings.update`,
  `tenant.billing.manage`, `tenant.owners.manage`, and `tenant.audit.read`.
  Owner-role management stays Owner-only to preserve the last-authority
  guarantee, and audit stays Owner-only so no actor solely controls the record
  of its own actions.
- The migration is additive and idempotent: two rows in
  `private.role_permissions` plus three `ALTER POLICY ... RENAME` statements on
  `public.groups`, whose policies were already permission-driven but still named
  "Tenant owners …". No schema change, no function change, no RPC signature
  change, so the Flutter client contract is unaffected.
- Application changes were the `permissions.ts` role table and one hardcoded
  `tenantRole === "owner"` check for the groups navigation item in
  `Sidebar.tsx`. The reports surfaces were already permission-driven and needed
  no change.
- Entitlement gating is untouched. `has_permission()` evaluates
  `has_tenant_entitlement()` independently of role, so Simple workspaces still
  reach neither groups nor reports.
- Added `verify_admin_operational_permissions.sql`, covering the new Admin
  permissions, the retained Owner governance core, Member exclusion, an
  end-to-end Admin group insert through RLS, and a Simple-edition Owner that
  still cannot reach either permission.
- Three existing suites encoded the old contract and were updated as intentional
  changes rather than regressions: `verify_phase2_granular_roles.sql`,
  `verify_role_edition_baseline.sql`, and `verify_tenant_authorization.sql`
  (which also asserted that an Admin group insert must be denied).
- Verification: clean local `db reset` applied the full chain including the new
  migration; all fifteen rollback-only suites passed; `db lint` reported no
  schema errors; `db advisors --level warn` reported no issues; regenerated
  types differed only by the generator's trailing blank line; `npx tsc
  --noEmit`, `npm run i18n:check` (875 messages), and the 40-route production
  build passed. No new user-facing strings were required.
- Applied to `ObjectTrack2` production via `supabase db push --linked` after a
  dry run confirmed exactly one pending migration; it registered under its own
  filename, leaving 29 migrations with zero local/remote mismatches. Applied to
  `ObjectTrack-stage` through the Supabase MCP connector, because the CLI still
  cannot provision its `cli_login_postgres` login role there. Both remotes were
  verified to show `tenant.groups.manage` and `tenant.reports.generate` on admin
  and owner, `tenant.audit.read` and `tenant.owners.manage` on owner only, and
  the three renamed `Tenant managers ... groups` policies.

## 2026-08-15 — Billing Phase 1: commercial plan catalog

- Added `private.subscription_plans` (`free`, `hobby`, `business`) and
  `public.tenant.plan_code`, introducing a commercial axis above the existing
  edition capability model. A plan resolves to an edition; `edition` itself is
  unchanged and still decides which roles exist and how visibility behaves.
- Repointed all eight entitlement consumers from
  `private.edition_entitlements` (keyed by edition) to a new per-tenant view
  `private.tenant_entitlements` (keyed by tenant): `has_tenant_entitlement`,
  `current_tenant_product_context`, `tenant_admin_profile`,
  `enforce_object_quota`, `enforce_profile_quota`, `enforce_invitation_quota`,
  `current_tenant_usage`, and `platform_tenant_product_context`. Only the join
  line changed in each; no function signature was touched, so the Flutter RPC
  contract is unaffected.
- `private.sync_tenant_plan_edition()` keeps the two columns in step in both
  directions: changing the plan derives the edition, and changing the edition
  derives that edition's default plan. A verify assertion proves no workspace
  can hold a plan and edition that disagree.
- Grandfathering per the 2026-08-15 decision: existing `simple` workspaces
  backfilled to `hobby`, which carries the same 5-user / 100-object allowance
  simple had. Existing `full` workspaces backfilled to `business`. No existing
  workspace loses any capability.
- `free` is the default plan for the simple edition, so **new** self-service
  signups get 10 objects / 2 users. This is the only intentional behaviour
  change and it applies only to workspaces created after this migration.
- Extended the platform-field guard so `plan_code` is operator-managed like
  `edition`. This exposed a trap: the trigger calls
  `private.enforce_tenant_platform_fields()`, added in Phase 3 of the role work
  with a self-provisioning carve-out, while an older unused
  `public.enforce_tenant_platform_fields()` still exists. The first attempt
  patched the public copy and a workspace Owner was consequently able to change
  its own `plan_code`. The new verify suite caught it before it left the
  machine; the private copy is now the one patched.
- Added `verify_billing_plan_catalog.sql`: catalog shape, plan/edition
  bidirectional sync, the free 10-object ceiling, grandfathered hobby limits,
  Simple plans holding no Full features, and Owner-attempted plan escalation.
- Updated four existing suites that assumed simple means 5 users / 100 objects.
  `verify_phase5_object_visibility.sql` and `verify_phase6_edition_upgrade.sql`
  now pin `hobby` explicitly, since they need more members than free allows;
  `verify_phase4_simple_entitlements_and_quotas.sql` shrinks the free plan
  instead of the retired entitlement table; `verify_phase1_edition_metadata.sql`
  asserts the new free defaults.
- `private.edition_entitlements` is intentionally retained and unread. It is
  dropped in a later phase once production confirms nothing depends on it.
- Verification: clean local reset; all sixteen suites pass; `db lint` and
  `db advisors --level warn` clean; regenerated types add only `plan_code`;
  `npx tsc --noEmit`, `npm run i18n:check` (875 messages), and the 40-route
  production build pass.
- Not applied to any remote. No application or UI change yet.

## 2026-08-15 — Billing Phase 2: plan administration without payment

- Added `set_tenant_plan(tenant_id, plan_code)`: AAL2 platform-operator only,
  advisory-locked, idempotent, and audited as `tenant.plan.changed` with the
  from/to plan and edition recorded. Unknown or inactive plans and missing
  tenants are rejected.
- `upgrade_tenant_to_full` required no change. It still sets `edition = 'full'`
  and `private.sync_tenant_plan_edition()` derives the business plan, so its
  signature, return shape, and audit action are untouched and the Flutter
  client and ops flow keep working.
- Added `current_tenant_plan()`, returning plan code, edition, limits, and
  current usage. It returns no rows unless the caller holds the Owner-only
  `tenant.billing.manage`, so the permission is the gate rather than the UI.
- Added `/admin/billing`, an Owner-facing read-only page showing the plan name
  and usage meters for objects and members, with strings in both catalogues
  (now 889 messages). Plan codes are stored untranslated and translated at
  render; an unrecognised code falls back to the raw value rather than
  throwing, so adding a plan in the database cannot break the page.
- Added `BILLING_ENABLED` in `src/lib/billing/flags.ts`, fail-closed like
  `SELF_SERVICE_REGISTRATION_ENABLED`. It gates commerce only. Entitlements
  resolve from the stored plan and never consult the flag, so disabling it can
  never strip a paying workspace of what it paid for.
- Added `verify_billing_plan_administration.sql`: an Owner cannot change its own
  plan, an aal1 operator cannot either, an AAL2 operator can and repeating it is
  a no-op leaving exactly one audit row, unknown plans and missing tenants are
  rejected, a downgrade to free preserves all twelve existing objects while
  blocking the thirteenth, and a Member cannot read the plan.
- Verification: clean local reset; all seventeen suites pass; `db lint` and
  `db advisors --level warn` clean; `npx tsc --noEmit`, `npm run i18n:check`
  (889 messages), and the 41-route production build pass.
- Not applied to any remote. Phase 3 onward is blocked on a Stripe account,
  price identifiers, and the open pricing, currency, tax, and trial decisions.

## 2026-08-15 — Billing Phase 3: Stripe integration

- Pricing decided: Hobby $5/month and $50/year, Business $20/month and
  $200/year, USD, annual at ten times monthly (two months free), no trial, and
  Stripe Tax off for now.
- Created the products and four recurring prices in the test-mode
  `Metavues Tech Inc.` account (`acct_1AyxKGExuGi7DZSF`) through the Stripe
  connector. Each price carries `lookup_key` plus `plan_code` and `interval`
  metadata so the mapping never depends on a hardcoded identifier.
- Added `private.plan_prices` keyed by `(plan_code, billing_interval)`, which
  the monthly-plus-annual decision requires; price identifiers live in the
  catalog rather than on the plan row. Free has no Stripe price: it is the
  absence of a subscription.
- Added `private.tenant_billing` (Stripe identifiers and subscription state, no
  card data ever) and `private.billing_events`, keyed by Stripe event ID as an
  idempotency and replay ledger.
- Implemented decision 5: the webhook route verifies the Stripe signature, then
  calls `apply_stripe_subscription_event(secret, payload)`. The shared secret is
  stored only as a SHA-256 digest via `set_billing_webhook_secret()`, which is
  AAL2-operator-only and rejects secrets under 32 characters. The service role
  key stays out of application code entirely.
- The plan is resolved from the Stripe price through `plan_prices`, never from
  the payload, so an unknown price grants `free` rather than anything paid.
  Status mapping: `active`/`trialing`/`past_due` hold the purchased plan;
  anything terminal falls back to `free`.
- Added `billing_checkout_context()` so the checkout and portal actions can
  reach the price catalog and Stripe customer without granting `authenticated`
  read access to `private`. The workspace is derived from the caller inside the
  database and never supplied by the client.
- Application layer: installed `stripe@22`, added a lazy server client,
  `/api/billing/webhook`, Checkout and Customer Portal server actions, and plan
  buttons on `/admin/billing` that render only when `BILLING_ENABLED` is true.
  Strings in both catalogues (894 messages).
- **Added `/api/billing/webhook` to the middleware public allowlist.** Now that
  the middleware actually runs, an unauthenticated Stripe POST would otherwise
  have been redirected to `/login` and never reached the route. The route is
  authenticated by Stripe signature rather than by cookie.
- Two bugs caught by the new suite before leaving the machine: `RETURNS TABLE`
  declared `tenant_id` and `plan_code` as plpgsql variables that collided with
  the identically named columns in `ON CONFLICT` and `UPDATE` targets, so the
  output columns were renamed; and the suite itself twice read `private` tables
  while holding the `anon` or `authenticated` role, which correctly failed.
- Added `verify_billing_webhook_ledger.sql`: aal1 operator refused, weak secret
  refused, secret stored only as a digest, wrong secret refused with no plan
  change, a valid event upgrading the workspace and recording subscription
  state, redelivery applying nothing and leaving one audit row, `past_due`
  holding the plan, cancellation falling back to free while preserving all
  fifteen objects and blocking the sixteenth, an unknown price granting only
  free, and a malformed event rejected.
- Verification: clean local reset; all eighteen suites pass; `db lint` and
  `db advisors --level warn` clean; `npx tsc --noEmit`, `npm run i18n:check`
  (894 messages), and the 41-route production build pass.
- Not applied to any remote, and not yet exercised against a real Stripe
  payload. That needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
  `BILLING_WEBHOOK_RPC_SECRET` in the environment plus the Stripe CLI, none of
  which the MCP connector can provide to the running application.

## 2026-08-15 — Billing Phase 4: lifecycle, dunning, and downgrade safety

- Implemented the 30-day grace window from decision 4. Entering `past_due`
  opens it and records `grace_started_at`/`grace_until`; recovering to `active`
  or `trialing` closes it. A repeated `payment_failed` keeps the original start
  date, so a customer cannot extend the deadline indefinitely by failing again.
  A verify case backdates a window and asserts the deadline does not move.
- Added `private.billing_dunning_log`, keyed by workspace, grace window, and
  stage, so a reminder is never sent twice for the same window. Stages are day
  0, 7, 21, and 29 per decision 4.
- Added `billing_dunning_due()` and `record_billing_dunning_sent()`, plus
  `expire_billing_grace()` which downgrades expired windows, audits the change
  with `source: grace_expired`, and is idempotent.
- All three are granted to `service_role` only. A verify case asserts that even
  an AAL2 platform operator cannot run the sweep or read the dunning queue
  directly.
- Added `scripts/process-billing-lifecycle.mjs` and `npm run billing:worker`,
  mirroring the report worker as a one-shot scheduled script. It sends reminders
  first and expires grace second, so the day-29 notice always precedes the
  day-30 downgrade. A reminder is recorded only after Resend accepts it, so a
  transient delivery failure retries on the next run instead of being lost.
- Added `current_tenant_billing_status()` and Owner-facing banners for the
  over-quota and payment-failed states, in both catalogues (898 messages). Both
  say plainly that nothing is deleted, because decision 3 makes that true and
  the wording is what stops a downgrade reading as data loss.
- Added `verify_billing_downgrade_safety.sql`. Its central case puts 40 objects
  in a Business workspace, expires the grace window, and asserts all 40 survive
  the downgrade to a 10-object plan, remain readable by name, and that only
  creation is blocked.
- Verification: clean local reset; all nineteen suites pass; `db lint` and
  `db advisors --level warn` clean; `npx tsc --noEmit`, `npm run i18n:check`
  (898 messages), and the 41-route production build pass.
- Two operational prerequisites remain and neither is code: the worker must be
  scheduled daily, and Stripe's own retry settings must be extended so it does
  not cancel or mark a subscription unpaid before our day 30.

## 2026-08-15 — Activate the edge middleware, which had never run

- Found that the edge middleware had never executed in production. Unauthenticated
  requests to `/admin`, `/dashboard`, `/objects`, `/events`, `/transfers`,
  `/settings`, and `/ops` all returned HTTP 200 with `x-matched-path` set and no
  `location` header, and an unknown path returned 404 rather than redirecting.
- Cause: the App Router lives under `src/`, so Next.js expects
  `src/middleware.ts`. The file sat at the repository root, where it is silently
  ignored. It compiled, type-checked, and built cleanly the whole time.
  `middleware-manifest.json` listed no entries and `npm run build` printed no
  `ƒ Middleware` line. The file dated from 2026-07-21, so the layer had been
  inert since it was written.
- No data was exposed. The database remained authoritative throughout, and
  server components and actions still called `requireTenantAdminAccess` and
  `requirePlatformAccess`, so protected pages returned an empty shell while the
  data fetch threw. What was missing was the outermost layer only: edge session
  refresh, the public-route allowlist, onboarding and unauthorized redirects,
  and the coarse per-path permission gate.
- The 2026-08-14 record that unauthenticated `/admin` "redirects to `/login`"
  was a correct browser observation attributed to the wrong layer. The
  client-side `AuthGate` produced the same visible outcome.
- Fixed by `git mv middleware.ts src/middleware.ts`. No logic change. The build
  now reports `ƒ Middleware 76.2 kB` and the manifest lists one entry.
- Verified against the production build served locally, anonymous only:
  `/admin`, `/dashboard`, `/objects`, `/events`, `/transfers`, `/settings`,
  `/ops`, `/groups`, `/users`, `/unauthorized`, and an unknown path each return
  a single 307 to `/login` and settle there in exactly one hop, with no redirect
  loops. `/login`, `/register`, `/forgot-password`, `/object-info/1`, and
  `/invitations/accept` return 200 unredirected. `/api/qr/1` passes through to
  its route handler, and `_next/static` chunks are unaffected.
- Authenticated behaviour is not verified here: creating a session would have
  required credentials against the production Supabase project. The onboarding,
  unauthorized, and per-path permission branches need a browser pass.
- Known rough edge: unauthenticated calls to `/api/admin/reports` now receive a
  307 redirect to `/login` rather than a JSON 401. Harmless for the app, which
  only calls it with a session, but worth tightening if that route ever gets an
  external caller.
- Enabling this layer adds three Supabase calls per matched request through
  `getAuthenticatedAccessContext`, including RSC prefetches. Worth watching on
  the free plan.
- Deployed as commit `9f7c318` in `dpl_6D7Tv3PwMNnPTzmpSAtbJzwCc3pB`; the
  middleware began serving roughly 30 seconds after the build started.
  Production now matches the local results exactly: eleven protected paths each
  return a single 307 to `/login` and settle in one hop, and the four public
  paths return 200 unredirected.
- The Vercel runtime-error table corroborates the diagnosis. An
  `Error: Authentication is required.` group on `/admin`, first seen
  2026-07-31, records the old behaviour: the request reached the server
  component, which threw while the page still returned a 200 shell. Its final
  occurrences are attributed to `dpl_44aurmddmxzvJzM53kXopU1cbVq2`, the last
  pre-fix deployment, and came from this investigation's own probes. With the
  middleware live those requests no longer reach the server component.
