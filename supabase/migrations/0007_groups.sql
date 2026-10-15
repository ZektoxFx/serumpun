-- Groups: members, posts, comments and Helpful votes.
--
-- Residents read the four public_* views: the groups, members, posts and comments of their own township, with the
-- names residents already read through profiles (never a unit number), whether the caller is a member, their own last
-- visit (for "N new"; nobody else's) and their own Helpful votes. Every write goes through an RPC that checks its
-- caller: a verified resident of the township and, to post, comment or vote, a member of the group.

-- ---------------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references public.townships (id),
  name text not null check (length(btrim(name)) between 1 and 60),
  -- The categories and tile colours of lib/domain/community.ts.
  category text not null check (category in ('family', 'sports', 'fitness', 'hobbies', 'other')),
  description text check (length(description) <= 500),
  rules text check (length(rules) <= 2000),
  colour text not null check (colour in ('red', 'orange', 'amber', 'ink', 'green', 'purple')),
  created_by uuid references public.profiles (id) on delete set null,
  member_count int not null default 0 check (member_count >= 0),
  created_at timestamptz not null default now()
);
create index groups_township_id_idx on public.groups (township_id);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  -- When the member last opened the group: what was posted after it is "new" to them. Only they read it.
  last_visit_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_id_idx on public.group_members (user_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  type text not null check (type in ('general', 'question', 'share_lend')),
  body text not null check (length(btrim(body)) between 1 and 2000),
  listing_id uuid, -- the Share & Lend migration adds the foreign key (ruling R6)
  comment_count int not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now()
);
create index posts_group_id_created_at_idx on public.posts (group_id, created_at desc);
create index posts_author_id_idx on public.posts (author_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 1000),
  helpful_count int not null default 0 check (helpful_count >= 0),
  created_at timestamptz not null default now()
);
create index comments_post_id_created_at_idx on public.comments (post_id, created_at);
create index comments_author_id_idx on public.comments (author_id);

