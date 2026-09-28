-- Require display names on every profile. Signup and invitation flows may
-- provide them explicitly, while legacy clients can supply the same personal
-- fields in their own auth metadata.
CREATE OR REPLACE FUNCTION private.require_user_profile_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_metadata jsonb;
BEGIN
  NEW.first_name := NULLIF(btrim(NEW.first_name), '');
  NEW.last_name := NULLIF(btrim(NEW.last_name), '');

  IF NEW.first_name IS NULL OR NEW.last_name IS NULL THEN
    SELECT auth_user.raw_user_meta_data
    INTO v_user_metadata
    FROM auth.users AS auth_user
    WHERE auth_user.id = NEW.id;

    NEW.first_name := COALESCE(
      NEW.first_name,
      NULLIF(btrim(v_user_metadata ->> 'first_name'), '')
    );
    NEW.last_name := COALESCE(
      NEW.last_name,
      NULLIF(btrim(v_user_metadata ->> 'last_name'), '')
    );
  END IF;

  IF NEW.first_name IS NULL OR NEW.last_name IS NULL THEN
    RAISE EXCEPTION 'First and last name are required'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.require_user_profile_names()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER user_profiles_require_names
BEFORE INSERT OR UPDATE OF first_name, last_name
ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION private.require_user_profile_names();

ALTER TABLE public.user_profiles
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL,
  ADD CONSTRAINT user_profiles_first_name_nonblank_check
    CHECK (NULLIF(btrim(first_name), '') IS NOT NULL),
  ADD CONSTRAINT user_profiles_last_name_nonblank_check
    CHECK (NULLIF(btrim(last_name), '') IS NOT NULL);
