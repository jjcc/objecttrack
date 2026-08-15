# Tenant Authorization Model

This document defines the authorization boundary after local Phase 7 acceptance
of the Simple/Full role-and-edition work on 2026-08-13. Staging and production
rollout remain pending. Database RLS, protected RPCs, and backend authorization
are authoritative; hiding a control in the UI is not an authorization check.

Every protected operation evaluates all applicable dimensions:

```text
Allowed = tenant membership
          AND role permission
          AND edition entitlement
          AND resource visibility or relationship
          AND tenant status
```

Edition, tenant role, and object relationship are separate. Edition controls
features and quotas, role controls permitted actions, and visibility or
holder/group relationships control which resources a user may access.

## Roles and editions

| Role | Scope | Purpose |
| --- | --- | --- |
| `viewer` | One Full workspace | Reads assigned objects and uses the limited current-holder lookup. |
| `member` | One workspace | Reads relationship-visible objects and participates in permitted transfers. |
| `admin` | One Full workspace | Performs delegated operations without workspace governance, reports, audit, billing, or Owner management. |
| `owner` | One workspace | Governs the workspace and also receives Admin operational permissions. At least one Owner must remain. |
| Platform Operator | Platform | Performs explicitly granted internal operations. This is independent of tenant roles and requires TOTP-verified AAL2. |

`user_profiles.tenant_role` stores `viewer`, `member`, `admin`, or
`owner`. Simple permits only Owner and Member; Full permits all four roles.
`platform_operators` stores the separate platform identity. A person may have
both identities, but Platform Operator status alone grants no tenant access.

## Permission matrix

`✓` means the role receives the permission before edition filtering.

| Permission group | Viewer | Member | Admin | Owner | Platform Operator |
| --- | :---: | :---: | :---: | :---: | :---: |
| Assigned-object read and holder lookup | ✓ | ✓ | ✓ | ✓ | — |
| Participate in transfers | — | ✓ | ✓ | ✓ | — |
| Read all workspace objects | — | — | ✓ | ✓ | — |
| Manage objects, categories, event types, custom fields, and advanced transfers | — | — | ✓ | ✓ | — |
| Read users, invite users, and manage supported non-Owner roles | — | — | ✓ | ✓ | — |
| Access tenant administration | — | — | ✓ | ✓ | — |
| Manage groups and generate reports | — | — | ✓ | ✓ | — |
| Update workspace settings; manage billing and Owners; read tenant audit | — | — | — | ✓ | — |
| Create, update, or suspend tenants; read platform audit | — | — | — | — | ✓ |

The exact synchronized catalog lives in
[`src/lib/auth/permissions.ts`](../src/lib/auth/permissions.ts). Edition
entitlements subtract permissions from this role baseline. Simple disables
custom categories, groups, advanced transfers, reports, and tenant audit. Its
current limits are five active users and 100 non-deleted objects; the database
enforces both transactionally. Workspace kind is descriptive and never changes
authorization.

Owner-only invariants apply in addition to the catalog. An Admin cannot grant,
demote, or remove an Owner, and no action may remove the final Owner.

The Owner/Admin boundary is deliberately four permissions wide:
`tenant.settings.update`, `tenant.billing.manage`, `tenant.owners.manage`, and
`tenant.audit.read`. Group management and report generation moved to Admin on
2026-08-14 as routine operations. The remaining four are governance: an Admin
that could grant roles could promote itself, and an Admin that solely controlled
the audit log could obscure its own actions.

## Object visibility and lookup

- Simple `private`: Members see objects currently assigned to them.
- Simple `shared`: Members may read all workspace objects, while mutation and
  transfer access remains relationship- and permission-scoped.
- Full Member: access follows the configured assigned/group scope.
- Viewer: assigned-object read only, plus the minimal holder lookup.
- Owner and Admin: read all workspace objects and perform permitted operations.

The holder lookup returns approved fields for one object; it does not grant
directory access or broad object visibility. Public Object Info and QR routes
use separate display-safe RPCs and remain subject to the workspace's anonymous
sharing setting.

## Enforcement rules

- Derive tenant context from authenticated membership. Never accept a
  client-supplied `tenant_id` as proof of access.
- Scope every tenant-owned read and mutation to `current_tenant_id()`.
- Inserts may rely on a trusted trigger to assign the tenant, but an explicitly
  supplied different tenant must fail.
- Updates require both RLS `USING` and `WITH CHECK` predicates so rows cannot
  move across tenants.
- Resolve edition, visibility, status, limits, and feature flags through
  `current_tenant_product_context()`; never trust browser-supplied product
  context. Suspended workspaces receive no active tenant entitlements.
- Tenant membership never grants cross-tenant access. Platform operations use a
  separate, audited AAL2 authorization path.
- Sensitive mutations, quota checks, provisioning, invitation acceptance, and
  edition upgrades use transactional RPC contracts.
- Authorization data belongs in database membership records or trusted app
  metadata, never user-editable JWT `user_metadata`.
- Denials must not reveal whether a cross-tenant record exists.

## Application enforcement layers

| Layer | Responsibility |
| --- | --- |
| Middleware | Refresh the session, handle public routes, and perform coarse route/permission redirects. |
| Client navigation and gates | Reflect access for usability only; never establish authority. |
| Server helpers | Build validated access context, require tenant/platform permissions, and enforce operator AAL2. |
| Database | Enforce tenant isolation, roles, entitlements, resource scope, quotas, and transactional invariants. |

## Verification

The rollback-only suites under `supabase/verify_*.sql` cover tenant isolation,
granular roles, edition metadata, self-service provisioning, Simple
entitlements and quotas, object visibility and holder lookup, and in-place
edition upgrades. Run every suite against a local or disposable database:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/verify_phase5_object_visibility.sql
```

The connecting role must be able to create rollback-only `auth.users` fixtures
and switch locally to `authenticated`; the local Supabase `postgres` role
satisfies this. Never run these suites against production.
