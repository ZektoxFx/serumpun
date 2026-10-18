-- Home favourites (feedback round 2, like Touch 'n Go): the services a resident keeps on Home, in their order, as the
-- keys of lib/domain/nav.ts. Null means never edited, and the app shows its default seven. The app skips a key it no
-- longer knows, so this only checks the shape: at most 7, no repeats, key-like words.

alter table public.profiles add column favourites text[];

create function public.set_favourites(p_keys text[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.my_township() is null then
    raise exception 'not_allowed';
  end if;
  if p_keys is null
     or cardinality(p_keys) > 7
     or (select count(distinct k) from unnest(p_keys) k) <> cardinality(p_keys)
     or exists (select 1 from unnest(p_keys) k where k is null or k !~ '^[a-z][a-z-]{1,30}$') then
    raise exception 'bad_favourites';
  end if;
  update public.profiles set favourites = p_keys where id = (select auth.uid());
end
$$;

revoke execute on function public.set_favourites(text[]) from public, anon;
grant execute on function public.set_favourites(text[]) to authenticated;

notify pgrst, 'reload schema';
