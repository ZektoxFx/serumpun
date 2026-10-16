-- General chat (feedback, 17 Oct): one group per township that every verified resident and the Management Office are
-- in, pinned at the top of Groups, where anyone can talk to everyone. Its members are rows like any group's, so posts,
-- "N new" and visits work as before: this migration adds today's verified people, a trigger adds everyone verified
-- later, and leave_group refuses it.

alter table public.groups add column is_general boolean not null default false;
create unique index groups_general_idx on public.groups (township_id) where is_general;

-- The live townships' General chat, with everyone verified in it; the office looks after it.
insert into public.groups (township_id, name, category, description, rules, colour, is_general)
select
  t.id, 'General chat', 'other', 'Say hi, ask for help or share news with your neighbours.',
  'Be kind and keep it about ' || t.name || E'.\nNo selling: use Services or Share & Lend instead.\n'
    || 'For anything broken, use Report an issue so the office can track it.',
  'orange', true
from public.townships t
where t.active and not exists (select 1 from public.groups g where g.township_id = t.id and g.is_general);

insert into public.group_members (group_id, user_id, role, joined_at)
select g.id, p.id, case when p.role = 'management' then 'admin' else 'member' end, p.created_at
from public.groups g
join public.profiles p on p.township_id = g.township_id and p.status = 'verified'
where g.is_general
on conflict do nothing;

update public.groups g
   set member_count = (select count(*) from public.group_members m where m.group_id = g.id)
 where g.is_general;

-- Everyone verified joins their township's General chat: a resident once the office approves them, or a profile made
-- verified directly. Nothing happens while a township has no General chat (the seed makes it after the people).
create function public.join_general_chat()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'verified' and (tg_op = 'INSERT' or old.status is distinct from 'verified') then
    with joined as (
      insert into public.group_members (group_id, user_id, role)
      select g.id, new.id, case when new.role = 'management' then 'admin' else 'member' end
        from public.groups g
       where g.township_id = new.township_id and g.is_general
      on conflict do nothing
      returning group_id
    )
    update public.groups set member_count = member_count + 1 where id in (select group_id from joined);
  end if;
  return new;
end
$$;
create trigger profiles_join_general_chat
  after insert or update of status on public.profiles
  for each row execute function public.join_general_chat();

-- public_groups (0007) with is_general at the end. Everything else is as before; create or replace keeps its grants, and
-- the options are given again because replacing a view resets them.
create or replace view public.public_groups with (security_invoker = false, security_barrier = true) as
select
  g.id, g.name, g.category, g.description, g.rules, g.colour, g.member_count, g.created_at,
  m.user_id is not null as is_member, m.role as my_role, m.joined_at, m.last_visit_at,
  g.is_general
from public.groups g
left join public.group_members m on m.group_id = g.id and m.user_id = (select auth.uid())
where g.township_id = (select public.my_township());

-- leave_group (0007): nobody leaves General chat. Everything else is as before; create or replace keeps its grants.
create or replace function public.leave_group(p_group uuid)
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
  if exists (select 1 from public.groups where id = p_group and is_general) then
    raise exception 'general_group';
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

-- A trigger's function is nobody's to call.
revoke execute on function public.join_general_chat() from public, anon, authenticated;

notify pgrst, 'reload schema';
