-- Billing Phase 1: commercial plan catalog above the edition capability model.
--
-- Adds `plan_code` as the commercial identity of a workspace and repoints every
-- entitlement lookup from `private.edition_entitlements` (keyed by edition) to
-- `private.subscription_plans` (keyed by plan). `edition` is unchanged and
-- remains what authorization reads: it still decides which roles exist and how
-- member visibility behaves. A plan resolves *to* an edition.
--
-- Behaviour-preserving by construction:
--   * existing simple workspaces backfill to `hobby`, which carries the same
--     5-user / 100-object allowance simple has today;
--   * existing full workspaces backfill to `business`, which is unlimited;
--   * no function signature changes, so the Flutter RPC contract is untouched.
--
-- New self-service signups get `free` (10 objects / 2 users). That is the only
-- intentional behaviour change, and it applies to workspaces created after this
-- migration, never to existing ones.
--
-- private.edition_entitlements is deliberately left in place. It is no longer
-- read by anything after this migration and is dropped in a later phase once
-- that has been confirmed in production.

CREATE TABLE private.subscription_plans (
  code text PRIMARY KEY,
  edition text NOT NULL,
  max_users integer,
  max_objects integer,
  custom_categories boolean NOT NULL,
  groups boolean NOT NULL,
  advanced_transfers boolean NOT NULL,
  reports boolean NOT NULL,
  audit_ui boolean NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default_for_edition boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL,
  CONSTRAINT subscription_plans_edition_check
    CHECK (edition IN ('simple', 'full')),
  CONSTRAINT subscription_plans_max_users_check
    CHECK (max_users IS NULL OR max_users > 0),
  CONSTRAINT subscription_plans_max_objects_check
    CHECK (max_objects IS NULL OR max_objects > 0)
);

ALTER TABLE private.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Exactly one plan per edition is the fallback used when a workspace is created
-- without an explicit plan.
CREATE UNIQUE INDEX subscription_plans_one_default_per_edition
  ON private.subscription_plans (edition)
  WHERE is_default_for_edition;

INSERT INTO private.subscription_plans (
  code, edition, max_users, max_objects,
  custom_categories, groups, advanced_transfers, reports, audit_ui,
  is_default_for_edition, sort_order
) VALUES
  ('free',     'simple',   2,   10, false, false, false, false, false, true,  1),
  ('hobby',    'simple',   5,  100, false, false, false, false, false, false, 2),
  ('business', 'full',  NULL, NULL, true,  true,  true,  true,  true,  true,  3);

REVOKE ALL ON private.subscription_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.subscription_plans TO service_role;

COMMENT ON TABLE private.subscription_plans IS
  'Commercial plans. Each plan resolves to an edition and carries the quota and '
  'feature entitlements for workspaces on that plan.';

ALTER TABLE public.tenant
  ADD COLUMN plan_code text REFERENCES private.subscription_plans(code);

-- Grandfather existing workspaces: simple keeps its current allowance.
UPDATE public.tenant SET plan_code = 'hobby' WHERE edition = 'simple';
UPDATE public.tenant SET plan_code = 'business' WHERE edition = 'full';

ALTER TABLE public.tenant ALTER COLUMN plan_code SET NOT NULL;

COMMENT ON COLUMN public.tenant.plan_code IS
  'Commercial plan. Authoritative for quotas and feature entitlements. The '
  'edition column stays authoritative for roles and visibility and is kept in '
  'step with this column by private.sync_tenant_plan_edition().';

