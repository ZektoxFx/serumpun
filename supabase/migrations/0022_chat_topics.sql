-- General chat topics (feedback round 2): General chat becomes a list of topics, as Telegram's communities are, each a
-- live group chat. Everyone in the township reads; verified residents and the office post, and only the office posts in
-- an office-only topic. Only the office adds, renames and removes topics (removing hides one; its messages stay), and
-- Announcements, the office's own, mirrors every announcement it publishes. What General chat already had moves into
-- Borak-borak in 0023, applied with the topic screens. Residents read the two public_* views; new messages go out live
-- as postgres_changes, which row-level security limits to the township.

-- ---------------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------------

create table public.chat_topics (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  emoji text not null check (char_length(btrim(emoji)) between 1 and 8),
  title text not null check (char_length(btrim(title)) between 1 and 40),
  office_only boolean not null default false,
  -- 'announcements': the office's topic that mirrors its announcements; it is never removed or opened to residents.
  system_key text check (system_key in ('announcements')),
  sort_order int not null default 100,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (group_id, system_key)
);

create table public.topic_messages (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.chat_topics (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index topic_messages_topic_id_created_at_idx on public.topic_messages (topic_id, created_at);
create index topic_messages_sender_id_idx on public.topic_messages (sender_id);

-- When each person last read each topic: other people's messages after it are unread to them.
create table public.topic_reads (
  topic_id uuid not null references public.chat_topics (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (topic_id, user_id)
);
create index topic_reads_user_id_idx on public.topic_reads (user_id);

-- The township a topic belongs to, for the topic_messages policy. Security definer: chat_topics is closed to residents.
create function public.topic_township(p_topic uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select g.township_id from public.chat_topics t join public.groups g on g.id = t.group_id where t.id = p_topic
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- The views residents read. Definer views, so their WHERE is the only filter; security_barrier keeps a caller's own
-- filters from running before it.
-- ---------------------------------------------------------------------------------------------------------------------

-- The topics of the caller's township's General chat, each with its latest message, and how many of other people's
-- messages came after the later of the caller's last read and when they joined General chat (so a newcomer does not
-- start with hundreds; someone not in it yet, waiting for approval, counts from signing up).
create view public.public_topics with (security_invoker = false, security_barrier = true) as
select
  t.id, t.emoji, t.title, t.office_only, t.system_key, t.sort_order,
  last.body as last_body, last.created_at as last_at, last.sender_name as last_sender,
  (
    select count(*)::int
      from public.topic_messages tm
     where tm.topic_id = t.id
       and tm.sender_id is distinct from me.id
       and tm.created_at > greatest(r.last_read_at, coalesce(m.joined_at, me.created_at)) -- greatest skips a null
  ) as unread_count
from public.chat_topics t
join public.groups g on g.id = t.group_id and g.is_general
join public.profiles me on me.id = (select auth.uid()) and me.township_id = g.township_id
left join public.group_members m on m.group_id = g.id and m.user_id = me.id
left join public.topic_reads r on r.topic_id = t.id and r.user_id = me.id
left join lateral (
  select tm.body, tm.created_at, p.full_name as sender_name
    from public.topic_messages tm
    left join public.profiles p on p.id = tm.sender_id
   where tm.topic_id = t.id
   order by tm.created_at desc
   limit 1
) last on true
where t.removed_at is null;

-- The messages of those topics: who sent each (by name, never a unit; from_office for the Management Office), and
-- whether it is the caller's.
create view public.public_topic_messages with (security_invoker = false, security_barrier = true) as
select
  tm.id, tm.topic_id, tm.body, tm.created_at, p.full_name as sender_name,
  coalesce(p.role = 'management', false) as from_office,
  coalesce(tm.sender_id = (select auth.uid()), false) as is_mine
from public.topic_messages tm
join public.chat_topics t on t.id = tm.topic_id and t.removed_at is null
join public.groups g on g.id = t.group_id and g.is_general
left join public.profiles p on p.id = tm.sender_id
where g.township_id = (select public.my_township());

-- ---------------------------------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------------------------------

-- A verified resident or the office posts in a topic of their township's General chat (only the office in an
-- office-only one). Posting marks the topic read for the sender.
create function public.send_topic_message(p_topic uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_office_only boolean;
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  select t.office_only into v_office_only
    from public.chat_topics t join public.groups g on g.id = t.group_id
   where t.id = p_topic and g.township_id = public.my_township() and g.is_general and t.removed_at is null;
  if not found then
    raise exception 'not_found';
  end if;
  if v_office_only and not public.is_management() then
    raise exception 'office_only';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'bad_body';
  end if;
  insert into public.topic_messages (topic_id, sender_id, body)
  values (p_topic, (select auth.uid()), left(btrim(p_body), 2000))
  returning id into v_id;
  insert into public.topic_reads (topic_id, user_id, last_read_at)
  values (p_topic, (select auth.uid()), now())
  on conflict (topic_id, user_id) do update set last_read_at = excluded.last_read_at;
  return v_id;
end
$$;

-- The caller has read a topic of their township (anyone signed in there, waiting for approval too: they read).
create function public.mark_topic_read(p_topic uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.topic_reads (topic_id, user_id, last_read_at)
  select t.id, (select auth.uid()), now()
    from public.chat_topics t join public.groups g on g.id = t.group_id
   where t.id = p_topic and g.township_id = (select public.my_township())
  on conflict (topic_id, user_id) do update set last_read_at = excluded.last_read_at
$$;

-- The office adds a topic to its township's General chat, last in the list.
create function public.create_topic(p_emoji text, p_title text, p_office_only boolean)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_group uuid;
  v_id uuid;
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  if coalesce(char_length(btrim(p_emoji)), 0) not between 1 and 8
     or coalesce(char_length(btrim(p_title)), 0) not between 1 and 40 then
    raise exception 'bad_topic';
  end if;
  select id into v_group from public.groups where township_id = public.my_township() and is_general;
  if v_group is null then
    raise exception 'not_found';
  end if;
  insert into public.chat_topics (group_id, emoji, title, office_only, sort_order)
  select v_group, btrim(p_emoji), btrim(p_title), coalesce(p_office_only, false), coalesce(max(sort_order), 0) + 10
    from public.chat_topics
   where group_id = v_group
  returning id into v_id;
  return v_id;
end
$$;

-- The office changes a topic's emoji and name, or makes it office-only or open. Announcements stays office-only.
create function public.update_topic(p_topic uuid, p_emoji text, p_title text, p_office_only boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_system text;
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  if coalesce(char_length(btrim(p_emoji)), 0) not between 1 and 8
     or coalesce(char_length(btrim(p_title)), 0) not between 1 and 40 then
    raise exception 'bad_topic';
  end if;
  select t.system_key into v_system
    from public.chat_topics t join public.groups g on g.id = t.group_id
   where t.id = p_topic and g.township_id = public.my_township() and t.removed_at is null;
  if not found then
    raise exception 'not_found';
  end if;
  if v_system = 'announcements' and not coalesce(p_office_only, false) then
    raise exception 'system_topic';
  end if;
  update public.chat_topics
     set emoji = btrim(p_emoji), title = btrim(p_title), office_only = coalesce(p_office_only, false)
   where id = p_topic;
end
$$;

-- The office removes a topic: it leaves the list and its page goes; its messages are kept. Never Announcements.
create function public.remove_topic(p_topic uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_system text;
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  select t.system_key into v_system
    from public.chat_topics t join public.groups g on g.id = t.group_id
   where t.id = p_topic and g.township_id = public.my_township() and t.removed_at is null;
  if not found then
    raise exception 'not_found';
  end if;
  if v_system = 'announcements' then
    raise exception 'system_topic';
  end if;
  update public.chat_topics set removed_at = now() where id = p_topic;
end
$$;

-- Announcements mirrors the office's announcements: each one is also a message there, from whoever published it, at the
-- same time. A township without General chat gets nothing.
create function public.mirror_announcement()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.topic_messages (topic_id, sender_id, body, created_at)
  select t.id, new.created_by, left(new.title || E'\n' || new.body, 2000), new.created_at
    from public.chat_topics t
    join public.groups g on g.id = t.group_id
   where g.township_id = new.township_id and g.is_general and t.system_key = 'announcements';
  return null;
end
$$;
create trigger announcements_mirror_to_topic
  after insert on public.announcements
  for each row execute function public.mirror_announcement();

-- ---------------------------------------------------------------------------------------------------------------------
-- Data: the starting topics in every General chat, and the announcements so far
-- ---------------------------------------------------------------------------------------------------------------------

-- STARTING_TOPICS of lib/domain/topics.ts.
insert into public.chat_topics (group_id, emoji, title, office_only, system_key, sort_order)
select g.id, s.emoji, s.title, s.office_only, s.system_key, s.sort_order
  from public.groups g
 cross join (values
   ('📢', 'Announcements', true, 'announcements', 0),
   ('🆘', 'Help & support', false, null, 10),
   ('💬', 'Borak-borak', false, null, 20),
   ('👋', 'Say hi', false, null, 30),
   ('🔎', 'Lost & found', false, null, 40),
   ('🚗', 'Traffic & roads', false, null, 50)
 ) as s (emoji, title, office_only, system_key, sort_order)
 where g.is_general;

-- The announcements published so far, in Announcements (the trigger mirrors the rest).
insert into public.topic_messages (topic_id, sender_id, body, created_at)
select t.id, a.created_by, left(a.title || E'\n' || a.body, 2000), a.created_at
  from public.announcements a
  join public.groups g on g.township_id = a.township_id and g.is_general
  join public.chat_topics t on t.group_id = g.id and t.system_key = 'announcements';

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.chat_topics enable row level security;
alter table public.topic_messages enable row level security;
alter table public.topic_reads enable row level security;

-- The township reads its topics' messages, and so receives new ones live.
create policy "The township reads its General chat messages" on public.topic_messages
  for select to authenticated
  using (public.topic_township(topic_id) = (select public.my_township()));

alter publication supabase_realtime add table public.topic_messages;

-- Take away the defaults, then give back exactly what is used: residents read messages and the two views; nothing is
-- written except through the RPCs.
revoke all on table public.chat_topics, public.topic_messages, public.topic_reads from anon, authenticated;
grant select on table public.topic_messages to authenticated;
grant select, insert, update, delete on table public.chat_topics, public.topic_messages, public.topic_reads
  to service_role;
revoke all on table public.public_topics, public.public_topic_messages from anon, authenticated, service_role;
grant select on table public.public_topics, public.public_topic_messages to authenticated;

revoke execute on function
  public.topic_township(uuid),
  public.send_topic_message(uuid, text),
  public.mark_topic_read(uuid),
  public.create_topic(text, text, boolean),
  public.update_topic(uuid, text, text, boolean),
  public.remove_topic(uuid),
  public.mirror_announcement()
  from public, anon, authenticated;
-- topic_township too: the topic_messages policy runs it as the caller.
grant execute on function
  public.topic_township(uuid),
  public.send_topic_message(uuid, text),
  public.mark_topic_read(uuid),
  public.create_topic(text, text, boolean),
  public.update_topic(uuid, text, text, boolean),
  public.remove_topic(uuid)
  to authenticated;

notify pgrst, 'reload schema';
