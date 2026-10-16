-- One-to-one messages: conversations about something a neighbour posted, their two members, and the messages.
--
-- A conversation is always about a context and always with whoever posted it: start_conversation takes the context (a
-- Share & Lend post of a group for now; services, Share & Lend items and open games extend it as their tasks land) and
-- finds its owner and its title itself, so nobody can open a chat with a neighbour about nothing, or put a made-up title
-- on one. The two members read their messages through row-level security and their inbox through my_conversations
-- (names and neighbourhoods, never a unit or a phone); nothing is written except through the RPCs. New messages go out
-- live as postgres_changes, which row-level security limits to the conversation's two members.

-- ---------------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  -- The context types of lib/domain/messages.ts. context_id is the row it is about (a few seeded ones have none yet).
  context_type text not null check (context_type in ('post', 'service', 'listing', 'game')),
  context_id uuid,
  context_title text not null check (length(btrim(context_title)) between 1 and 120),
  -- '<smaller user id>:<larger user id>': one conversation per pair and context, however often it is started.
  pair_key text not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique nulls not distinct (pair_key, context_type, context_id)
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The other member's messages after it are unread.
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create index conversation_members_user_id_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conversation_id_created_at_idx on public.messages (conversation_id, created_at);
create index messages_sender_id_idx on public.messages (sender_id);

-- Whether the caller is one of the conversation's two members. Security definer: conversation_members is closed to
-- residents, and the messages policy needs to look into it.
create function public.is_conversation_member(p_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members where conversation_id = p_conversation and user_id = (select auth.uid())
  )
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- The inbox. A definer view, so its WHERE is the only filter; security_barrier keeps a caller's own filters from running
-- before it. One row per conversation of the caller: the other person, what it is about, the latest message, and how
-- many of the other person's messages came after the caller last read it.
-- ---------------------------------------------------------------------------------------------------------------------

create view public.my_conversations with (security_invoker = false, security_barrier = true) as
select
  c.id, c.context_type, c.context_title, c.last_message_at,
  p.full_name as other_name, p.neighbourhood as other_neighbourhood,
  last.body as last_body, coalesce(last.sender_id = me.user_id, false) as last_is_mine,
  (
    select count(*)::int from public.messages m
     where m.conversation_id = c.id and m.sender_id is distinct from me.user_id
       and m.created_at > coalesce(me.last_read_at, '-infinity')
  ) as unread_count
from public.conversation_members me
join public.conversations c on c.id = me.conversation_id
join public.conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
join public.profiles p on p.id = o.user_id
left join lateral (
  select m.body, m.sender_id from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1
) last on true
where me.user_id = (select auth.uid()) and (select public.my_township()) is not null;

-- ---------------------------------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------------------------------

-- The inbox badge: the other people's messages the caller has not read, across all their conversations.
create function public.unread_message_count()
returns int
language sql stable set search_path = ''
as $$
  select coalesce(sum(unread_count), 0)::int from public.my_conversations
$$;

-- Opens the caller's conversation with whoever posted the context, or finds the one they have (a second tap, or two at
-- once, get the same one). Returns its id. A context is a Share & Lend post of a group of the caller's township; its
-- title is the post's text on one line, cut to 80 characters (titleOf in lib/seed/messages.ts does the same).
create function public.start_conversation(p_context_type text, p_context_id uuid)
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

-- A member writes in their conversation. Writing counts as having read it up to now.
create function public.send_message(p_conversation uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if not public.is_conversation_member(p_conversation) then
    raise exception 'not_found';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'bad_body';
  end if;
  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation, (select auth.uid()), left(btrim(p_body), 2000))
  returning id into v_id;
  update public.conversations set last_message_at = now() where id = p_conversation;
  update public.conversation_members set last_read_at = now()
   where conversation_id = p_conversation and user_id = (select auth.uid());
  return v_id;
end
$$;

-- The member has the conversation open: everything in it so far is read. Anyone else changes nothing.
create function public.mark_conversation_read(p_conversation uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.conversation_members set last_read_at = now()
   where conversation_id = p_conversation and user_id = (select auth.uid())
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-level security, Realtime and privileges
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- The two members read the conversation's messages, and so receive new ones live.
create policy "Members read their conversations' messages" on public.messages
  for select to authenticated
  using ((select public.my_township()) is not null and public.is_conversation_member(conversation_id));

alter publication supabase_realtime add table public.messages;

-- Take away the defaults, then give back exactly what is used: members read messages and their inbox view; nothing is
-- written except through the RPCs.
revoke all on table public.conversations, public.conversation_members, public.messages from anon, authenticated;
grant select on table public.messages to authenticated;
grant select, insert, update, delete on table public.conversations, public.conversation_members, public.messages
  to service_role;
revoke all on table public.my_conversations from anon, authenticated, service_role;
grant select on table public.my_conversations to authenticated;

revoke execute on function
  public.is_conversation_member(uuid),
  public.unread_message_count(),
  public.start_conversation(text, uuid),
  public.send_message(uuid, text),
  public.mark_conversation_read(uuid)
  from public, anon, authenticated;
grant execute on function
  public.is_conversation_member(uuid),
  public.unread_message_count(),
  public.start_conversation(text, uuid),
  public.send_message(uuid, text),
  public.mark_conversation_read(uuid)
  to authenticated;

notify pgrst, 'reload schema';
