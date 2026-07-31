# Tenant Management Architecture Design

## Context

The product is a B2B SaaS application with an existing tenant model. It needs management capabilities such as:

- Creating and modifying tenants
- Applying default tenant settings
- Inviting users to a specific tenant
- Managing tenant-owned data
- Generating reports
- Supporting internal operational tasks

The main design question is whether these capabilities should live inside the customer application or in a completely separate management application.

## Decision

Use one backend platform initially, while separating the user experiences and authorization boundaries into three areas:

| Area | Intended users | Allowed scope |
| --- | --- | --- |
| Customer application | Regular tenant users | Their own tenant's application data |
| Tenant administration | Tenant owners and administrators | Users, invitations, settings, data, and reports for their tenant only |
| Platform operations | Authorized internal staff | Tenant creation, suspension, support, and approved cross-tenant operations |

Tenant administration may be embedded in the main application because it is part of the customer experience. The internal platform-operations interface should be kept separate from normal tenant-facing navigation and protected by stronger controls.

An initial URL layout could be:

- `app.example.com` for the customer application
- `app.example.com/admin` for tenant administration
- `ops.example.com` for internal platform operations

These interfaces may share a repository, service layer, authentication infrastructure, and deployment pipeline. The architectural boundary should exist in the code and authorization model even if they are not separate deployments.

## High-Level Architecture

```text
Customer UI ---------+
Tenant Admin UI -----+--> Application/API services --> Database
Internal Ops UI -----+
```

All interfaces must call the same application services for tenant operations. Authorization and tenant isolation must be enforced by the backend rather than only by UI visibility.

## Tenant Isolation and Authorization

- Every tenant-owned record should include a `tenant_id` or have an unambiguous relationship to a tenant-owned parent.
- The backend should derive the user's permitted tenant context from authenticated membership and must not trust a `tenant_id` supplied by the browser.
- Cross-tenant access should be denied by default.
- Tenant and platform permissions should be explicit, for example:
  - `tenant.settings.update`
  - `tenant.users.invite`
  - `tenant.users.roles.update`
  - `tenant.data.update`
  - `tenant.reports.generate`
  - `platform.tenants.create`
  - `platform.tenants.suspend`
- Platform-operator access should require stronger authentication and should be granted only to authorized internal accounts.
- Sensitive actions should be recorded in an immutable or append-only audit log.

## Tenant Provisioning

Tenant creation should be handled by a dedicated application service or transaction that:

1. Creates the tenant.
2. Applies versioned default settings.
3. Creates the initial tenant-owner invitation or membership.
4. Records an audit event.
5. Enqueues any non-critical setup work.

Defaults should be versioned so that future changes do not silently alter existing tenants. If existing tenants need new defaults, apply them through an explicit migration.

## Invitation Flow

An invitation should contain at least:

- `tenant_id`
- Invited email address
- Intended role
- A cryptographically random, single-use token stored as a hash
- Expiration time
- Inviter identity
- Created, accepted, and revoked timestamps

Recommended flow:

1. A tenant administrator submits the invited email and role.
2. The backend verifies that the administrator can invite users for that tenant.
3. The backend creates the invitation and sends an email containing a single-use link.
4. The recipient authenticates or registers.
5. The backend verifies the token, email policy, expiry, and invitation status.
6. The backend creates membership in the invitation's tenant and marks the invitation accepted in one transaction.

The browser must not be able to change the target tenant during invitation acceptance.

## Reporting and Background Work

Small reports may be generated synchronously. Large reports and exports should run as background jobs with:

- The tenant context captured when the job is created
- Authorization checked before enqueueing and again before download
- Tenant-scoped storage paths and object access
- Expiring download links where appropriate
- Audit events for sensitive exports
- Retention and deletion policies

## Implementation Approach

Start as a modular monolith:

- One repository and backend
- Separate route groups or frontend entry points for customer, tenant-admin, and platform-operator experiences
- Shared domain/application services
- Centralized authorization and tenant-scoping middleware or policies
- Transactional tenant provisioning and invitation acceptance
- Background jobs for email delivery and expensive report generation
- Audit logging for tenant creation, settings changes, invitations, role changes, exports, and operator access

Avoid duplicating tenant-management business logic in the different interfaces. The interfaces should be separate consumers of the same protected services.

## When to Split into Separate Deployments

Move the management interface or control plane to an independent deployment when there is a concrete need, such as:

- Compliance or network-isolation requirements
- A requirement that customer-application vulnerabilities or outages not expose the control plane
- Separate engineering ownership and release schedules
- Substantially different scaling characteristics
- Powerful internal cross-tenant workflows that warrant stronger infrastructure isolation

Even after a deployment split, keep tenant-management rules in a well-defined service layer or API rather than creating a second implementation.

## Consequences

### Benefits

- Faster initial development and simpler operations
- Consistent tenant rules across all interfaces
- A familiar embedded administration experience for tenant administrators
- Clear separation of normal tenant access from internal cross-tenant operations
- A practical migration path to independent deployments later

### Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Accidental cross-tenant access | Backend-enforced scoping, deny-by-default authorization, and isolation tests |
| Internal operator compromise | Strong authentication, least privilege, audit logging, and a separate operations interface |
| Default settings drift | Versioned defaults and explicit migrations |
| Duplicate management logic | Shared application services and policy enforcement |
| Expensive reporting affects the app | Background jobs, resource limits, and workload isolation when needed |

## Summary

Embed tenant-facing administration in the main product, but treat it as a distinct authorization area. Keep the internal cross-tenant operations interface separate. Begin with a shared backend and modular codebase, then split deployments only when security, compliance, scale, or organizational requirements justify the additional complexity.
