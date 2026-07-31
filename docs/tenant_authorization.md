# Tenant Authorization Model

This document defines the Phase 1 authorization boundary for tenant management.
Database row-level security (RLS) and backend authorization are authoritative;
hiding a control in the user interface is not an authorization check.

## Roles

| Role | Scope | Purpose |
| --- | --- | --- |
| `member` | One tenant | Uses tenant data and manages their own supported profile fields. |
| `admin` | One tenant | Manages the tenant's settings, members, data, invitations, and reports. |
| `owner` | One tenant | Has tenant-admin capabilities and controls owner-level membership changes. At least one owner must remain. |
| Platform operator | Platform | Performs explicitly granted internal operations, such as provisioning or suspending tenants. This is not a tenant role. |

`user_profiles.tenant_role` stores the tenant role (`member`, `admin`, or
`owner`). Membership and role checks must also match the active tenant.
`platform_operators` stores the separately granted platform identity. A platform
operator receives no tenant permissions merely by being an operator.

## Permission Matrix

`✓` means the role receives the permission by default. `—` means denied.

| Permission | Member | Admin | Owner | Platform operator |
| --- | :---: | :---: | :---: | :---: |
| `tenant.data.read` | ✓ | ✓ | ✓ | — |
| `tenant.users.read` | ✓ | ✓ | ✓ | — |
| `tenant.settings.update` | — | ✓ | ✓ | — |
| `tenant.users.invite` | — | ✓ | ✓ | — |
| `tenant.users.roles.update` | — | ✓ | ✓ | — |
| `tenant.data.update` | — | ✓ | ✓ | — |
| `tenant.reports.generate` | — | ✓ | ✓ | — |
| `platform.tenants.create` | — | — | — | ✓ |
| `platform.tenants.suspend` | — | — | — | ✓ |

Owner-only business rules still apply on top of the catalog. In particular, an
admin cannot grant an owner or platform-operator role, and no action may demote
or remove the last owner. The Phase 1 permission catalog establishes the
authorization vocabulary; invitation, report, provisioning, suspension, and
last-owner workflows are completed in later phases.

## Enforcement Rules

- Derive tenant context from the authenticated user's membership. Never accept
  a client-provided `tenant_id` as proof of access.
- Every tenant-owned query must be scoped to `current_tenant_id()`. This applies
  to reads, inserts, updates, and deletes.
- Inserts may omit `tenant_id` when a trusted database trigger assigns the
  authenticated tenant. An explicitly supplied different tenant must fail.
- Updates require both an RLS `USING` predicate and a `WITH CHECK` predicate so
  a row cannot be moved into another tenant.
- Tenant membership never grants cross-tenant access. Platform operations use a
  separate, explicit operator authorization path and must be audited.
- Authorization data belongs in database membership records or trusted app
  metadata, never user-editable JWT `user_metadata`.
- Backend endpoints should return a consistent forbidden response for denied
  operations and must not reveal whether a cross-tenant record exists.

## Verification

[`supabase/verify_tenant_authorization.sql`](../supabase/verify_tenant_authorization.sql)
creates two isolated tenants and representative users inside a transaction. It
checks tenant-derived context, cross-tenant reads and writes, forged tenant IDs,
and member/admin/owner permission boundaries, then always rolls back.

Run it only against a local or disposable database after all migrations:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/verify_tenant_authorization.sql
```

The connecting role must be able to create the rollback-only fixtures in
`auth.users` and switch locally to `authenticated` (the local Supabase
`postgres` role satisfies this). A successful run prints a completion message
and persists no fixture data.
