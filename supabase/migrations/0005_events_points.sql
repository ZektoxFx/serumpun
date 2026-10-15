-- Events, RSVPs, QR check-in and the points ledger.
--
-- Residents never touch the three tables. They read public_events, which leaves out the check-in code and adds the
-- organiser's name and whether the caller is going, and they write only through the RPCs below, each of which checks
-- its caller itself. The check-in code reaches only the organiser and the Management Office (event_checkin_url). Points
-- are created only by check_in_event (and spent by the rewards of a later migration); each person reads only their own.

-- ---------------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references public.townships (id),
  group_id uuid, -- the groups migration adds the foreign key (ruling R6)
  title text not null check (length(btrim(title)) between 1 and 120),
  description text check (length(description) <= 2000),
  -- The categories of lib/domain/events.ts. The Management Office's events, and only those, are 'official'.
  category text not null check (category in ('official', 'sports', 'family', 'green', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_text text not null check (length(btrim(location_text)) between 1 and 120),
  organizer_id uuid references public.profiles (id) on delete set null,
  is_official boolean not null default false,
  -- Points for a resident event: none asked, asked (pending), approved or rejected by the Management Office.
  approval_status text not null default 'none' check (approval_status in ('none', 'pending', 'approved', 'rejected')),
  points int not null default 0 check (points between 0 and 1000),
  -- The secret in the check-in QR (/checkin/<id>?c=<code>).
  checkin_code text not null default replace(gen_random_uuid()::text, '-', ''),
  going_count int not null default 0 check (going_count >= 0),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (is_official = (category = 'official')),
  check (points = 0 or approval_status = 'approved')
);
create index events_township_id_starts_at_idx on public.events (township_id, starts_at);
create index events_organizer_id_idx on public.events (organizer_id);

-- Who is going, and when they checked in at the venue.
create table public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  checked_in_at timestamptz,
  primary key (event_id, user_id)
);
create index event_rsvps_user_id_idx on public.event_rsvps (user_id);

