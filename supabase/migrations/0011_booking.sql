-- Book a Court: free 1-hour slots at the township's courts, 7 am to 11 pm, up to 7 days ahead (spec §8.9).
--
-- Residents read their township's courts and their own bookings, never anyone else's: which hours are taken comes from
-- booked_slots (hours only, never who), and how many hours their household has left from household_booked_hours. They
-- book and cancel only through book_slot and cancel_booking, which keep the rules of lib/domain/booking.ts: a day from
-- today to six days ahead in Malaysia, a slot that has not started, one booking per slot, at most 2 hours a day per
-- household (the residents of one unit), and cancelling at least 2 hours before the start.

-- ---------------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------------

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references public.townships (id),
  -- The sports of lib/domain/booking.ts.
  sport text not null check (sport in ('badminton', 'futsal', 'tennis', 'hall')),
  court_label text not null check (length(btrim(court_label)) between 1 and 60),
  place_name text not null check (length(btrim(place_name)) between 1 and 80),
  lat double precision not null,
  lng double precision not null
);
create index facilities_township_id_idx on public.facilities (township_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  township_id uuid not null references public.townships (id),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The booker's unit when they booked: the household the daily limit counts. Only its booker can read it.
  unit_no text not null,
  date date not null,
  start_hour int not null check (start_hour between 7 and 22),
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  players_needed int not null default 0 check (players_needed between 0 and 10),
  created_at timestamptz not null default now()
);
-- One booking per slot: a second tap, or two neighbours at once, gets slot_taken.
create unique index bookings_slot_idx on public.bookings (facility_id, date, start_hour) where status = 'booked';
create index bookings_user_id_idx on public.bookings (user_id);
create index bookings_township_id_date_idx on public.bookings (township_id, date) where status = 'booked';

-- Who joins a game that needs players (Task 21). Nothing reads or writes it yet.
create table public.booking_players (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (booking_id, user_id)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------------------------------

-- A verified resident books one slot of a court in their township. p_players_needed is for Find players (Task 21).
create function public.book_slot(p_facility uuid, p_date date, p_hour int, p_players_needed int default 0)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_township uuid := public.my_township();
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_unit text;
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if not exists (select 1 from public.facilities where id = p_facility and township_id = v_township) then
    raise exception 'not_found';
  end if;
  if p_date is null or p_date < v_today or p_date > v_today + 6 then
    raise exception 'bad_date';
  end if;
  if p_hour is null or p_hour not between 7 and 22 then
    raise exception 'bad_slot';
  end if;
  if (p_date + make_interval(hours => p_hour)) at time zone 'Asia/Kuala_Lumpur' <= now() then
    raise exception 'slot_started';
  end if;
  if p_players_needed is null or p_players_needed not between 0 and 10 then
    raise exception 'bad_players';
  end if;
  select unit_no into v_unit from public.profile_private where id = v_me;
  if v_unit is null then
    raise exception 'no_unit'; -- the Management Office has no home to book for
  end if;
  -- One booking at a time per household and day, so two residents of a unit cannot both take its last hour.
  perform pg_advisory_xact_lock(hashtextextended(v_township::text || '|' || lower(btrim(v_unit)) || '|' || p_date::text, 0));
  if (
    select count(*) from public.bookings
     where township_id = v_township and date = p_date and status = 'booked' and lower(btrim(unit_no)) = lower(btrim(v_unit))
  ) >= 2 then
    raise exception 'household_limit';
  end if;
  insert into public.bookings (facility_id, township_id, user_id, unit_no, date, start_hour, players_needed)
  values (p_facility, v_township, v_me, v_unit, p_date, p_hour, p_players_needed)
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'slot_taken';
  end if;
  return v_id;
end
$$;

-- The booker cancels, free, until 2 hours before the start.
create function public.cancel_booking(p_booking uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.bookings%rowtype;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  select * into v from public.bookings
   where id = p_booking and user_id = (select auth.uid()) and status = 'booked'
     for update;
  if not found then
    raise exception 'not_found';
  end if;
  if (v.date + make_interval(hours => v.start_hour)) at time zone 'Asia/Kuala_Lumpur' - interval '2 hours' < now() then
    raise exception 'too_late';
  end if;
  update public.bookings set status = 'cancelled' where id = p_booking;
end
$$;

-- Which hours of a court are taken on a day: hours only, never who. Any member may look (pending ones browse too).
create function public.booked_slots(p_facility uuid, p_date date)
returns setof int
language sql stable security definer set search_path = ''
as $$
  select b.start_hour from public.bookings b
   where b.facility_id = p_facility and b.date = p_date and b.status = 'booked'
     and b.township_id = public.my_township()
   order by 1
$$;

-- How many hours the caller's household has booked on a day, for "Your household can still book ...".
create function public.household_booked_hours(p_date date)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.bookings b
    join public.profile_private pp on pp.id = (select auth.uid())
   where b.township_id = public.my_township() and b.date = p_date and b.status = 'booked'
     and lower(btrim(b.unit_no)) = lower(btrim(pp.unit_no))
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.facilities enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_players enable row level security;

create policy "Residents read their township's courts" on public.facilities
  for select to authenticated using (township_id = (select public.my_township()));
create policy "Residents read their own bookings" on public.bookings
  for select to authenticated using (user_id = (select auth.uid()) and township_id = (select public.my_township()));

-- Take away the defaults, then give back exactly what is used: residents read courts and their own bookings; nothing
-- is written except through the RPCs.
revoke all on table public.facilities, public.bookings, public.booking_players from anon, authenticated;
grant select on table public.facilities, public.bookings to authenticated;
grant select, insert, update, delete on table public.facilities, public.bookings, public.booking_players to service_role;

revoke execute on function
  public.book_slot(uuid, date, int, int),
  public.cancel_booking(uuid),
  public.booked_slots(uuid, date),
  public.household_booked_hours(date)
  from public, anon, authenticated;
grant execute on function
  public.book_slot(uuid, date, int, int),
  public.cancel_booking(uuid),
  public.booked_slots(uuid, date),
  public.household_booked_hours(date)
  to authenticated;

notify pgrst, 'reload schema';
