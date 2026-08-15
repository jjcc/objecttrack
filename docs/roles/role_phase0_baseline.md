# Phase 0 Authorization Baseline

## Purpose

This document freezes the authorization and application behavior that exists
before Simple and Full editions are introduced. It is the regression contract
for the later phases in [role_implementation_plan.md](role_implementation_plan.md).

Unless a behavior is listed under **Approved intentional changes**, later work
must preserve it.

## Current identity and tenancy model

- `public.tenant` is the durable workspace record.
- `public.user_profiles.tenant_id` is required and currently gives each user
  one tenant membership.
- `public.user_profiles.tenant_role` supports `member`, `admin`, and `owner`.
- `private.platform_operators` is independent of tenant membership.
- Tenant context is derived from the authenticated user by
  `current_tenant_id()`; browser-supplied tenant IDs are not trusted.
- Existing tenants do not yet have edition or workspace-kind columns.

## Current permission matrix

This is the behavior before the planned Admin narrowing and Viewer addition.

| Permission | Member | Admin | Owner | Platform Operator |
|---|:---:|:---:|:---:|:---:|
| `tenant.data.read` | Yes | Yes | Yes | No |
| `tenant.data.update` | No | Yes | Yes | No |
| `tenant.settings.update` | No | Yes | Yes | No |
| `tenant.users.read` | Yes | Yes | Yes | No |
| `tenant.users.invite` | No | Yes | Yes | No |
| `tenant.users.roles.update` | No | Yes | Yes | No |
| `tenant.reports.generate` | No | Yes | Yes | No |
| `tenant.audit.read` | No | Yes | Yes | No |
| `platform.tenants.create` | No | No | No | Yes, with AAL2 |
| `platform.tenants.update` | No | No | No | Yes, with AAL2 |
| `platform.tenants.suspend` | No | No | No | Yes, with AAL2 |
| `platform.audit.read` | No | No | No | Yes, with AAL2 |

Owner-only invariants already apply in addition to this matrix:

- Only an Owner can grant the Owner role.
- An Admin cannot demote or remove an Owner.
- The last Owner cannot be demoted or removed.
- Platform Operator status grants no tenant membership or tenant permission.

## Protected application areas

| Area | Current protection |
|---|---|
| `/admin/profile` | `tenant.settings.update` |
| `/admin/members` | `tenant.users.read` plus role-management RPC checks |
| `/admin/invitations` | `tenant.users.invite` |
| `/admin/reports` and report API | `tenant.reports.generate` |
| `/admin/audit` | `tenant.audit.read` |
| `/ops/tenants/new` | `platform.tenants.create` and AAL2 |
| `/ops/tenants/[id]` | `platform.tenants.update` and AAL2 |
| `/ops/audit` | `platform.audit.read` and AAL2 |
| Tenant application data | Tenant-scoped RLS and protected transfer RPCs |
| Object images | Tenant-scoped Storage policies |
| Public object/QR information | Dedicated limited public functions/routes |

## Authoritative database surfaces

The regression boundary includes:

- Tenant-scoped public tables: `tenant`, `user_profiles`, `groups`,
  `categories`, `event_types`, `objects`, `events`, `transfer_requests`, and
  `object_custom_schemas`.
- Protected private tables: permission definitions, role permissions,
  Platform Operators, defaults, invitations, work queue, reports, and audit.
- Membership and permission helpers: `current_tenant_id()`,
  `current_tenant_role()`, `has_permission()`, `is_admin()`, and
  `is_platform_operator()`.
- Tenant provisioning, administration, invitation, report, audit, lookup, and
  transfer functions created by the existing migration chain.
- Object-image and report Storage policies.

## Existing verification suites

| Suite | Regression coverage |
|---|---|
| `verify_transfer_workflow.sql` | Atomic transfer approval/rejection and actor rules |
| `verify_tenant_authorization.sql` | Role boundaries, tenant isolation, forged tenant IDs, tables, RPCs, and Storage |
| `verify_phase2_tenant_operations.sql` | Provisioning, defaults, suspension, and operations permissions |
| `verify_phase3_tenant_administration.sql` | Profile, member, role, removal, and last-Owner rules |
| `verify_phase4_tenant_invitations.sql` | Invitation authorization, lifecycle, replay, expiry, and tenant binding |
| `verify_phase5_tenant_reports.sql` | Report request, job, download, storage, retention, and tenant isolation |
| `verify_phase6_security.sql` | AAL2 operations, audit scope/immutability, and secret rejection |
| `verify_role_edition_baseline.sql` | Explicit current role-permission fixtures and cross-tenant permission denial |

All suites are rollback-only and must be run against a local or disposable
database, never by seeding production.

## Approved intentional changes

Later phases are expected to change only these baseline behaviors:

- Existing tenants gain `edition = 'full'`; new self-registered workspaces use
  `edition = 'simple'`.
- Viewer becomes a supported Full role.
- Full Admin loses reports, audit, billing, Owner management, and
  governance-sensitive settings.
- Member and Viewer object visibility becomes relationship/scope aware.
- Simple workspaces restrict roles, categories, groups, reports, audit,
  advanced transfers, user count, and object count.
- Registration supports creating a Simple workspace without an invitation.
- Object-facing `Owner` wording changes to `Current holder` without renaming
  `objects.current_owner_id` in this release.

## Phase 1 migration contract

The Phase 1 edition migration must prove, in a rollback-only verification
suite, that:

1. Every tenant that existed before the migration has `edition = 'full'`.
2. No tenant, user, object, category, event, transfer, invitation, report,
   image, or QR identifier changes during the backfill.
3. `workspace_kind` does not grant or remove any permission.
4. Existing Full tenant behavior remains compatible until the later explicit
   permission-activation phase.

