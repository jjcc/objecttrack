# Subscription and Billing Implementation Plan

## Objective

Introduce commercial subscription plans (Free, Hobby, Business) with payment
collection, while preserving the existing edition/role/visibility authorization
model and keeping the whole system behind a fail-closed feature flag.

Status: **Not started.** The seven design decisions were settled on 2026-08-15
and are recorded below. Pricing, currency, tax handling, and trial policy remain
open, but none of them block Phase 1.

## The core design decision: plan is not edition

The current model keys entitlements to edition:

```
tenant.edition ∈ {simple, full}
  └── private.edition_entitlements (PK: edition)
        └── max_users, max_objects, custom_categories, groups,
            advanced_transfers, reports, audit_ui
```

`edition` is load-bearing for authorization. It decides which roles exist
(Simple allows Owner and Member only; Full adds Admin and Viewer), it drives
private/shared member visibility, and it is read by RLS policies, several
`SECURITY DEFINER` RPCs, and the Flutter client through the shared RPC contract.

Three commercial tiers cannot be expressed by a two-value column, and widening
the `edition` check to four values would drag pricing into the authorization
model — precisely the collapse the project has avoided elsewhere.

**Recommendation: add a fourth concept, `plan`, layered above edition.**

```
tenant.plan_code ∈ {free, hobby, business}     commercial identity
  └── private.subscription_plans (PK: code)
        ├── edition          → capability model (simple | full)
        └── quotas + feature entitlements
```

Entitlement resolution moves from "join on edition" to "join on plan". `edition`
stays exactly as it is and remains what authorization reads, so adding or
repricing a plan never touches an RLS policy or an RPC signature. This extends
the existing doctrine in CLAUDE.md — edition, role, and visibility stay strictly
separate — with plan as a commercial axis that resolves *to* an edition.

Proposed mapping (numbers are proposals, not decisions):

| Plan | Edition | Max objects | Max users | Features |
| --- | --- | --- | --- | --- |
| `free` | `simple` | 10 | 2 | none |
| `hobby` | `simple` | 100 | 5 | none |
| `business` | `full` | unlimited | unlimited | all |

Hobby at 100 objects deliberately matches today's Simple quota, so existing
Simple workspaces can be backfilled to Hobby with no change in what they can do.

## Decisions required before Phase 1

1. **Object and user limits per plan.** The table above is a starting point.
   Free at 10 objects is the number you gave; Hobby and the user limits are
   proposals.
2. **Grandfathering.** Existing Simple workspaces have a 100-object allowance.
   Do they become Hobby (keeps the allowance, but they never paid for it), or
   Free with a legacy exemption? Recommendation: backfill to Hobby, and if that
   is commercially unacceptable, add a `legacy_quota_until` date rather than
   cutting them immediately.
3. **Downgrade behaviour when over quota.** A Business workspace with 500
   objects that stops paying cannot fit in Free. Recommendation: never delete
   or hide data — block *creation* only, show a persistent banner, and keep
   existing records readable. This must be explicit policy because the quota
   triggers only guard `INSERT`.
4. **Dunning window.** How long between first failed payment and downgrade.
   Recommendation: 14 days with email at day 0, 7, and 13.
5. **Service-role boundary for the webhook.** CLAUDE.md currently states that
   `SUPABASE_SERVICE_ROLE_KEY` is report-worker only and must never be imported
   into app code. A Stripe webhook needs privileged writes. Options: (a) a
   documented single-file exception for the webhook route, (b) a
   `SECURITY DEFINER` RPC authenticated by a dedicated shared secret, or
   (c) move webhook handling into the existing worker process.
   Recommendation: (b), which keeps the rule intact and keeps the privileged
   surface in the database where the rest of the authorization lives.
6. **Payment provider.** This plan assumes Stripe (Checkout + Customer Portal),
   which avoids building card capture, invoicing, tax, and dunning UI.
7. **Currency, pricing, tax handling, and whether annual billing exists at
   launch.**

## Feature flag

A single fail-closed server flag gates everything, matching the existing
`SELF_SERVICE_REGISTRATION_ENABLED` pattern (absent or `false` means disabled).

`BILLING_ENABLED`

When **off**, which is the default and the state on every environment until
explicitly enabled:

