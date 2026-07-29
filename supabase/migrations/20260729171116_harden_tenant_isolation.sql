-- Close legacy global policies now that data is tenant scoped.
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM anon;

ALTER VIEW public.transfer_requests_display
SET (security_invoker = true, security_barrier = true);

DROP POLICY IF EXISTS "Admins full access" ON public.user_profiles;
DROP POLICY IF EXISTS "Users see own profile" ON public.user_profiles;
CREATE POLICY "Tenant users read profiles"
ON public.user_profiles FOR SELECT TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  OR id = (SELECT auth.uid())
);
CREATE POLICY "Tenant admins create profiles"
ON public.user_profiles FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = (SELECT public.current_tenant_id())
  AND (SELECT public.is_admin())
);
CREATE POLICY "Tenant admins update profiles"
ON public.user_profiles FOR UPDATE TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND (SELECT public.is_admin())
)
WITH CHECK (
  tenant_id = (SELECT public.current_tenant_id())
  AND (SELECT public.is_admin())
);
CREATE POLICY "Tenant admins delete profiles"
ON public.user_profiles FOR DELETE TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND (SELECT public.is_admin())
);

DROP POLICY IF EXISTS "Admins full access" ON public.groups;
DROP POLICY IF EXISTS "Users see own group" ON public.groups;
DROP POLICY IF EXISTS "Tenant members read groups" ON public.groups;
CREATE POLICY "Tenant users read groups"
ON public.groups FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));
CREATE POLICY "Tenant admins create groups"
ON public.groups FOR INSERT TO authenticated
WITH CHECK (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()));
CREATE POLICY "Tenant admins update groups"
ON public.groups FOR UPDATE TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()))
WITH CHECK (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()));
CREATE POLICY "Tenant admins delete groups"
ON public.groups FOR DELETE TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins full access" ON public.categories;
DROP POLICY IF EXISTS "Authenticated read" ON public.categories;
DROP POLICY IF EXISTS "Tenant members read categories" ON public.categories;
CREATE POLICY "Tenant users read categories"
ON public.categories FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));
CREATE POLICY "Tenant admins create categories"
ON public.categories FOR INSERT TO authenticated
WITH CHECK (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()));
CREATE POLICY "Tenant admins update categories"
ON public.categories FOR UPDATE TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()))
WITH CHECK (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()));
CREATE POLICY "Tenant admins delete categories"
ON public.categories FOR DELETE TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins full access" ON public.event_types;
DROP POLICY IF EXISTS "Authenticated read" ON public.event_types;
DROP POLICY IF EXISTS "Tenant members read event types" ON public.event_types;
CREATE POLICY "Tenant users read event types"
ON public.event_types FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));
CREATE POLICY "Tenant admins create event types"
ON public.event_types FOR INSERT TO authenticated
WITH CHECK (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()));
CREATE POLICY "Tenant admins update event types"
ON public.event_types FOR UPDATE TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()))
WITH CHECK (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()));
CREATE POLICY "Tenant admins delete event types"
ON public.event_types FOR DELETE TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins full access" ON public.objects;
DROP POLICY IF EXISTS "Users see group objects" ON public.objects;
DROP POLICY IF EXISTS "Tenant members read objects" ON public.objects;
CREATE POLICY "Tenant users read objects"
ON public.objects FOR SELECT TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()));
CREATE POLICY "Tenant admins create objects"
ON public.objects FOR INSERT TO authenticated
WITH CHECK (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()));
CREATE POLICY "Tenant admins update objects"
ON public.objects FOR UPDATE TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()))
WITH CHECK (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()));
CREATE POLICY "Tenant admins delete objects"
ON public.objects FOR DELETE TO authenticated
USING (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins full access" ON public.events;
DROP POLICY IF EXISTS "Users see group events" ON public.events;
DROP POLICY IF EXISTS "Users insert own events" ON public.events;
CREATE POLICY "Tenant users read events"
ON public.events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups AS event_group
    WHERE event_group.id = events.group_id
      AND event_group.tenant_id = (SELECT public.current_tenant_id())
  )
);
CREATE POLICY "Tenant users create events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups AS event_group
    WHERE event_group.id = events.group_id
      AND event_group.tenant_id = (SELECT public.current_tenant_id())
  )
  AND (
    e_from = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  )
);
CREATE POLICY "Tenant admins update events"
ON public.events FOR UPDATE TO authenticated
USING (
  (SELECT public.is_admin())
  AND EXISTS (
    SELECT 1 FROM public.groups AS event_group
    WHERE event_group.id = events.group_id
      AND event_group.tenant_id = (SELECT public.current_tenant_id())
  )
)
WITH CHECK (
  (SELECT public.is_admin())
  AND EXISTS (
    SELECT 1 FROM public.groups AS event_group
    WHERE event_group.id = events.group_id
      AND event_group.tenant_id = (SELECT public.current_tenant_id())
  )
);
CREATE POLICY "Tenant admins delete events"
ON public.events FOR DELETE TO authenticated
USING (
  (SELECT public.is_admin())
  AND EXISTS (
    SELECT 1 FROM public.groups AS event_group
    WHERE event_group.id = events.group_id
      AND event_group.tenant_id = (SELECT public.current_tenant_id())
  )
);

DROP POLICY IF EXISTS "Authorized users read transfer_requests" ON public.transfer_requests;
CREATE POLICY "Tenant users read transfer requests"
ON public.transfer_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.objects AS transfer_object
    WHERE transfer_object.id = transfer_requests.object_id
      AND transfer_object.tenant_id = (SELECT public.current_tenant_id())
  )
  AND (
    (SELECT public.is_admin())
    OR (SELECT auth.uid()) = from_user_id
    OR (SELECT auth.uid()) = to_user_id
  )
);
