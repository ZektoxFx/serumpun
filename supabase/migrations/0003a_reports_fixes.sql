-- Review fixes for 0003_reports.sql (an applied migration is never edited).

-- Same as 0003, except that Me too is refused on a finished report (resolved or confirmed). Joining after the fix would
-- let a stranger answer Fixed or Not fixed, and two such answers reopen it; only people affected before the fix should
-- answer. A reopened report is open again. The check runs under the row lock, so a Me too cannot slip in beside a
-- resolve. CREATE OR REPLACE keeps the signature, owner and grants.
create or replace function public.metoo_report(p_report uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  -- The row lock queues concurrent Me toos on one report, so each count builds on the one before.
  select * into v_report
    from public.reports
   where id = p_report and township_id = public.my_township()
     for update;
  -- Someone else's private report answers as if it did not exist.
  if not found or (v_report.is_private and v_report.created_by is distinct from (select auth.uid())) then
    raise exception 'not_found';
  end if;
  if v_report.created_by = (select auth.uid()) then
    raise exception 'own_report';
  end if;
  if v_report.status in ('resolved', 'confirmed') then
    raise exception 'not_open';
  end if;

  insert into public.report_metoo (report_id, user_id) values (p_report, (select auth.uid())) on conflict do nothing;
  if found then
    update public.reports set metoo_count = metoo_count + 1, updated_at = now() where id = p_report;
  end if;
end
$$;

-- Same rule as 0003, except that the third clause (whoever can see the report update that carries the photo) now covers
-- private reports only. Only a private report's after-photo lives in `private-photos`; a public report's is in `photos`.
-- Without the limit, a later service-role write that put a private-photos path on a public report's update would make
-- that photo readable by the whole township.
alter policy "Uploaders, their office and report readers read private photos" on storage.objects
  using (
    bucket_id = 'private-photos'
    and (
      (owner_id = (select auth.uid())::text and (select public.my_township()) is not null)
      or (
        (select public.is_management())
        and exists (
          select 1 from public.profiles p
           where p.id::text = (storage.foldername(objects.name))[1] and p.township_id = (select public.my_township())
        )
      )
      or exists (
        select 1
          from public.public_report_updates u
          join public.public_reports r on r.id = u.report_id
         where u.photo_path = objects.name and r.is_private
      )
    )
  );

revoke execute on function public.metoo_report(uuid) from public, anon, authenticated;
grant execute on function public.metoo_report(uuid) to authenticated;
