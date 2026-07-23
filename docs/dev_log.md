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
