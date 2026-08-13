-- Rollback-only verification for Phase 5 object visibility and holder lookup.

BEGIN;

INSERT INTO public.tenant (
  id, institution_name, edition, member_visibility,
  show_object_info_without_authentication
)
OVERRIDING SYSTEM VALUE
VALUES
  (975000001, 'Simple Private', 'simple', 'private', false),
  (975000002, 'Simple Shared', 'simple', 'shared', false),
  (975000003, 'Full Workspace', 'full', 'private', false),
  (975000004, 'Other Workspace', 'full', 'private', true);

INSERT INTO auth.users (id, aud, role, is_sso_user, is_anonymous)
VALUES
  ('97500000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', false, false),
  ('97500000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', false, false),
  ('97500000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', false, false),
  ('97500000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', false, false),
  ('97500000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', false, false),
  ('97500000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', false, false),
  ('97500000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', false, false),
  ('97500000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', false, false),
  ('97500000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', false, false),
  ('97500000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', false, false),
  ('97500000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', false, false),
  ('97500000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', false, false),
  ('97500000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', false, false);

INSERT INTO public.groups (id, tenant_id, title)
OVERRIDING SYSTEM VALUE
VALUES
  (975000001, 975000001, 'Simple Private Group'),
  (975000002, 975000002, 'Simple Shared Group'),
  (975000003, 975000003, 'Full Group One'),
  (975000004, 975000003, 'Full Group Two'),
  (975000005, 975000004, 'Other Group');

INSERT INTO public.user_profiles (
  id, tenant_id, tenant_role, group_id, first_name, last_name
)
VALUES
  ('97500000-0000-4000-8000-000000000001', 975000001, 'owner', 975000001, 'Private', 'Owner'),
  ('97500000-0000-4000-8000-000000000002', 975000001, 'member', 975000001, 'Private', 'Member A'),
  ('97500000-0000-4000-8000-000000000003', 975000001, 'member', 975000001, 'Private', 'Member B'),
  ('97500000-0000-4000-8000-000000000004', 975000002, 'owner', 975000002, 'Shared', 'Owner'),
  ('97500000-0000-4000-8000-000000000005', 975000002, 'member', 975000002, 'Shared', 'Member A'),
  ('97500000-0000-4000-8000-000000000006', 975000002, 'member', 975000002, 'Shared', 'Member B'),
  ('97500000-0000-4000-8000-000000000007', 975000003, 'owner', 975000003, 'Full', 'Owner'),
  ('97500000-0000-4000-8000-000000000008', 975000003, 'admin', 975000003, 'Full', 'Admin'),
  ('97500000-0000-4000-8000-000000000009', 975000003, 'member', 975000003, 'Full', 'Member A'),
  ('97500000-0000-4000-8000-000000000010', 975000003, 'member', 975000003, 'Full', 'Member Peer'),
  ('97500000-0000-4000-8000-000000000011', 975000003, 'member', 975000004, 'Full', 'Other Group'),
  ('97500000-0000-4000-8000-000000000012', 975000003, 'viewer', 975000004, 'Full', 'Viewer'),
  ('97500000-0000-4000-8000-000000000013', 975000004, 'owner', 975000005, 'Other', 'Owner');

INSERT INTO public.categories (id, tenant_id, name)
OVERRIDING SYSTEM VALUE
VALUES
  (975000001, 975000001, 'Private Category'),
  (975000002, 975000002, 'Shared Category'),
  (975000003, 975000003, 'Full Category'),
  (975000004, 975000004, 'Other Category');

INSERT INTO public.event_types (id, tenant_id, label)
OVERRIDING SYSTEM VALUE
VALUES
  (975000001, 975000001, 'phase5-private'),
  (975000002, 975000002, 'phase5-shared'),
  (975000003, 975000003, 'phase5-full'),
  (975000004, 975000004, 'phase5-other');

INSERT INTO public.objects (
  id, tenant_id, name, category_id, current_owner_id, image
)
OVERRIDING SYSTEM VALUE
VALUES
  (975000001, 975000001, 'Private A', 975000001, '97500000-0000-4000-8000-000000000002', '975000001/975000001/a.jpg'),
  (975000002, 975000001, 'Private B', 975000001, '97500000-0000-4000-8000-000000000003', '975000001/975000002/b.jpg'),
  (975000003, 975000002, 'Shared A', 975000002, '97500000-0000-4000-8000-000000000005', '975000002/975000003/a.jpg'),
  (975000004, 975000002, 'Shared B', 975000002, '97500000-0000-4000-8000-000000000006', '975000002/975000004/b.jpg'),
  (975000005, 975000003, 'Full Assigned', 975000003, '97500000-0000-4000-8000-000000000009', '975000003/975000005/a.jpg'),
  (975000006, 975000003, 'Full Group Peer', 975000003, '97500000-0000-4000-8000-000000000010', '975000003/975000006/b.jpg'),
  (975000007, 975000003, 'Full Other Group', 975000003, '97500000-0000-4000-8000-000000000011', '975000003/975000007/c.jpg'),
  (975000008, 975000003, 'Full Viewer Assigned', 975000003, '97500000-0000-4000-8000-000000000012', '975000003/975000008/d.jpg'),
  (975000009, 975000003, 'Full Owner Object', 975000003, '97500000-0000-4000-8000-000000000007', '975000003/975000009/e.jpg'),
  (975000010, 975000004, 'Public Other Object', 975000004, '97500000-0000-4000-8000-000000000013', '975000004/975000010/x.jpg');

