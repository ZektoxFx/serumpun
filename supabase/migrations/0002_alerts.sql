-- Live Map: alerts, votes, the privacy view residents read, the RPCs that write, and live updates.
--
-- Residents never touch the two tables. They read public_alerts (no created_by) and write only through the RPCs below,
-- each of which checks its caller itself. Live updates are id-only Realtime broadcasts on the channel
-- `township:<id>` (ruling R4). The tables stay out of the supabase_realtime publication on purpose: its
-- postgres_changes payloads would carry whole rows, created_by included.

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references public.townships (id),
  -- The nine types and three severities of lib/domain/alerts.ts.
  type text not null check (
    type in ('accident', 'snake', 'suspicious', 'stray_dogs', 'flood', 'fallen_tree', 'walkway_blocked', 'streetlight', 'police')
  ),
  severity text not null check (severity in ('high', 'medium', 'low')),
  lat float8 not null check (lat between -90 and 90), -- NaN and infinity fail these too
  lng float8 not null check (lng between -180 and 180),
  note text check (length(note) <= 280),
  photo_url text check (photo_url ~ '^https://' and length(photo_url) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  is_official boolean not null default false,
  -- cleared: three residents said it is gone. removed: the Management Office took its official pin down.
  status text not null default 'active' check (status in ('active', 'cleared', 'removed')),
  confirm_count int not null default 0,
  gone_count int not null default 0,
  created_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  expires_at timestamptz,
  -- Only official pins live without an expiry: they stay until the Management Office removes them.
  check (is_official or expires_at is not null)
);
create index alerts_township_id_status_idx on public.alerts (township_id, status);
create index alerts_created_by_idx on public.alerts (created_by);

-- One vote per resident per alert, changeable.
create table public.alert_votes (
  alert_id uuid not null references public.alerts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  vote text not null check (vote in ('still_there', 'gone')),
  created_at timestamptz not null default now(),
  primary key (alert_id, user_id)
);
create index alert_votes_user_id_idx on public.alert_votes (user_id);

-- The live pins of the caller's township, without who posted them. A definer view (it reads the tables as its owner),
-- so the WHERE below is the only filter. security_barrier keeps a caller's own filters from running before it.
create view public.public_alerts with (security_invoker = false, security_barrier = true) as
select
  a.id, a.township_id, a.type, a.severity, a.lat, a.lng, a.note, a.photo_url, a.is_official, a.status,
  a.confirm_count, a.gone_count, a.created_at, a.last_confirmed_at, a.expires_at,
  coalesce(a.created_by = (select auth.uid()), false) as is_mine,
  (select v.vote from public.alert_votes v where v.alert_id = a.id and v.user_id = (select auth.uid())) as my_vote
from public.alerts a
where a.township_id = (select public.my_township())
  and a.status = 'active'
  and (a.is_official or a.expires_at > now());

