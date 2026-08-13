-- Phase 6: edition-aware workspace administration and in-place upgrades.

CREATE OR REPLACE FUNCTION public.update_current_tenant_workspace(
  p_workspace_kind text,
  p_member_visibility text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id bigint := public.current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.settings.update', v_tenant_id) THEN
    RAISE EXCEPTION 'Permission denied: tenant.settings.update'
      USING ERRCODE = '42501';
  END IF;
  IF p_workspace_kind NOT IN ('family', 'business', 'club', 'other') THEN
    RAISE EXCEPTION 'Invalid workspace kind' USING ERRCODE = '22023';
  END IF;
  IF p_member_visibility NOT IN ('private', 'shared') THEN
    RAISE EXCEPTION 'Invalid member visibility' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tenant
  SET
    workspace_kind = p_workspace_kind,
    member_visibility = p_member_visibility,
    updated_at = now()
  WHERE id = v_tenant_id;
END;
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
  JOIN private.edition_entitlements AS entitlement
    ON entitlement.edition = tenant_record.edition
  WHERE tenant_record.id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upgrade_tenant_to_full(p_tenant_id bigint)
RETURNS TABLE (tenant_id bigint, edition text, upgraded boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_edition text;
BEGIN
  IF NOT public.has_permission('platform.tenants.update') THEN
    RAISE EXCEPTION 'AAL2 platform access is required'
      USING ERRCODE = '42501';
  END IF;
  IF p_tenant_id IS NULL OR p_tenant_id <= 0 THEN
    RAISE EXCEPTION 'Invalid tenant ID' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tenant-edition-upgrade:' || p_tenant_id::text, 0)
  );

  SELECT tenant_record.edition
  INTO v_edition
  FROM public.tenant AS tenant_record
  WHERE tenant_record.id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_edition = 'full' THEN
    RETURN QUERY SELECT p_tenant_id, 'full'::text, false;
    RETURN;
  END IF;
  IF v_edition <> 'simple' THEN
    RAISE EXCEPTION 'Unsupported source edition' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tenant
  SET edition = 'full', updated_at = now()
  WHERE id = p_tenant_id;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_actor_id,
    p_tenant_id,
    'tenant.edition.upgraded',
    'tenant',
    p_tenant_id::text,
    jsonb_build_object('from', 'simple', 'to', 'full', 'strategy', 'in_place')
  );

  RETURN QUERY SELECT p_tenant_id, 'full'::text, true;
END;
$$;

REVOKE ALL ON FUNCTION public.update_current_tenant_workspace(text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_tenant_product_context(bigint)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upgrade_tenant_to_full(bigint)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_current_tenant_workspace(text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_tenant_product_context(bigint)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upgrade_tenant_to_full(bigint)
  TO authenticated;

COMMENT ON FUNCTION public.upgrade_tenant_to_full(bigint) IS
  'AAL2 platform-operator-only, idempotent, in-place Simple-to-Full upgrade. No tenant data or identifiers are copied.';