INSERT INTO public.events (
  id, tenant_id, group_id, object_id, event_type_id, e_to
)
OVERRIDING SYSTEM VALUE
SELECT
  975000000 + object_record.id - 975000000,
  object_record.tenant_id,
  CASE object_record.tenant_id
    WHEN 975000001 THEN 975000001
    WHEN 975000002 THEN 975000002
    WHEN 975000003 THEN CASE
      WHEN object_record.id IN (975000005, 975000006, 975000009)
        THEN 975000003
      ELSE 975000004
    END
    ELSE 975000005
  END,
  object_record.id,
  CASE object_record.tenant_id
    WHEN 975000001 THEN 975000001
    WHEN 975000002 THEN 975000002
    WHEN 975000003 THEN 975000003
    ELSE 975000004
  END,
  object_record.current_owner_id
FROM public.objects AS object_record
WHERE object_record.id BETWEEN 975000001 AND 975000010;

INSERT INTO storage.objects (bucket_id, name, owner)
SELECT 'object-images', object_record.image, object_record.current_owner_id
FROM public.objects AS object_record
WHERE object_record.id BETWEEN 975000001 AND 975000010;

INSERT INTO public.transfer_requests (
  id, tenant_id, object_id, from_user_id, to_user_id, group_id, status
)
OVERRIDING SYSTEM VALUE
VALUES
  (
    975000001, 975000001, 975000002,
    '97500000-0000-4000-8000-000000000002',
    '97500000-0000-4000-8000-000000000003',
    975000001, 'pending'
  ),
  (
    975000002, 975000003, 975000006,
    '97500000-0000-4000-8000-000000000009',
    '97500000-0000-4000-8000-000000000010',
    975000003, 'pending'
  );

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.aal', 'aal1', true);

-- Simple private Member: assigned object only; old transfer does not bypass
-- the disabled transfer entitlement.
SELECT set_config('request.jwt.claim.sub', '97500000-0000-4000-8000-000000000002', true);
DO $$
DECLARE object_count bigint;
DECLARE event_count bigint;
DECLARE transfer_count bigint;
BEGIN
  SELECT count(*) INTO object_count FROM public.objects
  WHERE tenant_id = 975000001;
  SELECT count(*) INTO event_count FROM public.events
  WHERE tenant_id = 975000001;
  SELECT count(*) INTO transfer_count FROM public.transfer_requests
  WHERE tenant_id = 975000001;
  IF object_count <> 1 OR event_count <> 1 OR transfer_count <> 0
     OR (SELECT count(*) FROM storage.objects
         WHERE bucket_id = 'object-images'
           AND name LIKE '975000001/%') <> 1 THEN
    RAISE EXCEPTION 'Simple private visibility is incorrect: %, %, %',
      object_count, event_count, transfer_count;
  END IF;
  IF public.can_view_object_image('975000001/975000002/b.jpg') THEN
    RAISE EXCEPTION 'Simple private member can read another member image';
  END IF;
  IF (SELECT count(*) FROM public.group_profile_directory()) <> 0 THEN
    RAISE EXCEPTION 'Simple member reached the Full transfer directory';
  END IF;
END;
$$;

-- Simple shared Member: every workspace object and matching event, no writes.
SELECT set_config('request.jwt.claim.sub', '97500000-0000-4000-8000-000000000005', true);
DO $$
DECLARE denied boolean := false;
BEGIN
  IF (SELECT count(*) FROM public.objects WHERE tenant_id = 975000002) <> 2
     OR (SELECT count(*) FROM public.events WHERE tenant_id = 975000002) <> 2
     OR (SELECT count(*) FROM storage.objects
         WHERE bucket_id = 'object-images'
           AND name LIKE '975000002/%') <> 2
     OR NOT public.can_view_object_image('975000002/975000004/b.jpg') THEN
    RAISE EXCEPTION 'Simple shared visibility is incorrect';
  END IF;
  BEGIN
    UPDATE public.objects SET name = 'Forbidden'
    WHERE id = 975000004;
    IF FOUND THEN RAISE EXCEPTION 'Simple Member updated an object'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
