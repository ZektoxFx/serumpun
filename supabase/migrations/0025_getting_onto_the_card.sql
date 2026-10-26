-- Household access card, stage 2 (docs/superpowers/specs/2026-10-19-household-access-card-design.md, section 7.1):
-- getting onto the card. The office gives a code at the counter, a resident registers with it (an SMS code, then a
-- PIN), family join with invite codes, and a card moves to a new phone.
--
-- Codes are kept only as SHA-256 hashes, and SMS codes and PINs only as bcrypt hashes made here. Signed-in users read
-- codes without their hash, and nobody but the service role reads SMS checks. Every write goes through the functions
-- below, each of which takes the township and the caller from the session or my_card(), never from its arguments.
-- The service-role ones are called by server code that has checked what the database can't: an SMS code, a signature.

-- ---------------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------------

-- The office's codes, one open per unit, and the family's invites to a card. A code is open while it has no used_at
-- and no cancelled_at, and its expires_at is still ahead.
create table public.card_codes (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references public.townships (id),
  unit_id uuid not null references public.units (id) on delete cascade,
  card_id uuid references public.cards (id) on delete cascade,
  kind text not null check (kind in ('office', 'invite')),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  name text check (length(btrim(name)) between 1 and 40),
  role text check (role in ('co_owner', 'adult', 'child')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  check ((kind = 'invite') = (card_id is not null and name is not null and role is not null))
);
create index card_codes_open_unit_id_idx on public.card_codes (unit_id) where used_at is null and cancelled_at is null;

-- The SMS codes sent to a phone number. There is no SMS provider: the server shows the code on screen.
create table public.sms_checks (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^\+601[0-9]{8,9}$'),
  code_hash text not null,
  tries int not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- A resident's phone holds one active key. A new browser's key waits until the old browser, or a manager, moves the
-- card to it; a key that moved away, or was declined, is retired rather than deleted, so its browser says the card is
-- elsewhere instead of asking again.
alter table public.phone_keys
  add column state text not null default 'active' check (state in ('active', 'waiting', 'retired'));

-- One account per phone number: sign-in finds the person by it.
create unique index profile_private_phone_idx on public.profile_private (phone) where phone is not null;

-- ---------------------------------------------------------------------------------------------------------------------
-- Replaced from 0024 (CREATE OR REPLACE keeps their owner and grants). Every state the stage-1 app can reach keeps its
-- answer: demo accounts still join their one phone, every seeded member already has a phone, no account on a card is
-- rejected, and every existing key is active.
-- ---------------------------------------------------------------------------------------------------------------------

-- The caller's card, or null. Null too for someone the office rejected, as my_township() is (0001a).
create or replace function public.my_card() returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.card_id
    from public.card_members m
    join public.profiles p on p.id = m.user_id
   where m.user_id = (select auth.uid()) and p.status <> 'rejected'
$$;

-- The managers of a card: its Owner, and its Co-owner once the office has checked their IC (spec section 5). Not a
-- definer and granted to nobody, like notify(): only the functions below call it.
create function public.card_managers(p_card uuid) returns uuid[]
language sql stable set search_path = ''
as $$
  select coalesce(array_agg(user_id), '{}')
    from public.card_members
   where card_id = p_card and (role = 'owner' or (role = 'co_owner' and ic_checked_at is not null))
$$;

-- Checks a person's PIN. It answers {"ok": true}, {"ok": false, "tries_left": n} or {"ok": false, "locked_until": t},
-- returning rather than raising so that a wrong try is saved. The 5th wrong try locks the PIN for 15 minutes and tells
-- the person's card's Owner and Co-owner. 0024's verify_card_pin, for any person: the server calls it for phone sign-in
-- and moves, and the functions below for their caller.
create function public.check_member_pin(p_user uuid, p_pin text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.member_pins%rowtype;
begin
  -- Locks the row, so tries sent at once still count one at a time.
  select * into v from public.member_pins where user_id = p_user for update;
  if not found then
    raise exception 'no_pin';
  end if;
  if v.locked_until > now() then
    return jsonb_build_object('ok', false, 'locked_until', v.locked_until);
  end if;
  if extensions.crypt(p_pin, v.pin_hash) = v.pin_hash then
    update public.member_pins set failed_count = 0, locked_until = null where user_id = p_user;
    return jsonb_build_object('ok', true);
  end if;
  -- Every visitor shares a demo account, so its lockout lives in each browser (spec section 9): one visitor can't lock
  -- everyone out.
  if (select raw_app_meta_data ? 'demo' from auth.users where id = p_user) then
    return jsonb_build_object('ok', false, 'tries_left', 5 - v.failed_count);
  end if;
  if v.failed_count + 1 < 5 then
    update public.member_pins set failed_count = v.failed_count + 1 where user_id = p_user;
    return jsonb_build_object('ok', false, 'tries_left', 5 - (v.failed_count + 1));
  end if;
  update public.member_pins set failed_count = 0, locked_until = now() + interval '15 minutes' where user_id = p_user
  returning locked_until into v.locked_until;
  perform public.notify(
    array(
      select m.user_id from public.card_members m
       where m.card_id = (select card_id from public.card_members where user_id = p_user) and m.role in ('owner', 'co_owner')
    ),
    'card', 'notify.card.pinLocked', null, '/me'
  );
  return jsonb_build_object('ok', false, 'locked_until', v.locked_until);
end
$$;

-- Checks the caller's PIN, for the card's PIN pad.
create or replace function public.verify_card_pin(p_pin text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  return public.check_member_pin((select auth.uid()), p_pin);
end
$$;

-- Adds this browser's public key to the caller's phone, making the phone the first time, and answers what the pass
-- carries. A resident's phone has one active key: a new browser's key waits ({"waiting": true}) until the old browser or
-- a manager moves the card to it, and a key that moved away answers {"moved": true}. A demo account is shared by every
-- visitor, so each browser still joins its seeded phone: many visitors as Aisyah keep her card at 3 of 4 phones.
create or replace function public.register_phone_key(p_x text, p_y text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_card public.cards%rowtype;
  v_name text;
  v_phone uuid;
  v_phone_card uuid;
  v_state text;
begin
  -- Locks the card, so two browsers can't both make the caller's phone or both ask for it, nor two people both take its
  -- last phone.
  select * into v_card from public.cards where id = public.my_card() for update;
  if not found then
    raise exception 'no_card';
  end if;
  -- A P-256 coordinate is 32 bytes: 43 base64url characters.
  if p_x is null or p_y is null or p_x !~ '^[A-Za-z0-9_-]{43}$' or p_y !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'bad_key';
  end if;
  select pr.full_name, p.id, p.card_id into v_name, v_phone, v_phone_card
    from public.profiles pr
    left join public.card_phones p on p.user_id = pr.id
   where pr.id = v_me;
  -- One phone per person, so it can't join this card while it sits on another (stage 1 raised a raw 23505 here).
  if v_phone_card <> v_card.id then
    raise exception 'phone_elsewhere';
  end if;
  if v_phone is null then
    if (select count(*) from public.card_phones where card_id = v_card.id) >= v_card.phone_limit then
      raise exception 'card_full';
    end if;
    -- The whole name, so two people who share a first name get two labels. 52 characters keep it within its 60.
    insert into public.card_phones (card_id, user_id, label)
    values (v_card.id, v_me, left(btrim(v_name), 52) || '''s phone')
    returning id into v_phone;
  else
    select state into v_state from public.phone_keys where phone_id = v_phone and x = p_x and y = p_y;
    if v_state = 'waiting' then
      return jsonb_build_object('waiting', true);
    elsif v_state = 'retired' then
      return jsonb_build_object('moved', true);
    elsif v_state is null
      and exists (select 1 from public.phone_keys where phone_id = v_phone and state = 'active')
      and not coalesce((select raw_app_meta_data ? 'demo' from auth.users where id = v_me), false) then
      -- The newest browser wins: one that still waits is retired, and says the card is elsewhere.
      update public.phone_keys set state = 'retired' where phone_id = v_phone and state = 'waiting';
      insert into public.phone_keys (phone_id, x, y, state) values (v_phone, p_x, p_y, 'waiting');
      perform public.notify(array[v_me], 'card', 'notify.card.moveAsked', v_name, '/me');
      perform public.notify(
        array_remove(public.card_managers(v_card.id), v_me), 'card', 'notify.card.moveAsked', v_name, '/me/household'
      );
      return jsonb_build_object('waiting', true);
    end if;
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

-- ---------------------------------------------------------------------------------------------------------------------
-- Codes at the counter, SMS checks and registering
-- ---------------------------------------------------------------------------------------------------------------------

-- Gives a unit with no card a fresh office code, cancelling the one it had, and answers when it expires. The server
-- makes the code and sends only its hash. The office's own way in is give_unit_code; the seed calls this directly.
create function public.issue_unit_code(p_unit uuid, p_code_hash text, p_by uuid)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_township uuid;
  v_expires timestamptz;
begin
  -- Two codes given at once can't both stay open. NO KEY UPDATE, not UPDATE: a registration that holds the old code
  -- still makes the unit's card, whose foreign key needs a KEY SHARE lock on the unit, so the two can't deadlock.
  select township_id into v_township from public.units where id = p_unit for no key update;
  if not found then
    raise exception 'not_found';
  end if;
  -- Ending a card for a new Owner needs stage 5's ended card.
  if exists (select 1 from public.cards where unit_id = p_unit) then
    raise exception 'has_card';
  end if;
  update public.card_codes set cancelled_at = now()
   where unit_id = p_unit and kind = 'office' and used_at is null and cancelled_at is null and expires_at > now();
  insert into public.card_codes (township_id, unit_id, kind, code_hash, created_by, expires_at)
  values (v_township, p_unit, 'office', p_code_hash, p_by, now() + interval '3 days')
  returning expires_at into v_expires;
  return v_expires;
end
$$;

-- The office, at the counter, after checking the IC and the house title or tenancy agreement: saves the unit's record
-- as it now stands, then gives the unit a code. A tenant's lease must end after today, in Malaysia; an owner has none.
create function public.give_unit_code(
  p_unit uuid, p_name text, p_tenure text, p_phone text, p_lease_end date, p_code_hash text
)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  perform 1 from public.units where id = p_unit and township_id = public.my_township() for no key update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_name is null or length(v_name) not between 1 and 80 then
    raise exception 'bad_name';
  end if;
  if p_tenure is null or p_tenure not in ('owner', 'tenant') then
    raise exception 'bad_tenure';
  end if;
  if p_phone is null or p_phone !~ '^\+601[0-9]{8,9}$' then
    raise exception 'bad_phone';
  end if;
  if (p_tenure = 'tenant' and (p_lease_end is null or p_lease_end <= (now() at time zone 'Asia/Kuala_Lumpur')::date))
     or (p_tenure = 'owner' and p_lease_end is not null) then
    raise exception 'bad_lease';
  end if;
  update public.units
     set record_name = v_name, record_tenure = p_tenure, record_phone = p_phone, lease_end = p_lease_end
   where id = p_unit;
  return public.issue_unit_code(p_unit, p_code_hash, (select auth.uid()));
end
$$;

-- Keeps a 6-digit SMS code for a phone number, for 10 minutes, and answers the check's id. It never looks for an
-- account, so any well-formed number gets a code.
create function public.start_sms_check(p_phone text, p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_phone is null or p_phone !~ '^\+601[0-9]{8,9}$' then
    raise exception 'bad_phone';
  end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' then
    raise exception 'bad_code';
  end if;
  -- No cron: old checks go whenever a new one starts.
  delete from public.sms_checks where created_at < now() - interval '1 day';
  insert into public.sms_checks (phone, code_hash, expires_at)
  values (p_phone, extensions.crypt(p_code, extensions.gen_salt('bf')), now() + interval '10 minutes')
  returning id into v_id;
  return v_id;
end
$$;

-- Checks an SMS code. It answers {"ok": true}, {"ok": false, "tries_left": n}, or {"ok": false, "expired": true} for a
-- check that is missing, used, out of date or out of tries (5).
create function public.verify_sms_check(p_check uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.sms_checks%rowtype;
begin
  -- Locks the row, so tries sent at once still count one at a time.
  select * into v from public.sms_checks where id = p_check for update;
  if not found or v.used_at is not null or v.expires_at <= now() or v.tries >= 5 then
    return jsonb_build_object('ok', false, 'expired', true);
  end if;
  if extensions.crypt(p_code, v.code_hash) = v.code_hash then
    update public.sms_checks set verified_at = coalesce(verified_at, now()) where id = p_check;
    return jsonb_build_object('ok', true);
  end if;
  update public.sms_checks set tries = tries + 1 where id = p_check returning tries into v.tries;
  return jsonb_build_object('ok', false, 'tries_left', 5 - v.tries);
end
$$;

-- Puts a new account on a card, with its profile, phone and PIN, and answers the card. An office code makes the unit's
-- card with the person as its Owner, named as on the office's record and checked when the code was given. An invite
-- puts them on the inviter's card with the name and role it set. The server has just made the account (p_user), and
-- deletes it again if this refuses, so nothing is left half-made.
create function public.complete_registration(p_code_hash text, p_check uuid, p_user uuid, p_pin text, p_lang text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_code public.card_codes%rowtype;
  v_check public.sms_checks%rowtype;
  v_unit public.units%rowtype;
  v_card public.cards%rowtype;
  v_name text;
  v_role text;
  v_checked timestamptz;
begin
  -- Locked, so one code used twice at once makes one account: the second waits, then finds it used.
  select * into v_code from public.card_codes where code_hash = p_code_hash for update;
  if not found or v_code.used_at is not null or v_code.cancelled_at is not null or v_code.expires_at <= now() then
    raise exception 'bad_code';
  end if;
  select * into v_unit from public.units where id = v_code.unit_id;
  select * into v_check from public.sms_checks where id = p_check for update;
  -- An office code texts the number on the office's record, never one typed in.
  if not found or v_check.verified_at is null or v_check.used_at is not null or v_check.expires_at <= now()
     or (v_code.kind = 'office' and v_check.phone is distinct from v_unit.record_phone) then
    raise exception 'bad_check';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    raise exception 'bad_pin';
  end if;
  if exists (select 1 from public.profile_private where phone = v_check.phone) then
    raise exception 'phone_taken';
  end if;

  if v_code.kind = 'office' then
    if exists (select 1 from public.cards where unit_id = v_unit.id) then
      raise exception 'has_card';
    end if;
    insert into public.cards (township_id, unit_id) values (v_unit.township_id, v_unit.id) returning * into v_card;
    v_name := v_unit.record_name;
    v_role := 'owner';
    v_checked := v_code.created_at;
  else
    -- Locks the card, so two invites used at once can't both take its last phone. An open invite holds a phone.
    select * into v_card from public.cards where id = v_code.card_id for update;
    if (select count(*) from public.card_phones where card_id = v_card.id)
       + (select count(*) from public.card_codes
           where card_id = v_card.id and id <> v_code.id
             and used_at is null and cancelled_at is null and expires_at > now())
       >= v_card.phone_limit then
      raise exception 'card_full';
    end if;
    v_name := v_code.name;
    v_role := v_code.role;
  end if;

  insert into public.profiles (id, township_id, full_name, neighbourhood, role, status, lang)
  values (
    p_user, v_unit.township_id, v_name, v_unit.neighbourhood, 'resident', 'verified',
    case when p_lang in ('en', 'ms') then p_lang else 'en' end
  );
  begin
    insert into public.profile_private (id, unit_no, phone) values (p_user, v_unit.label, v_check.phone);
  exception when unique_violation then
    raise exception 'phone_taken'; -- the same number registering at the same moment
  end;
  insert into public.card_members (card_id, user_id, role, ic_checked_at) values (v_card.id, p_user, v_role, v_checked);
  insert into public.card_phones (card_id, user_id, label)
  values (v_card.id, p_user, left(btrim(v_name), 52) || '''s phone');
  insert into public.member_pins (user_id, pin_hash) values (p_user, extensions.crypt(p_pin, extensions.gen_salt('bf')));
  update public.card_codes set used_at = now(), used_by = p_user where id = v_code.id;
  update public.sms_checks set used_at = now() where id = p_check;
  if v_code.kind = 'invite' then
    perform public.notify(public.card_managers(v_card.id), 'card', 'notify.card.joined', v_name, '/me/household');
  end if;
  return v_card.id;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Family invites
-- ---------------------------------------------------------------------------------------------------------------------

-- A manager invites someone to their card, confirmed with their PIN, and it answers {"ok": true, "expires_at": t} or
-- the PIN's answer. A child: the Owner or the checked Co-owner. An adult: only while the Owner decides alone, until
-- stage 3's two-person approvals. A Co-owner: the Owner, when there is none. The name must not make a phone label the
-- card already has. Every refusal comes before the PIN, so a refused invite costs no try.
create function public.create_invite(p_name text, p_role text, p_pin text, p_code_hash text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_card public.cards%rowtype;
  v_my_role text;
  v_name text := btrim(p_name);
  v_pin jsonb;
  v_expires timestamptz;
begin
  -- Locks the card, so two invites made at once can't both take its last phone.
  select * into v_card from public.cards where id = public.my_card() for update;
  if not found then
    raise exception 'no_card';
  end if;
  if not v_me = any (public.card_managers(v_card.id)) then
    raise exception 'not_allowed';
  end if;
  if p_role is null or p_role not in ('co_owner', 'adult', 'child') then
    raise exception 'bad_role';
  end if;
  select role into v_my_role from public.card_members where user_id = v_me;
  if p_role = 'co_owner' then
    if v_my_role <> 'owner' then
      raise exception 'not_allowed';
    end if;
    if exists (select 1 from public.card_members where card_id = v_card.id and role = 'co_owner')
       or exists (
         select 1 from public.card_codes
          where card_id = v_card.id and role = 'co_owner'
            and used_at is null and cancelled_at is null and expires_at > now()
       ) then
      raise exception 'has_co_owner';
    end if;
  elsif p_role = 'adult'
    and (v_my_role <> 'owner'
         or exists (
           select 1 from public.card_members where card_id = v_card.id and role = 'co_owner' and ic_checked_at is not null
         )) then
    raise exception 'needs_both';
  end if;
  if v_name is null or length(v_name) not between 1 and 40 then
    raise exception 'bad_name';
  end if;
  if exists (
       select 1 from public.card_codes
        where card_id = v_card.id and lower(name) = lower(v_name)
          and used_at is null and cancelled_at is null and expires_at > now()
     )
     or exists (select 1 from public.card_phones where card_id = v_card.id and lower(label) = lower(v_name || '''s phone')) then
    raise exception 'name_taken';
  end if;
  if (select count(*) from public.card_phones where card_id = v_card.id)
     + (select count(*) from public.card_codes
         where card_id = v_card.id and used_at is null and cancelled_at is null and expires_at > now())
     >= v_card.phone_limit then
    raise exception 'card_full';
  end if;
  v_pin := public.check_member_pin(v_me, p_pin);
  if not (v_pin ->> 'ok')::boolean then
    return v_pin;
  end if;
  insert into public.card_codes (township_id, unit_id, card_id, kind, code_hash, name, role, created_by, expires_at)
  values (
    v_card.township_id, v_card.unit_id, v_card.id, 'invite', p_code_hash, v_name, p_role, v_me, now() + interval '3 days'
  )
  returning expires_at into v_expires;
  return jsonb_build_object('ok', true, 'expires_at', v_expires);
end
$$;

-- Cancels an open invite on the caller's card: whoever made it, or a manager.
create function public.cancel_invite(p_invite uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_by uuid;
  v_card uuid;
begin
  select created_by, card_id into v_by, v_card
    from public.card_codes
   where id = p_invite and kind = 'invite' and card_id = public.my_card()
     and used_at is null and cancelled_at is null and expires_at > now()
     for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_by is distinct from v_me and not v_me = any (public.card_managers(v_card)) then
    raise exception 'not_allowed';
  end if;
  update public.card_codes set cancelled_at = now() where id = p_invite;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Moving a card to a new phone
-- ---------------------------------------------------------------------------------------------------------------------

-- The old browser moves its person's card to the key that waits, with that person's PIN, and answers {"ok": true} or
-- the PIN's answer. The server calls it only after checking a fresh note signed by (p_x, p_y): the database can't check
-- an ECDSA signature, and a person can read their own phone's public keys.
create function public.move_phone_key(p_user uuid, p_x text, p_y text, p_pin text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_phone uuid;
  v_pin jsonb;
begin
  -- Locks the card, as register_phone_key does, so no new browser asks while the key moves.
  select p.id into v_phone
    from public.card_phones p
    join public.cards c on c.id = p.card_id
   where p.user_id = p_user
     for update of c;
  if not exists (select 1 from public.phone_keys where phone_id = v_phone and x = p_x and y = p_y and state = 'active') then
    raise exception 'not_this_phone';
  end if;
  if not exists (select 1 from public.phone_keys where phone_id = v_phone and state = 'waiting') then
    raise exception 'nothing_waiting';
  end if;
  v_pin := public.check_member_pin(p_user, p_pin);
  if not (v_pin ->> 'ok')::boolean then
    return v_pin;
  end if;
  -- The old key stops at once at online readers; the waiting one takes its place.
  update public.phone_keys set state = case state when 'active' then 'retired' else 'active' end
   where phone_id = v_phone and state in ('active', 'waiting');
  perform public.notify(
    array[p_user], 'card', 'notify.card.moved', (select full_name from public.profiles where id = p_user), '/me'
  );
  return jsonb_build_object('ok', true);
end
$$;

-- For a lost phone: a manager moves another person's card to their waiting key, with the manager's own PIN, and it
-- answers {"ok": true} or the PIN's answer. Never for themselves, so the Owner's move needs the checked Co-owner and the
-- Co-owner's the Owner (a card has one of each), and anyone else's any manager.
create function public.approve_phone_move(p_member uuid, p_pin text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_card uuid;
  v_phone uuid;
  v_pin jsonb;
  v_name text;
begin
  select id into v_card from public.cards where id = public.my_card() for update;
  if not exists (select 1 from public.card_members where card_id = v_card and user_id = p_member) then
    raise exception 'not_found';
  end if;
  if p_member = v_me or not v_me = any (public.card_managers(v_card)) then
    raise exception 'not_allowed';
  end if;
  select id into v_phone from public.card_phones where user_id = p_member;
  if not exists (select 1 from public.phone_keys where phone_id = v_phone and state = 'waiting') then
    raise exception 'nothing_waiting';
  end if;
  v_pin := public.check_member_pin(v_me, p_pin);
  if not (v_pin ->> 'ok')::boolean then
    return v_pin;
  end if;
  update public.phone_keys set state = case state when 'active' then 'retired' else 'active' end
   where phone_id = v_phone and state in ('active', 'waiting');
  select full_name into v_name from public.profiles where id = p_member;
  perform public.notify(array[p_member], 'card', 'notify.card.moved', v_name, '/me');
  perform public.notify(
    array_remove(public.card_managers(v_card), p_member), 'card', 'notify.card.moved', v_name, '/me/household'
  );
  return jsonb_build_object('ok', true);
end
$$;

-- "No, that wasn't me": the caller's waiting keys are retired, so those browsers say the card is elsewhere.
create function public.decline_phone_move()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.phone_keys set state = 'retired'
   where state = 'waiting' and phone_id in (select id from public.card_phones where user_id = (select auth.uid()));
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.card_codes enable row level security;
alter table public.sms_checks enable row level security; -- no policy: only the service role reads it

create policy "The office reads its township's office codes" on public.card_codes
  for select to authenticated using (
    kind = 'office' and (select public.is_management()) and township_id = (select public.my_township())
  );
create policy "Members read their card's invites" on public.card_codes
  for select to authenticated using (card_id = (select public.my_card()));

-- Take away the defaults, then give back exactly what the policies above need: signed-in users read codes, never their
-- hash, and nothing of SMS checks. The service-role key (server code, seed, demo reset) bypasses RLS but still needs
-- table privileges.
revoke all on table public.card_codes, public.sms_checks from anon, authenticated;
grant select (
  id, township_id, unit_id, card_id, kind, name, role, created_by, created_at, expires_at, used_at, used_by, cancelled_at
) on table public.card_codes to authenticated;
grant select, insert, update, delete on table public.card_codes, public.sms_checks to service_role;

revoke execute on function
  public.card_managers(uuid), public.check_member_pin(uuid, text), public.issue_unit_code(uuid, text, uuid),
  public.give_unit_code(uuid, text, text, text, date, text), public.start_sms_check(text, text),
  public.verify_sms_check(uuid, text), public.complete_registration(text, uuid, uuid, text, text),
  public.create_invite(text, text, text, text), public.cancel_invite(uuid), public.move_phone_key(uuid, text, text, text),
  public.approve_phone_move(uuid, text), public.decline_phone_move()
  from public, anon, authenticated;
-- They check the caller themselves.
grant execute on function
  public.give_unit_code(uuid, text, text, text, date, text), public.create_invite(text, text, text, text),
  public.cancel_invite(uuid), public.approve_phone_move(uuid, text), public.decline_phone_move()
  to authenticated;
-- They act for whoever the server names: only trusted server code holding the service-role key, after its own checks.
grant execute on function
  public.check_member_pin(uuid, text), public.issue_unit_code(uuid, text, uuid), public.start_sms_check(text, text),
  public.verify_sms_check(uuid, text), public.complete_registration(text, uuid, uuid, text, text),
  public.move_phone_key(uuid, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
