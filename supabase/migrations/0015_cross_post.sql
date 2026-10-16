-- "Also post to a group": create_listing (0010) can also put a Share & Lend post about the new item in one of the
-- caller's groups, linked by listing_id (ruling R6), in the same transaction. Its other rules are as before. The new
-- parameter changes the signature, so the old function is dropped and the grants are given again; calls without
-- p_group work as before.

drop function public.create_listing(text, text, text, text, text, date);

-- A verified resident lists something to lend, give away or swap. Only a swap says what it wants; only a lend item has
-- an end date (today or later in Malaysia, within a year). With p_group, a group they are in gets a post about it (its
-- description, else its title); a group they are not in lists nothing (not_member).
create function public.create_listing(
  p_kind text, p_title text, p_description text, p_emoji text, p_swap_for text, p_available_until date,
  p_group uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_id uuid;
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if p_kind is null or p_kind not in ('lend', 'give', 'swap') then
    raise exception 'bad_kind';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'bad_title';
  end if;
  if p_kind = 'lend' and p_available_until is not null
     and (p_available_until < v_today or p_available_until > v_today + 365) then
    raise exception 'bad_dates';
  end if;
  if p_group is not null and not exists (
    select 1 from public.group_members m
      join public.groups g on g.id = m.group_id
     where m.group_id = p_group and m.user_id = v_me and g.township_id = public.my_township()
  ) then
    raise exception 'not_member';
  end if;
  insert into public.listings (township_id, kind, title, description, emoji, swap_for, owner_id, available_until)
  values (
    public.my_township(), p_kind, left(btrim(p_title), 80), left(nullif(btrim(p_description), ''), 500),
    coalesce(left(nullif(btrim(p_emoji), ''), 16), '📦'),
    case when p_kind = 'swap' then left(nullif(btrim(p_swap_for), ''), 120) end,
    v_me,
    case when p_kind = 'lend' then p_available_until end
  )
  returning id into v_id;
  if p_group is not null then
    insert into public.posts (group_id, author_id, type, body, listing_id)
    values (
      p_group, v_me, 'share_lend', coalesce(left(nullif(btrim(p_description), ''), 500), left(btrim(p_title), 80)), v_id
    );
  end if;
  return v_id;
end
$$;

revoke execute on function public.create_listing(text, text, text, text, text, date, uuid) from public, anon, authenticated;
grant execute on function public.create_listing(text, text, text, text, text, date, uuid) to authenticated;

notify pgrst, 'reload schema';
