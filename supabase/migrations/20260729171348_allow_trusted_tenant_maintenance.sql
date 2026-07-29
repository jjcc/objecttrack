-- Data API callers are tenant-bound; trusted SQL/service maintenance may
-- explicitly supply a tenant when no end-user JWT is present.
CREATE OR REPLACE FUNCTION public.assign_current_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id bigint := public.current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL THEN
    IF NEW.tenant_id IS NULL THEN
      RAISE EXCEPTION 'A tenant is required';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := v_tenant_id;
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'Record must belong to the acting user tenant';
  END IF;
  RETURN NEW;
END;
$$;
