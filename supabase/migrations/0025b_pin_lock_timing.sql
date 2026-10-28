-- Household access card, stage 2: a follow-up to 0025a_moves_and_pin_timing.sql from its review. Only CREATE OR REPLACE of
-- check_member_pin, as 0025a wrote it but for the change below, and it keeps every answer (decision 17):
--   check_member_pin   hashes for a locked PIN too. 0025a made a number with no account take as long to refuse as a wrong
--                      PIN, but a locked one (only a number with an account can lock) was still refused at once, so
--                      someone who locked a number with five wrong tries could time the sixth and learn it has an account.

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
    -- A bcrypt on the stored hash, as a wrong PIN costs, so a locked number takes as long to refuse (plan call 6).
    perform extensions.crypt(p_pin, v.pin_hash);
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

-- CREATE OR REPLACE keeps the function's grants. They are restated as 0025 and 0025a left them.
revoke execute on function public.check_member_pin(uuid, text) from public, anon, authenticated;
-- It acts for whoever the server names: only trusted server code holding the service-role key, after its own checks.
grant execute on function public.check_member_pin(uuid, text) to service_role;

notify pgrst, 'reload schema';
