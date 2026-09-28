-- Allow platform operators to remove an accidentally created, otherwise empty
-- self-service workspace. This is intentionally narrower than general tenant
-- deletion: the user's auth account is preserved so it can accept an existing
-- organization invitation after its obsolete membership is removed.

INSERT INTO private.permission_definitions (code, description)
VALUES (
  'platform.tenants.delete_accidental',
  'Delete an empty self-service workspace while preserving its owner account'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO private.role_permissions (role, permission)
VALUES ('platform_operator', 'platform.tenants.delete_accidental')
ON CONFLICT (role, permission) DO NOTHING;

-- Audit rows must outlive hard-deleted tenant records. Keeping the numeric
-- tenant identifier (instead of setting it to NULL) also preserves useful
-- operational evidence; inserts remain restricted to privileged functions.
ALTER TABLE private.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_tenant_id_fkey;

COMMENT ON COLUMN private.audit_log.tenant_id IS
  'Tenant identifier at event time; may reference a tenant that was later deleted.';

DROP FUNCTION IF EXISTS public.delete_accidental_workspace(bigint, text);

CREATE OR REPLACE FUNCTION public.delete_accidental_workspace(
  p_tenant_id bigint,
  p_confirmation_name text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_tenant public.tenant%ROWTYPE;
  v_owner_id uuid;
  v_owner_email text;
  v_previous_defaults_context text := current_setting(
    'app.applying_tenant_defaults', true
  );
BEGIN
  IF NOT public.has_permission('platform.tenants.delete_accidental') THEN
    RAISE EXCEPTION 'Permission denied: platform.tenants.delete_accidental'
      USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A deletion reason is required' USING ERRCODE = '22023';
  END IF;

  SELECT tenant_record.* INTO v_tenant
  FROM public.tenant AS tenant_record
  WHERE tenant_record.id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_tenant.edition <> 'simple' THEN
    RAISE EXCEPTION 'Only an empty self-service Simple workspace can be deleted'
      USING ERRCODE = '55000';
  END IF;
  IF p_confirmation_name IS DISTINCT FROM v_tenant.institution_name THEN
    RAISE EXCEPTION 'Workspace name confirmation does not match'
      USING ERRCODE = '22023';
  END IF;

  SELECT provisioning.user_id, lower(users.email)
  INTO v_owner_id, v_owner_email
  FROM private.simple_workspace_provisioning AS provisioning
  JOIN auth.users AS users ON users.id = provisioning.user_id
  WHERE provisioning.tenant_id = p_tenant_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Only a self-service workspace can be deleted'
      USING ERRCODE = '55000';
  END IF;

  IF (SELECT count(*) FROM public.user_profiles AS profile
      WHERE profile.tenant_id = p_tenant_id) <> 1
     OR NOT EXISTS (
       SELECT 1
       FROM public.user_profiles AS profile
       WHERE profile.tenant_id = p_tenant_id
         AND profile.id = v_owner_id
         AND profile.tenant_role = 'owner'
     ) THEN
    RAISE EXCEPTION 'Workspace must have exactly its original owner and no other members'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (SELECT 1 FROM public.objects WHERE tenant_id = p_tenant_id)
     OR EXISTS (SELECT 1 FROM public.groups WHERE tenant_id = p_tenant_id)
     OR EXISTS (SELECT 1 FROM public.events WHERE tenant_id = p_tenant_id)
     OR EXISTS (SELECT 1 FROM public.transfer_requests WHERE tenant_id = p_tenant_id)
     OR EXISTS (SELECT 1 FROM private.tenant_invitations WHERE tenant_id = p_tenant_id)
     OR EXISTS (SELECT 1 FROM private.tenant_report_jobs WHERE tenant_id = p_tenant_id)
     OR EXISTS (
       SELECT 1
       FROM storage.objects AS stored_object
       WHERE stored_object.bucket_id IN ('object-images', 'tenant-reports')
         AND (storage.foldername(stored_object.name))[1] = p_tenant_id::text
     )
     OR EXISTS (
       SELECT 1
       FROM private.tenant_billing AS billing
       WHERE billing.tenant_id = p_tenant_id
         AND (
           billing.stripe_customer_id IS NOT NULL
           OR billing.stripe_subscription_id IS NOT NULL
           OR billing.subscription_status IS NOT NULL
         )
     ) THEN
    RAISE EXCEPTION 'Workspace contains user data or billing history and cannot be deleted'
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO private.audit_log (
    actor_id, tenant_id, action, target_type, target_id, metadata
  ) VALUES (
    v_actor_id,
    p_tenant_id,
    'tenant.accidental_workspace.deleted',
    'tenant',
    p_tenant_id::text,
    jsonb_build_object(
      'institution_name', v_tenant.institution_name,
      'owner_user_id', v_owner_id,
      'owner_email', v_owner_email,
      'reason', btrim(p_reason)
    )
  );

  -- These bootstrap rows use restrictive tenant foreign keys. All other
  -- self-service provisioning state cascades from the tenant deletion.
  DELETE FROM public.user_profiles WHERE tenant_id = p_tenant_id;
  PERFORM set_config('app.applying_tenant_defaults', 'true', true);
  DELETE FROM public.categories WHERE tenant_id = p_tenant_id;
  PERFORM set_config(
    'app.applying_tenant_defaults',
    COALESCE(v_previous_defaults_context, ''),
    true
  );
  DELETE FROM public.event_types WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenant WHERE id = p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_accidental_workspace(bigint, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_accidental_workspace(bigint, text, text)
  TO authenticated, service_role;
