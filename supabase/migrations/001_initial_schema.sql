-- Groups: organisational units
CREATE TABLE public.groups (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT groups_pkey PRIMARY KEY (id)
);

-- Categories: classification for objects
CREATE TABLE public.categories (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

-- Event types: lookup table for event labels
CREATE TABLE public.event_types (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  label text NOT NULL UNIQUE,
  CONSTRAINT event_types_pkey PRIMARY KEY (id)
);

-- Objects: the physical items being tracked
CREATE TABLE public.objects (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  description text,
  category_id bigint,
  model text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT objects_pkey PRIMARY KEY (id),
  CONSTRAINT objects_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);

-- User profiles: extends auth.users with application-level fields
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  group_id bigint,
  last_name text,
  first_name text,
  title text,
  city text,
  province text,
  country text,
  zipcode text,
  phone text,
  wechat_id text,
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT user_profiles_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id)
);

-- Events: immutable audit log (APPEND-ONLY)
CREATE TABLE public.events (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  group_id bigint NOT NULL,
  object_id bigint NOT NULL,
  event_type_id bigint NOT NULL,
  e_from uuid,
  e_to uuid,
  extra jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT events_object_id_fkey FOREIGN KEY (object_id) REFERENCES public.objects(id),
  CONSTRAINT events_event_type_id_fkey FOREIGN KEY (event_type_id) REFERENCES public.event_types(id),
  CONSTRAINT events_e_from_fkey FOREIGN KEY (e_from) REFERENCES public.user_profiles(id),
  CONSTRAINT events_e_to_fkey FOREIGN KEY (e_to) REFERENCES public.user_profiles(id)
);

-- Admin users table (for is_admin() check)
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id)
);
