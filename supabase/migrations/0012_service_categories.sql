-- Services get the team's category list (lib/domain/community.ts): Tutoring, Repairs, Cleaning, Food, Childcare,
-- Eldercare, Pets, Others. Home help becomes Cleaning; Pets keeps its key, pet_care. create_service checks the new list.

alter table public.services drop constraint services_category_check;
update public.services set category = 'cleaning' where category = 'home_help';
alter table public.services add constraint services_category_check
  check (category in ('tutoring', 'repairs', 'cleaning', 'food', 'childcare', 'eldercare', 'pet_care', 'other'));

-- As in 0009, with the new list. create or replace keeps its grants.
create or replace function public.create_service(
  p_kind text, p_category text, p_title text, p_description text, p_price_text text, p_availability_text text,
  p_budget_text text, p_needed_by date
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if p_kind is null or p_kind not in ('offer', 'request') then
    raise exception 'bad_kind';
  end if;
  if p_category is null
     or p_category not in ('tutoring', 'repairs', 'cleaning', 'food', 'childcare', 'eldercare', 'pet_care', 'other') then
    raise exception 'bad_category';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'bad_title';
  end if;
  if p_kind = 'request' and p_needed_by is not null and (p_needed_by < v_today or p_needed_by > v_today + 365) then
    raise exception 'bad_date';
  end if;
  insert into public.services (
    township_id, kind, category, title, description, price_text, availability_text, budget_text, needed_by, provider_id
  )
  values (
    public.my_township(), p_kind, p_category, left(btrim(p_title), 80), left(nullif(btrim(p_description), ''), 1000),
    case when p_kind = 'offer' then left(nullif(btrim(p_price_text), ''), 40) end,
    case when p_kind = 'offer' then left(nullif(btrim(p_availability_text), ''), 80) end,
    case when p_kind = 'request' then left(nullif(btrim(p_budget_text), ''), 40) end,
    case when p_kind = 'request' then p_needed_by end,
    (select auth.uid())
  )
  returning id into v_id;
  return v_id;
end
$$;

notify pgrst, 'reload schema';
