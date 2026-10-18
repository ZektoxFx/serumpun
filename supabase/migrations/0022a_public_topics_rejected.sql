-- Review fix for 0022_chat_topics.sql (an applied migration is never edited): public_topics found the reader through
-- profiles directly, so a rejected applicant still saw the topics and their latest messages. It now also goes through
-- my_township(), which gives a rejected applicant nothing, as every other view does. Everything else is as before;
-- create or replace keeps its grants, and the options are given again because replacing a view resets them.
create or replace view public.public_topics with (security_invoker = false, security_barrier = true) as
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
join public.profiles me on me.id = (select auth.uid())
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
where t.removed_at is null and g.township_id = (select public.my_township());

notify pgrst, 'reload schema';
