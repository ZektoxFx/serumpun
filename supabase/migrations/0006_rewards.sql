-- Rewards and vouchers: the catalog, redemptions, and the RPCs that spend points and use vouchers.
--
-- Points are spent only by redeem_reward (a 'reward' row in points_ledger, ref_id = the voucher), and a voucher is used
-- only by use_voucher. Residents read the catalog of their township and their own vouchers; the Management Office reads
-- the township's vouchers for its list. Shops need no system: the cashier looks at the voucher on the phone.

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references public.townships (id),
  partner_name text not null check (length(btrim(partner_name)) between 1 and 80),
  title text not null check (length(btrim(title)) between 1 and 80),
  title_ms text not null check (length(btrim(title_ms)) between 1 and 80),
  -- The categories of lib/domain/points.ts.
  category text not null check (category in ('food', 'groceries', 'family', 'sports')),
  points_cost int not null check (points_cost between 1 and 100000),
  terms text check (length(terms) <= 120), -- "min spend RM50"
  terms_ms text check (length(terms_ms) <= 120),
  emoji text not null check (length(emoji) <= 16),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index rewards_township_id_idx on public.rewards (township_id);

-- A voucher. Its id is the id of the Redeem request that made it, so a repeated request finds it instead of paying twice.
create table public.redemptions (
  id uuid primary key,
  reward_id uuid not null references public.rewards (id),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- voucherCode in lib/domain/points.ts: no 0/O or 1/I.
  code text not null unique check (code ~ '^ELM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$'),
  status text not null default 'active' check (status in ('active', 'used')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  check ((status = 'used') = (used_at is not null))
);
create index redemptions_user_id_idx on public.redemptions (user_id);
create index redemptions_reward_id_idx on public.redemptions (reward_id);

-- The caller's points: the sum of their own ledger (row-level security already limits it to them).
create function public.my_points()
returns int
language sql stable set search_path = ''
as $$
  select coalesce(sum(delta), 0)::int from public.points_ledger where user_id = (select auth.uid())
$$;

-- Spends points on a reward of the caller's township: a voucher with a fresh code, valid VOUCHER_DAYS (30). Returns the
-- voucher's id, which is p_request: a double tap sends the same request twice and gets the first voucher back.
create function public.redeem_reward(p_reward uuid, p_request uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_reward public.rewards%rowtype;
  v_points int;
  v_code text;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  if p_request is null then
    raise exception 'bad_request';
  end if;
  -- One redemption at a time per resident: the profile row lock queues them, so the balance read below (a new
  -- statement, after the wait) already counts the redemption before it. NO KEY: other tables' references still work.
  perform 1 from public.profiles where id = (select auth.uid()) for no key update;
  if exists (select 1 from public.redemptions where id = p_request) then
    if exists (select 1 from public.redemptions where id = p_request and user_id = (select auth.uid())) then
      return p_request;
    end if;
    raise exception 'bad_request';
  end if;

  select * into v_reward from public.rewards where id = p_reward and township_id = public.my_township() and active;
  if not found then
    raise exception 'not_found';
  end if;
  select coalesce(sum(delta), 0) into v_points from public.points_ledger where user_id = (select auth.uid());
  if v_points < v_reward.points_cost then
    raise exception 'insufficient_points';
  end if;

  loop
    v_code := 'ELM-';
    for i in 1..6 loop
      if i = 5 then
        v_code := v_code || '-';
      end if;
      v_code := v_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from public.redemptions where code = v_code);
  end loop;

  insert into public.redemptions (id, reward_id, user_id, code, expires_at)
  values (p_request, p_reward, (select auth.uid()), v_code, now() + interval '30 days');
  insert into public.points_ledger (user_id, delta, reason, ref_id)
  values ((select auth.uid()), -v_reward.points_cost, 'reward', p_request);
  return p_request;
end
$$;

-- "Slide to use": the owner marks an active, unexpired voucher used. Using it again is refused.
create function public.use_voucher(p_redemption uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_voucher public.redemptions%rowtype;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
  end if;
  select * into v_voucher from public.redemptions where id = p_redemption and user_id = (select auth.uid()) for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_voucher.status = 'used' then
    raise exception 'already_used';
  end if;
  if v_voucher.expires_at <= now() then
    raise exception 'expired';
  end if;
  update public.redemptions set status = 'used', used_at = now() where id = p_redemption;
end
$$;

alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;

create policy "Residents read their township's rewards" on public.rewards
  for select to authenticated using (township_id = (select public.my_township()));

create policy "Residents read their own vouchers; the office reads its township's" on public.redemptions
  for select to authenticated
  using (
    (user_id = (select auth.uid()) and (select public.my_township()) is not null)
    or (
      (select public.is_management())
      and exists (select 1 from public.rewards r where r.id = redemptions.reward_id and r.township_id = (select public.my_township()))
    )
  );

revoke all on table public.rewards, public.redemptions from anon, authenticated;
grant select on table public.rewards, public.redemptions to authenticated;
grant select, insert, update, delete on table public.rewards, public.redemptions to service_role;

revoke execute on function public.my_points(), public.redeem_reward(uuid, uuid), public.use_voucher(uuid)
  from public, anon, authenticated;
grant execute on function public.my_points(), public.redeem_reward(uuid, uuid), public.use_voucher(uuid) to authenticated;

notify pgrst, 'reload schema';
