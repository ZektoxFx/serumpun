-- Reporting channel: reports, Me too, timelines, fix confirmations, the privacy views residents read, the RPCs that
-- write, photo storage, and live updates.
--
-- Residents never touch the four report tables. They read public_reports (no created_by) and public_report_updates
-- (no author_id), and write only through the RPCs below, each of which checks its caller itself. The Management Office
-- also reads reports directly, its own township only, for the reporter's name and unit. Live updates are id-only
-- broadcasts on `township:<id>` (ruling R4); the report tables stay out of the supabase_realtime publication.
--
-- Photos are storage object paths, never URLs. The public bucket `photos` holds `<random uuid>.jpg`, so a public link
-- names nobody; the private bucket `private-photos` holds `<user id>/<random uuid>.jpg`, read through signed URLs. An
-- RPC takes a photo only if the caller uploaded that very object under its bucket's naming rule (is_own_photo).

-- ---------------------------------------------------------------------------------------------------------------------
-- Photo storage
-- ---------------------------------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos', 'photos', true, 5242880, array['image/jpeg']),
  ('private-photos', 'private-photos', false, 5242880, array['image/jpeg']);

-- Uploads. Public photos get random names at the bucket root; private photos go in the uploader's own folder. There is
-- no update or delete policy, so an uploaded photo can be neither swapped nor removed through the API. `photos` has no
-- select policy either: public URLs need none, and with listing closed nobody can see who uploaded what.
create policy "Verified residents upload public photos under random names" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (select public.is_verified())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$'
  );

create policy "Verified residents upload private photos to their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'private-photos'
    and (select public.is_verified())
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$')
  );

