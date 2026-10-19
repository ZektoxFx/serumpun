-- Review fix for 0024_access_cards.sql (an applied migration is never edited): every member of a card, a child included,
-- could read its unit's record_phone, and so could the office. Phone numbers are the office's alone, and in stage 1 not
-- even the office reads this one: only the service role does. The office's way to it comes in stage 2, with codes at
-- the counter. Signed-in users keep every other column, through the same row policies. They are now refused
-- `select *` on units, so they name their columns.
revoke select on table public.units from authenticated;
grant select (id, township_id, label, neighbourhood, record_name, record_tenure, lease_end) on table public.units
  to authenticated;

notify pgrst, 'reload schema';
