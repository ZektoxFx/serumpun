-- Emergency (feedback, 17 Oct): a resident holds ＋ for 3 seconds and taps once, and the Management Office and the
-- residents within 2 km are alerted (a bell notification, a phone notification for those who turned alerts on, and a red
-- 2 km circle on every map) until the office resolves it, the sender cancels it, or 2 hours pass. Who sent it is the
-- office's to know; residents see where and what. Choosing whom to alert (lib/domain/emergency.ts) and sending the
-- phone notifications happen on the server, with the service role. Calling 999 stays the first thing to do.

create table public.emergencies (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references public.townships (id),
  created_by uuid not null references public.profiles (id) on delete cascade,
  lat float8 not null check (lat between -90 and 90),
  lng float8 not null check (lng between -180 and 180),
  -- What it is, once the sender says (lib/domain/emergency.ts): sending first is what matters.
  kind text not null default 'unknown' check (kind in ('unknown', 'fire', 'medical', 'crime', 'other')),
  status text not null default 'active' check (status in ('active', 'resolved', 'cancelled')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index emergencies_township_id_created_at_idx on public.emergencies (township_id, created_at desc);

-- The phones a user turned alerts on for (Me › Emergency alerts). Only the server reads them, to send.
create table public.push_subscriptions (
  endpoint text primary key check (length(endpoint) between 10 and 1000),
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- What residents see: the township's live emergencies of the last 2 hours, where and what, never who (is_mine marks the
-- sender's own). A definer view, so its WHERE is the only filter.
create view public.public_emergencies with (security_invoker = false, security_barrier = true) as
select e.id, e.lat, e.lng, e.kind, e.created_at, e.created_by = (select auth.uid()) as is_mine
from public.emergencies e
where e.township_id = (select public.my_township()) and e.status = 'active' and e.created_at > now() - interval '2 hours';

-- ---------------------------------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------------------------------

-- A verified resident raises an emergency where they are. While their last one is still live, tapping again gives
-- that one back (is_new false), so a double tap alerts nobody twice.
create function public.raise_emergency(p_lat float8, p_lng float8)
returns table (id uuid, is_new boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'bad_place';
  end if;
  -- One at a time per person: their own rows, locked, so two taps at once cannot both insert.
  perform pg_advisory_xact_lock(hashtextextended('emergency|' || v_me::text, 0));
  select e.id into v_id from public.emergencies e
   where e.created_by = v_me and e.status = 'active' and e.created_at > now() - interval '2 hours'
   order by e.created_at desc limit 1;
  if v_id is not null then
    return query select v_id, false;
    return;
  end if;
  insert into public.emergencies (township_id, created_by, lat, lng)
  values (public.my_township(), v_me, p_lat, p_lng)
  returning emergencies.id into v_id;
  return query select v_id, true;
end
$$;

-- The sender says what is happening, while it is live.
create function public.set_emergency_kind(p_emergency uuid, p_kind text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in ('fire', 'medical', 'crime', 'other') then
    raise exception 'bad_kind';
  end if;
  update public.emergencies set kind = p_kind
   where id = p_emergency and created_by = (select auth.uid()) and status = 'active';
  if not found then
    raise exception 'not_found';
  end if;
end
$$;

-- The sender cancels a false alarm; the office resolves one of its township's.
create function public.close_emergency(p_emergency uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_status = 'cancelled' then
    update public.emergencies set status = 'cancelled', closed_at = now()
     where id = p_emergency and created_by = (select auth.uid()) and status = 'active';
  elsif p_status = 'resolved' and public.is_management() then
    update public.emergencies set status = 'resolved', closed_at = now()
     where id = p_emergency and township_id = public.my_township() and status = 'active';
  else
    raise exception 'not_allowed';
  end if;
  if not found then
    raise exception 'not_found';
  end if;
end
$$;

-- This phone may be sent alerts for the caller (the browser's push subscription). A phone handed to someone else is
-- theirs from their next save.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.my_township() is null then
    raise exception 'not_allowed';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or p_p256dh is null or p_auth is null then
    raise exception 'bad_subscription';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, (select auth.uid()), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end
$$;

-- No more alerts on this phone (only for the caller's own subscription).
create function public.delete_push_subscription(p_endpoint text)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = (select auth.uid())
$$;

-- Maps refetch when an emergency starts, changes or ends: an id-only broadcast on the township's channel (as alerts
-- do, ruling R4), and on a channel of its own that the in-app popup listens to on every page.
create function public.broadcast_emergency_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform realtime.send(jsonb_build_object('id', new.id), 'emergencies', 'township:' || new.township_id::text, false);
  perform realtime.send(jsonb_build_object('id', new.id), 'emergencies', 'emergencies:' || new.township_id::text, false);
  return null;
end
$$;
create trigger emergencies_broadcast
  after insert or update on public.emergencies
  for each row execute function public.broadcast_emergency_change();

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.emergencies enable row level security;
alter table public.push_subscriptions enable row level security;

-- The office reads its township's, sender included, for the dashboard's banner; residents read the view.
create policy "The Management Office reads its township's emergencies" on public.emergencies
  for select to authenticated using ((select public.is_management()) and township_id = (select public.my_township()));

revoke all on table public.emergencies, public.push_subscriptions from anon, authenticated;
grant select on table public.emergencies to authenticated;
grant select, insert, update, delete on table public.emergencies, public.push_subscriptions to service_role;
revoke all on table public.public_emergencies from anon, authenticated, service_role;
grant select on table public.public_emergencies to authenticated;

revoke execute on function
  public.raise_emergency(float8, float8),
  public.set_emergency_kind(uuid, text),
  public.close_emergency(uuid, text),
  public.save_push_subscription(text, text, text),
  public.delete_push_subscription(text),
  public.broadcast_emergency_change()
  from public, anon, authenticated;
grant execute on function
  public.raise_emergency(float8, float8),
  public.set_emergency_kind(uuid, text),
  public.close_emergency(uuid, text),
  public.save_push_subscription(text, text, text),
  public.delete_push_subscription(text)
  to authenticated;

notify pgrst, 'reload schema';
