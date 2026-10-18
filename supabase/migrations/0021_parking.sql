-- Pay parking (feedback round 2): a demo of paying for parking at Sime Darby Property's malls. A resident's saved car
-- plates, and their parking sessions: a pretend entry time (there is no gate camera) and, once "paid" (no money moves),
-- the amount, the way they chose and when they must have left.
--
-- Only trusted server code (lib/parking.ts, with the service role) reads and writes these tables, because the amount
-- comes from the tested fee rules in lib/domain/parking.ts. Residents get no API access at all, so nobody can read
-- anyone's plates, their own included, except through the app's server.

create table public.vehicles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Normalised: upper case letters and digits in words of one space ("WXY 1234").
  plate text not null check (plate ~ '^[A-Z0-9]+( [A-Z0-9]+)*$' and length(replace(plate, ' ', '')) between 2 and 10),
  last_used_at timestamptz not null default now(),
  primary key (user_id, plate)
);

create table public.parking_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The mall slugs of lib/domain/malls.ts.
  mall text not null check (mall in ('elmina-lakeside-mall', 'kl-east-mall')),
  plate text not null,
  entered_at timestamptz not null,
  created_at timestamptz not null default now(),
  method text check (method in ('duitnow_qr', 'fpx', 'apple_pay', 'google_pay')),
  total_sen int check (total_sen >= 0),
  paid_at timestamptz,
  exit_by timestamptz,
  ref text unique,
  -- Paid means all of it at once.
  check ((paid_at is null) = (method is null) and (paid_at is null) = (total_sen is null) and (paid_at is null) = (exit_by is null))
);
create index parking_sessions_lookup_idx on public.parking_sessions (user_id, mall, plate, created_at desc);

alter table public.vehicles enable row level security;
alter table public.parking_sessions enable row level security;

revoke all on table public.vehicles, public.parking_sessions from anon, authenticated;
grant select, insert, update, delete on table public.vehicles, public.parking_sessions to service_role;

notify pgrst, 'reload schema';