-- Plan and edition must never disagree. Whichever one a writer changes, the
-- other follows.
CREATE OR REPLACE FUNCTION private.sync_tenant_plan_edition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_edition text;
  v_plan text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.plan_code IS NULL THEN
      SELECT plan.code INTO v_plan
      FROM private.subscription_plans AS plan
      WHERE plan.edition = NEW.edition
        AND plan.is_default_for_edition;
      IF v_plan IS NULL THEN
        RAISE EXCEPTION 'No default plan for edition %', NEW.edition
          USING ERRCODE = '22023';
      END IF;
      NEW.plan_code := v_plan;
    ELSE
      SELECT plan.edition INTO v_edition
      FROM private.subscription_plans AS plan
      WHERE plan.code = NEW.plan_code;
      NEW.edition := v_edition;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.plan_code IS DISTINCT FROM OLD.plan_code THEN
    SELECT plan.edition INTO v_edition
    FROM private.subscription_plans AS plan
    WHERE plan.code = NEW.plan_code;
    NEW.edition := v_edition;
  ELSIF NEW.edition IS DISTINCT FROM OLD.edition THEN
    SELECT plan.code INTO v_plan
    FROM private.subscription_plans AS plan
    WHERE plan.edition = NEW.edition
      AND plan.is_default_for_edition;
    IF v_plan IS NULL THEN
      RAISE EXCEPTION 'No default plan for edition %', NEW.edition
        USING ERRCODE = '22023';
    END IF;
    NEW.plan_code := v_plan;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_tenant_plan_edition()
  FROM PUBLIC, anon, authenticated;

-- Runs before the platform-field guard so that a derived edition change is
-- evaluated by that guard rather than sneaking past it.
CREATE TRIGGER tenant_sync_plan_edition
BEFORE INSERT OR UPDATE ON public.tenant
FOR EACH ROW EXECUTE FUNCTION private.sync_tenant_plan_edition();

-- Per-tenant resolved entitlements. Every consumer joins this instead of
-- joining edition_entitlements on edition.
CREATE VIEW private.tenant_entitlements AS
SELECT
  tenant_record.id AS tenant_id,
  plan.code AS plan_code,
  plan.edition,
  plan.max_users,
  plan.max_objects,
  plan.custom_categories,
  plan.groups,
  plan.advanced_transfers,
  plan.reports,
  plan.audit_ui
FROM public.tenant AS tenant_record
JOIN private.subscription_plans AS plan
  ON plan.code = tenant_record.plan_code;

REVOKE ALL ON private.tenant_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.tenant_entitlements TO service_role;

