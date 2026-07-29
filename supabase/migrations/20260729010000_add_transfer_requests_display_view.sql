-- Provide the transfer screens with one read-only source for request, object,
-- and participant display data. The explicit visibility predicate preserves the
-- transfer_requests access rules even though the view owner resolves the joins.

create or replace view public.transfer_requests_display
with (security_barrier = true)
as
select
  request.id,
  request.status,
  request.reason,
  request.created_at,
  request.updated_at,
  object.name as object_name,
  object.description as object_description,
  object.model as object_model,
  nullif(
    concat_ws(' ', from_profile.first_name, from_profile.last_name),
    ''
  ) as from_user_full_name,
  nullif(
    concat_ws(' ', to_profile.first_name, to_profile.last_name),
    ''
  ) as to_user_full_name
from public.transfer_requests as request
join public.objects as object
  on object.id = request.object_id
left join public.user_profiles as from_profile
  on from_profile.id = request.from_user_id
left join public.user_profiles as to_profile
  on to_profile.id = request.to_user_id
where public.is_admin()
   or auth.uid() = request.from_user_id
   or auth.uid() = request.to_user_id;

revoke all on public.transfer_requests_display from public, anon;
grant select on public.transfer_requests_display to authenticated;
