-- Services: neighbours offering a skill (tuition, repairs, home help, pet care) or asking for one.
--
-- Residents read the township's active services through public_services (who posted it, by name and neighbourhood,
-- never a unit or a phone, and how many conversations were started about it) and post only through create_service.
-- "Message" and "I can help" start a conversation about a service with whoever posted it: start_conversation learns the
-- 'service' context here. Payment is arranged between neighbours, outside the app.

create table public.services (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references public.townships (id),
  kind text not null check (kind in ('offer', 'request')),
  -- The categories of lib/domain/community.ts.
  category text not null check (category in ('tutoring', 'repairs', 'home_help', 'pet_care', 'other')),
  title text not null check (length(btrim(title)) between 1 and 80),
  description text check (length(description) <= 1000),
  -- An offer's price and availability ("RM40 / hour", "Weekday evenings"); a request's budget and date.
  price_text text check (length(price_text) <= 40),
  availability_text text check (length(availability_text) <= 80),
  budget_text text check (length(budget_text) <= 40),
  needed_by date,
  -- Whoever posted it: an offer's provider, or the neighbour asking in a request.
  provider_id uuid not null references public.profiles (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind = 'offer' or (price_text is null and availability_text is null)),
  check (kind = 'request' or (budget_text is null and needed_by is null))
);
create index services_township_id_created_at_idx on public.services (township_id, created_at desc);
create index services_provider_id_idx on public.services (provider_id);

-- Conversations are counted and found by what they are about.
create index conversations_context_idx on public.conversations (context_type, context_id);

-- The township's active services. A definer view, so its WHERE is the only filter; security_barrier keeps a caller's
-- own filters from running before it.
create view public.public_services with (security_invoker = false, security_barrier = true) as
select
  s.id, s.kind, s.category, s.title, s.description, s.price_text, s.availability_text, s.budget_text, s.needed_by,
  s.created_at, p.full_name as provider_name, p.neighbourhood as provider_neighbourhood,
  s.provider_id = (select auth.uid()) as is_mine,
  (select count(*)::int from public.conversations c where c.context_type = 'service' and c.context_id = s.id)
    as conversation_count
from public.services s
join public.profiles p on p.id = s.provider_id
where s.township_id = (select public.my_township()) and s.active;

-- A verified resident offers a service or asks for one. Only the fields of its kind are kept: an offer's price and
-- availability, a request's budget and date (today or later in Malaysia, within a year).
create function public.create_service(
  p_kind text, p_category text, p_title text, p_description text, p_price_text text, p_availability_text text,
  p_budget_text text, p_needed_by date
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
  if p_kind is null or p_kind not in ('offer', 'request') then
    raise exception 'bad_kind';
  end if;
  if p_category is null or p_category not in ('tutoring', 'repairs', 'home_help', 'pet_care', 'other') then
    raise exception 'bad_category';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'bad_title';
  end if;
  if p_kind = 'request' and p_needed_by is not null and (p_needed_by < v_today or p_needed_by > v_today + 365) then
    raise exception 'bad_date';
  end if;
  insert into public.services (
    township_id, kind, category, title, description, price_text, availability_text, budget_text, needed_by, provider_id
  )
  values (
    public.my_township(), p_kind, p_category, left(btrim(p_title), 80), left(nullif(btrim(p_description), ''), 1000),
    case when p_kind = 'offer' then left(nullif(btrim(p_price_text), ''), 40) end,
    case when p_kind = 'offer' then left(nullif(btrim(p_availability_text), ''), 80) end,
    case when p_kind = 'request' then left(nullif(btrim(p_budget_text), ''), 40) end,
    case when p_kind = 'request' then p_needed_by end,
    (select auth.uid())
  )
  returning id into v_id;
  return v_id;
end
$$;

-- start_conversation (0008) learns the 'service' context: an active service of the caller's township, with whoever
-- posted it, titled by the service. Everything else is as before; create or replace keeps its grants.
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

alter table public.services enable row level security;

-- Take away the defaults, then give back exactly what is used: residents read the view; nothing is written except
-- through create_service.
revoke all on table public.services from anon, authenticated;
grant select, insert, update, delete on table public.services to service_role;
revoke all on table public.public_services from anon, authenticated, service_role;
grant select on table public.public_services to authenticated;

revoke execute on function public.create_service(text, text, text, text, text, text, text, date) from public, anon, authenticated;
grant execute on function public.create_service(text, text, text, text, text, text, text, date) to authenticated;

notify pgrst, 'reload schema';
