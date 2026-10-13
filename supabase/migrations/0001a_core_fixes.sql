-- Review fixes for 0001_core.sql (an applied migration is never edited).

-- Rejected applicants get no township data. Every township-scoped policy compares against my_township(), so a NULL
-- here makes all of them fail closed. CREATE OR REPLACE keeps the function's owner and grants.
create or replace function public.my_township() returns uuid
language sql stable security definer set search_path = ''
as $$
  select township_id from public.profiles where id = (select auth.uid()) and status <> 'rejected'
$$;

-- Everyone can still read their own row, so the app can tell a rejected applicant why they are locked out.
create policy "Users read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

notify pgrst, 'reload schema';
