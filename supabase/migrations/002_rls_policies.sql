-- Helper function: check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid());
$$;

-- user_profiles RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.user_profiles
  USING (public.is_admin());
CREATE POLICY "Users see own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

-- groups RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.groups
  USING (public.is_admin());
CREATE POLICY "Users see own group" ON public.groups
  FOR SELECT USING (
    id IN (SELECT group_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- categories RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.categories USING (public.is_admin());
CREATE POLICY "Authenticated read" ON public.categories FOR SELECT USING (auth.uid() IS NOT NULL);

-- event_types RLS
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.event_types USING (public.is_admin());
CREATE POLICY "Authenticated read" ON public.event_types FOR SELECT USING (auth.uid() IS NOT NULL);

-- objects RLS
ALTER TABLE public.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.objects USING (public.is_admin());
CREATE POLICY "Users see group objects" ON public.objects
  FOR SELECT USING (
    id IN (
      SELECT object_id FROM public.events
      WHERE group_id IN (
        SELECT group_id FROM public.user_profiles WHERE id = auth.uid()
      )
    )
  );

-- events RLS (APPEND-ONLY: only INSERT for non-admins, no UPDATE/DELETE)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.events USING (public.is_admin());
CREATE POLICY "Users see group events" ON public.events
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );
CREATE POLICY "Users insert own events" ON public.events
  FOR INSERT WITH CHECK (
    group_id IN (SELECT group_id FROM public.user_profiles WHERE id = auth.uid())
    AND e_from = auth.uid()
  );

-- admin_users RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read admin_users" ON public.admin_users
  FOR SELECT USING (auth.uid() IS NOT NULL);
