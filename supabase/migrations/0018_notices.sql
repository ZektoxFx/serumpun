-- Notify the office (feedback, 17 Oct): a resident tells the Management Office ahead of time about something that may
-- affect the neighbours (renovation noise, moving with the lift, an event at home, contractors coming), so the office is
-- not caught out when neighbours ask. Only the office and the resident see it. The office marks it noted, with a reply
-- if it likes, and the resident is told. lib/domain/notices.ts keeps the same kinds and limits.

create table public.resident_notices (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references public.townships (id),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('renovation', 'moving', 'event', 'contractor', 'other')),
  starts_on date not null,
  ends_on date not null,
  details text not null check (length(btrim(details)) between 1 and 1000),
  status text not null default 'sent' check (status in ('sent', 'noted')),
  reply text check (length(reply) <= 500),
  created_at timestamptz not null default now(),
  noted_at timestamptz,
  check (ends_on >= starts_on)
);
create index resident_notices_township_id_created_at_idx on public.resident_notices (township_id, created_at desc);
create index resident_notices_user_id_idx on public.resident_notices (user_id);

-- A verified resident with a home in the township tells the office about something from today on, lasting at most 90
-- days. The office's people are told.
create function public.submit_notice(p_kind text, p_starts_on date, p_ends_on date, p_details text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_township uuid := public.my_township();
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if not exists (select 1 from public.profile_private where id = v_me) then
    raise exception 'no_unit'; -- the Management Office has no home to tell itself about
  end if;
  if p_kind is null or p_kind not in ('renovation', 'moving', 'event', 'contractor', 'other') then
    raise exception 'bad_kind';
  end if;
  if p_starts_on is null or p_ends_on is null or p_starts_on < v_today or p_starts_on > v_today + 365
     or p_ends_on < p_starts_on or p_ends_on > p_starts_on + 90 then
    raise exception 'bad_dates';
  end if;
  if nullif(btrim(p_details), '') is null then
    raise exception 'bad_details';
  end if;
  insert into public.resident_notices (township_id, user_id, kind, starts_on, ends_on, details)
  values (v_township, v_me, p_kind, p_starts_on, p_ends_on, left(btrim(p_details), 1000))
  returning id into v_id;
  perform public.notify(
    array(
      select p.id from public.profiles p
       where p.township_id = v_township and p.role = 'management' and p.status = 'verified'
    ),
    'notice', 'notify.notice.new', (select full_name from public.profiles where id = v_me), '/dashboard/notices'
  );
  return v_id;
end
$$;

-- The office marks a notice of its township noted, with an optional reply, and the resident is told.
create function public.note_notice(p_notice uuid, p_reply text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_resident uuid;
  v_reply text := left(nullif(btrim(p_reply), ''), 500);
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  update public.resident_notices
     set status = 'noted', reply = v_reply, noted_at = now()
   where id = p_notice and township_id = public.my_township() and status = 'sent'
  returning user_id into v_resident;
  if v_resident is null then
    raise exception 'not_found';
  end if;
  perform public.notify(array[v_resident], 'notice', 'notify.notice.noted', v_reply, '/notices');
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.resident_notices enable row level security;
create policy "Residents read their own notices" on public.resident_notices
  for select to authenticated using (user_id = (select auth.uid()));
create policy "The Management Office reads its township's notices" on public.resident_notices
  for select to authenticated using ((select public.is_management()) and township_id = (select public.my_township()));

-- Take away the defaults, then give back exactly what is used: reading (under the policies above); nothing is written
-- except through the RPCs.
revoke all on table public.resident_notices from anon, authenticated;
grant select on table public.resident_notices to authenticated;
grant select, insert, update, delete on table public.resident_notices to service_role;

revoke execute on function public.submit_notice(text, date, date, text), public.note_notice(uuid, text)
  from public, anon, authenticated;
grant execute on function public.submit_notice(text, date, date, text), public.note_notice(uuid, text) to authenticated;

notify pgrst, 'reload schema';
