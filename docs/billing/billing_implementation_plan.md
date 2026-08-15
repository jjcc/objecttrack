# Subscription and Billing Implementation Plan

## Objective

Introduce commercial subscription plans (Free, Hobby, Business) with payment
collection, while preserving the existing edition/role/visibility authorization
model and keeping the whole system behind a fail-closed feature flag.

Status: **Phase 1 complete (2026-08-15), local only.** The seven design
decisions are recorded below. Phase 2 is unblocked and ready to start. Phase 3
onward is blocked on a Stripe account, price identifiers, and pricing/currency
decisions. Pricing, currency, tax handling, and trial policy remain open.

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

## Decisions settled 2026-08-15

| # | Decision | Answer |
| --- | --- | --- |
| 1 | Plan limits | Free 10 objects / 2 users; Hobby 100 / 5; Business unlimited |
| 2 | Grandfathering | Existing Simple workspaces backfill to Hobby |
| 3 | Over-quota downgrade | Block creation only; all data stays readable and editable |
| 4 | Dunning window | 30 days, emails at day 0, 7, 21, and 29 |
| 5 | Webhook privilege | `SECURITY DEFINER` RPC behind a dedicated shared secret |
| 6 | Provider | Stripe Checkout + Customer Portal |
| 7 | Cadence | Monthly **and** annual at launch |

Two answers diverged from the original recommendation and change the work:

**30-day dunning.** Stripe's default retry schedule gives up well before day 30
and will cancel or mark the subscription `unpaid` on its own. Stripe's retry and
subscription-lifecycle settings must be configured so the provider never ends
the subscription before our own grace period does; otherwise the two clocks
disagree and a customer is downgraded early. This is a Stripe dashboard
configuration task, not only application code.

**Monthly and annual at launch.** A plan therefore has more than one price, so
price identifiers cannot live on the plan row. Phase 3 gains a
`private.plan_prices` table keyed by `(plan_code, interval)`. Phase 4 gains
proration and mid-term cadence-switch handling, and must decide whether an
annual downgrade takes effect immediately or at period end.

Still open, none of which block Phase 1 or 2: actual prices, currency, whether
Stripe Tax is enabled, and whether a trial exists.

## Original decision list, retained for context

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

### Phase 1: Plan catalog and entitlement repointing — **complete**

Delivered by `20260815051500_billing_phase1_plan_catalog.sql`. Database only,
no payment, no UI.

- [x] Add `private.subscription_plans` (PK `code`; `edition`, `max_users`,
      `max_objects`, the five feature booleans, `is_active`,
      `is_default_for_edition`, `sort_order`).
- [x] Seed `free` (10/2), `hobby` (100/5), `business` (unlimited).
- [x] Add `tenant.plan_code` with a foreign key to `subscription_plans`.
- [x] Backfill: existing `simple` → `hobby`; existing `full` → `business`.
- [x] Repoint all eight entitlement consumers through a new per-tenant view
      `private.tenant_entitlements`. Only the join line changed in each, so no
      function signature moved.
- [x] Keep `edition` authoritative for roles and visibility;
      `private.sync_tenant_plan_edition()` derives each column from the other
      so they cannot drift.
- [x] Extend the platform-field guard so `plan_code` is operator-managed.
      Note the live trigger calls the **`private`** copy of
      `enforce_tenant_platform_fields`, not the older unused `public` one.
- [x] Retain `private.edition_entitlements`, now unread, for a later drop.
- [x] `verify_billing_plan_catalog.sql` covering catalog shape, bidirectional
      plan/edition sync, the free ceiling, grandfathered hobby limits, Simple
      holding no Full features, and Owner-attempted plan escalation.
- [x] Update the four existing suites that assumed simple means 5 users /
      100 objects.

Exit met: all sixteen suites pass, lint and advisors clean, types add only
`plan_code`, tsc/i18n/build pass. Not applied to any remote.

### Phase 2: Plan administration without payment — **complete**

Delivered by `20260815061000_billing_phase2_plan_administration.sql`.

- [x] `set_tenant_plan(p_tenant_id, p_plan_code)` — AAL2 platform operator,
      audited as `tenant.plan.changed`, idempotent, advisory-locked, rejecting
      unknown or inactive plans and missing tenants.
- [x] `upgrade_tenant_to_full` needed **no change**: it still sets
      `edition = 'full'`, and the sync trigger derives the business plan from
      that. Signature, return shape, and audit action are all unchanged, so the
      Flutter client and existing ops flow are unaffected.
- [x] `current_tenant_plan()` — read-only plan and usage, returning no rows
      unless the caller holds the Owner-only `tenant.billing.manage`.
- [x] Owner-facing `/admin/billing` page with plan name and usage meters for
      objects and members, in both locales.
- [x] `BILLING_ENABLED` in `src/lib/billing/flags.ts`, fail-closed. It gates
      commerce only; entitlements always resolve from the stored plan and never
      consult the flag.
- [x] `verify_billing_plan_administration.sql`: Owner denied, aal1 operator
      denied, AAL2 operator allowed, idempotent with exactly one audit row,
      unknown plan and missing tenant rejected, downgrade preserves every object
      while blocking new ones, and `current_tenant_plan` is Owner-only.

Exit met: 17 suites pass, lint and advisors clean, tsc/i18n (889 messages)/
41-route build pass. Not applied to any remote.

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

### Phase 4: Lifecycle, dunning, and over-quota policy — **complete**

Delivered by `20260815081500_billing_phase4_lifecycle.sql` and
`scripts/process-billing-lifecycle.mjs`.

- [x] Status mapping: `active`/`trialing`/`past_due` hold the purchased plan;
      terminal statuses fall back to Free.
- [x] 30-day grace window opened on `past_due` and closed on recovery. A
      repeated `payment_failed` keeps the original start, so the deadline cannot
      be extended indefinitely.
- [x] Dunning at day 0, 7, 21, and 29 through Resend, driven by
      `billing_dunning_due()` and recorded by `record_billing_dunning_sent()`.
      A reminder is recorded only after Resend accepts it, so a transient
      failure retries rather than being silently swallowed.
- [x] `expire_billing_grace()` downgrades expired windows and is idempotent.
- [x] Over-quota policy: creation blocked, nothing deleted or hidden, with
      Owner-facing banners for both over-quota and payment-failed states in
      both locales.
- [x] Grandfathering was delivered in Phase 1.
- [x] `verify_billing_downgrade_safety.sql`: 40 objects survive a downgrade to
      a 10-object plan and stay readable, creation is blocked, the sweep is
      idempotent, grace cannot be extended, reminders fire in stage order and
      never twice, recovery clears the schedule, and the lifecycle surface is
      unreachable by an authenticated user or platform operator.

Exit met: 19 suites pass, lint and advisors clean, tsc/i18n (898 messages)/
41-route build pass. Not yet exercised against a real Stripe test card.

**The worker needs scheduling.** `npm run billing:worker` is a one-shot script
like the report worker, and must run daily. Nothing downgrades and no reminder
is sent until it is scheduled.

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
