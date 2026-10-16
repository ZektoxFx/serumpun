-- Service ratings: 1 to 5 stars on an offer, one per neighbour (they can change it), and only from someone who has a
-- conversation with the provider about that service.
--
-- Residents read the township's ratings through public_service_ratings: the stars, never who gave them (is_mine marks
-- the caller's own), and rate only through rate_service. my_conversations learns context_id, so a conversation about a
-- service can offer to rate it.

create table public.service_reviews (
  service_id uuid not null references public.services (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (service_id, reviewer_id)
);

-- The stars of the township's active services. A definer view, so its WHERE is the only filter; security_barrier keeps a
-- caller's own filters from running before it.
create view public.public_service_ratings with (security_invoker = false, security_barrier = true) as
select r.service_id, r.rating, r.reviewer_id = (select auth.uid()) as is_mine
from public.service_reviews r
join public.services s on s.id = r.service_id
where s.township_id = (select public.my_township()) and s.active;

-- my_conversations (0008) with context_id at the end: what the conversation is about. Everything else is as before;
-- create or replace keeps its grants, and the options are given again because replacing a view resets them.
create or replace view public.my_conversations with (security_invoker = false, security_barrier = true) as
select
  c.id, c.context_type, c.context_title, c.last_message_at,
  p.full_name as other_name, p.neighbourhood as other_neighbourhood,
  last.body as last_body, coalesce(last.sender_id = me.user_id, false) as last_is_mine,
  (
    select count(*)::int from public.messages m
     where m.conversation_id = c.id and m.sender_id is distinct from me.user_id
       and m.created_at > coalesce(me.last_read_at, '-infinity')
  ) as unread_count,
  c.context_id
from public.conversation_members me
join public.conversations c on c.id = me.conversation_id
join public.conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
join public.profiles p on p.id = o.user_id
left join lateral (
  select m.body, m.sender_id from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1
) last on true
where me.user_id = (select auth.uid()) and (select public.my_township()) is not null;

-- A verified resident rates an active offer of their township that is not their own, once they have a conversation with
-- its provider about it. Rating again changes their stars.
create function public.rate_service(p_service uuid, p_rating int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_provider uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  select s.provider_id into v_provider
    from public.services s
   where s.id = p_service and s.township_id = public.my_township() and s.active and s.kind = 'offer';
  if v_provider is null then
    raise exception 'not_found';
  end if;
  if v_provider = v_me then
    raise exception 'self';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'bad_rating';
  end if;
  if not exists (
    select 1 from public.conversations c
      join public.conversation_members mine on mine.conversation_id = c.id and mine.user_id = v_me
      join public.conversation_members theirs on theirs.conversation_id = c.id and theirs.user_id = v_provider
     where c.context_type = 'service' and c.context_id = p_service
  ) then
    raise exception 'no_conversation';
  end if;
  insert into public.service_reviews (service_id, reviewer_id, rating)
  values (p_service, v_me, p_rating)
  on conflict (service_id, reviewer_id) do update set rating = excluded.rating;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.service_reviews enable row level security;

-- Take away the defaults, then give back exactly what is used: residents read the view; nothing is written except
-- through rate_service.
revoke all on table public.service_reviews from anon, authenticated;
grant select, insert, update, delete on table public.service_reviews to service_role;
revoke all on table public.public_service_ratings from anon, authenticated, service_role;
grant select on table public.public_service_ratings to authenticated;

revoke execute on function public.rate_service(uuid, int) from public, anon, authenticated;
grant execute on function public.rate_service(uuid, int) to authenticated;

notify pgrst, 'reload schema';