-- One Helpful vote per person and comment.
create table public.comment_helpful (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_helpful_user_id_idx on public.comment_helpful (user_id);

-- Ruling R6: an event can belong to a group, which pins it on its page.
alter table public.events
  add constraint events_group_id_fkey foreign key (group_id) references public.groups (id) on delete set null;
create index events_group_id_idx on public.events (group_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- The views residents read. Definer views, so their WHERE is the only filter; security_barrier keeps a caller's own
-- filters from running before it.
-- ---------------------------------------------------------------------------------------------------------------------

-- The township's groups, and the caller's membership of each (nulls when not a member).
create view public.public_groups with (security_invoker = false, security_barrier = true) as
select
  g.id, g.name, g.category, g.description, g.rules, g.colour, g.member_count, g.created_at,
  m.user_id is not null as is_member, m.role as my_role, m.joined_at, m.last_visit_at
from public.groups g
left join public.group_members m on m.group_id = g.id and m.user_id = (select auth.uid())
where g.township_id = (select public.my_township());

-- Who is in each group, by name and neighbourhood; not when they last visited.
create view public.public_group_members with (security_invoker = false, security_barrier = true) as
select m.group_id, m.user_id, p.full_name, p.neighbourhood, m.role, m.joined_at
from public.group_members m
join public.groups g on g.id = m.group_id
join public.profiles p on p.id = m.user_id
where g.township_id = (select public.my_township());

create view public.public_posts with (security_invoker = false, security_barrier = true) as
select
  po.id, po.group_id, po.author_id, p.full_name as author_name, p.neighbourhood as author_neighbourhood,
  po.type, po.body, po.listing_id, po.comment_count, po.created_at,
  coalesce(po.author_id = (select auth.uid()), false) as is_mine
from public.posts po
join public.groups g on g.id = po.group_id
left join public.profiles p on p.id = po.author_id
where g.township_id = (select public.my_township());

-- Comments, with whether the caller marked each one Helpful.
create view public.public_comments with (security_invoker = false, security_barrier = true) as
select
  c.id, c.post_id, p.full_name as author_name, c.body, c.helpful_count, c.created_at,
  coalesce(c.author_id = (select auth.uid()), false) as is_mine,
  h.user_id is not null as my_helpful
from public.comments c
join public.posts po on po.id = c.post_id
join public.groups g on g.id = po.group_id
left join public.profiles p on p.id = c.author_id
left join public.comment_helpful h on h.comment_id = c.id and h.user_id = (select auth.uid())
where g.township_id = (select public.my_township());

-- ---------------------------------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------------------------------

-- A verified resident starts a group in their township and becomes its admin. Its tile colour follows the category.
create function public.create_group(p_name text, p_category text, p_description text, p_rules text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'bad_name';
  end if;
  if p_category is null or p_category not in ('family', 'sports', 'fitness', 'hobbies', 'other') then
    raise exception 'bad_category';
  end if;
  insert into public.groups (township_id, name, category, description, rules, colour, created_by, member_count)
  values (
    public.my_township(), left(btrim(p_name), 60), p_category, left(nullif(btrim(p_description), ''), 500),
    left(nullif(btrim(p_rules), ''), 2000),
    case p_category when 'family' then 'red' when 'sports' then 'amber' when 'fitness' then 'orange'
      when 'hobbies' then 'purple' else 'ink' end,
    (select auth.uid()), 1
  )
  returning id into v_id;
  insert into public.group_members (group_id, user_id, role, last_visit_at) values (v_id, (select auth.uid()), 'admin', now());
  return v_id;
end
$$;

-- Joins a group of the caller's township. Joining again changes nothing.
create function public.join_group(p_group uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if not exists (select 1 from public.groups where id = p_group and township_id = public.my_township()) then
    raise exception 'not_found';
  end if;
  insert into public.group_members (group_id, user_id) values (p_group, (select auth.uid())) on conflict do nothing;
  if found then
    update public.groups set member_count = member_count + 1 where id = p_group;
  end if;
end
$$;

-- Leaves a group. The admin stays, so a group always has one. Leaving twice changes nothing.
create function public.leave_group(p_group uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if not exists (select 1 from public.groups where id = p_group and township_id = public.my_township()) then
    raise exception 'not_found';
  end if;
  if exists (
    select 1 from public.group_members where group_id = p_group and user_id = (select auth.uid()) and role = 'admin'
  ) then
    raise exception 'admin_cannot_leave';
  end if;
  delete from public.group_members where group_id = p_group and user_id = (select auth.uid()) and role = 'member';
  if found then
    update public.groups set member_count = greatest(member_count - 1, 0) where id = p_group;
  end if;
end
$$;

-- A member opened the group: what was posted until now is no longer new to them. Anyone else changes nothing.
create function public.mark_group_visited(p_group uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.group_members set last_visit_at = now() where group_id = p_group and user_id = (select auth.uid())
$$;

-- A member posts in their group: general, a question, or something to share or lend.
create function public.create_post(p_group uuid, p_type text, p_body text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if not exists (select 1 from public.groups where id = p_group and township_id = public.my_township()) then
    raise exception 'not_found';
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group and user_id = (select auth.uid())) then
    raise exception 'not_member';
  end if;
  if p_type is null or p_type not in ('general', 'question', 'share_lend') then
    raise exception 'bad_type';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'bad_body';
  end if;
  insert into public.posts (group_id, author_id, type, body)
  values (p_group, (select auth.uid()), p_type, left(btrim(p_body), 2000))
  returning id into v_id;
  return v_id;
end
$$;

-- A member comments on a post of their group. The post's author is told, unless they wrote the comment.
create function public.add_comment(p_post uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_group uuid;
  v_name text;
  v_author uuid;
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  select g.id, g.name, po.author_id into v_group, v_name, v_author
    from public.posts po
    join public.groups g on g.id = po.group_id
   where po.id = p_post and g.township_id = public.my_township();
  if not found then
    raise exception 'not_found';
  end if;
  if not exists (select 1 from public.group_members where group_id = v_group and user_id = (select auth.uid())) then
    raise exception 'not_member';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'bad_body';
  end if;
  insert into public.comments (post_id, author_id, body)
  values (p_post, (select auth.uid()), left(btrim(p_body), 1000))
  returning id into v_id;
  update public.posts set comment_count = comment_count + 1 where id = p_post;
  if v_author is distinct from (select auth.uid()) then
    perform public.notify(array[v_author], 'group', 'notify.group.comment', v_name, '/community/groups/' || v_group);
  end if;
  return v_id;
end
$$;

-- Marks a comment Helpful (p_helpful true) or takes the mark back, as a member of its group, never on one's own comment.
-- The wanted state rather than a toggle: a double tap sends the same state twice and changes nothing the second time.
create function public.set_helpful(p_comment uuid, p_helpful boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_group uuid;
  v_author uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  select po.group_id, c.author_id into v_group, v_author
    from public.comments c
    join public.posts po on po.id = c.post_id
    join public.groups g on g.id = po.group_id
   where c.id = p_comment and g.township_id = public.my_township();
  if not found then
    raise exception 'not_found';
  end if;
  if not exists (select 1 from public.group_members where group_id = v_group and user_id = (select auth.uid())) then
    raise exception 'not_member';
  end if;
  if v_author = (select auth.uid()) then
    raise exception 'own_comment';
  end if;
  -- Each count change follows a row that really changed, so two votes at once keep helpful_count right.
  if coalesce(p_helpful, false) then
    insert into public.comment_helpful (comment_id, user_id) values (p_comment, (select auth.uid())) on conflict do nothing;
    if found then
      update public.comments set helpful_count = helpful_count + 1 where id = p_comment;
    end if;
  else
    delete from public.comment_helpful where comment_id = p_comment and user_id = (select auth.uid());
    if found then
      update public.comments set helpful_count = greatest(helpful_count - 1, 0) where id = p_comment;
    end if;
  end if;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.comment_helpful enable row level security;

-- Take away the defaults, then give back exactly what is used: residents read the four views; nothing is written
-- except through the RPCs.
revoke all on table public.groups, public.group_members, public.posts, public.comments, public.comment_helpful
  from anon, authenticated;
grant select, insert, update, delete on table
  public.groups, public.group_members, public.posts, public.comments, public.comment_helpful
  to service_role;
revoke all on table public.public_groups, public.public_group_members, public.public_posts, public.public_comments
  from anon, authenticated, service_role;
grant select on table public.public_groups, public.public_group_members, public.public_posts, public.public_comments
  to authenticated;

revoke execute on function
  public.create_group(text, text, text, text),
  public.join_group(uuid),
  public.leave_group(uuid),
  public.mark_group_visited(uuid),
  public.create_post(uuid, text, text),
  public.add_comment(uuid, text),
  public.set_helpful(uuid, boolean)
  from public, anon, authenticated;
grant execute on function
  public.create_group(text, text, text, text),
  public.join_group(uuid),
  public.leave_group(uuid),
  public.mark_group_visited(uuid),
  public.create_post(uuid, text, text),
  public.add_comment(uuid, text),
  public.set_helpful(uuid, boolean)
  to authenticated;

notify pgrst, 'reload schema';