-- Whether p_path is an object the caller uploaded to p_bucket, named as that bucket requires. Only the RPCs call it
-- (as their owner, which reads storage.objects past its row-level security).
create function public.is_own_photo(p_bucket text, p_path text)
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce(
    p_path ~ case p_bucket
      when 'photos' then '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$'
      when 'private-photos' then
        '^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$'
    end
    and exists (
      select 1 from storage.objects o
       where o.bucket_id = p_bucket and o.name = p_path and o.owner_id = (select auth.uid())::text
    ),
    false
  )
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Alerts take photos now: a path in `photos`, no longer a URL. No alert has one yet (0002a refused them all).
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.alerts drop constraint alerts_photo_url_check;
alter table public.alerts rename column photo_url to photo_path;
alter table public.alerts add constraint alerts_photo_path_check
  check (photo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$');

-- Same view as 0002, with photo_path. A view column cannot be renamed in place.
drop view public.public_alerts;
create view public.public_alerts with (security_invoker = false, security_barrier = true) as
select
  a.id, a.township_id, a.type, a.severity, a.lat, a.lng, a.note, a.photo_path, a.is_official, a.status,
  a.confirm_count, a.gone_count, a.created_at, a.last_confirmed_at, a.expires_at,
  coalesce(a.created_by = (select auth.uid()), false) as is_mine,
  (select v.vote from public.alert_votes v where v.alert_id = a.id and v.user_id = (select auth.uid())) as my_vote
from public.alerts a
where a.township_id = (select public.my_township())
  and a.status = 'active'
  and (a.is_official or a.expires_at > now());

-- Same as 0002a, except that a photo is accepted when it is the caller's own upload to `photos`. A parameter cannot be
-- renamed in place either.
drop function public.create_alert(text, text, float8, float8, text, text);
create function public.create_alert(
  p_type text, p_severity text, p_lat float8, p_lng float8, p_note text default null, p_photo_path text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if p_type is null or p_type not in (
    'accident', 'snake', 'suspicious', 'stray_dogs', 'flood', 'fallen_tree', 'walkway_blocked', 'streetlight', 'police'
  ) then
    raise exception 'bad_type';
  end if;
  if p_severity is null or p_severity not in ('high', 'medium', 'low') then
    raise exception 'bad_severity';
  end if;
  -- Within about 5 km of the township centre (also refuses null, NaN and infinite coordinates).
  if not exists (
    select 1 from public.townships t
     where t.id = public.my_township() and abs(p_lat - t.centre_lat) <= 0.05 and abs(p_lng - t.centre_lng) <= 0.05
  ) then
    raise exception 'out_of_area';
  end if;
  if p_photo_path is not null and not public.is_own_photo('photos', p_photo_path) then
    raise exception 'bad_photo';
  end if;

  insert into public.alerts (township_id, type, severity, lat, lng, note, photo_path, created_by, expires_at)
  values (
    public.my_township(), p_type, p_severity, p_lat, p_lng, left(nullif(btrim(p_note), ''), 280), p_photo_path,
    (select auth.uid()), now() + interval '2 hours'
  )
  returning id into v_id;
  return v_id;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  -- The number people quote ("#1042"). wipe_demo_data restarts it at 1001 and the seed inserts in a fixed order, so
  -- every reseed hands out the same numbers; live reports carry on from the seed's last one.
  ref_no int generated always as identity (start with 1001) unique,
  township_id uuid not null references public.townships (id),
  -- The categories, statuses and teams of lib/domain/reports.ts.
  category text not null check (
    category in ('streetlight', 'road', 'tree', 'rubbish', 'drain', 'park', 'walkway', 'security', 'animals')
  ),
  title text not null check (length(btrim(title)) between 1 and 120),
  description text check (length(description) <= 1000),
  lat float8 not null check (lat between -90 and 90),
  lng float8 not null check (lng between -180 and 180),
  location_text text check (length(location_text) <= 120),
  photo_path text,
  -- Only the reporter and the Management Office see a private report. It takes no Me too.
  is_private boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  status text not null default 'submitted' check (
    status in ('submitted', 'acknowledged', 'in_progress', 'resolved', 'confirmed', 'reopened')
  ),
  team text check (team in ('facilities', 'roads', 'landscape', 'cleaning', 'security')),
  metoo_count int not null default 0 check (metoo_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz, -- set while resolved or confirmed; a reopened report has none
  source_alert_id uuid references public.alerts (id) on delete set null,
  -- A public report's photo sits at the root of `photos`; a private one's in its reporter's folder of `private-photos`.
  check (photo_path ~ (
    case when is_private then '^[0-9a-f-]{36}/' else '^' end
    || '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$'
  ))
);
create index reports_township_id_status_idx on public.reports (township_id, status);
create index reports_created_by_idx on public.reports (created_by);

-- "Me too": one per resident per report.
create table public.report_metoo (
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);
create index report_metoo_user_id_idx on public.report_metoo (user_id);

-- The timeline: each step (and each message from the Management Office), with an optional photo.
create table public.report_updates (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  status text not null check (
    status in ('submitted', 'acknowledged', 'in_progress', 'resolved', 'confirmed', 'reopened')
  ),
  message text check (length(message) <= 500),
  photo_path text check (
    photo_path ~ '^([0-9a-f-]{36}/)?[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$'
  ),
  created_at timestamptz not null default now()
);
create index report_updates_report_id_created_at_idx on public.report_updates (report_id, created_at);

-- "Fixed" or "Not fixed" from the reporter or a Me-too resident, for the latest fix (a new fix clears them).
create table public.report_confirmations (
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  fixed boolean not null,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);
create index report_confirmations_user_id_idx on public.report_confirmations (user_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- Privacy views. Definer views (they read the tables as their owner), so each WHERE is the only filter;
-- security_barrier keeps a caller's own filters from running before it.
-- ---------------------------------------------------------------------------------------------------------------------

-- The caller's township's reports, without who sent them: public ones, the caller's own private ones, and for the
-- Management Office every one (so the dashboard has one source with the fix counts).
create view public.public_reports with (security_invoker = false, security_barrier = true) as
select
  r.id, r.ref_no, r.township_id, r.category, r.title, r.description, r.lat, r.lng, r.location_text, r.photo_path,
  r.is_private, r.status, r.team, r.metoo_count, r.created_at, r.updated_at, r.resolved_at, r.source_alert_id,
  coalesce(r.created_by = (select auth.uid()), false) as is_mine,
  exists (select 1 from public.report_metoo m where m.report_id = r.id and m.user_id = (select auth.uid())) as has_metoo,
  (select count(*) from public.report_confirmations c where c.report_id = r.id and c.fixed)::int as fixed_yes,
  (select count(*) from public.report_confirmations c where c.report_id = r.id and not c.fixed)::int as fixed_no
from public.reports r
where r.township_id = (select public.my_township())
  and (not r.is_private or r.created_by = (select auth.uid()) or (select public.is_management()));

-- The timelines of the reports the caller can see in public_reports, without who wrote each step.
create view public.public_report_updates with (security_invoker = false, security_barrier = true) as
select
  u.id, u.report_id, u.status, u.message, u.photo_path, u.created_at,
  coalesce(p.role = 'management', false) as by_management
from public.report_updates u
left join public.profiles p on p.id = u.author_id
where u.report_id in (select r.id from public.public_reports r);

-- Signed URLs for private photos: the uploader, the Management Office of the uploader's township, and whoever can see
-- the report update the photo belongs to (the reporter, for the office's after-photo on a private report).
create policy "Uploaders, their office and report readers read private photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'private-photos'
    and (
      (owner_id = (select auth.uid())::text and (select public.my_township()) is not null)
      or (
        (select public.is_management())
        and exists (
          select 1 from public.profiles p
           where p.id::text = (storage.foldername(objects.name))[1] and p.township_id = (select public.my_township())
        )
      )
      or exists (select 1 from public.public_report_updates u where u.photo_path = objects.name)
    )
  );

-- ---------------------------------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------------------------------

-- A verified resident reports a problem to the Management Office. The first timeline step is "submitted".
create function public.create_report(
  p_category text, p_title text, p_description text, p_lat float8, p_lng float8, p_location_text text default null,
  p_photo_path text default null, p_is_private boolean default false, p_source_alert uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_title text := left(btrim(p_title), 120);
  v_private boolean := coalesce(p_is_private, false);
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if p_category is null or p_category not in (
    'streetlight', 'road', 'tree', 'rubbish', 'drain', 'park', 'walkway', 'security', 'animals'
  ) then
    raise exception 'bad_category';
  end if;
  if v_title is null or v_title = '' then
    raise exception 'bad_title';
  end if;
  -- Within about 5 km of the township centre (also refuses null, NaN and infinite coordinates).
  if not exists (
    select 1 from public.townships t
     where t.id = public.my_township() and abs(p_lat - t.centre_lat) <= 0.05 and abs(p_lng - t.centre_lng) <= 0.05
  ) then
    raise exception 'out_of_area';
  end if;
  if p_photo_path is not null
     and not public.is_own_photo(case when v_private then 'private-photos' else 'photos' end, p_photo_path) then
    raise exception 'bad_photo';
  end if;

  insert into public.reports (
    township_id, category, title, description, lat, lng, location_text, photo_path, is_private, created_by,
    source_alert_id
  )
  values (
    public.my_township(), p_category, v_title, left(nullif(btrim(p_description), ''), 1000), p_lat, p_lng,
    left(nullif(btrim(p_location_text), ''), 120), p_photo_path, v_private, (select auth.uid()),
    -- The alert it came from, if that alert is in the caller's township; a stale link is dropped, not an error.
    (select a.id from public.alerts a where a.id = p_source_alert and a.township_id = public.my_township())
  )
  returning id into v_id;
  insert into public.report_updates (report_id, author_id, status) values (v_id, (select auth.uid()), 'submitted');
  return v_id;
end
$$;

-- "Already reported nearby?": up to 3 open public reports of the category within 150 m, nearest first.
create function public.nearby_open_reports(p_category text, p_lat float8, p_lng float8)
returns setof public.public_reports
language sql stable security definer set search_path = ''
as $$
  select r.*
    from public.public_reports r
   cross join lateral (
     -- Haversine metres, as distanceMeters in lib/domain/geo.ts. least() keeps rounding from pushing asin past 1.
     select 2 * 6371000 * asin(least(1, sqrt(
       power(sin(radians(r.lat - p_lat) / 2), 2)
       + cos(radians(p_lat)) * cos(radians(r.lat)) * power(sin(radians(r.lng - p_lng) / 2), 2)
     ))) as m
   ) d
   where r.category = p_category
     and not r.is_private
     and r.status not in ('resolved', 'confirmed')
     and d.m <= 150
   order by d.m
   limit 3
$$;

-- "Me too" from a verified neighbour: never on your own report or a private one; a second tap changes nothing.
-- It counts up rather than recounting because seeded reports carry Me toos from neighbours with no demo account.
create function public.metoo_report(p_report uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  -- The row lock queues concurrent Me toos on one report, so each count builds on the one before.
  select * into v_report
    from public.reports
   where id = p_report and township_id = public.my_township()
     for update;
  -- Someone else's private report answers as if it did not exist.
  if not found or (v_report.is_private and v_report.created_by is distinct from (select auth.uid())) then
    raise exception 'not_found';
  end if;
  if v_report.created_by = (select auth.uid()) then
    raise exception 'own_report';
  end if;

  insert into public.report_metoo (report_id, user_id) values (p_report, (select auth.uid())) on conflict do nothing;
  if found then
    update public.reports set metoo_count = metoo_count + 1, updated_at = now() where id = p_report;
  end if;
end
$$;

-- The Management Office of the report's township moves it along (MANAGEMENT_NEXT), assigns a team, or posts a message
-- and photo at the current step. The reporter and every Me-too resident are told about each step and message.
create function public.update_report_status(
  p_report uuid, p_status text, p_team text default null, p_message text default null, p_photo_path text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
  v_team text;
  v_message text := left(nullif(btrim(p_message), ''), 500);
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  select * into v_report
    from public.reports
   where id = p_report and township_id = public.my_township()
     for update;
  if not found then
    raise exception 'not_found';
  end if;
  -- The same status is allowed: a message, a photo or a team at the current step. Only residents confirm or reopen.
  if p_status is null or (p_status <> v_report.status and (v_report.status, p_status) not in (
    ('submitted', 'acknowledged'), ('submitted', 'in_progress'), ('submitted', 'resolved'),
    ('acknowledged', 'in_progress'), ('acknowledged', 'resolved'),
    ('reopened', 'acknowledged'), ('reopened', 'in_progress'), ('reopened', 'resolved'),
    ('in_progress', 'resolved')
  )) then
    raise exception 'bad_status';
  end if;
  v_team := coalesce(nullif(btrim(p_team), ''), v_report.team); -- no team given keeps the current one
  if v_team not in ('facilities', 'roads', 'landscape', 'cleaning', 'security') then
    raise exception 'bad_team';
  end if;
  -- An after-photo follows the report's privacy.
  if p_photo_path is not null
     and not public.is_own_photo(case when v_report.is_private then 'private-photos' else 'photos' end, p_photo_path) then
    raise exception 'bad_photo';
  end if;

  if p_status = v_report.status and v_message is null and p_photo_path is null then
    -- No step and no message: nothing for the timeline and nobody to tell. A repeated click changes nothing.
    if v_team is distinct from v_report.team then
      update public.reports set team = v_team, updated_at = now() where id = p_report;
    end if;
    return;
  end if;

  update public.reports
     set status = p_status,
         team = v_team,
         resolved_at = case when p_status = 'resolved' and v_report.status <> 'resolved' then now() else resolved_at end,
         updated_at = now()
   where id = p_report;
  if p_status = 'resolved' and v_report.status <> 'resolved' then
    -- A new fix: residents answer again for this one.
    delete from public.report_confirmations where report_id = p_report;
  end if;
  insert into public.report_updates (report_id, author_id, status, message, photo_path)
  values (p_report, (select auth.uid()), p_status, v_message, p_photo_path);

  perform public.notify(
    array(select v_report.created_by union select m.user_id from public.report_metoo m where m.report_id = p_report),
    'report',
    case when p_status = v_report.status then 'notify.report.update' else 'notify.report.' || p_status end,
    '#' || v_report.ref_no || ' ' || v_report.title,
    '/reports/' || p_report
  );
end
$$;

-- After "resolved", the reporter or a Me-too resident says Fixed or Not fixed (changing their answer is allowed).
-- The reporter's Fixed confirms it. The reporter's Not fixed, or two from others, reopen it (shouldReopen) and tell
-- the Management Office.
create function public.confirm_report_fix(p_report uuid, p_fixed boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
  v_by_reporter boolean;
  v_status text;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if p_fixed is null then
    raise exception 'bad_answer';
  end if;
  select * into v_report
    from public.reports
   where id = p_report and township_id = public.my_township()
     for update;
  if not found or (v_report.is_private and v_report.created_by is distinct from (select auth.uid())) then
    raise exception 'not_found';
  end if;
  v_by_reporter := coalesce(v_report.created_by = (select auth.uid()), false);
  if not v_by_reporter and not exists (
    select 1 from public.report_metoo m where m.report_id = p_report and m.user_id = (select auth.uid())
  ) then
    raise exception 'not_affected';
  end if;
  if v_report.status <> 'resolved' then
    raise exception 'not_resolved';
  end if;

  insert into public.report_confirmations (report_id, user_id, fixed)
  values (p_report, (select auth.uid()), p_fixed)
  on conflict (report_id, user_id) do update set fixed = excluded.fixed, created_at = now();

  v_status := case
    when v_by_reporter and p_fixed then 'confirmed'
    when exists (
      select 1 from public.report_confirmations c
       where c.report_id = p_report and not c.fixed and c.user_id = v_report.created_by
    ) or (
      select count(*) from public.report_confirmations c
       where c.report_id = p_report and not c.fixed and c.user_id is distinct from v_report.created_by
    ) >= 2 then 'reopened'
    else 'resolved'
  end;

  -- updated_at moves even when the status stays, so the board hears about the new answer.
  update public.reports
     set status = v_status,
         resolved_at = case when v_status = 'reopened' then null else resolved_at end,
         updated_at = now()
   where id = p_report;
  if v_status <> 'resolved' then
    insert into public.report_updates (report_id, author_id, status) values (p_report, (select auth.uid()), v_status);
  end if;
  if v_status = 'reopened' then
    perform public.notify(
      array(
        select p.id from public.profiles p
         where p.township_id = v_report.township_id and p.role = 'management' and p.status = 'verified'
      ),
      'report', 'notify.report.reopened', '#' || v_report.ref_no || ' ' || v_report.title, '/dashboard'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Live updates (ruling R4): each change to a report or its timeline tells its township's public channel which report
-- changed, and nothing more: `{id: <report id>, table}`. Clients refetch the views. Definer and exception-safe for the
-- same reasons as broadcast_alert_change in 0002a: only an RLS-bypassing role can write realtime.messages, and a failed
-- broadcast must never undo the write.
-- ---------------------------------------------------------------------------------------------------------------------

create function public.broadcast_report_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb;
  v_report uuid;
  v_township uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;
  if tg_table_name = 'reports' then
    v_report := v_row ->> 'id';
    v_township := v_row ->> 'township_id';
  else
    v_report := v_row ->> 'report_id';
    select r.township_id into v_township from public.reports r where r.id = v_report;
  end if;
  if v_township is not null then -- an update removed along with its report: the report's own broadcast covers it
    begin
      perform realtime.send(
        jsonb_build_object('id', v_report, 'table', tg_table_name::text),
        tg_table_name::text,
        'township:' || v_township::text,
        false
      );
    exception when others then
      raise warning 'broadcast_report_change: % (%)', sqlerrm, sqlstate;
    end;
  end if;
  return null;
end
$$;

create trigger reports_broadcast
  after insert or update or delete on public.reports
  for each row execute function public.broadcast_report_change();
create trigger report_updates_broadcast
  after insert or update or delete on public.report_updates
  for each row execute function public.broadcast_report_change();

-- Notifications are per user, so they go out as postgres_changes: row-level security limits each subscriber to their
-- own rows.
alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.reports enable row level security;
alter table public.report_metoo enable row level security;
alter table public.report_updates enable row level security;
alter table public.report_confirmations enable row level security;

-- The dashboard reads its own township's reports, created_by included, for the reporter's name and unit. Residents
-- match no row: they read public_reports.
create policy "The Management Office reads its township's reports" on public.reports
  for select to authenticated
  using ((select public.is_management()) and township_id = (select public.my_township()));

-- Table privileges: take away the defaults, then give back exactly what is used.
revoke all on table public.reports, public.report_metoo, public.report_updates, public.report_confirmations
  from anon, authenticated;
grant select on table public.reports to authenticated;
-- Never grant API roles anything on report_metoo, report_updates or report_confirmations: PostgREST would let residents
-- embed who said Me too, who wrote a step or who answered through the views.
grant select, insert, update, delete on table
  public.reports, public.report_metoo, public.report_updates, public.report_confirmations
  to service_role;
-- Read-only, and only for signed-in users: as simple views they would otherwise pass writes through.
revoke all on table public.public_alerts, public.public_reports, public.public_report_updates
  from anon, authenticated, service_role;
grant select on table public.public_alerts, public.public_reports, public.public_report_updates to authenticated;

-- Function privileges. The RPCs check their caller themselves; the helper and the trigger function are nobody's to call.
revoke execute on function
  public.is_own_photo(text, text),
  public.create_alert(text, text, float8, float8, text, text),
  public.create_report(text, text, text, float8, float8, text, text, boolean, uuid),
  public.nearby_open_reports(text, float8, float8),
  public.metoo_report(uuid),
  public.update_report_status(uuid, text, text, text, text),
  public.confirm_report_fix(uuid, boolean),
  public.broadcast_report_change()
  from public, anon, authenticated;
grant execute on function
  public.create_alert(text, text, float8, float8, text, text),
  public.create_report(text, text, text, float8, float8, text, text, boolean, uuid),
  public.nearby_open_reports(text, float8, float8),
  public.metoo_report(uuid),
  public.update_report_status(uuid, text, text, text, text),
  public.confirm_report_fix(uuid, boolean)
  to authenticated;

notify pgrst, 'reload schema';