- No checkout, plan-selection, or billing-portal UI renders anywhere.
- `/api/billing/*` route handlers return 503.
- Plan changes happen only through the existing AAL2 platform-operator path.
- Quotas and entitlements still resolve normally, from whatever plan a tenant
  already has. **Turning the flag off must never remove a paying tenant's
  entitlements** — it disables commerce, not capability.

When **on**: self-service checkout, portal, and webhook-driven plan changes are
live.

The flag is read server-side only. Client components learn about it through the
existing product-context path, never by reading the environment directly.

## Phases

### Phase 0: Decisions and baseline

- [ ] Settle every item in "Decisions required before Phase 1".
- [ ] Record the current entitlement contract as a regression baseline, in the
      style of `docs/roles/role_phase0_baseline.md`.
- [ ] Confirm the current production tenant inventory and which plan each
      existing workspace lands on.
- [ ] Create a Stripe account in **test mode** and record product/price IDs.
      No live keys yet.

Exit: all seven decisions written down; clean local reset, all existing verify
suites, lint, advisors, tsc, i18n, and build pass before any change.

### Phase 1: Plan catalog and entitlement repointing

Database only. No payment, no UI, no behaviour change.

- [ ] Add `private.subscription_plans` (PK `code`; `edition`, `max_users`,
      `max_objects`, the five feature booleans, `is_active`, `sort_order`, and
      display metadata). Constrain `edition` to the existing two values.
- [ ] Seed `free`, `hobby`, and `business` per the agreed matrix.
- [ ] Add `tenant.plan_code`, defaulting to the plan that preserves current
      behaviour, with a foreign key to `subscription_plans`.
- [ ] Backfill: existing `simple` tenants → agreed grandfather plan;
      existing `full` tenants → `business`.
- [ ] Repoint `has_tenant_entitlement`, `enforce_object_quota`,
      `enforce_profile_quota`, `enforce_invitation_quota`,
      `current_tenant_usage`, `current_tenant_product_context`, and
      `platform_tenant_product_context` to resolve through `plan_code`.
- [ ] Keep `edition` authoritative for role availability and visibility, and
      derive it from the plan on every plan change so the two cannot drift.
- [ ] Extend `enforce_tenant_platform_fields` so `plan_code` is
      operator/service-role controlled, exactly like `edition` today.
- [ ] Retain `private.edition_entitlements` until Phase 6 to avoid breaking
      anything mid-flight; drop it only once nothing reads it.
- [ ] New `verify_billing_plan_catalog.sql`: entitlements resolve identically
      before and after repointing for every existing tenant; a Free tenant is
      blocked at its object limit; plan and edition never disagree.

Exit: every existing verify suite still passes unchanged, proving no
authorization behaviour moved.

### Phase 2: Plan administration without payment

- [ ] `set_tenant_plan(p_tenant_id, p_plan_code)` — AAL2 platform operator,
      audited, idempotent, advisory-locked, mirroring `upgrade_tenant_to_full`.
- [ ] Keep `upgrade_tenant_to_full` working as a thin wrapper so the Flutter
      client and existing ops flows do not break.
- [ ] Owner-facing read-only plan and usage display, gated on the existing
      `tenant.billing.manage` permission, which is already Owner-only.
- [ ] Introduce `BILLING_ENABLED`, defaulting to disabled, and assert the
      disabled path behaves exactly as today.
- [ ] `verify_billing_plan_administration.sql` covering operator-only plan
      changes, audit rows, idempotency, and that a non-operator cannot change
      `plan_code` directly.

Exit: plans are fully administrable internally, with no payment integration and
no user-visible change.

### Phase 3: Stripe integration

- [ ] `private.tenant_billing` (tenant PK, `stripe_customer_id`,
      `stripe_subscription_id`, `subscription_status`, `current_period_end`,
      `cancel_at_period_end`). No card data is ever stored.
- [ ] `private.billing_events` keyed by Stripe event ID, as an idempotency and
      replay ledger.
- [ ] Checkout-session server action, requiring `tenant.billing.manage`, with
      the tenant derived from `AccessContext` and never from client input.
