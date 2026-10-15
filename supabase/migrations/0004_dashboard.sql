-- Management Office dashboard: official-only map pin types.
--
-- Road works and water cuts are notices from the Management Office (spec §8.1), not hazards a resident drops. The table
-- takes them on official pins only, and only create_official_pin hands them out; create_alert keeps its nine types.

alter table public.alerts drop constraint alerts_type_check;
alter table public.alerts add constraint alerts_type_check check (
  type in (
    'accident', 'snake', 'suspicious', 'stray_dogs', 'flood', 'fallen_tree', 'walkway_blocked', 'streetlight', 'police',
    'road_works', 'water_cut'
  )
  and (is_official or type not in ('road_works', 'water_cut'))
);

-- Same as 0002, with the two official types. CREATE OR REPLACE keeps the signature, owner and grants.
create or replace function public.create_official_pin(
  p_type text, p_severity text, p_lat float8, p_lng float8, p_note text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_management() then
    raise exception 'not_management';
  end if;
  if p_type is null or p_type not in (
    'accident', 'snake', 'suspicious', 'stray_dogs', 'flood', 'fallen_tree', 'walkway_blocked', 'streetlight', 'police',
    'road_works', 'water_cut'
  ) then
    raise exception 'bad_type';
  end if;
  if p_severity is null or p_severity not in ('high', 'medium', 'low') then
    raise exception 'bad_severity';
  end if;
  if not exists (
    select 1 from public.townships t
     where t.id = public.my_township() and abs(p_lat - t.centre_lat) <= 0.05 and abs(p_lng - t.centre_lng) <= 0.05
  ) then
    raise exception 'out_of_area';
  end if;

  insert into public.alerts (township_id, type, severity, lat, lng, note, created_by, is_official)
  values (
    public.my_township(), p_type, p_severity, p_lat, p_lng, left(nullif(btrim(p_note), ''), 280), (select auth.uid()), true
  )
  returning id into v_id;
  return v_id;
end
$$;

notify pgrst, 'reload schema';
