-- Share & Lend: things neighbours lend, give away or swap, and the four steps of borrowing.
--
-- Residents read listings through public_listings (who lists it, by name and neighbourhood, never a unit or a phone)
-- and the borrow requests they are part of through my_borrows; they write only through the RPCs below. Borrowing has
-- four steps (requested, approved, picked up, returned) that the owner moves on, and the borrower may cancel before the
-- pick-up (canAdvanceBorrow in lib/domain/community.ts is the same table); each step tells the other person. Give away
-- and Swap work through a conversation: start_conversation learns the 'listing' context here. Nothing is sold.

-- ---------------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------------

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references public.townships (id),
  -- The kinds of lib/domain/community.ts.
  kind text not null check (kind in ('lend', 'give', 'swap')),
  title text not null check (length(btrim(title)) between 1 and 80),
  description text check (length(description) <= 500),
  emoji text not null default '📦' check (length(emoji) between 1 and 16),
  swap_for text check (length(swap_for) <= 120),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  available_until date,
  status text not null default 'available' check (status in ('available', 'given', 'hidden')),
  created_at timestamptz not null default now(),
  check (kind = 'swap' or swap_for is null),
  check (kind = 'lend' or available_until is null)
);
create index listings_township_id_created_at_idx on public.listings (township_id, created_at desc);
create index listings_owner_id_idx on public.listings (owner_id);

create table public.borrow_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  borrower_id uuid not null references public.profiles (id) on delete cascade,
  from_date date not null,
  to_date date not null,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'declined', 'cancelled', 'picked_up', 'returned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (to_date >= from_date)
);
-- One open request per borrower and item.
create unique index borrow_requests_open_idx on public.borrow_requests (listing_id, borrower_id)
  where status in ('requested', 'approved', 'picked_up');
create index borrow_requests_borrower_id_idx on public.borrow_requests (borrower_id);

-- Ruling R6: a group's Share & Lend post can point at its listing.
alter table public.posts
  add constraint posts_listing_id_fkey foreign key (listing_id) references public.listings (id) on delete set null;