-- Every point earned or spent. A balance is the sum of its owner's rows. The unique key counts each event (or voucher)
-- once per person, however often a check-in is retried.
create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta int not null check (delta <> 0),
  reason text not null check (reason in ('event', 'reward')),
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_id)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- The view residents read. A definer view, so its WHERE is the only filter; security_barrier keeps a caller's own
-- filters from running before it. Events are public in the township, and so is the name of whoever runs one (residents
-- already read each other's names through profiles); the check-in code is not here.
-- ---------------------------------------------------------------------------------------------------------------------

create view public.public_events with (security_invoker = false, security_barrier = true) as
select
  e.id, e.township_id, e.group_id, e.title, e.description, e.category, e.starts_at, e.ends_at, e.location_text,
  e.is_official, e.approval_status, e.points, e.going_count, e.created_at,
  case when e.is_official then null else p.full_name end as organizer_name,
  coalesce(e.organizer_id = (select auth.uid()), false) as is_mine,
  r.user_id is not null as is_going,
  r.checked_in_at
from public.events e
left join public.profiles p on p.id = e.organizer_id
left join public.event_rsvps r on r.event_id = e.id and r.user_id = (select auth.uid())
where e.township_id = (select public.my_township());

-- ---------------------------------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------------------------------

-- The organiser of a resident event asks the Management Office for points; the office is told. Asking again while it
-- waits, or after an approval, changes nothing.
create function public.request_event_points(p_event uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  select * into v_event from public.events where id = p_event and township_id = public.my_township() for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_event.is_official or v_event.organizer_id is distinct from (select auth.uid()) then
    raise exception 'not_organizer';
  end if;
  if v_event.ends_at <= now() then
    raise exception 'event_over';
  end if;
  if v_event.approval_status in ('pending', 'approved') then
    return;
  end if;
  update public.events set approval_status = 'pending' where id = p_event;
  perform public.notify(
    array(
      select p.id from public.profiles p
       where p.township_id = v_event.township_id and p.role = 'management' and p.status = 'verified'
    ),
    'event', 'notify.event.pending', v_event.title, '/dashboard/events'
  );
end
$$;

-- A verified resident creates an event in their township (going to it themselves), optionally asking for points at
-- once. The Management Office's events are official: approved and worth DEFAULT_POINTS.official (150).
create function public.create_event(
  p_title text, p_description text, p_category text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_location_text text, p_ask_points boolean default false
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_office boolean := public.is_management();
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if (v_office and p_category is distinct from 'official')
     or (not v_office and (p_category is null or p_category not in ('sports', 'family', 'green', 'other'))) then
    raise exception 'bad_category';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'bad_title';
  end if;
  if nullif(btrim(p_location_text), '') is null then
    raise exception 'bad_place';
  end if;
  -- Later than now, within a year, and one sitting of at most a day.
  if p_starts_at is null or p_ends_at is null or p_starts_at < now() or p_starts_at > now() + interval '1 year'
     or p_ends_at <= p_starts_at or p_ends_at > p_starts_at + interval '24 hours' then
    raise exception 'bad_time';
  end if;

  insert into public.events (
    township_id, title, description, category, starts_at, ends_at, location_text, organizer_id, is_official,
    approval_status, points
  )
  values (
    public.my_township(), left(btrim(p_title), 120), left(nullif(btrim(p_description), ''), 2000), p_category,
    p_starts_at, p_ends_at, left(btrim(p_location_text), 120), (select auth.uid()), v_office,
    case when v_office then 'approved' else 'none' end, case when v_office then 150 else 0 end
  )
  returning id into v_id;

  if not v_office then
    insert into public.event_rsvps (event_id, user_id) values (v_id, (select auth.uid()));
    update public.events set going_count = 1 where id = v_id;
    if coalesce(p_ask_points, false) then
      perform public.request_event_points(v_id);
    end if;
  end if;
  return v_id;
end
$$;

-- The Management Office approves points for a resident event that asked, or turns it down; the organiser is told.
create function public.approve_event(p_event uuid, p_points int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  if p_points is null or p_points not between 1 and 1000 then
    raise exception 'bad_points';
  end if;
  select * into v_event from public.events where id = p_event and township_id = public.my_township() for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_event.approval_status <> 'pending' then
    raise exception 'not_pending';
  end if;
  update public.events set approval_status = 'approved', points = p_points where id = p_event;
  perform public.notify(array[v_event.organizer_id], 'event', 'notify.event.approved', v_event.title, '/community/events/' || p_event);
end
$$;

create function public.reject_event(p_event uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  select * into v_event from public.events where id = p_event and township_id = public.my_township() for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_event.approval_status <> 'pending' then
    raise exception 'not_pending';
  end if;
  update public.events set approval_status = 'rejected' where id = p_event;
  perform public.notify(array[v_event.organizer_id], 'event', 'notify.event.rejected', v_event.title, '/community/events/' || p_event);
end
$$;

-- "Going" to an event that has not ended. A second tap changes nothing.
create function public.rsvp_event(p_event uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ends timestamptz;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  select ends_at into v_ends from public.events where id = p_event and township_id = public.my_township();
  if not found then
    raise exception 'not_found';
  end if;
  if v_ends <= now() then
    raise exception 'event_over';
  end if;
  insert into public.event_rsvps (event_id, user_id) values (p_event, (select auth.uid())) on conflict do nothing;
  if found then
    update public.events set going_count = going_count + 1 where id = p_event;
  end if;
end
$$;

-- No longer going. Someone who already checked in stays on the list.
create function public.cancel_rsvp(p_event uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if not exists (select 1 from public.events where id = p_event and township_id = public.my_township()) then
    raise exception 'not_found';
  end if;
  if exists (
    select 1 from public.event_rsvps
     where event_id = p_event and user_id = (select auth.uid()) and checked_in_at is not null
  ) then
    raise exception 'checked_in';
  end if;
  delete from public.event_rsvps where event_id = p_event and user_id = (select auth.uid()) and checked_in_at is null;
  if found then
    update public.events set going_count = greatest(going_count - 1, 0) where id = p_event;
  end if;
end
$$;

-- Check-in from the event's QR: a verified resident, the right code, an approved event with points, inside the window
-- (1 h before the start to 3 h after, both included: isWithinCheckinWindow), and not checked in already. Returns the
-- points added. A wrong or unknown event answers bad_code, so the codes of other townships' events cannot be probed.
create function public.check_in_event(p_event uuid, p_code text)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_now timestamptz := now();
  v_new boolean;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  select * into v_event from public.events where id = p_event and township_id = public.my_township();
  if not found or p_code is null or v_event.checkin_code <> p_code then
    raise exception 'bad_code';
  end if;
  if v_event.approval_status <> 'approved' or v_event.points = 0 then
    raise exception 'not_approved';
  end if;
  if v_now < v_event.starts_at - interval '1 hour' or v_now > v_event.starts_at + interval '3 hours' then
    raise exception 'outside_window';
  end if;

  -- One check-in per resident: a second scan, or two at once, finds checked_in_at already set and changes nothing.
  -- Checking in without having tapped Going counts as going (xmax = 0 marks a freshly inserted row).
  insert into public.event_rsvps (event_id, user_id, checked_in_at)
  values (p_event, (select auth.uid()), v_now)
  on conflict (event_id, user_id) do update set checked_in_at = excluded.checked_in_at
   where public.event_rsvps.checked_in_at is null
  returning (xmax = 0) into v_new;
  if not found then
    raise exception 'already_checked_in';
  end if;
  if v_new then
    update public.events set going_count = going_count + 1 where id = p_event;
  end if;
  insert into public.points_ledger (user_id, delta, reason, ref_id)
  values ((select auth.uid()), v_event.points, 'event', p_event)
  on conflict do nothing;
  return v_event.points;
end
$$;

-- The link the check-in QR holds, for the organiser and the Management Office only.
create function public.event_checkin_url(p_event uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  select * into v_event from public.events where id = p_event and township_id = public.my_township();
  if not found then
    raise exception 'not_found';
  end if;
  if not (public.is_management() or v_event.organizer_id = (select auth.uid())) then
    raise exception 'not_allowed';
  end if;
  return '/checkin/' || v_event.id || '?c=' || v_event.checkin_code;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.points_ledger enable row level security;

create policy "Residents read their own points" on public.points_ledger
  for select to authenticated
  using (user_id = (select auth.uid()) and (select public.my_township()) is not null);

-- Take away the defaults, then give back exactly what is used: residents read events through the view and their own
-- points; nothing is written except through the RPCs.
revoke all on table public.events, public.event_rsvps, public.points_ledger from anon, authenticated;
grant select on table public.points_ledger to authenticated;
grant select, insert, update, delete on table public.events, public.event_rsvps, public.points_ledger to service_role;
revoke all on table public.public_events from anon, authenticated, service_role;
grant select on table public.public_events to authenticated;

revoke execute on function
  public.request_event_points(uuid),
  public.create_event(text, text, text, timestamptz, timestamptz, text, boolean),
  public.approve_event(uuid, int),
  public.reject_event(uuid),
  public.rsvp_event(uuid),
  public.cancel_rsvp(uuid),
  public.check_in_event(uuid, text),
  public.event_checkin_url(uuid)
  from public, anon, authenticated;
grant execute on function
  public.request_event_points(uuid),
  public.create_event(text, text, text, timestamptz, timestamptz, text, boolean),
  public.approve_event(uuid, int),
  public.reject_event(uuid),
  public.rsvp_event(uuid),
  public.cancel_rsvp(uuid),
  public.check_in_event(uuid, text),
  public.event_checkin_url(uuid)
  to authenticated;

notify pgrst, 'reload schema';
