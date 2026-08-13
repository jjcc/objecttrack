-- Rollback-only verification for Phase 6 edition administration and upgrade.

BEGIN;

INSERT INTO public.tenant (
  id, institution_name, edition, workspace_kind, member_visibility, defaults_version
)
OVERRIDING SYSTEM VALUE
VALUES
  (976000001, 'Phase 6 Simple', 'simple', 'family', 'private', 1),
  (976000002, 'Phase 6 Full', 'full', 'business', 'shared', 1);

SELECT private.apply_tenant_defaults(976000001, 1);
SELECT private.apply_tenant_defaults(976000002, 1);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) VALUES
  ('97600000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97600000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'member@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97600000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'operator@example.test', '', now(), now(), now(), '', '', '', ''),
  ('97600000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'outsider@example.test', '', now(), now(), now(), '', '', '', '');

INSERT INTO public.groups (id, tenant_id, title)
OVERRIDING SYSTEM VALUE VALUES (976000001, 976000001, 'Preserved Group');

INSERT INTO public.user_profiles (id, tenant_id, tenant_role, group_id, email)
VALUES
  ('97600000-0000-4000-8000-000000000001', 976000001, 'owner', 976000001, 'owner@example.test'),
  ('97600000-0000-4000-8000-000000000002', 976000001, 'member', 976000001, 'member@example.test');

INSERT INTO private.platform_operators (user_id)
VALUES ('97600000-0000-4000-8000-000000000003');

INSERT INTO public.objects (
  id, tenant_id, name, category_id, current_owner_id, image
)
OVERRIDING SYSTEM VALUE
SELECT
  976000001,
  976000001,
  'Preserved Object',
  min(category.id),
  '97600000-0000-4000-8000-000000000001',
  'object-images/976000001/preserved.jpg'
FROM public.categories AS category
WHERE category.tenant_id = 976000001;

INSERT INTO public.events (
  id, tenant_id, group_id, object_id, event_type_id, e_from, e_to, extra
)
OVERRIDING SYSTEM VALUE
SELECT
  976000001,
  976000001,
  976000001,
  976000001,
  min(event_type.id),
  '97600000-0000-4000-8000-000000000001',
  '97600000-0000-4000-8000-000000000002',
  jsonb_build_object('history', 'preserved')
FROM public.event_types AS event_type
WHERE event_type.tenant_id = 976000001;

INSERT INTO public.transfer_requests (
  id, tenant_id, object_id, from_user_id, to_user_id, group_id, status, reason
)
OVERRIDING SYSTEM VALUE VALUES (
  976000001,
  976000001,
  976000001,
  '97600000-0000-4000-8000-000000000002',
  '97600000-0000-4000-8000-000000000001',
  976000001,
  'approved',
  'Preserved transfer'
);

INSERT INTO private.tenant_invitations (
  id, tenant_id, invited_email, intended_role, invited_by, token_hash, expires_at
) VALUES (
  '97600000-0000-4000-8000-000000000001',
  976000001,
  'invitee@example.test',
  'member',
  '97600000-0000-4000-8000-000000000001',
  decode(repeat('76', 32), 'hex'),
  now() + interval '7 days'
);

CREATE TEMP TABLE phase6_before AS
SELECT jsonb_build_object(
  'users', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
    FROM public.user_profiles AS row_record WHERE row_record.tenant_id = 976000001),
  'objects', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
    FROM public.objects AS row_record WHERE row_record.tenant_id = 976000001),
  'categories', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
    FROM public.categories AS row_record WHERE row_record.tenant_id = 976000001),
  'event_types', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
    FROM public.event_types AS row_record WHERE row_record.tenant_id = 976000001),
  'events', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
    FROM public.events AS row_record WHERE row_record.tenant_id = 976000001),
  'transfers', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
    FROM public.transfer_requests AS row_record WHERE row_record.tenant_id = 976000001),
  'invitations', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
    FROM private.tenant_invitations AS row_record WHERE row_record.tenant_id = 976000001),
  'image_reference', (SELECT image FROM public.objects WHERE id = 976000001),
  'qr_identifier', '/objects/' || 976000001::text
) AS snapshot;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal1', true);
SELECT set_config('request.jwt.claim.sub', '97600000-0000-4000-8000-000000000001', true);

SELECT public.update_current_tenant_workspace('collector', 'shared');

