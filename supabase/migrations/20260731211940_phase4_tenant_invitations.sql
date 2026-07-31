-- Phase 4: secure, tenant-scoped, single-use invitations.

CREATE TABLE private.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id bigint NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  intended_role text NOT NULL
    CHECK (intended_role IN ('member', 'admin', 'owner')),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expired_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  delivery_error text,
  CONSTRAINT tenant_invitation_email_format CHECK (
    invited_email = lower(btrim(invited_email))
    AND invited_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  CONSTRAINT tenant_invitation_expiry_after_creation CHECK (
    expires_at > created_at
  ),
  CONSTRAINT tenant_invitation_acceptance_pair CHECK (
    (accepted_at IS NULL AND accepted_by IS NULL)
    OR (accepted_at IS NOT NULL AND accepted_by IS NOT NULL)
  ),
  CONSTRAINT tenant_invitation_revocation_pair CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
  )
);

CREATE UNIQUE INDEX tenant_invitations_one_active_email_idx
  ON private.tenant_invitations (tenant_id, invited_email)
  WHERE accepted_at IS NULL
    AND revoked_at IS NULL
    AND expired_at IS NULL;
CREATE INDEX tenant_invitations_tenant_created_idx
  ON private.tenant_invitations (tenant_id, created_at DESC);
CREATE INDEX tenant_invitations_invited_by_idx
  ON private.tenant_invitations (invited_by);
CREATE INDEX tenant_invitations_accepted_by_idx
  ON private.tenant_invitations (accepted_by)
  WHERE accepted_by IS NOT NULL;
CREATE INDEX tenant_invitations_revoked_by_idx
  ON private.tenant_invitations (revoked_by)
  WHERE revoked_by IS NOT NULL;

