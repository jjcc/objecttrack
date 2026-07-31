-- Rollback-only integration verification for Phase 4 tenant invitations.

BEGIN;

CREATE TEMP TABLE phase4_result (
  label text PRIMARY KEY,
  invitation_id uuid NOT NULL
);
GRANT SELECT, INSERT, UPDATE ON phase4_result TO authenticated;

INSERT INTO public.tenant (
  id, institution_name, status, defaults_version
)
OVERRIDING SYSTEM VALUE
VALUES
  (940000001, 'Phase 4 tenant A', 'active', 0),
  (940000002, 'Phase 4 tenant B', 'active', 0);

INSERT INTO auth.users (id, aud, role, email, is_sso_user, is_anonymous)
VALUES
  ('94000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', false, false),
  ('94000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'admin@example.test', false, false),
  ('94000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'member@example.test', false, false),
  ('94000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'invited@example.test', false, false),
  ('94000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'wrong@example.test', false, false),
  ('94000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'cross-admin@example.test', false, false),
  ('94000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'revoked@example.test', false, false),
  ('94000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'expired@example.test', false, false),
  ('94000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'uninvited@example.test', false, false);

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
VALUES
  ('94000000-0000-4000-8000-000000000001', 940000001, 'owner', 'owner@example.test'),
  ('94000000-0000-4000-8000-000000000002', 940000001, 'admin', 'admin@example.test'),
  ('94000000-0000-4000-8000-000000000003', 940000001, 'member', 'member@example.test'),
  ('94000000-0000-4000-8000-000000000006', 940000002, 'admin', 'cross-admin@example.test');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub',
  '94000000-0000-4000-8000-000000000003',
  true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.create_tenant_invitation(
      'blocked@example.test',
      'member',
      repeat('1', 64),
      now() + interval '7 days'
    );
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Regular member created an invitation';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '94000000-0000-4000-8000-000000000002',
  true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.create_tenant_invitation(
      'owner-candidate@example.test',
      'owner',
      repeat('2', 64),
      now() + interval '7 days'
    );
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Tenant admin invited an owner';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '94000000-0000-4000-8000-000000000001',
  true
);

INSERT INTO phase4_result (label, invitation_id)
SELECT 'accepted', invitation_id
FROM public.create_tenant_invitation(
  'invited@example.test',
  'admin',
  repeat('a', 64),
  now() + interval '7 days'
);

DO $$
DECLARE
  v_count bigint;
  v_denied boolean := false;
BEGIN
  SELECT count(*) INTO v_count FROM public.tenant_invitations();
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Owner invitation list was not scoped correctly';
  END IF;

  BEGIN
    PERFORM public.create_tenant_invitation(
      'invited@example.test',
      'member',
      repeat('9', 64),
      now() + interval '7 days'
    );
  EXCEPTION WHEN sqlstate '23505' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Duplicate active invitation was created';
  END IF;

  PERFORM public.record_tenant_invitation_delivery(
    (SELECT invitation_id FROM phase4_result WHERE label = 'accepted'),
    true,
    NULL
  );

  v_denied := false;
  BEGIN
    PERFORM public.prepare_tenant_invitation_resend(
      (SELECT invitation_id FROM phase4_result WHERE label = 'accepted'),
      repeat('b', 64),
      now() + interval '7 days'
    );
  EXCEPTION WHEN sqlstate 'P0001' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Immediate invitation resend bypassed the cooldown';
  END IF;
END;
$$;

RESET ROLE;

UPDATE private.invitation_delivery_attempts
SET attempted_at = now() - interval '2 minutes'
WHERE invitation_id = (
  SELECT invitation_id FROM phase4_result WHERE label = 'accepted'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '94000000-0000-4000-8000-000000000001',
  true
);

DO $$
DECLARE
  v_invitation_id uuid;
BEGIN
  SELECT invitation_id INTO v_invitation_id
  FROM phase4_result
  WHERE label = 'accepted';

  PERFORM public.prepare_tenant_invitation_resend(
    v_invitation_id,
    repeat('b', 64),
    now() + interval '7 days'
  );
  PERFORM public.record_tenant_invitation_delivery(
    v_invitation_id,
    false,
    'Synthetic delivery failure without token material'
  );
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '94000000-0000-4000-8000-000000000006',
  true
);

DO $$
DECLARE
  v_count bigint;
  v_denied boolean := false;
BEGIN
  SELECT count(*) INTO v_count FROM public.tenant_invitations();
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Another tenant can list Phase 4 invitations';
  END IF;

  BEGIN
    PERFORM public.revoke_tenant_invitation(
      (SELECT invitation_id FROM phase4_result WHERE label = 'accepted')
    );
  EXCEPTION WHEN sqlstate 'P0002' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Another tenant revoked an invitation';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '94000000-0000-4000-8000-000000000005',
  true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.accept_tenant_invitation(repeat('b', 64));
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'A different email accepted the invitation';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '94000000-0000-4000-8000-000000000009',
  true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
    VALUES (
      '94000000-0000-4000-8000-000000000009',
      940000001,
      'member',
      'uninvited@example.test'
    );
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Uninvited account self-enrolled into a tenant';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '94000000-0000-4000-8000-000000000004',
  true
);

DO $$
DECLARE
  v_tenant_id bigint;
  v_denied boolean := false;
BEGIN
  v_tenant_id := public.accept_tenant_invitation(repeat('b', 64));
  IF v_tenant_id <> 940000001 THEN
    RAISE EXCEPTION 'Invitation acceptance returned the wrong tenant';
  END IF;

  BEGIN
    PERFORM public.accept_tenant_invitation(repeat('b', 64));
  EXCEPTION WHEN sqlstate 'P0001' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Accepted invitation was replayed';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '94000000-0000-4000-8000-000000000001',
  true
);

INSERT INTO phase4_result (label, invitation_id)
SELECT 'revoked', invitation_id
FROM public.create_tenant_invitation(
  'revoked@example.test',
  'member',
  repeat('c', 64),
  now() + interval '7 days'
);

DO $$
BEGIN
  PERFORM public.revoke_tenant_invitation(
    (SELECT invitation_id FROM phase4_result WHERE label = 'revoked')
  );
END;
$$;

INSERT INTO phase4_result (label, invitation_id)
SELECT 'expired', invitation_id
FROM public.create_tenant_invitation(
  'expired@example.test',
  'member',
  repeat('d', 64),
  now() + interval '7 days'
);

RESET ROLE;

UPDATE private.tenant_invitations
SET expired_at = now()
WHERE id = (SELECT invitation_id FROM phase4_result WHERE label = 'expired');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '94000000-0000-4000-8000-000000000007',
  true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.accept_tenant_invitation(repeat('c', 64));
  EXCEPTION WHEN sqlstate 'P0001' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Revoked invitation was accepted';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '94000000-0000-4000-8000-000000000008',
  true
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.accept_tenant_invitation(repeat('d', 64));
  EXCEPTION WHEN sqlstate 'P0001' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Expired invitation was accepted';
  END IF;
END;
$$;

RESET ROLE;

DO $$
DECLARE
  v_count bigint;
  v_status text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = '94000000-0000-4000-8000-000000000004'
      AND tenant_id = 940000001
      AND tenant_role = 'admin'
      AND email = 'invited@example.test'
  ) THEN
    RAISE EXCEPTION 'Invitation acceptance did not create the intended membership';
  END IF;

  SELECT status INTO v_status
  FROM public.invitation_link_status(repeat('b', 64));
  IF v_status <> 'accepted' THEN
    RAISE EXCEPTION 'Accepted link status is incorrect';
  END IF;
  SELECT status INTO v_status
  FROM public.invitation_link_status(repeat('c', 64));
  IF v_status <> 'revoked' THEN
    RAISE EXCEPTION 'Revoked link status is incorrect';
  END IF;
  SELECT status INTO v_status
  FROM public.invitation_link_status(repeat('d', 64));
  IF v_status <> 'expired' THEN
    RAISE EXCEPTION 'Expired link status is incorrect';
  END IF;
  SELECT status INTO v_status
  FROM public.invitation_link_status(repeat('e', 64));
  IF v_status <> 'invalid' THEN
    RAISE EXCEPTION 'Invalid link status is incorrect';
  END IF;

  SELECT count(*) INTO v_count
  FROM private.audit_log
  WHERE tenant_id = 940000001
    AND action LIKE 'tenant.invitation.%';
  IF v_count <> 8 THEN
    RAISE EXCEPTION 'Invitation audit trail is incomplete: %', v_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM private.audit_log
    WHERE tenant_id = 940000001
      AND metadata::text LIKE '%' || repeat('b', 64) || '%'
  ) THEN
    RAISE EXCEPTION 'Invitation token leaked into audit metadata';
  END IF;
END;
$$;

SELECT 'phase 4 tenant invitations verification passed' AS result;
ROLLBACK;