DO $$
DECLARE v_profile record;
BEGIN
  SELECT * INTO v_profile FROM public.tenant_admin_profile();
  IF v_profile.edition <> 'simple'
     OR v_profile.workspace_kind <> 'collector'
     OR v_profile.member_visibility <> 'shared'
     OR v_profile.max_users <> 5
     OR v_profile.max_objects <> 100
     OR v_profile.custom_categories THEN
    RAISE EXCEPTION 'Simple workspace administration context is incorrect';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '97600000-0000-4000-8000-000000000002', true);
DO $$
DECLARE v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.update_current_tenant_workspace('business', 'private');
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Member changed owner-only workspace settings';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '97600000-0000-4000-8000-000000000003', true);
DO $$
DECLARE v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.upgrade_tenant_to_full(976000001);
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'AAL1 platform operator upgraded a tenant';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.aal', 'aal2', true);

SELECT set_config('request.jwt.claim.sub', '97600000-0000-4000-8000-000000000004', true);
DO $$
DECLARE v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.upgrade_tenant_to_full(976000001);
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'AAL2 non-operator upgraded a tenant';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '97600000-0000-4000-8000-000000000003', true);

DO $$
DECLARE
  v_result record;
  v_context record;
BEGIN
  SELECT * INTO v_result FROM public.upgrade_tenant_to_full(976000001);
  IF v_result.tenant_id <> 976000001 OR v_result.edition <> 'full' OR NOT v_result.upgraded THEN
    RAISE EXCEPTION 'Simple-to-Full upgrade result is incorrect';
  END IF;

  SELECT * INTO v_context FROM public.platform_tenant_product_context(976000001);
  IF v_context.edition <> 'full'
     OR v_context.max_users IS NOT NULL
     OR v_context.max_objects IS NOT NULL
     OR NOT v_context.custom_categories
     OR NOT v_context.groups
     OR NOT v_context.advanced_transfers
     OR NOT v_context.reports
     OR NOT v_context.audit_ui THEN
    RAISE EXCEPTION 'Full entitlements were not immediately activated';
  END IF;

  SELECT * INTO v_result FROM public.upgrade_tenant_to_full(976000001);
  IF v_result.upgraded OR v_result.edition <> 'full' THEN
    RAISE EXCEPTION 'Upgrade replay was not idempotent';
  END IF;

  SELECT * INTO v_result FROM public.upgrade_tenant_to_full(976000002);
  IF v_result.upgraded OR v_result.edition <> 'full' THEN
    RAISE EXCEPTION 'Existing Full tenant was not an idempotent no-op';
  END IF;
END;
$$;

RESET ROLE;

DO $$
DECLARE
  v_before jsonb;
  v_after jsonb;
BEGIN
  SELECT snapshot INTO v_before FROM phase6_before;
  SELECT jsonb_build_object(
    'users', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
      FROM public.user_profiles AS row_record WHERE row_record.tenant_id = 976000001),
    'objects', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
      FROM public.objects AS row_record WHERE row_record.tenant_id = 976000001),
    'categories', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
      FROM public.categories AS row_record WHERE row_record.tenant_id = 976000001),
    'event_types', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
      FROM public.event_types AS row_record WHERE row_record.tenant_id = 976000001),
    'events', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
      FROM public.events AS row_record WHERE row_record.tenant_id = 976000001),
    'transfers', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
      FROM public.transfer_requests AS row_record WHERE row_record.tenant_id = 976000001),
    'invitations', (SELECT jsonb_agg(to_jsonb(row_record) ORDER BY row_record.id)
      FROM private.tenant_invitations AS row_record WHERE row_record.tenant_id = 976000001),
    'image_reference', (SELECT image FROM public.objects WHERE id = 976000001),
    'qr_identifier', '/objects/' || 976000001::text
  ) INTO v_after;

  IF v_before IS DISTINCT FROM v_after THEN
    RAISE EXCEPTION 'Upgrade changed tenant data or identifiers';
  END IF;
  IF (SELECT edition FROM public.tenant WHERE id = 976000001) <> 'full' THEN
    RAISE EXCEPTION 'Tenant edition did not persist as Full';
  END IF;
  IF (SELECT count(*) FROM private.audit_log
      WHERE tenant_id = 976000001 AND action = 'tenant.edition.upgraded') <> 1 THEN
    RAISE EXCEPTION 'Upgrade did not emit exactly one dedicated audit event';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE tenant_id = 976000001 AND tenant_role NOT IN ('owner', 'member')
  ) THEN
    RAISE EXCEPTION 'Existing tenant roles changed during upgrade';
  END IF;
END;
$$;

SELECT 'phase 6 edition administration and upgrade verification passed' AS result;
ROLLBACK;