CREATE TABLE private.invitation_delivery_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invitation_id uuid NOT NULL
    REFERENCES private.tenant_invitations(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invitation_delivery_attempts_invitation_time_idx
  ON private.invitation_delivery_attempts (invitation_id, attempted_at DESC);
CREATE INDEX invitation_delivery_attempts_actor_time_idx
  ON private.invitation_delivery_attempts (actor_id, attempted_at DESC);

REVOKE ALL ON private.tenant_invitations,
  private.invitation_delivery_attempts
FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON private.tenant_invitations TO service_role;
GRANT SELECT, INSERT ON private.invitation_delivery_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE private.invitation_delivery_attempts_id_seq
  TO service_role;

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
    RAISE EXCEPTION 'A valid tenant invitation is required'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.assign_profile_tenant() FROM PUBLIC;

DROP TRIGGER profiles_assign_current_tenant ON public.user_profiles;
CREATE TRIGGER profiles_assign_current_tenant
BEFORE INSERT ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION private.assign_profile_tenant();

CREATE OR REPLACE FUNCTION public.create_tenant_invitation(
  p_invited_email text,
  p_intended_role text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS TABLE (
  invitation_id uuid,
  invited_email text,
  tenant_name text,
  intended_role text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
  v_actor_role text := public.current_tenant_role();
  v_email text := lower(btrim(p_invited_email));
  v_invitation_id uuid;
  v_tenant_name text;
BEGIN
  IF v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.users.invite', v_tenant_id) THEN
    RAISE EXCEPTION 'Permission denied: tenant.users.invite'
      USING ERRCODE = '42501';
  END IF;
  IF v_email IS NULL
     OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'A valid invitation email is required'
      USING ERRCODE = '22023';
  END IF;
  IF p_intended_role NOT IN ('member', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Unsupported invitation role' USING ERRCODE = '22023';
  END IF;
  IF p_intended_role = 'owner' AND v_actor_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only a tenant owner can invite another owner'
      USING ERRCODE = '42501';
  END IF;
  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invitation token hash is invalid' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at <= now() OR p_expires_at > now() + interval '30 days' THEN
    RAISE EXCEPTION 'Invitation expiry must be within the next 30 days'
      USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(*)
    FROM private.tenant_invitations AS recent
    WHERE recent.invited_by = v_actor_id
      AND recent.created_at > now() - interval '1 hour'
  ) >= 10 THEN
    RAISE EXCEPTION 'Invitation creation rate limit exceeded'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE private.tenant_invitations AS invitation
  SET expired_at = now()
  WHERE invitation.tenant_id = v_tenant_id
    AND invitation.invited_email = v_email
    AND invitation.accepted_at IS NULL
    AND invitation.revoked_at IS NULL
    AND invitation.expired_at IS NULL
    AND invitation.expires_at <= now();

  IF EXISTS (
    SELECT 1
    FROM public.user_profiles AS profile
    WHERE profile.tenant_id = v_tenant_id
      AND lower(profile.email) = v_email
  ) THEN
    RAISE EXCEPTION 'This email already belongs to a tenant member'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO private.tenant_invitations (
    tenant_id,
    invited_email,
    intended_role,
    invited_by,
    token_hash,
    expires_at
  ) VALUES (
    v_tenant_id,
    v_email,
    p_intended_role,
    v_actor_id,
    decode(p_token_hash, 'hex'),
    p_expires_at
  )
  RETURNING id INTO v_invitation_id;

  INSERT INTO private.invitation_delivery_attempts (
    invitation_id, actor_id
  ) VALUES (
    v_invitation_id, v_actor_id
  );

  SELECT tenant.institution_name INTO v_tenant_name
  FROM public.tenant AS tenant
  WHERE tenant.id = v_tenant_id;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_actor_id,
    v_tenant_id,
    'tenant.invitation.created',
    'tenant_invitation',
    v_invitation_id::text,
    jsonb_build_object(
      'invited_email', v_email,
      'intended_role', p_intended_role,
      'expires_at', p_expires_at
    )
  );

  RETURN QUERY SELECT
    v_invitation_id,
    v_email,
    v_tenant_name,
    p_intended_role,
    p_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_invitations()
RETURNS TABLE (
  id uuid,
  invited_email text,
  intended_role text,
  status text,
  delivery_status text,
  created_at timestamptz,
  expires_at timestamptz,
  last_sent_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    invitation.id,
    invitation.invited_email,
    invitation.intended_role,
    CASE
      WHEN invitation.accepted_at IS NOT NULL THEN 'accepted'
      WHEN invitation.revoked_at IS NOT NULL THEN 'revoked'
      WHEN invitation.expired_at IS NOT NULL OR invitation.expires_at <= now()
        THEN 'expired'
      ELSE 'pending'
    END,
    invitation.delivery_status,
    invitation.created_at,
    invitation.expires_at,
    invitation.last_sent_at,
    invitation.accepted_at,
    invitation.revoked_at
  FROM private.tenant_invitations AS invitation
  WHERE invitation.tenant_id = public.current_tenant_id()
    AND public.has_permission('tenant.users.invite', invitation.tenant_id)
  ORDER BY invitation.created_at DESC, invitation.id
$$;

CREATE OR REPLACE FUNCTION public.prepare_tenant_invitation_resend(
  p_invitation_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS TABLE (
  invited_email text,
  tenant_name text,
  intended_role text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
  v_last_attempt timestamptz;
  v_email text;
  v_role text;
  v_tenant_name text;
BEGIN
  IF v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.users.invite', v_tenant_id) THEN
    RAISE EXCEPTION 'Permission denied: tenant.users.invite'
      USING ERRCODE = '42501';
  END IF;
  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invitation token hash is invalid' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at <= now() OR p_expires_at > now() + interval '30 days' THEN
    RAISE EXCEPTION 'Invitation expiry must be within the next 30 days'
      USING ERRCODE = '22023';
  END IF;

  SELECT max(attempt.attempted_at) INTO v_last_attempt
  FROM private.invitation_delivery_attempts AS attempt
  WHERE attempt.invitation_id = p_invitation_id;

  IF v_last_attempt > now() - interval '60 seconds' THEN
    RAISE EXCEPTION 'Wait at least 60 seconds before resending'
      USING ERRCODE = 'P0001';
  END IF;
  IF (
    SELECT count(*)
    FROM private.invitation_delivery_attempts AS attempt
    WHERE attempt.actor_id = v_actor_id
      AND attempt.attempted_at > now() - interval '1 hour'
  ) >= 5 THEN
    RAISE EXCEPTION 'Invitation resend rate limit exceeded'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT invitation.invited_email, invitation.intended_role
  INTO v_email, v_role
  FROM private.tenant_invitations AS invitation
  WHERE invitation.id = p_invitation_id
    AND invitation.tenant_id = v_tenant_id
    AND invitation.accepted_at IS NULL
    AND invitation.revoked_at IS NULL
    AND invitation.expired_at IS NULL
    AND invitation.expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending invitation not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE private.tenant_invitations
  SET
    token_hash = decode(p_token_hash, 'hex'),
    expires_at = p_expires_at,
    delivery_status = 'pending',
    delivery_error = NULL
  WHERE id = p_invitation_id;

  INSERT INTO private.invitation_delivery_attempts (
    invitation_id, actor_id
  ) VALUES (
    p_invitation_id, v_actor_id
  );

  SELECT tenant.institution_name INTO v_tenant_name
  FROM public.tenant AS tenant
  WHERE tenant.id = v_tenant_id;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id
  ) VALUES (
    v_actor_id,
    v_tenant_id,
    'tenant.invitation.resent',
    'tenant_invitation',
    p_invitation_id::text
  );

  RETURN QUERY SELECT v_email, v_tenant_name, v_role, p_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_tenant_invitation_delivery(
  p_invitation_id uuid,
  p_succeeded boolean,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.users.invite', v_tenant_id) THEN
    RAISE EXCEPTION 'Permission denied: tenant.users.invite'
      USING ERRCODE = '42501';
  END IF;

  UPDATE private.tenant_invitations
  SET
    delivery_status = CASE WHEN p_succeeded THEN 'sent' ELSE 'failed' END,
    delivery_error = CASE
      WHEN p_succeeded THEN NULL
      ELSE left(COALESCE(p_error, 'Unknown email delivery error'), 1000)
    END,
    last_sent_at = now()
  WHERE id = p_invitation_id
    AND tenant_id = v_tenant_id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id
  ) VALUES (
    v_actor_id,
    v_tenant_id,
    CASE
      WHEN p_succeeded THEN 'tenant.invitation.delivered'
      ELSE 'tenant.invitation.delivery_failed'
    END,
    'tenant_invitation',
    p_invitation_id::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_tenant_invitation(
  p_invitation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant_id bigint := public.current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL
     OR NOT public.has_permission('tenant.users.invite', v_tenant_id) THEN
    RAISE EXCEPTION 'Permission denied: tenant.users.invite'
      USING ERRCODE = '42501';
  END IF;

  UPDATE private.tenant_invitations
  SET revoked_at = now(), revoked_by = v_actor_id
  WHERE id = p_invitation_id
    AND tenant_id = v_tenant_id
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expired_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending invitation not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id
  ) VALUES (
    v_actor_id,
    v_tenant_id,
    'tenant.invitation.revoked',
    'tenant_invitation',
    p_invitation_id::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.invitation_link_status(p_token_hash text)
RETURNS TABLE (
  status text,
  tenant_name text,
  invited_email_masked text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation private.tenant_invitations%ROWTYPE;
  v_tenant_name text;
BEGIN
  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT invitation.* INTO v_invitation
  FROM private.tenant_invitations AS invitation
  WHERE invitation.token_hash = decode(p_token_hash, 'hex');

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT tenant.institution_name INTO v_tenant_name
  FROM public.tenant AS tenant
  WHERE tenant.id = v_invitation.tenant_id;

  RETURN QUERY SELECT
    CASE
      WHEN v_invitation.accepted_at IS NOT NULL THEN 'accepted'
      WHEN v_invitation.revoked_at IS NOT NULL THEN 'revoked'
      WHEN v_invitation.expired_at IS NOT NULL
        OR v_invitation.expires_at <= now() THEN 'expired'
      ELSE 'pending'
    END,
    v_tenant_name,
    left(split_part(v_invitation.invited_email, '@', 1), 2)
      || '***@'
      || split_part(v_invitation.invited_email, '@', 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(p_token_hash text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_user_email text;
  v_invitation private.tenant_invitations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
  END IF;
  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invitation link is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT invitation.* INTO v_invitation
  FROM private.tenant_invitations AS invitation
  WHERE invitation.token_hash = decode(p_token_hash, 'hex')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation link is invalid' USING ERRCODE = 'P0002';
  END IF;
  IF v_invitation.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has already been accepted' USING ERRCODE = 'P0001';
  END IF;
  IF v_invitation.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has been revoked' USING ERRCODE = 'P0001';
  END IF;
  IF v_invitation.expired_at IS NOT NULL OR v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = 'P0001';
  END IF;

  SELECT lower(users.email) INTO v_user_email
  FROM auth.users AS users
  WHERE users.id = v_user_id;
  IF v_user_email IS DISTINCT FROM v_invitation.invited_email THEN
    RAISE EXCEPTION 'Sign in with the invited email address'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_profiles AS profile WHERE profile.id = v_user_id
  ) THEN
    RAISE EXCEPTION 'This account already has a tenant membership'
      USING ERRCODE = '23505';
  END IF;

  PERFORM set_config(
    'app.accepting_tenant_invitation_id',
    v_invitation.id::text,
    true
  );

  INSERT INTO public.user_profiles (
    id, tenant_id, tenant_role, email
  ) VALUES (
    v_user_id,
    v_invitation.tenant_id,
    v_invitation.intended_role,
    v_invitation.invited_email
  );

  UPDATE private.tenant_invitations
  SET accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invitation.id;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_user_id,
    v_invitation.tenant_id,
    'tenant.invitation.accepted',
    'tenant_invitation',
    v_invitation.id::text,
    jsonb_build_object('intended_role', v_invitation.intended_role)
  );

  RETURN v_invitation.tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tenant_invitation(
  text, text, text, timestamptz
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_invitations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prepare_tenant_invitation_resend(
  uuid, text, timestamptz
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_tenant_invitation_delivery(
  uuid, boolean, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_tenant_invitation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invitation_link_status(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_tenant_invitation(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_tenant_invitation(
  text, text, text, timestamptz
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_invitations()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prepare_tenant_invitation_resend(
  uuid, text, timestamptz
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_tenant_invitation_delivery(
  uuid, boolean, text
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_tenant_invitation(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.invitation_link_status(text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(text)
  TO authenticated, service_role;
