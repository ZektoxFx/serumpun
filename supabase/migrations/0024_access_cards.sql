create extension if not exists pgcrypto with schema extensions; -- extensions.crypt() and gen_salt() hash the PINs

-- Household access card, stage 1 (docs/superpowers/specs/2026-10-19-household-access-card-design.md, sections 5 and 6):
-- the office's units, one card per unit, the people and phones on it, each phone's browser keys, the visit log, and
-- the PINs that open the card.
--
-- Signed-in users only read: the office its township's units, cards, members and phones; a member their own card's.
-- Every write goes through the functions below or the service role (the seed, the reader API). The visit log keeps
-- the card, so the unit, and never the person or the phone. Nobody reads the PINs.

-- ---------------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------------

-- The office's record of a home: who is on record, and the last day of a tenant's lease.
create table public.units (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references public.townships (id),
  label text not null check (length(btrim(label)) between 1 and 80),
  neighbourhood text not null check (length(btrim(neighbourhood)) between 1 and 80),
  record_name text not null check (length(btrim(record_name)) between 1 and 80),
  record_tenure text not null check (record_tenure in ('owner', 'tenant')),
  record_phone text check (length(btrim(record_phone)) <= 30),
  lease_end date,
  unique (township_id, label),
  check (record_tenure = 'tenant' or lease_end is null)
);

-- One card per unit. A suspended card carries the office's reason; places are the ones it opens.
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references public.townships (id),
  unit_id uuid not null unique references public.units (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  suspended_reason text check (length(btrim(suspended_reason)) between 1 and 200),
  suspended_at timestamptz,
  places text[] not null default '{facilities,gym,pool}' check (places <@ '{facilities,gym,pool}'),
  phone_limit int not null default 4 check (phone_limit between 4 and 40),
  created_at timestamptz not null default now(),
  check ((status = 'suspended') = (suspended_reason is not null))
);

-- The people on a card: one card each, and at most one Owner and one Co-owner per card.
create table public.card_members (
  card_id uuid not null references public.cards (id) on delete cascade,
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'co_owner', 'adult', 'child')),
  ic_checked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);
create unique index card_members_one_owner_idx on public.card_members (card_id) where role = 'owner';
create unique index card_members_one_co_owner_idx on public.card_members (card_id) where role = 'co_owner';

-- A card's phones, one per person.
create table public.card_phones (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 60),
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (card_id, label)
);
create unique index card_phones_one_per_person_idx on public.card_phones (user_id) where user_id is not null;

-- The public key (P-256 x and y, base64url) of each browser that holds a phone's card. Readers never store these: the
-- signed pass carries the key.
create table public.phone_keys (
  id uuid primary key default gen_random_uuid(),
  phone_id uuid not null references public.card_phones (id) on delete cascade,
  x text not null,
  y text not null,
  created_at timestamptz not null default now(),
  unique (phone_id, x, y)
);

-- Every tap, by card (so by unit), never by person or phone. The nonce is the tap note's own, so a replayed note fails
-- its insert (23505). The reasons are DENY_REASONS in lib/card/decide.ts.
create table public.card_visits (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references public.townships (id),
  card_id uuid not null references public.cards (id) on delete cascade,
  place text not null check (place in ('facilities', 'gym', 'pool')),
  facility_id uuid references public.facilities (id) on delete set null,
  granted boolean not null,
  reason text check (reason in ('pass_expired', 'phone_off', 'card_suspended', 'lease_ended', 'place_off', 'no_booking')),
  offline boolean not null default false,
  nonce text not null unique,
  at timestamptz not null,
  created_at timestamptz not null default now(),
  check (granted = (reason is null))
);
create index card_visits_card_id_at_idx on public.card_visits (card_id, at desc);

-- Each person's PIN, hashed with bcrypt, with the wrong tries since the last right one and any lockout.
create table public.member_pins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pin_hash text not null,
  failed_count int not null default 0,
  locked_until timestamptz
);

-- ---------------------------------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------------------------------

-- The caller's card, or null. Security definer, like my_township(), so the policies that call it don't recurse.
create function public.my_card() returns uuid
language sql stable security definer set search_path = ''
as $$
  select card_id from public.card_members where user_id = (select auth.uid())
$$;

