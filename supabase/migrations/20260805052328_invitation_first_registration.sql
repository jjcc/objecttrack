-- Expose invitation-bound registration context to possession of a valid,
-- high-entropy invitation token. Tenant membership is still created only by
-- accept_tenant_invitation after authentication.

CREATE OR REPLACE FUNCTION public.invitation_registration_context(
  p_token_hash text
)
RETURNS TABLE (
  status text,
  tenant_name text,
  invited_email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation private.tenant_invitations%ROWTYPE;
  v_tenant_name text;
  v_status text;
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

  v_status := CASE
    WHEN v_invitation.accepted_at IS NOT NULL THEN 'accepted'
    WHEN v_invitation.revoked_at IS NOT NULL THEN 'revoked'
    WHEN v_invitation.expired_at IS NOT NULL
      OR v_invitation.expires_at <= now() THEN 'expired'
    ELSE 'pending'
  END;

  RETURN QUERY SELECT
    v_status,
    v_tenant_name,
    CASE WHEN v_status = 'pending' THEN v_invitation.invited_email END;
END;
$$;

REVOKE ALL ON FUNCTION public.invitation_registration_context(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invitation_registration_context(text)
  TO anon, authenticated, service_role;