- [ ] Customer-portal session for plan changes and cancellation.
- [ ] `POST /api/billing/webhook`: verify the Stripe signature before anything
      else, reject unsigned or replayed events, then apply the plan change
      through the Phase 5 boundary decision.
- [ ] Return 503 from every billing route when `BILLING_ENABLED` is off.
- [ ] `verify_billing_webhook_ledger.sql`: duplicate event IDs apply once;
      an unknown tenant is rejected; a plan change writes an audit row.

Exit: a test-mode subscription creates, upgrades, and cancels end to end
against a local or staging deployment driven by the Stripe CLI.

### Phase 4: Lifecycle, dunning, and over-quota policy

- [ ] Map subscription status to plan: `active`/`trialing` hold the paid plan;
      `past_due` enters grace; `canceled`/`unpaid` fall back to Free.
- [ ] Implement the agreed dunning window with emails through the existing
      Resend integration.
- [ ] Implement the over-quota policy: block creation, never delete, surface a
      persistent banner with the current count against the limit.
- [ ] Implement grandfathering per the Phase 0 decision.
- [ ] `verify_billing_downgrade_safety.sql`: a downgraded over-quota tenant
      keeps every existing object readable, cannot create new ones, and loses
      no rows.

Exit: the full subscription lifecycle is exercised, including a failed payment
driven by a Stripe test card.

### Phase 5: User interface and i18n

- [ ] Plan selection and comparison, Owner-only.
- [ ] Billing settings under `/admin`, gated on `tenant.billing.manage`.
- [ ] Contextual upgrade prompt when a quota blocks an action, replacing the
      current bare `quota.objects.exceeded` failure.
- [ ] Usage meters for objects and users against the plan limit.
- [ ] Every new string in both `messages/en.json` and `messages/zh-CN.json`.
      Plan names and statuses are application-owned enums: store untranslated,
      translate at render.

Exit: `npm run i18n:check` passes; both locales reviewed.

### Phase 6: Verification and rollout

- [ ] Clean local reset; every verify suite; lint; advisors; regenerate types;
      tsc; i18n; production build.
- [ ] Staging with Stripe **test** keys and `BILLING_ENABLED=true`; full
      browser pass across all three plans including a failed payment.
- [ ] Production: deploy with `BILLING_ENABLED` absent, so nothing changes.
- [ ] Apply migrations to production, verify entitlements are unchanged for the
      existing tenant, then enable the flag.
- [ ] Drop `private.edition_entitlements` once nothing reads it.
- [ ] Update the runbook and CLAUDE.md; append a dev_log entry.

Exit: an existing tenant is unaffected; a new workspace can subscribe, upgrade,
downgrade, and cancel; no authorization regression.

## Constraints carried from the existing system

- **The database stays authoritative.** Plan, quota, and entitlement checks
  belong in RLS and RPCs. A hidden upgrade button is not enforcement.
- **Never trust a client-supplied plan.** Plan state derives from the Stripe
  webhook or an operator RPC, never from a form field.
- **Never accept a client-supplied `tenant_id`.** Derive it from
  `AccessContext`, as everywhere else.
- **Migrations are additive** and must match the live project's registered
  history. Production history is currently clean and aligned.
- **The Flutter client shares these RPCs.** `current_tenant_product_context`
  gaining a `plan_code` field is additive and safe; changing or removing a field
  is not. Coordinate before touching existing shapes.
- **`tenant.billing.manage` already exists** and is Owner-only. Reuse it rather
  than inventing a permission.
- **Stripe webhooks need a stable public URL.** Use Vercel production; drive
  local development with the Stripe CLI.

## Risks

| Risk | Mitigation |
| --- | --- |
| Free's 10-object limit silently strands existing Simple workspaces | Grandfather to Hobby; Phase 1 verify suite asserts no tenant loses capability |
| Webhook replay or forgery grants a free upgrade | Signature verification before parsing; event-ID ledger; plan changes audited |
| Downgrade destroys customer data | Policy is block-creation-only; a verify suite asserts zero row loss |
| Plan and edition drift apart | Edition derived from plan on every change; verify suite asserts they agree |
| Service-role key spreads into app code | Decision 5 keeps the privileged surface in the database |
| Flag disabled mid-subscription removes paid entitlements | Flag gates commerce only; entitlements continue to resolve from the stored plan |
