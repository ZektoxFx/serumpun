-- Review fixes for 0002_alerts.sql (an applied migration is never edited).

-- Same as 0002, except that any photo is refused. CREATE OR REPLACE keeps the signature, owner and grants.
create or replace function public.create_alert(
  p_type text, p_severity text, p_lat float8, p_lng float8, p_note text default null, p_photo_url text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if p_type is null or p_type not in (
    'accident', 'snake', 'suspicious', 'stray_dogs', 'flood', 'fallen_tree', 'walkway_blocked', 'streetlight', 'police'
  ) then
    raise exception 'bad_type';
  end if;
  if p_severity is null or p_severity not in ('high', 'medium', 'low') then
    raise exception 'bad_severity';
  end if;
  -- Within about 5 km of the township centre (also refuses null, NaN and infinite coordinates).
  if not exists (
    select 1 from public.townships t
     where t.id = public.my_township() and abs(p_lat - t.centre_lat) <= 0.05 and abs(p_lng - t.centre_lng) <= 0.05
  ) then
    raise exception 'out_of_area';
  end if;
  -- Photos stay refused until Task 7 creates the photos bucket and validates object paths.
  if p_photo_url is not null then
    raise exception 'bad_photo';
  end if;

  insert into public.alerts (township_id, type, severity, lat, lng, note, photo_url, created_by, expires_at)
  values (
    public.my_township(), p_type, p_severity, p_lat, p_lng, left(nullif(btrim(p_note), ''), 280), p_photo_url,
    (select auth.uid()), now() + interval '2 hours'
  )
  returning id into v_id;
  return v_id;
end
$$;

-- Same as 0002, except that a failing broadcast only warns: whatever Realtime does, the alert or vote is still saved.
create or replace function public.broadcast_alert_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb;
  v_alert uuid;
  v_township uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;
  if tg_table_name = 'alerts' then
    v_alert := v_row ->> 'id';
    v_township := v_row ->> 'township_id';
  else
    v_alert := v_row ->> 'alert_id';
    select a.township_id into v_township from public.alerts a where a.id = v_alert;
  end if;
  if v_township is not null then -- a vote removed along with its alert: the alert's own broadcast covers it
    begin
      perform realtime.send(
        jsonb_build_object('id', v_alert, 'table', tg_table_name::text),
        tg_table_name::text,
        'township:' || v_township::text,
        false
      );
    exception when others then
      raise warning 'broadcast_alert_change: % (%)', sqlerrm, sqlstate;
    end;
  end if;
  return null;
end
$$;

-- Never grant SELECT on alert_votes to API roles: PostgREST would let residents embed voter profiles through public_alerts.

revoke execute on function
  public.create_alert(text, text, float8, float8, text, text), public.broadcast_alert_change()
  from public, anon, authenticated;
grant execute on function public.create_alert(text, text, float8, float8, text, text) to authenticated;

notify pgrst, 'reload schema';
