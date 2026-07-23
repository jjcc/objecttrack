-- All transfer mutations go through the transactional RPC contract.
-- The table itself is read-only through the Data API.

drop policy if exists "Admins manage transfer_requests"
  on public.transfer_requests;

drop policy if exists "Users read related transfer requests"
  on public.transfer_requests;

drop policy if exists "Authorized users read transfer_requests"
  on public.transfer_requests;

create policy "Authorized users read transfer_requests"
  on public.transfer_requests
  for select
  to authenticated
  using (
    (select public.is_admin())
    or (select auth.uid()) = from_user_id
    or (select auth.uid()) = to_user_id
  );

revoke insert, update, delete on public.transfer_requests from authenticated;
grant select on public.transfer_requests to authenticated;
