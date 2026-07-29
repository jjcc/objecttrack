-- Allow an authenticated user to update only the personal fields on their own
-- profile. Identity, group membership, and creation metadata remain
-- administrator-controlled.

create or replace function public.update_own_profile(
  p_first_name text default null,
  p_last_name text default null,
  p_email text default null,
  p_title text default null,
  p_phone text default null,
  p_city text default null,
  p_province text default null,
  p_country text default null,
  p_zipcode text default null,
  p_wechat_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.user_profiles
  set first_name = nullif(btrim(p_first_name), ''),
      last_name = nullif(btrim(p_last_name), ''),
      email = nullif(btrim(p_email), ''),
      title = nullif(btrim(p_title), ''),
      phone = nullif(btrim(p_phone), ''),
      city = nullif(btrim(p_city), ''),
      province = nullif(btrim(p_province), ''),
      country = nullif(btrim(p_country), ''),
      zipcode = nullif(btrim(p_zipcode), ''),
      wechat_id = nullif(btrim(p_wechat_id), '')
  where id = v_user_id;

  if not found then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_own_profile(
  text, text, text, text, text, text, text, text, text, text
) from public, anon;

grant execute on function public.update_own_profile(
  text, text, text, text, text, text, text, text, text, text
) to authenticated;