create index posts_listing_id_idx on public.posts (listing_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- The views residents read. Definer views, so their WHERE is the only filter; security_barrier keeps a caller's own
-- filters from running before it.
-- ---------------------------------------------------------------------------------------------------------------------

-- What is up in the township, and the caller's own listings that were given away. On their own listing, how many
-- borrow requests wait for their answer.
create view public.public_listings with (security_invoker = false, security_barrier = true) as
select
  l.id, l.kind, l.title, l.description, l.emoji, l.swap_for, l.available_until, l.status, l.created_at,
  p.full_name as owner_name, p.neighbourhood as owner_neighbourhood,
  l.owner_id = (select auth.uid()) as is_mine,
  case when l.owner_id = (select auth.uid()) then (
    select count(*)::int from public.borrow_requests br where br.listing_id = l.id and br.status = 'requested'
  ) else 0 end as waiting_count
from public.listings l
join public.profiles p on p.id = l.owner_id
where l.township_id = (select public.my_township())
  and (l.status = 'available' or (l.status = 'given' and l.owner_id = (select auth.uid())));

-- The borrow requests the caller is part of: theirs as the borrower, and those for the things they lend.
create view public.my_borrows with (security_invoker = false, security_barrier = true) as
select
  br.id, br.listing_id, br.from_date, br.to_date, br.status, br.updated_at,
  l.title as listing_title, l.emoji as listing_emoji,
  case when l.owner_id = (select auth.uid()) then 'owner' else 'borrower' end as my_role,
  b.full_name as borrower_name, b.neighbourhood as borrower_neighbourhood, o.full_name as owner_name
from public.borrow_requests br
join public.listings l on l.id = br.listing_id
join public.profiles b on b.id = br.borrower_id
join public.profiles o on o.id = l.owner_id
where l.township_id = (select public.my_township())
  and (br.borrower_id = (select auth.uid()) or l.owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------------------------------

-- A verified resident lists something to lend, give away or swap. Only a swap says what it wants; only a lend item has
-- an end date (today or later in Malaysia, within a year).
create function public.create_listing(
  p_kind text, p_title text, p_description text, p_emoji text, p_swap_for text, p_available_until date
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
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
  insert into public.listings (township_id, kind, title, description, emoji, swap_for, owner_id, available_until)
  values (
    public.my_township(), p_kind, left(btrim(p_title), 80), left(nullif(btrim(p_description), ''), 500),
    coalesce(left(nullif(btrim(p_emoji), ''), 16), '📦'),
    case when p_kind = 'swap' then left(nullif(btrim(p_swap_for), ''), 120) end,
    (select auth.uid()),
    case when p_kind = 'lend' then p_available_until end
  )
  returning id into v_id;
  return v_id;
end
$$;

-- Asks to borrow an item someone else lends: from today, back within 30 days and while it is lent out. One open request
-- per borrower and item. The owner is told.
create function public.request_borrow(p_listing uuid, p_from date, p_to date)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  -- A share lock: close_listing (which takes the row for update) cannot slip in between the checks and the insert.
  select * into v_listing from public.listings
   where id = p_listing and township_id = public.my_township() and status = 'available'
     for share;
  if not found then
    raise exception 'not_found';
  end if;
  if v_listing.kind <> 'lend' then
    raise exception 'not_lendable';
  end if;
  if v_listing.owner_id = (select auth.uid()) then
    raise exception 'own_listing';
  end if;
  if p_from is null or p_to is null or p_from < v_today or p_to < p_from or p_to > p_from + 30
     or (v_listing.available_until is not null and p_to > v_listing.available_until) then
    raise exception 'bad_dates';
  end if;
  insert into public.borrow_requests (listing_id, borrower_id, from_date, to_date)
  values (p_listing, (select auth.uid()), p_from, p_to)
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'already_requested';
  end if;
  perform public.notify(
    array[v_listing.owner_id], 'borrow', 'notify.borrow.requested', v_listing.title, '/community/share/' || p_listing
  );
  return v_id;
end
$$;

-- The owner or the borrower moves a request on, as canAdvanceBorrow allows: the owner from requested to approved or
-- declined, approved to picked_up, picked_up to returned; the borrower from requested or approved to cancelled. An
-- approval must not overlap another approved or picked-up loan of the item. The other person is told.
create function public.advance_borrow(p_request uuid, p_next text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v record;
  v_owner boolean;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  select br.listing_id, br.borrower_id, br.status, br.from_date, br.to_date, l.owner_id, l.title into v
    from public.borrow_requests br
    join public.listings l on l.id = br.listing_id
   where br.id = p_request and l.township_id = public.my_township()
     for update of br;
  if not found then
    raise exception 'not_found';
  end if;
  if v_me is distinct from v.owner_id and v_me is distinct from v.borrower_id then
    raise exception 'not_allowed';
  end if;
  v_owner := v_me = v.owner_id;
  if not (
    (v_owner and (
      (v.status = 'requested' and p_next in ('approved', 'declined'))
      or (v.status = 'approved' and p_next = 'picked_up')
      or (v.status = 'picked_up' and p_next = 'returned')
    ))
    or (not v_owner and v.status in ('requested', 'approved') and p_next = 'cancelled')
  ) then
    raise exception 'bad_step';
  end if;
  if p_next = 'approved' and exists (
    select 1 from public.borrow_requests o
     where o.listing_id = v.listing_id and o.id <> p_request and o.status in ('approved', 'picked_up')
       and daterange(o.from_date, o.to_date, '[]') && daterange(v.from_date, v.to_date, '[]')
  ) then
    raise exception 'overlap';
  end if;
  update public.borrow_requests set status = p_next, updated_at = now() where id = p_request;
  perform public.notify(
    array[case when v_owner then v.borrower_id else v.owner_id end], 'borrow',
    case p_next
      when 'approved' then 'notify.borrow.approved'
      when 'declined' then 'notify.borrow.declined'
      when 'picked_up' then 'notify.borrow.pickedUp'
      when 'returned' then 'notify.borrow.returned'
      else 'notify.borrow.cancelled'
    end,
    v.title, '/community/share/' || v.listing_id
  );
end
$$;

-- The owner takes a listing down: a give-away as given, anything else hidden. Not while a borrow request is open.
create function public.close_listing(p_listing uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  select * into v_listing from public.listings
   where id = p_listing and township_id = public.my_township() and status = 'available'
     for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_listing.owner_id <> (select auth.uid()) then
    raise exception 'not_allowed';
  end if;
  if exists (
    select 1 from public.borrow_requests where listing_id = p_listing and status in ('requested', 'approved', 'picked_up')
  ) then
    raise exception 'on_loan';
  end if;
  update public.listings set status = case when kind = 'give' then 'given' else 'hidden' end where id = p_listing;
end
$$;

-- start_conversation (0009) learns the 'listing' context: an item that is up in the caller's township, with its owner,
-- titled by the item. Everything else is as before; create or replace keeps its grants.
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
-- Row-level security and privileges
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.listings enable row level security;
alter table public.borrow_requests enable row level security;

-- Take away the defaults, then give back exactly what is used: residents read the two views; nothing is written except
-- through the RPCs.
revoke all on table public.listings, public.borrow_requests from anon, authenticated;
grant select, insert, update, delete on table public.listings, public.borrow_requests to service_role;
revoke all on table public.public_listings, public.my_borrows from anon, authenticated, service_role;
grant select on table public.public_listings, public.my_borrows to authenticated;

revoke execute on function
  public.create_listing(text, text, text, text, text, date),
  public.request_borrow(uuid, date, date),
  public.advance_borrow(uuid, text),
  public.close_listing(uuid)
  from public, anon, authenticated;
grant execute on function
  public.create_listing(text, text, text, text, text, date),
  public.request_borrow(uuid, date, date),
  public.advance_borrow(uuid, text),
  public.close_listing(uuid)
  to authenticated;

notify pgrst, 'reload schema';
