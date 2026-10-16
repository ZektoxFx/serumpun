-- Find players and open games (spec §8.9). A booker can ask for 1 to 10 neighbours when booking (book_slot's
-- p_players_needed, 0011). Open games are the township's coming games that still need players. Neighbours join and
-- leave them only through join_game and leave_game, and the host sees who joined through game_players: booking_players
-- keeps no API grants. The host is told when someone joins or leaves, and the players when the host cancels.
-- start_conversation learns the 'game' context: a chat with the host about the game.

-- ---------------------------------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------------------------------

-- "Badminton Court 1 · 17/10 · 20:00": a game in words that read the same in English and Malay, for notifications and
-- chat titles. Only the definer functions below call it.
create function public.game_title(p_booking uuid)
returns text
language sql stable set search_path = ''
as $$
  select f.court_label || ' · ' || to_char(b.date, 'DD/MM') || ' · ' || lpad(b.start_hour::text, 2, '0') || ':00'
    from public.bookings b
    join public.facilities f on f.id = b.facility_id
   where b.id = p_booking
$$;

-- The township's coming games that still need players, soonest first, plus the ones the caller joined (full or not), but
-- never the caller's own (their booking pass shows those). The host's name and neighbourhood, never their unit. Any
-- member may look; only verified residents join.
create function public.open_games()
returns table (
  booking_id uuid, sport text, court_label text, place_name text, date date, start_hour int,
  needed int, joined int, host_name text, host_neighbourhood text, i_joined boolean
)
language sql stable security definer set search_path = ''
as $$
  select g.* from (
    select b.id, f.sport, f.court_label, f.place_name, b.date, b.start_hour, b.players_needed,
           (select count(*)::int from public.booking_players bp where bp.booking_id = b.id),
           p.full_name, p.neighbourhood,
           exists (select 1 from public.booking_players bp where bp.booking_id = b.id and bp.user_id = (select auth.uid()))
      from public.bookings b
      join public.facilities f on f.id = b.facility_id
      join public.profiles p on p.id = b.user_id
     where b.township_id = public.my_township() and b.status = 'booked' and b.players_needed > 0
       and b.user_id <> (select auth.uid())
       and (b.date + make_interval(hours => b.start_hour)) at time zone 'Asia/Kuala_Lumpur' > now()
  ) g (booking_id, sport, court_label, place_name, date, start_hour, needed, joined, host_name, host_neighbourhood, i_joined)
   where g.joined < g.needed or g.i_joined
   order by g.date, g.start_hour, g.court_label
$$;

-- A verified neighbour joins a coming open game of their township, not their own, while it has a spot, and the host is
-- told. Joining again changes nothing.
create function public.join_game(p_booking uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v public.bookings%rowtype;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  -- Locks the game, so two neighbours cannot both take its last spot, nor join while the host cancels.
  select * into v from public.bookings
   where id = p_booking and township_id = public.my_township() and status = 'booked' and players_needed > 0
     for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v.user_id = v_me then
    raise exception 'own_game';
  end if;
  if (v.date + make_interval(hours => v.start_hour)) at time zone 'Asia/Kuala_Lumpur' <= now() then
    raise exception 'game_started';
  end if;
  if exists (select 1 from public.booking_players where booking_id = p_booking and user_id = v_me) then
    return;
  end if;
  if (select count(*) from public.booking_players where booking_id = p_booking) >= v.players_needed then
    raise exception 'game_full';
  end if;
  insert into public.booking_players (booking_id, user_id) values (p_booking, v_me);
  perform public.notify(
    array[v.user_id], 'game', 'notify.game.joined', (select full_name from public.profiles where id = v_me),
    '/book/' || p_booking
  );
end
$$;

-- A player leaves a coming game they joined, and the host is told.
create function public.leave_game(p_booking uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v public.bookings%rowtype;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  select * into v from public.bookings
   where id = p_booking and township_id = public.my_township() and status = 'booked'
     for update;
  if not found then
    raise exception 'not_found';
  end if;
  if (v.date + make_interval(hours => v.start_hour)) at time zone 'Asia/Kuala_Lumpur' <= now() then
    raise exception 'game_started';
  end if;
  delete from public.booking_players where booking_id = p_booking and user_id = v_me;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.notify(
    array[v.user_id], 'game', 'notify.game.left', (select full_name from public.profiles where id = v_me),
    '/book/' || p_booking
  );
end
$$;

-- Who joined the caller's own game, first to join first: names and neighbourhoods, never units. Nobody else's game.
create function public.game_players(p_booking uuid)
returns table (full_name text, neighbourhood text, joined_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.full_name, p.neighbourhood, bp.created_at
    from public.booking_players bp
    join public.bookings b on b.id = bp.booking_id
    join public.profiles p on p.id = bp.user_id
   where bp.booking_id = p_booking and b.user_id = (select auth.uid())
   order by bp.created_at
$$;

-- cancel_booking (0011) also tells the game's players. Everything else is as before; create or replace keeps its grants.
create or replace function public.cancel_booking(p_booking uuid)
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
  perform public.notify(
    array(select user_id from public.booking_players where booking_id = p_booking), 'game', 'notify.game.cancelled',
    public.game_title(p_booking), '/book#open-games'
  );
end
$$;

-- start_conversation (0010) learns the 'game' context: an open game of the caller's township, with its host, titled by
-- the court and time. Everything else is as before; create or replace keeps its grants.
create or replace function public.start_conversation(p_context_type text, p_context_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_other uuid;
  v_title text;
  v_pair text;
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if p_context_type = 'post' then
    select po.author_id, btrim(left(regexp_replace(btrim(po.body), '\s+', ' ', 'g'), 80)) into v_other, v_title
      from public.posts po
      join public.groups g on g.id = po.group_id
     where po.id = p_context_id and po.type = 'share_lend' and g.township_id = public.my_township();
  elsif p_context_type = 'service' then
    select s.provider_id, s.title into v_other, v_title
      from public.services s
     where s.id = p_context_id and s.active and s.township_id = public.my_township();
  elsif p_context_type = 'listing' then
    select l.owner_id, l.title into v_other, v_title
      from public.listings l
     where l.id = p_context_id and l.status = 'available' and l.township_id = public.my_township();
  elsif p_context_type = 'game' then
    select b.user_id, public.game_title(b.id) into v_other, v_title
      from public.bookings b
     where b.id = p_context_id and b.status = 'booked' and b.players_needed > 0 and b.township_id = public.my_township();
  end if;
  if v_other is null then
    raise exception 'bad_context';
  end if;
  if v_other = v_me then
    raise exception 'self';
  end if;
  v_pair := least(v_me, v_other)::text || ':' || greatest(v_me, v_other)::text;
  insert into public.conversations (context_type, context_id, context_title, pair_key)
  values (p_context_type, p_context_id, v_title, v_pair)
  on conflict (pair_key, context_type, context_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.conversations
     where pair_key = v_pair and context_type = p_context_type and context_id = p_context_id;
  else
    insert into public.conversation_members (conversation_id, user_id) values (v_id, v_me), (v_id, v_other);
  end if;
  return v_id;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------------------------------------------------

revoke execute on function
  public.game_title(uuid),
  public.open_games(),
  public.join_game(uuid),
  public.leave_game(uuid),
  public.game_players(uuid)
  from public, anon, authenticated;
grant execute on function
  public.open_games(),
  public.join_game(uuid),
  public.leave_game(uuid),
  public.game_players(uuid)
  to authenticated;

notify pgrst, 'reload schema';
