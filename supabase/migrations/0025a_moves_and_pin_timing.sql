-- Household access card, stage 2: follow-ups to 0025_getting_onto_the_card.sql from its review. Only CREATE OR REPLACE of
-- four of its functions, each as 0025 wrote it but for the change below, and each keeps every answer the live stage-1 app
-- can reach (decision 17):
--   check_member_pin   hashes for a person with no PIN too, so phone sign-in takes as long for an unknown number;
--   register_phone_key tells the managers about a move once, not again when a newer browser replaces one still waiting;
--   issue_unit_code    looks for the unit's card again after cancelling the old code, which a registration may have used;
--   decline_phone_move locks the card first, as the moves do, so a decline racing a move can't leave no active key.

-- Checks a person's PIN. It answers {"ok": true}, {"ok": false, "tries_left": n} or {"ok": false, "locked_until": t},
-- returning rather than raising so that a wrong try is saved. The 5th wrong try locks the PIN for 15 minutes and tells
-- the person's card's Owner and Co-owner. 0024's verify_card_pin, for any person: the server calls it for phone sign-in
-- and moves, and the functions in 0025 for their caller.
create or replace function public.check_member_pin(p_user uuid, p_pin text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.member_pins%rowtype;
begin
  -- Locks the row, so tries sent at once still count one at a time.
  select * into v from public.member_pins where user_id = p_user for update;
  if not found then
    -- A bcrypt all the same, so a number with no account takes as long to refuse as a wrong PIN (plan call 6).
    perform extensions.crypt(p_pin, extensions.gen_salt('bf'));
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
  v_replaced int;
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
      get diagnostics v_replaced = row_count;
      insert into public.phone_keys (phone_id, x, y, state) values (v_phone, p_x, p_y, 'waiting');
      perform public.notify(array[v_me], 'card', 'notify.card.moveAsked', v_name, '/me');
      -- The managers were told when the first browser asked; one taking its place tells them nothing new.
      if v_replaced = 0 then
        perform public.notify(
          array_remove(public.card_managers(v_card.id), v_me), 'card', 'notify.card.moveAsked', v_name, '/me/household'
        );
      end if;
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

-- Gives a unit with no card a fresh office code, cancelling the one it had, and answers when it expires. The server
-- makes the code and sends only its hash. The office's own way in is give_unit_code; the seed calls this directly.
create or replace function public.issue_unit_code(p_unit uuid, p_code_hash text, p_by uuid)
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
  -- Again: that unit lock lets a registration make the card meanwhile. One that holds the old code made the update above
  -- wait for it to commit, so this sees its card.
  if exists (select 1 from public.cards where unit_id = p_unit) then
    raise exception 'has_card';
  end if;
  insert into public.card_codes (township_id, unit_id, kind, code_hash, created_by, expires_at)
  values (v_township, p_unit, 'office', p_code_hash, p_by, now() + interval '3 days')
  returning expires_at into v_expires;
  return v_expires;
end
$$;

-- "No, that wasn't me": the caller's waiting keys are retired, so those browsers say the card is elsewhere.
create or replace function public.decline_phone_move()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- Locks the card first, as the moves and register_phone_key do, so a decline racing a move waits for it instead of
  -- retiring the key the move has just made active.
  perform 1 from public.cards where id = public.my_card() for update;
  update public.phone_keys set state = 'retired'
   where state = 'waiting' and phone_id in (select id from public.card_phones where user_id = (select auth.uid()));
end
$$;

-- CREATE OR REPLACE keeps each function's grants. They are restated as 0024 (register_phone_key) and 0025 left them.
revoke execute on function
  public.check_member_pin(uuid, text), public.register_phone_key(text, text), public.issue_unit_code(uuid, text, uuid),
  public.decline_phone_move()
  from public, anon, authenticated;
-- They check the caller themselves.
grant execute on function public.register_phone_key(text, text), public.decline_phone_move() to authenticated;
-- They act for whoever the server names: only trusted server code holding the service-role key, after its own checks.
grant execute on function public.check_member_pin(uuid, text), public.issue_unit_code(uuid, text, uuid) to service_role;

notify pgrst, 'reload schema';
