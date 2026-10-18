-- General chat's posts move into its topics (feedback round 2): every post in General chat, and every comment on one,
-- becomes a message in Borak-borak with its author and time; then the posts go, and their comments with them. Apart from
-- 0022 so that the live demo's old General chat page keeps its posts until the topic screens are deployed: apply it with
-- them.

insert into public.topic_messages (topic_id, sender_id, body, created_at)
select t.id, x.author_id, x.body, x.created_at
  from public.groups g
  join public.chat_topics t on t.group_id = g.id and t.title = 'Borak-borak'
  join lateral (
    select po.author_id, po.body, po.created_at from public.posts po where po.group_id = g.id
    union all
    select c.author_id, c.body, c.created_at
      from public.comments c join public.posts po on po.id = c.post_id
     where po.group_id = g.id
  ) x on true
 where g.is_general;

delete from public.posts po using public.groups g where g.id = po.group_id and g.is_general;