-- Protect plan_code the same way edition is protected: only a platform
-- operator or a trusted server-side identity may change it.
--
-- Note this replaces the `private` copy, which is the one the
-- tenant_enforce_platform_fields trigger actually calls. A now-unused
-- `public.enforce_tenant_platform_fields` also exists from an earlier
-- migration and is deliberately left alone.
CREATE OR REPLACE FUNCTION private.enforce_tenant_platform_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_is_initial_self_provisioning boolean := false;
BEGIN
  IF v_actor_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM private.simple_workspace_provisioning AS provisioning
      WHERE provisioning.user_id = v_actor_id
        AND provisioning.tenant_id = NEW.id
        AND NEW.edition = 'simple'
        AND NOT EXISTS (
          SELECT 1 FROM public.user_profiles AS profile
          WHERE profile.id = v_actor_id
        )
    ) INTO v_is_initial_self_provisioning;
  END IF;

  IF v_actor_id IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.status_reason IS DISTINCT FROM NEW.status_reason
       OR OLD.suspended_at IS DISTINCT FROM NEW.suspended_at
       OR OLD.defaults_version IS DISTINCT FROM NEW.defaults_version
       OR OLD.billing_owner_id IS DISTINCT FROM NEW.billing_owner_id
       OR OLD.edition IS DISTINCT FROM NEW.edition
       OR OLD.plan_code IS DISTINCT FROM NEW.plan_code
     )
     AND NOT (SELECT public.is_platform_operator())
     AND NOT v_is_initial_self_provisioning THEN
    RAISE EXCEPTION 'Platform-managed tenant fields cannot be changed here'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Repointed consumers. Bodies are unchanged apart from the entitlement join.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_tenant_entitlement(
  p_entitlement text,
  p_tenant_id bigint DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH caller AS (
    SELECT profile.tenant_id
    FROM public.user_profiles AS profile
    WHERE profile.id = (SELECT auth.uid())
  )
  SELECT COALESCE(
    (
      SELECT CASE p_entitlement
        WHEN 'custom_categories' THEN entitlement.custom_categories
        WHEN 'groups' THEN entitlement.groups
        WHEN 'advanced_transfers' THEN entitlement.advanced_transfers
        WHEN 'reports' THEN entitlement.reports
        WHEN 'audit_ui' THEN entitlement.audit_ui
        ELSE false
      END
      FROM caller
      JOIN public.tenant AS tenant_record
        ON tenant_record.id = caller.tenant_id
       AND tenant_record.id = COALESCE(p_tenant_id, caller.tenant_id)
       AND tenant_record.status = 'active'
      JOIN private.tenant_entitlements AS entitlement
        ON entitlement.tenant_id = tenant_record.id
    ),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_product_context()
RETURNS TABLE (
  tenant_id bigint,
  edition text,
  workspace_kind text,
  member_visibility text,
  tenant_status text,
  max_users integer,
  max_objects integer,
  custom_categories boolean,
  groups boolean,
  advanced_transfers boolean,
  reports boolean,
  audit_ui boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    tenant_record.id,
    tenant_record.edition,
    tenant_record.workspace_kind,
    tenant_record.member_visibility,
    tenant_record.status,
    entitlement.max_users,
    entitlement.max_objects,
    entitlement.custom_categories,
    entitlement.groups,
    entitlement.advanced_transfers,
    entitlement.reports,
    entitlement.audit_ui
  FROM public.user_profiles AS profile
  JOIN public.tenant AS tenant_record
    ON tenant_record.id = profile.tenant_id
  JOIN private.tenant_entitlements AS entitlement
    ON entitlement.tenant_id = tenant_record.id
  WHERE profile.id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.tenant_admin_profile()
RETURNS TABLE (
  id bigint,
  institution_name text,
  description text,
  address text,
  contact text,
  phone text,
  email text,
  website text,
  social_media jsonb,
  show_object_info_without_authentication boolean,
  edition text,
  workspace_kind text,
  member_visibility text,
  max_users integer,
  max_objects integer,
  custom_categories boolean,
  groups boolean,
  advanced_transfers boolean,
  reports boolean,
  audit_ui boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    tenant_record.id,
    tenant_record.institution_name,
    tenant_record.description,
    tenant_record.address,
    tenant_record.contact,
    tenant_record.phone,
    tenant_record.email,
    tenant_record.website,
    tenant_record.social_media,
    tenant_record.show_object_info_without_authentication,
    tenant_record.edition,
    tenant_record.workspace_kind,
    tenant_record.member_visibility,
    entitlement.max_users,
    entitlement.max_objects,
    entitlement.custom_categories,
    entitlement.groups,
    entitlement.advanced_transfers,
    entitlement.reports,
    entitlement.audit_ui
  FROM public.tenant AS tenant_record
  JOIN private.tenant_entitlements AS entitlement
    ON entitlement.tenant_id = tenant_record.id
  WHERE tenant_record.id = public.current_tenant_id()
    AND public.has_permission('tenant.settings.update', tenant_record.id)
$$;

CREATE OR REPLACE FUNCTION private.enforce_object_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max integer;
  v_count bigint;
BEGIN
  SELECT entitlement.max_objects INTO v_max
  FROM public.tenant AS tenant_record
  JOIN private.tenant_entitlements AS entitlement
    ON entitlement.tenant_id = tenant_record.id
  WHERE tenant_record.id = NEW.tenant_id;
  IF v_max IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quota:objects:' || NEW.tenant_id::text, 0)
  );
  SELECT count(*) INTO v_count
  FROM public.objects AS object_record
  WHERE object_record.tenant_id = NEW.tenant_id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'quota.objects.exceeded' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_profile_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max integer;
  v_reserved bigint;
  v_accepting_invitation_id uuid := NULLIF(
    current_setting('app.accepting_tenant_invitation_id', true), ''
  )::uuid;
BEGIN
  SELECT entitlement.max_users INTO v_max
  FROM public.tenant AS tenant_record
  JOIN private.tenant_entitlements AS entitlement
    ON entitlement.tenant_id = tenant_record.id
  WHERE tenant_record.id = NEW.tenant_id;
  IF v_max IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quota:users:' || NEW.tenant_id::text, 0)
  );
  SELECT
    (SELECT count(*) FROM public.user_profiles AS profile
      WHERE profile.tenant_id = NEW.tenant_id)
    +
    (SELECT count(*) FROM private.tenant_invitations AS invitation
      WHERE invitation.tenant_id = NEW.tenant_id
        AND invitation.id IS DISTINCT FROM v_accepting_invitation_id
        AND invitation.accepted_at IS NULL
        AND invitation.revoked_at IS NULL
        AND invitation.expired_at IS NULL
        AND invitation.expires_at > now())
  INTO v_reserved;
  IF v_reserved >= v_max THEN
    RAISE EXCEPTION 'quota.users.exceeded' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_invitation_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max integer;
  v_reserved bigint;
BEGIN
  SELECT entitlement.max_users INTO v_max
  FROM public.tenant AS tenant_record
  JOIN private.tenant_entitlements AS entitlement
    ON entitlement.tenant_id = tenant_record.id
  WHERE tenant_record.id = NEW.tenant_id;
  IF v_max IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quota:users:' || NEW.tenant_id::text, 0)
  );
  SELECT
    (SELECT count(*) FROM public.user_profiles AS profile
      WHERE profile.tenant_id = NEW.tenant_id)
    +
    (SELECT count(*) FROM private.tenant_invitations AS invitation
      WHERE invitation.tenant_id = NEW.tenant_id
        AND invitation.accepted_at IS NULL
        AND invitation.revoked_at IS NULL
        AND invitation.expired_at IS NULL
        AND invitation.expires_at > now())
  INTO v_reserved;
  IF v_reserved >= v_max THEN
    RAISE EXCEPTION 'quota.users.exceeded' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_usage()
RETURNS TABLE (
  active_users bigint,
  pending_invitations bigint,
  max_users integer,
  object_count bigint,
  max_objects integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT count(*) FROM public.user_profiles AS member
      WHERE member.tenant_id = tenant_record.id),
    (SELECT count(*) FROM private.tenant_invitations AS invitation
      WHERE invitation.tenant_id = tenant_record.id
        AND invitation.accepted_at IS NULL
        AND invitation.revoked_at IS NULL
        AND invitation.expired_at IS NULL
        AND invitation.expires_at > now()),
    entitlement.max_users,
    (SELECT count(*) FROM public.objects AS object_record
      WHERE object_record.tenant_id = tenant_record.id),
    entitlement.max_objects
  FROM public.user_profiles AS profile
  JOIN public.tenant AS tenant_record ON tenant_record.id = profile.tenant_id
  JOIN private.tenant_entitlements AS entitlement
    ON entitlement.tenant_id = tenant_record.id
  WHERE profile.id = (SELECT auth.uid())
    AND tenant_record.status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.platform_tenant_product_context(
  p_tenant_id bigint
)
RETURNS TABLE (
  tenant_id bigint,
  edition text,
  workspace_kind text,
  member_visibility text,
  max_users integer,
  active_users bigint,
  pending_invitations bigint,
  max_objects integer,
  object_count bigint,
  custom_categories boolean,
  groups boolean,
  advanced_transfers boolean,
  reports boolean,
  audit_ui boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_permission('platform.tenants.update') THEN
    RAISE EXCEPTION 'AAL2 platform access is required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    tenant_record.id,
    tenant_record.edition,
    tenant_record.workspace_kind,
    tenant_record.member_visibility,
    entitlement.max_users,
    (SELECT count(*) FROM public.user_profiles AS member
      WHERE member.tenant_id = tenant_record.id),
    (SELECT count(*) FROM private.tenant_invitations AS invitation
      WHERE invitation.tenant_id = tenant_record.id
        AND invitation.accepted_at IS NULL
        AND invitation.revoked_at IS NULL
        AND invitation.expired_at IS NULL
        AND invitation.expires_at > now()),
    entitlement.max_objects,
    (SELECT count(*) FROM public.objects AS object_record
      WHERE object_record.tenant_id = tenant_record.id),
    entitlement.custom_categories,
    entitlement.groups,
    entitlement.advanced_transfers,
    entitlement.reports,
    entitlement.audit_ui
  FROM public.tenant AS tenant_record
  JOIN private.tenant_entitlements AS entitlement
    ON entitlement.tenant_id = tenant_record.id
  WHERE tenant_record.id = p_tenant_id;
END;
$$;