-- A verified resident drops a pin. It fades 2 hours after it was posted, or after its last "still there".
create function public.create_alert(
  p_type text, p_severity text, p_lat float8, p_lng float8, p_note text default null, p_photo_url text default null
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
  if p_photo_url is not null and (p_photo_url !~ '^https://' or length(p_photo_url) > 500) then
    raise exception 'bad_photo';
  end if;

  insert into public.alerts (township_id, type, severity, lat, lng, note, photo_url, created_by, expires_at)
  values (
    public.my_township(), p_type, p_severity, p_lat, p_lng, left(nullif(btrim(p_note), ''), 280), p_photo_url,
    (select auth.uid()), now() + interval '2 hours'
  )
  returning id into v_id;
  return v_id;
end
$$;

-- "Still there" or "Gone" from a verified neighbour. Never the poster: that is what makes one "still there" a
-- confirmation (isConfirmedHazard). Official pins take no votes: they stay until the Management Office removes them.
create function public.vote_alert(p_alert uuid, p_vote text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_alert public.alerts%rowtype;
  v_confirm int;
  v_gone int;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if p_vote is null or p_vote not in ('still_there', 'gone') then
    raise exception 'bad_vote';
  end if;
  -- The row lock queues concurrent votes on one alert, so each recount below sees every earlier vote.
  select * into v_alert
    from public.alerts
   where id = p_alert and township_id = public.my_township()
     for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_alert.created_by = (select auth.uid()) then
    raise exception 'own_alert';
  end if;
  if v_alert.is_official then
    raise exception 'official_pin';
  end if;
  if v_alert.status <> 'active' or v_alert.expires_at <= now() then
    raise exception 'not_active';
  end if;

  insert into public.alert_votes (alert_id, user_id, vote)
  values (p_alert, (select auth.uid()), p_vote)
  on conflict (alert_id, user_id) do update set vote = excluded.vote, created_at = now();

  select count(*) filter (where vote = 'still_there'), count(*) filter (where vote = 'gone')
    into v_confirm, v_gone
    from public.alert_votes
   where alert_id = p_alert;

  update public.alerts
     set confirm_count = v_confirm,
         gone_count = v_gone,
         last_confirmed_at = case when p_vote = 'still_there' then now() else last_confirmed_at end,
         expires_at = case when p_vote = 'still_there' then now() + interval '2 hours' else expires_at end,
         status = case when v_gone >= 3 then 'cleared' else status end
   where id = p_alert;
end
$$;

-- The Management Office pins road works, water cuts and the like to its own township's map. No expiry.
create function public.create_official_pin(p_type text, p_severity text, p_lat float8, p_lng float8, p_note text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  if p_type is null or p_type not in (
    'accident', 'snake', 'suspicious', 'stray_dogs', 'flood', 'fallen_tree', 'walkway_blocked', 'streetlight', 'police'
  ) then
    raise exception 'bad_type';
  end if;
  if p_severity is null or p_severity not in ('high', 'medium', 'low') then
    raise exception 'bad_severity';
  end if;
  if not exists (
    select 1 from public.townships t
     where t.id = public.my_township() and abs(p_lat - t.centre_lat) <= 0.05 and abs(p_lng - t.centre_lng) <= 0.05
  ) then
    raise exception 'out_of_area';
  end if;

  insert into public.alerts (township_id, type, severity, lat, lng, note, created_by, is_official)
  values (
    public.my_township(), p_type, p_severity, p_lat, p_lng, left(nullif(btrim(p_note), ''), 280), (select auth.uid()), true
  )
  returning id into v_id;
  return v_id;
end
$$;

-- Takes an official pin of the caller's township off the map. A second click (or a stale list) changes nothing.
create function public.remove_official_pin(p_alert uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  update public.alerts
     set status = 'removed'
   where id = p_alert and is_official and township_id = public.my_township() and status = 'active';
  if not found and not exists (
    select 1 from public.alerts where id = p_alert and is_official and township_id = public.my_township()
  ) then
    raise exception 'not_found';
  end if;
end
$$;

-- Live updates (ruling R4): each change to an alert or a vote tells its township's public channel which alert changed,
-- and nothing more. Clients refetch public_alerts. Definer because realtime.messages accepts rows only from roles that
-- bypass its RLS, and realtime.send turns a refused insert into a WARNING, so a broadcast would go missing silently.
create function public.broadcast_alert_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb;
  v_alert uuid;
  v_township uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;
  if tg_table_name = 'alerts' then
    v_alert := v_row ->> 'id';
    v_township := v_row ->> 'township_id';
  else
    v_alert := v_row ->> 'alert_id';
    select a.township_id into v_township from public.alerts a where a.id = v_alert;
  end if;
  if v_township is not null then -- a vote removed along with its alert: the alert's own broadcast covers it
    perform realtime.send(
      jsonb_build_object('id', v_alert, 'table', tg_table_name::text),
      tg_table_name::text,
      'township:' || v_township::text,
      false
    );
  end if;
  return null;
end
$$;

create trigger alerts_broadcast
  after insert or update or delete on public.alerts
  for each row execute function public.broadcast_alert_change();
create trigger alert_votes_broadcast
  after insert or update or delete on public.alert_votes
  for each row execute function public.broadcast_alert_change();

-- RLS on, and no policies: the API roles reach neither table (service_role bypasses RLS for the seed and demo reset).
alter table public.alerts enable row level security;
alter table public.alert_votes enable row level security;

-- Table privileges: take away the defaults, then give back exactly what is used.
revoke all on table public.alerts, public.alert_votes from anon, authenticated;
grant select, insert, update, delete on table public.alerts, public.alert_votes to service_role;
-- Read-only, and only for signed-in users: as a simple view it would otherwise pass writes through to alerts.
revoke all on table public.public_alerts from anon, authenticated, service_role;
grant select on table public.public_alerts to authenticated;

-- Function privileges. The four RPCs check their caller themselves; the trigger function is nobody's to call.
revoke execute on function
  public.create_alert(text, text, float8, float8, text, text), public.vote_alert(uuid, text),
  public.create_official_pin(text, text, float8, float8, text), public.remove_official_pin(uuid),
  public.broadcast_alert_change()
  from public, anon, authenticated;
grant execute on function
  public.create_alert(text, text, float8, float8, text, text), public.vote_alert(uuid, text),
  public.create_official_pin(text, text, float8, float8, text), public.remove_official_pin(uuid)
  to authenticated;

notify pgrst, 'reload schema';