-- Adds this browser's public key to the caller's phone, making the phone the first time, and answers what the pass
-- carries. Until stage 2's move-to-a-new-phone rule every browser of a person joins their one phone, which is also what
-- a shared demo account needs: many visitors as Aisyah keep her card at 3 of 4 phones.
create function public.register_phone_key(p_x text, p_y text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_card public.cards%rowtype;
  v_phone uuid;
begin
  -- Locks the card, so two browsers can't both make the caller's phone, nor two people both take its last one.
  select c.* into v_card
    from public.cards c
    join public.card_members m on m.card_id = c.id
   where m.user_id = v_me
     for update of c;
  if not found then
    raise exception 'no_card';
  end if;
  -- A P-256 coordinate is 32 bytes: 43 base64url characters.
  if p_x is null or p_y is null or p_x !~ '^[A-Za-z0-9_-]{43}$' or p_y !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'bad_key';
  end if;
  select id into v_phone from public.card_phones where user_id = v_me and card_id = v_card.id;
  if not found then
    if (select count(*) from public.card_phones where card_id = v_card.id) >= v_card.phone_limit then
      raise exception 'card_full';
    end if;
    -- 52 characters of name keep the label within its 60.
    insert into public.card_phones (card_id, user_id, label)
    select v_card.id, v_me, left(split_part(btrim(full_name), ' ', 1), 52) || '''s phone'
      from public.profiles where id = v_me
    returning id into v_phone;
  end if;
  insert into public.phone_keys (phone_id, x, y) values (v_phone, p_x, p_y) on conflict do nothing;
  return (
    select jsonb_build_object(
      'card', v_card.id, 'unit', u.label, 'township', v_card.township_id, 'phone', v_phone,
      'places', to_jsonb(v_card.places), 'suspended', v_card.status = 'suspended', 'lease_end', u.lease_end
    )
      from public.units u where u.id = v_card.unit_id
  );
end
$$;

-- Sets the PIN of each person listed, and clears their wrong tries and lockout. Only the seed calls it, with the
-- service-role key.
create function public.set_member_pins(p_users uuid[], p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- [0-9], not \d: on this database \d also matches other scripts' digits, which the PIN pad never sends.
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    raise exception 'bad_pin';
  end if;
  insert into public.member_pins (user_id, pin_hash)
  select u, extensions.crypt(p_pin, extensions.gen_salt('bf')) from unnest(p_users) u
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, failed_count = 0, locked_until = null;
end
$$;

-- Checks the caller's PIN. It answers {"ok": true}, {"ok": false, "tries_left": n} or {"ok": false, "locked_until": t},
-- returning rather than raising so that a wrong try is saved. The 5th wrong try locks the PIN for 15 minutes and tells
-- the card's Owner and Co-owner.
create function public.verify_card_pin(p_pin text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v public.member_pins%rowtype;
begin
  -- Locks the row, so tries sent at once still count one at a time.
  select * into v from public.member_pins where user_id = v_me for update;
  if not found then
    raise exception 'no_pin';
  end if;
  if v.locked_until > now() then
    return jsonb_build_object('ok', false, 'locked_until', v.locked_until);
  end if;
  if extensions.crypt(p_pin, v.pin_hash) = v.pin_hash then
    update public.member_pins set failed_count = 0, locked_until = null where user_id = v_me;
    return jsonb_build_object('ok', true);
  end if;
  -- Every visitor shares a demo account, so its lockout lives in each browser (spec section 9): one visitor can't lock
  -- everyone out.
  if (select raw_app_meta_data ? 'demo' from auth.users where id = v_me) then
    return jsonb_build_object('ok', false, 'tries_left', 5 - v.failed_count);
  end if;
  if v.failed_count + 1 < 5 then
    update public.member_pins set failed_count = v.failed_count + 1 where user_id = v_me;
    return jsonb_build_object('ok', false, 'tries_left', 5 - (v.failed_count + 1));
  end if;
  update public.member_pins set failed_count = 0, locked_until = now() + interval '15 minutes' where user_id = v_me
  returning locked_until into v.locked_until;
  perform public.notify(
    array(
      select m.user_id from public.card_members m
       where m.card_id = (select card_id from public.card_members where user_id = v_me) and m.role in ('owner', 'co_owner')
    ),
    'card', 'notify.card.pinLocked', null, '/me'
  );
  return jsonb_build_object('ok', false, 'locked_until', v.locked_until);
end
$$;

-- The office suspends a card of its township, saying why (a landlord's request, say), and everyone on it is told.
-- Suspending it again only changes the reason, and tells them the new one.
create function public.suspend_card(p_card uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_reason text := btrim(p_reason);
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  perform 1 from public.cards where id = p_card and township_id = public.my_township() for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_reason is null or length(v_reason) not between 1 and 200 then
    raise exception 'bad_reason';
  end if;
  update public.cards
     set status = 'suspended', suspended_reason = v_reason,
         suspended_at = case when status = 'suspended' then suspended_at else now() end
   where id = p_card;
  perform public.notify(
    array(select user_id from public.card_members where card_id = p_card), 'card', 'notify.card.suspended', v_reason,
    '/me'
  );
end
$$;

-- The office lifts a suspension, and everyone on the card is told.
create function public.lift_card_suspension(p_card uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_status text;
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  select status into v_status from public.cards where id = p_card and township_id = public.my_township() for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_status <> 'suspended' then
    raise exception 'not_suspended';
  end if;
  update public.cards set status = 'active', suspended_reason = null, suspended_at = null where id = p_card;
  perform public.notify(
    array(select user_id from public.card_members where card_id = p_card), 'card', 'notify.card.lifted', null, '/me'
  );
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.units enable row level security;
alter table public.cards enable row level security;
alter table public.card_members enable row level security;
alter table public.card_phones enable row level security;
alter table public.phone_keys enable row level security;
alter table public.card_visits enable row level security;
alter table public.member_pins enable row level security; -- no policy: only the PIN functions read it

create policy "The office reads its township's units" on public.units
  for select to authenticated using ((select public.is_management()) and township_id = (select public.my_township()));
create policy "Members read their card's unit" on public.units
  for select to authenticated using (id = (select unit_id from public.cards where id = (select public.my_card())));

create policy "The office reads its township's cards" on public.cards
  for select to authenticated using ((select public.is_management()) and township_id = (select public.my_township()));
create policy "Members read their own card" on public.cards
  for select to authenticated using (id = (select public.my_card()));

create policy "The office reads who is on its township's cards" on public.card_members
  for select to authenticated using (
    (select public.is_management())
    and exists (
      select 1 from public.cards c where c.id = card_members.card_id and c.township_id = (select public.my_township())
    )
  );
create policy "Members read who is on their card" on public.card_members
  for select to authenticated using (card_id = (select public.my_card()));

create policy "The office reads its township's card phones" on public.card_phones
  for select to authenticated using (
    (select public.is_management())
    and exists (
      select 1 from public.cards c where c.id = card_phones.card_id and c.township_id = (select public.my_township())
    )
  );
create policy "Members read their card's phones" on public.card_phones
  for select to authenticated using (card_id = (select public.my_card()));

create policy "People read their own phone's keys" on public.phone_keys
  for select to authenticated using (
    exists (select 1 from public.card_phones p where p.id = phone_keys.phone_id and p.user_id = (select auth.uid()))
  );

-- The office reads none: incident lookups come in stage 5.
create policy "Members read their card's visits" on public.card_visits
  for select to authenticated using (card_id = (select public.my_card()));

-- Take away the defaults, then give back exactly what the policies above need: signed-in users only read, and never the
-- PINs. The service-role key (seed, demo reset, reader API) bypasses RLS but still needs table privileges.
revoke all on table
  public.units, public.cards, public.card_members, public.card_phones, public.phone_keys, public.card_visits,
  public.member_pins
  from anon, authenticated;
grant select on table
  public.units, public.cards, public.card_members, public.card_phones, public.phone_keys, public.card_visits
  to authenticated;
grant select, insert, update, delete on table
  public.units, public.cards, public.card_members, public.card_phones, public.phone_keys, public.card_visits,
  public.member_pins
  to service_role;

revoke execute on function
  public.my_card(), public.register_phone_key(text, text), public.set_member_pins(uuid[], text),
  public.verify_card_pin(text), public.suspend_card(uuid, text), public.lift_card_suspension(uuid)
  from public, anon, authenticated;
-- my_card() only describes the caller, for the policies; the others check the caller themselves.
grant execute on function
  public.my_card(), public.register_phone_key(text, text), public.verify_card_pin(text),
  public.suspend_card(uuid, text), public.lift_card_suspension(uuid)
  to authenticated;
-- It sets anyone's PIN: only trusted server code holding the service-role key.
grant execute on function public.set_member_pins(uuid[], text) to service_role;

notify pgrst, 'reload schema';
