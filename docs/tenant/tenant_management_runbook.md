# Tenant Management Operations Runbook

This runbook covers the shared-backend tenant administration and the separate
/ops control-plane routes. Production changes must use protected application
services or reviewed migrations; do not edit tenant-owned rows directly.

## Access model

- Tenant administrators and owners use /admin for their current tenant.
- Platform operators use /ops. An active platform-operator grant and a
  TOTP-verified AAL2 session are both required.
- Operators who have not enrolled or verified TOTP are redirected to /mfa.
- Platform permissions remain separate from tenant permissions. An operator
  does not receive tenant membership or unrestricted tenant data access.
- Review operator assignments quarterly. Disable access immediately when it is
  no longer required.

## Editions, roles, and registration

- Simple workspaces support Owner and Member roles, predefined categories, and
  private/shared member visibility. Their user and object limits come from the
  workspace's plan, not from the edition: `free` allows 2 members and 10
  objects, `hobby` allows 5 and 100. See the Billing operations section.
- Full workspaces support Owner, Admin, Member, and Viewer roles plus entitled
  administration features. Admin is operational and covers groups and reports;
  workspace settings, billing, Owner management, and audit remain Owner-only.
- `workspace_kind` controls onboarding wording only and never authorization.
- Direct self-registration is controlled by
  `SELF_SERVICE_REGISTRATION_ENABLED`. It defaults to disabled when absent.
  Invitation-bound registration remains available when direct registration is
  disabled.
- Keep the flag disabled until schema, application, callback allowlists, email
  confirmation, and both registration paths pass acceptance in the target
  environment.

## Upgrade a Simple workspace

1. Sign in with an authorized AAL2 Platform Operator session.
2. Open the workspace under `/ops/tenants/[id]` and confirm its identity,
   current edition, membership, and quota usage.
3. Select the Simple-to-Full upgrade and submit once.
4. Confirm the workspace reports Full entitlements immediately.
5. Verify the dedicated `tenant.edition.upgraded` audit event.
6. Confirm existing users, roles, objects, categories, events, transfers,
   invitations, images, public links, and identifiers are unchanged.

