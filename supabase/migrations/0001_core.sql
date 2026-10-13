-- Core schema: townships, people, notifications, announcements, and the demo reset.
--
-- Access model. Supabase used to grant the API roles (anon, authenticated, service_role) every privilege on new
-- public tables and functions; from 2026-10-30 it grants nothing on new tables. Either way this file states every
-- grant itself, and later migrations must do the same:
--   * RLS is on for every table, and every policy is `to authenticated`: the anon key reaches nothing.
--   * Column-level grants decide which columns a signed-in user may write.
--   * Security definer functions pin `search_path = ''` (so every name is schema-qualified), lose EXECUTE for
--     public, anon and authenticated, and get it back only where the app calls them as a signed-in user.

create table public.townships (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  centre_lat float8 not null,
  centre_lng float8 not null,
  active boolean not null default false
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  township_id uuid not null references public.townships (id),
  full_name text not null check (length(btrim(full_name)) between 1 and 80),
  neighbourhood text not null check (length(btrim(neighbourhood)) between 1 and 80),
  role text not null default 'resident' check (role in ('resident', 'management')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  lang text not null default 'en' check (lang in ('en', 'ms')),
  created_at timestamptz not null default now()
);
create index profiles_township_id_idx on public.profiles (township_id);

-- Its own table so that no policy on profiles can ever hand out a unit number.
create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  unit_no text not null check (length(btrim(unit_no)) between 1 and 40),
  phone text check (length(phone) <= 30)
);

-- Policy helpers. Security definer so they can read profiles without tripping the profiles policies that call
-- them (which would recurse). Each one only ever describes the caller.
create function public.my_township() returns uuid
language sql stable security definer set search_path = ''
as $$
  select township_id from public.profiles where id = (select auth.uid())
$$;

create function public.is_verified() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'verified')
$$;

create function public.is_management() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'management' and status = 'verified'
  )
$$;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title_key text not null, -- an i18n message key, so each reader sees it in their own language
  body text,
  -- An in-app path. Never another site: '//host' and '/\host' would leave the app.
  link text check (link ~ '^/($|[^/\\])'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  -- A signed-in insert can only send title and body (column grants below); these defaults fill in the rest.
  township_id uuid not null default public.my_township() references public.townships (id),
  title text not null check (length(btrim(title)) between 1 and 120),
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index announcements_township_id_created_at_idx on public.announcements (township_id, created_at desc);

-- In-app notifications for a list of users (unknown ids are skipped, each user gets one row). Only trusted code
-- calls this: definer functions, and server code holding the service-role key after its own checks. Granting it to
-- signed-in users would let anyone send anyone a notification with any text and link.
create function public.notify(p_users uuid[], p_type text, p_title_key text, p_body text, p_link text)
returns void
language sql set search_path = ''
as $$
  insert into public.notifications (user_id, type, title_key, body, link)
  select p.id, p_type, p_title_key, p_body, p_link from public.profiles p where p.id = any (p_users)
$$;

-- The Management Office approves or rejects a resident of its own township, and the resident is told.
create function public.set_resident_status(p_profile uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_old text;
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  if p_status is null or p_status not in ('verified', 'rejected') then
    raise exception 'bad_status';
  end if;
  select status into v_old
    from public.profiles
   where id = p_profile and role = 'resident' and township_id = public.my_township()
     for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_old = p_status then
    return; -- a second click changes nothing and notifies nobody
  end if;
  update public.profiles set status = p_status where id = p_profile;
  perform public.notify(array[p_profile], 'account', 'notify.account.' || p_status, null, '/home');
end
$$;

-- Empties every feature table before a re-seed ("Reset demo data"). Tables added by later migrations are covered
-- without touching this function. The keep-list is what a reset must never touch: the ledger and the people.
create function public.wipe_demo_data()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_keep constant text[] := array['_migrations', 'townships', 'profiles', 'profile_private'];
  v_tables text;
begin
  -- CASCADE would also empty a kept table that references a wiped one. Refuse instead of deleting people.
  if exists (
    select 1
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_class kept on kept.oid = c.conrelid
      join pg_catalog.pg_class ref on ref.oid = c.confrelid
     where c.contype = 'f'
       and kept.relnamespace = 'public'::regnamespace and kept.relname = any (v_keep)
       and ref.relnamespace = 'public'::regnamespace and not (ref.relname = any (v_keep))
  ) then
    raise exception 'wipe_demo_data: a kept table references a table it would empty';
  end if;

  select string_agg(format('public.%I', tablename), ', ')
    into v_tables
    from pg_catalog.pg_tables
   where schemaname = 'public' and not (tablename = any (v_keep));

  if v_tables is not null then
    execute 'truncate table ' || v_tables || ' restart identity cascade';
  end if;
end
$$;

-- Row level security: on for every table; every policy is for signed-in users only.
alter table public.townships enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;

create policy "Signed-in users read townships" on public.townships
  for select to authenticated using (true);

create policy "Neighbours read profiles in their township" on public.profiles
  for select to authenticated using (township_id = (select public.my_township()));

-- The column grants below narrow this to full_name and lang: role and status are not the user's to change.
create policy "Users update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Owners and their Management Office read private details" on public.profile_private
  for select to authenticated using (
    id = (select auth.uid())
    or (
      (select public.is_management())
      and exists (
        select 1 from public.profiles p
         where p.id = profile_private.id and p.township_id = (select public.my_township())
      )
    )
  );

create policy "Users read their own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

-- The column grant below narrows this to read_at.
create policy "Users mark their own notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Residents read their township's announcements" on public.announcements
  for select to authenticated using (township_id = (select public.my_township()));

create policy "The Management Office posts to its own township" on public.announcements
  for insert to authenticated
  with check (
    (select public.is_management())
    and township_id = (select public.my_township())
    and created_by = (select auth.uid())
  );

-- Table privileges: take away the defaults, then give back exactly what the policies above need.
revoke all on table
  public.townships, public.profiles, public.profile_private, public.notifications, public.announcements
  from anon, authenticated;
grant select on table
  public.townships, public.profiles, public.profile_private, public.notifications, public.announcements
  to authenticated;
grant update (full_name, lang) on table public.profiles to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant insert (title, body) on table public.announcements to authenticated;
-- The service-role key (seed, demo reset, trusted server code) bypasses RLS but still needs table privileges.
grant select, insert, update, delete on table
  public.townships, public.profiles, public.profile_private, public.notifications, public.announcements
  to service_role;

-- Function privileges.
revoke execute on function
  public.my_township(), public.is_verified(), public.is_management(),
  public.notify(uuid[], text, text, text, text), public.set_resident_status(uuid, text), public.wipe_demo_data()
  from public, anon, authenticated;
-- Policies run these as the signed-in user; they only describe the caller.
grant execute on function public.my_township(), public.is_verified(), public.is_management() to authenticated;
-- Checks is_management() itself.
grant execute on function public.set_resident_status(uuid, text) to authenticated;
grant execute on function public.notify(uuid[], text, text, text, text), public.wipe_demo_data() to service_role;

-- Let the Data API see the new tables and functions now rather than at its next schema-cache refresh.
notify pgrst, 'reload schema';
