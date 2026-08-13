-- Phase 3: authenticated, idempotent self-service Simple provisioning.

CREATE TABLE private.simple_workspace_provisioning (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id bigint NOT NULL UNIQUE REFERENCES public.tenant(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE private.simple_workspace_provisioning_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX simple_workspace_attempts_user_time_idx
  ON private.simple_workspace_provisioning_attempts (user_id, attempted_at DESC);

REVOKE ALL ON private.simple_workspace_provisioning,
  private.simple_workspace_provisioning_attempts
FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON private.simple_workspace_provisioning TO service_role;
GRANT SELECT, INSERT ON private.simple_workspace_provisioning_attempts
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE
  private.simple_workspace_provisioning_attempts_id_seq TO service_role;

DROP TRIGGER tenant_enforce_platform_fields ON public.tenant;
DROP FUNCTION public.enforce_tenant_platform_fields();

CREATE FUNCTION private.enforce_tenant_platform_fields()
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
     )
     AND NOT (SELECT public.is_platform_operator())
     AND NOT v_is_initial_self_provisioning THEN
    RAISE EXCEPTION 'Platform-managed tenant fields cannot be changed here'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_tenant_platform_fields()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tenant_enforce_platform_fields
BEFORE UPDATE ON public.tenant
FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_platform_fields();

CREATE OR REPLACE FUNCTION private.assign_profile_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_current_tenant_id bigint := public.current_tenant_id();
  v_invitation_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    IF NEW.tenant_id IS NULL THEN
      RAISE EXCEPTION 'A tenant is required' USING ERRCODE = '23502';
    END IF;
    RETURN NEW;
  END IF;

  IF v_current_tenant_id IS NOT NULL THEN
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := v_current_tenant_id;
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM v_current_tenant_id THEN
      RAISE EXCEPTION 'Record must belong to the acting user tenant'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id = v_user_id
     AND NEW.tenant_role = 'owner'
     AND EXISTS (
       SELECT 1
       FROM private.simple_workspace_provisioning AS provisioning
       JOIN public.tenant AS tenant_record
         ON tenant_record.id = provisioning.tenant_id
       WHERE provisioning.user_id = v_user_id
         AND provisioning.tenant_id = NEW.tenant_id
         AND tenant_record.edition = 'simple'
         AND tenant_record.status = 'active'
     ) THEN
    RETURN NEW;
  END IF;

  v_invitation_id := NULLIF(
    current_setting('app.accepting_tenant_invitation_id', true),
    ''
  )::uuid;

  IF v_invitation_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM private.tenant_invitations AS invitation
    JOIN auth.users AS invited_user
      ON invited_user.id = v_user_id
     AND lower(invited_user.email) = invitation.invited_email
    WHERE invitation.id = v_invitation_id
      AND invitation.tenant_id = NEW.tenant_id
      AND invitation.accepted_at IS NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expired_at IS NULL
      AND invitation.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'A valid tenant invitation or provisioning context is required'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.assign_profile_tenant()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_simple_workspace(
  p_workspace_name text,
  p_workspace_kind text DEFAULT NULL
)
RETURNS TABLE (
  tenant_id bigint,
  created boolean,
  result_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_user_email text;
  v_email_confirmed_at timestamptz;
  v_workspace_name text := btrim(p_workspace_name);
  v_workspace_kind text := COALESCE(NULLIF(btrim(p_workspace_kind), ''), 'other');
  v_defaults_version integer;
  v_tenant_id bigint;
  v_attempt_count bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  SELECT provisioning.tenant_id INTO v_tenant_id
  FROM private.simple_workspace_provisioning AS provisioning
  JOIN public.user_profiles AS profile
    ON profile.id = provisioning.user_id
   AND profile.tenant_id = provisioning.tenant_id
   AND profile.tenant_role = 'owner'
  JOIN public.tenant AS tenant_record
    ON tenant_record.id = provisioning.tenant_id
   AND tenant_record.edition = 'simple'
  WHERE provisioning.user_id = v_user_id;

  IF v_tenant_id IS NOT NULL THEN
    RETURN QUERY SELECT v_tenant_id, false, 'existing'::text;
    RETURN;
  END IF;

  INSERT INTO private.simple_workspace_provisioning_attempts (user_id)
  VALUES (v_user_id);

  SELECT count(*) INTO v_attempt_count
  FROM private.simple_workspace_provisioning_attempts AS attempt
  WHERE attempt.user_id = v_user_id
    AND attempt.attempted_at > now() - interval '1 hour';

  IF v_attempt_count > 5 THEN
    RETURN QUERY SELECT NULL::bigint, false, 'rate_limited'::text;
    RETURN;
  END IF;

  SELECT lower(users.email), users.email_confirmed_at
  INTO v_user_email, v_email_confirmed_at
  FROM auth.users AS users
  WHERE users.id = v_user_id
  FOR UPDATE;

  IF v_user_email IS NULL OR v_email_confirmed_at IS NULL THEN
    RETURN QUERY SELECT NULL::bigint, false, 'email_unconfirmed'::text;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_profiles AS profile WHERE profile.id = v_user_id
  ) THEN
    RETURN QUERY SELECT NULL::bigint, false, 'already_member'::text;
    RETURN;
  END IF;

  IF v_workspace_name IS NULL OR length(v_workspace_name) NOT BETWEEN 2 AND 200 THEN
    RETURN QUERY SELECT NULL::bigint, false, 'invalid_name'::text;
    RETURN;
  END IF;
  IF v_workspace_kind NOT IN ('family', 'business', 'club', 'collector', 'other') THEN
    RETURN QUERY SELECT NULL::bigint, false, 'invalid_kind'::text;
    RETURN;
  END IF;

  SELECT defaults.version INTO v_defaults_version
  FROM private.tenant_default_versions AS defaults
  WHERE defaults.is_current
  FOR SHARE;
  IF v_defaults_version IS NULL THEN
    RAISE EXCEPTION 'No current tenant defaults version is configured';
  END IF;

  INSERT INTO public.tenant (
    institution_name,
    email,
    edition,
    workspace_kind,
    member_visibility,
    status,
    defaults_version,
    billing_owner_id
  ) VALUES (
    v_workspace_name,
    v_user_email,
    'simple',
    v_workspace_kind,
    'private',
    'active',
    0,
    v_user_id
  ) RETURNING id INTO v_tenant_id;

  INSERT INTO private.simple_workspace_provisioning (user_id, tenant_id)
  VALUES (v_user_id, v_tenant_id);

  PERFORM private.apply_tenant_defaults(v_tenant_id, v_defaults_version);

  UPDATE public.tenant
  SET show_object_info_without_authentication = false
  WHERE id = v_tenant_id;

  INSERT INTO public.user_profiles (
    id, tenant_id, tenant_role, email
  ) VALUES (
    v_user_id, v_tenant_id, 'owner', v_user_email
  );

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_user_id,
    v_tenant_id,
    'tenant.simple_workspace.created',
    'tenant',
    v_tenant_id::text,
    jsonb_build_object(
      'defaults_version', v_defaults_version,
      'workspace_kind', v_workspace_kind,
      'member_visibility', 'private'
    )
  );

  RETURN QUERY SELECT v_tenant_id, true, 'created'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.create_simple_workspace(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_simple_workspace(text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.create_simple_workspace(text, text) IS
  'Creates one idempotent Simple workspace for the confirmed authenticated user.';