The upgrade is locked, idempotent, and in-place. Repeated requests and existing
Full workspaces are no-ops. There is no automated downgrade. Never change the
edition directly or delete Full-only data to simulate a downgrade; follow the
validation requirements in
[role_implementation_plan.md](../roles/role_implementation_plan.md#future-guarded-downgrade-requirements).

## Provision a tenant

1. Sign in with an authorized AAL2 platform-operator session.
2. Open /ops/tenants/new.
3. Enter tenant profile data and the exact initial-owner email.
4. Submit once. The provisioning service creates the tenant, applies the
   current defaults version, creates the initial-owner work item, and writes
   the audit event in one transaction.
5. Confirm the tenant appears in /ops, its defaults version is correct, and the
   initial-owner work item is pending.
6. Investigate any failed work item before retrying. Never partially recreate a
   tenant by hand.

## Suspend or reactivate a tenant

1. Open the tenant in /ops.
2. Confirm tenant identity and current status.
3. Enter a specific operational reason and confirm the status change.
4. Verify the tenant.suspended or tenant.activated audit event.
5. Suspension is not deletion. Preserve data and coordinate contractual
   retention or export obligations separately.

## Invitations

- Tenant owners/admins manage invitations under /admin/invitations.
- Only a SHA-256 token hash is stored. Never copy raw invitation URLs into
  logs, tickets, or audit metadata.
- Invitations are email-bound, expire, are single-use, and create membership
  transactionally on acceptance.
- A delivery warning means the invitation remains pending but email delivery
  failed or is not configured. Confirm RESEND_API_KEY and
  INVITATION_FROM_EMAIL, then use the rate-limited resend action.
- For suspected disclosure, revoke the invitation and issue a new one.

## Reports and retention

- Small inventory exports stream synchronously from a tenant-scoped service.
- Run npm run reports:worker at least every five minutes for queued exports,
  with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in a secret manager.
- Files use tenant-id/job-id.csv in the private tenant-reports bucket.
- Downloads recheck tenant permission and use a 60-second signed URL.
- Completed files expire after seven days. Each worker run marks expired jobs
  and deletes their storage objects.
- Alert when jobs remain pending longer than 15 minutes, fail, or when storage
  deletion repeatedly fails.

## Default-setting migrations

1. Insert a new immutable default-version row; do not edit a version already
   applied to tenants.
2. Mark exactly one version current.
3. New tenants receive only the current version.
4. Review existing-tenant impact and migrate them explicitly.
5. Test on a clean local reset and prove the new current version did not
   silently alter an existing tenant.
6. Record rollout scope and audit the migration events.

## Audit review

- Tenant owners/admins review scoped events at /admin/audit.
- AAL2 platform operators review cross-tenant events and metrics at /ops/audit.
- Events are append-only and include actor, tenant where applicable, action,
  target, request ID, metadata, and timestamp.
- Never store passwords, raw invitation tokens, API keys, or secrets in audit
  metadata.

## Monitoring and alerts

The /ops/audit metrics cover invitation delivery failures, report failures,
pending work, and failed work. Configure alerts for:

- any report or provisioning work failure;
- invitation delivery failure spikes;
- work items pending longer than their service-level objective;
- repeated 401/403 responses on operations, admin, invitation, and report
  endpoints;
- repeated MFA failures or operator access outside expected hours;
- report retention deletion failures.

Database exceptions roll back their transaction, so rejected authorization
attempts are monitored from gateway, PostgREST, and application logs rather
than written into the transactional audit table. Forward structured
application, gateway, Auth, and Postgres logs to the production log sink with
request IDs, route, actor ID when known, and status. Never log request bodies
or credentials.

## Verification and incident response

- Before deployment, run a clean local migration reset, every rollback SQL
  verification suite, schema lint/advisors, generated types, TypeScript, i18n
  parity, and the production build.
- In staging, exercise direct Simple registration and invitation-bound
  registration with email confirmation enabled; verify Simple private/shared
  behavior and Full Owner, Admin, Member, and Viewer sessions.
- Before enabling production registration, smoke-test an existing Full
  workspace and a newly created Simple workspace, then monitor authorization
  denials, provisioning failures, invitation failures, and quota errors.
- If rollout signals regress, disable self-service registration first. Keep
  additive schema and role values in place during application rollback.
- For suspected cross-tenant access, disable the involved account/operator,
  preserve gateway and database logs, identify request IDs, determine affected
  resources, rotate exposed credentials, and follow the notification process.
- For invitation-token disclosure, revoke it. For report-link disclosure, the
  URL expires in 60 seconds; expire the job and run retention cleanup if a
  longer-lived concern exists.

## Criteria for a separate operations deployment

Move /ops into a separate deployment when one or more of these becomes true:

- compliance requires a distinct trust boundary or network segment;
- operators must use a separate identity provider or managed device;
- independent release ownership is required;
- report or operations workloads materially affect customer latency;
- the operator interface needs different availability, firewall, or incident
  controls;
- audits show shared-deployment risk exceeds separate-infrastructure cost.

Keep authorization and domain services shared at the backend boundary even
after a UI/deployment split to avoid divergent security rules.

## Billing operations

Billing is gated by `BILLING_ENABLED`, which is fail-closed. With it absent or
`false` there is no checkout, no portal, and `/api/billing/webhook` returns 503.
Entitlements are unaffected either way: they resolve from the workspace's stored
plan and never consult the flag, so turning billing off never strips a paying
workspace of what it paid for.

### Plans

| Plan | Edition | Objects | Members | Monthly | Annual |
| --- | --- | --- | --- | --- | --- |
| `free` | simple | 10 | 2 | — | — |
| `hobby` | simple | 100 | 5 | $5 | $50 |
| `business` | full | unlimited | unlimited | $20 | $200 |

`plan_code` is the commercial identity; `edition` remains the capability model
and follows the plan automatically. Never set them independently.

### Changing a workspace plan by hand

`set_tenant_plan(tenant_id, plan_code)` requires an AAL2 platform operator, is
idempotent, and writes a `tenant.plan.changed` audit row. Use it for comped
accounts and support corrections. Do not update `tenant.plan_code` directly:
the platform-field guard rejects it for any authenticated actor.

### Payment failure and downgrade

`past_due` opens a 30-day grace window during which the workspace keeps its paid
plan. Reminders go out at day 0, 7, 21, and 29. At expiry the workspace drops to
`free`.

**A downgrade never deletes or hides anything.** A workspace over its new limit
keeps every object readable and editable; only creation is blocked until it is
back under the limit or subscribed again. Say this plainly to any customer who
asks, because it is true by construction and verified by
`verify_billing_downgrade_safety.sql`.

### Scheduled worker

`npm run billing:worker` must run daily. It sends due reminders first and
expires grace second, so the day-29 notice always precedes the day-30
downgrade. **Nothing downgrades and no reminder is sent until it is
scheduled** — the code is inert without it.

### Stripe configuration

Stripe's own retry schedule must be extended so it does not cancel or mark a
subscription unpaid before day 30. Its default gives up earlier, which would
downgrade customers ahead of our own grace window and make the two clocks
disagree.

The webhook endpoint is `POST /api/billing/webhook`. It is allowlisted in the
edge middleware because Stripe carries no session; it is authenticated by
Stripe signature, not by cookie.
