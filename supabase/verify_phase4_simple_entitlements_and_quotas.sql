-- Rollback-only verification for Phase 4 Simple entitlements and quotas.

BEGIN;

UPDATE private.edition_entitlements
SET max_users = 2, max_objects = 2
WHERE edition = 'simple';

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) VALUES
  ('97400000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'simple-owner@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97400000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'simple-member@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97400000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'extra-member@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97400000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'full-owner@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO public.tenant (id, institution_name, edition, defaults_version)
OVERRIDING SYSTEM VALUE
VALUES
  (974000001, 'Simple Test', 'simple', 1),
  (974000002, 'Full Test', 'full', 1);

SELECT private.apply_tenant_defaults(974000001, 1);
SELECT private.apply_tenant_defaults(974000002, 1);

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
VALUES
  ('97400000-0000-4000-8000-000000000001', 974000001, 'owner', 'simple-owner@example.test'),
  ('97400000-0000-4000-8000-000000000004', 974000002, 'owner', 'full-owner@example.test');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.categories
      WHERE tenant_id = 974000001 AND system_managed) <> 6 THEN
    RAISE EXCEPTION 'Simple predefined categories are not system-managed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.categories
      WHERE tenant_id = 974000002 AND system_managed) THEN
    RAISE EXCEPTION 'Full default categories were incorrectly locked';
  END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal1', true);
SELECT set_config('request.jwt.claim.sub', '97400000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  denied boolean := false;
BEGIN
  IF public.has_permission('tenant.categories.manage', 974000001)
     OR public.has_permission('tenant.groups.manage', 974000001)
     OR public.has_permission('tenant.transfers.participate', 974000001)
     OR public.has_permission('tenant.reports.generate', 974000001)
     OR public.has_permission('tenant.audit.read', 974000001) THEN
    RAISE EXCEPTION 'Simple Full-only permissions remain enabled';
  END IF;

  BEGIN
    INSERT INTO public.categories (tenant_id, name)
    VALUES (974000001, 'Custom');
  EXCEPTION WHEN insufficient_privilege THEN
    denied := SQLERRM = 'entitlement.custom_categories.required';
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Simple category creation was not denied'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.groups (tenant_id, title)
    VALUES (974000001, 'Restricted Group');
  EXCEPTION WHEN insufficient_privilege THEN
    denied := SQLERRM = 'entitlement.groups.required';
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Simple group creation was not denied'; END IF;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO public.objects (tenant_id, name) VALUES
  (974000001, 'Object One'),
  (974000001, 'Object Two');

DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.objects (tenant_id, name)
    VALUES (974000001, 'Object Three');
  EXCEPTION WHEN raise_exception THEN
    denied := SQLERRM = 'quota.objects.exceeded';
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Simple object quota was not enforced'; END IF;

  INSERT INTO public.objects (tenant_id, name)
  SELECT 974000002, 'Full Object ' || value
  FROM generate_series(1, 3) AS value;
END;
$$;

INSERT INTO private.tenant_invitations (
  tenant_id, invited_email, intended_role, invited_by, token_hash, expires_at
) VALUES (
  974000001,
  'simple-member@example.test',
  'member',
  '97400000-0000-4000-8000-000000000001',
  decode(repeat('ab', 32), 'hex'),
  now() + interval '7 days'
);

DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO private.tenant_invitations (
      tenant_id, invited_email, intended_role, invited_by, token_hash, expires_at
    ) VALUES (
      974000001,
      'extra-member@example.test',
      'member',
      '97400000-0000-4000-8000-000000000001',
      decode(repeat('cd', 32), 'hex'),
      now() + interval '7 days'
    );
  EXCEPTION WHEN raise_exception THEN
    denied := SQLERRM = 'quota.users.exceeded';
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Invitation seat reservation was not enforced'; END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '97400000-0000-4000-8000-000000000002', true);
SELECT public.accept_tenant_invitation(encode(decode(repeat('ab', 32), 'hex'), 'hex'));

SELECT set_config('request.jwt.claim.sub', '97400000-0000-4000-8000-000000000001', true);
DO $$
DECLARE usage record;
BEGIN
  SELECT * INTO usage FROM public.current_tenant_usage();
  IF usage.active_users <> 2
     OR usage.pending_invitations <> 0
     OR usage.max_users <> 2
     OR usage.object_count <> 2
     OR usage.max_objects <> 2 THEN
    RAISE EXCEPTION 'Current tenant usage is incorrect: %', row_to_json(usage);
  END IF;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.user_profiles (id, tenant_id, tenant_role, email)
    VALUES (
      '97400000-0000-4000-8000-000000000003',
      974000001,
      'member',
      'extra-member@example.test'
    );
  EXCEPTION WHEN raise_exception THEN
    denied := SQLERRM = 'quota.users.exceeded';
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Active member quota was not enforced'; END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '97400000-0000-4000-8000-000000000004', true);

DO $$
BEGIN
  IF NOT public.has_permission('tenant.categories.manage', 974000002)
     OR NOT public.has_permission('tenant.groups.manage', 974000002)
     OR NOT public.has_permission('tenant.transfers.participate', 974000002)
     OR NOT public.has_permission('tenant.reports.generate', 974000002)
     OR NOT public.has_permission('tenant.audit.read', 974000002) THEN
    RAISE EXCEPTION 'Full permissions were incorrectly restricted';
  END IF;
  INSERT INTO public.categories (tenant_id, name) VALUES (974000002, 'Custom');
  INSERT INTO public.groups (tenant_id, title) VALUES (974000002, 'Full Group');
END;
$$;

SELECT 'phase 4 Simple entitlement and quota verification passed' AS result;
ROLLBACK;