END;
$$;

-- Simple Owner sees the complete workspace.
SELECT set_config('request.jwt.claim.sub', '97500000-0000-4000-8000-000000000001', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.objects WHERE tenant_id = 975000001) <> 2 THEN
    RAISE EXCEPTION 'Simple Owner cannot read all workspace objects';
  END IF;
END;
$$;

-- Full Member sees own assignment plus objects held by the same group.
SELECT set_config('request.jwt.claim.sub', '97500000-0000-4000-8000-000000000009', true);
DO $$
DECLARE object_count bigint;
DECLARE event_count bigint;
DECLARE directory_count bigint;
BEGIN
  SELECT count(*) INTO object_count FROM public.objects WHERE tenant_id = 975000003;
  SELECT count(*) INTO event_count FROM public.events WHERE tenant_id = 975000003;
  SELECT count(*) INTO directory_count FROM public.group_profile_directory();
  IF object_count <> 3 OR event_count <> 3 OR directory_count <> 4 THEN
    RAISE EXCEPTION 'Full Member assigned/group scope is incorrect: %, %, %',
      object_count, event_count, directory_count;
  END IF;
  IF (SELECT count(*) FROM storage.objects
      WHERE bucket_id = 'object-images'
        AND name LIKE '975000003/%') <> 3 THEN
    RAISE EXCEPTION 'Full Member storage RLS scope is incorrect';
  END IF;
  IF NOT public.can_view_object_image('975000003/975000006/b.jpg')
     OR public.can_view_object_image('975000003/975000007/c.jpg') THEN
    RAISE EXCEPTION 'Full Member image scope is incorrect';
  END IF;
END;
$$;

-- Viewer sees only the assigned object but can perform the restricted,
-- tenant-scoped holder lookup for another object.
SELECT set_config('request.jwt.claim.sub', '97500000-0000-4000-8000-000000000012', true);
DO $$
DECLARE lookup_result record;
DECLARE denied boolean := false;
BEGIN
  IF (SELECT count(*) FROM public.objects WHERE tenant_id = 975000003) <> 1
     OR (SELECT count(*) FROM public.events WHERE tenant_id = 975000003) <> 1
     OR (SELECT count(*) FROM storage.objects
         WHERE bucket_id = 'object-images'
           AND name LIKE '975000003/%') <> 1
     OR (SELECT count(*) FROM public.group_profile_directory()) <> 0 THEN
    RAISE EXCEPTION 'Viewer assigned-only scope or directory denial is incorrect';
  END IF;
  SELECT * INTO lookup_result FROM public.lookup_object_holder(975000007);
  IF lookup_result.object_name <> 'Full Other Group'
     OR lookup_result.current_holder_name <> 'Full Other Group' THEN
    RAISE EXCEPTION 'Controlled holder lookup returned incorrect data';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lookup_object_holder(975000010)) THEN
    RAISE EXCEPTION 'Controlled holder lookup crossed tenant boundaries';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.object_info(975000008))
     OR NOT EXISTS (SELECT 1 FROM public.object_info_events(975000008))
     OR EXISTS (SELECT 1 FROM public.object_info(975000007))
     OR EXISTS (SELECT 1 FROM public.object_info_events(975000007)) THEN
    RAISE EXCEPTION 'Authenticated QR/RPC visibility does not match Viewer scope';
  END IF;
  BEGIN
    INSERT INTO public.objects (tenant_id, name)
    VALUES (975000003, 'Viewer Write');
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Viewer created an object'; END IF;
END;
$$;

-- Full Admin and Owner retain tenant-wide visibility.
SELECT set_config('request.jwt.claim.sub', '97500000-0000-4000-8000-000000000008', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.objects WHERE tenant_id = 975000003) <> 5 THEN
    RAISE EXCEPTION 'Full Admin visibility was restricted';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '97500000-0000-4000-8000-000000000007', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.objects WHERE tenant_id = 975000003) <> 5 THEN
    RAISE EXCEPTION 'Full Owner visibility was restricted';
  END IF;
END;
$$;

-- Anonymous QR behavior remains a separate tenant-controlled path.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE anon;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.object_info(975000001)) THEN
    RAISE EXCEPTION 'Private object leaked through anonymous QR lookup';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.object_info(975000010))
     OR NOT EXISTS (SELECT 1 FROM public.object_info_events(975000010))
     OR NOT public.can_view_object_image('975000004/975000010/x.jpg')
     OR NOT EXISTS (
       SELECT 1 FROM storage.objects
       WHERE bucket_id = 'object-images'
         AND name = '975000004/975000010/x.jpg'
     ) THEN
    RAISE EXCEPTION 'Configured anonymous QR behavior was broken';
  END IF;
END;
$$;

SELECT 'phase 5 object visibility verification passed' AS result;
ROLLBACK;
