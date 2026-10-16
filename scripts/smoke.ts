import { createClient } from '@supabase/supabase-js';
import { bookableDates } from '@/lib/domain/booking';
import { env } from '@/lib/env';
import { seedAll } from '@/lib/seed';
import { DEMO_EMAIL, type DemoAccount } from '@/lib/seed/people';
import { createAdminClient } from '@/lib/supabase/admin';

// Run with `npm run smoke` on the seeded demo: the privacy, pending-user, double-tap and limit rules, each tried through
// the API as the demo accounts would. Prints PASS or FAIL per check and exits 1 on any FAIL. The checks book, redeem and
// check in, so the demo is seeded again at the end.

type Answer = { error: { message: string } | null };

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
  if (!ok) failures++;
}
/** The call was refused, with `code` when given: an RPC's `raise exception` code arrives as the message. */
const refused = (answer: Answer, code?: string) => answer.error !== null && (code === undefined || answer.error.message === code);
const said = (answer: Answer) => answer.error?.message ?? 'ok';

async function signIn(who: DemoAccount) {
  const client = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: DEMO_EMAIL[who], password: env.demoPassword });
  if (error) throw new Error(`sign in as ${who}: ${error.message}`);
  return { client, id: data.user.id };
}

const HOUR = 3_600_000;
const CENTRE = { p_lat: 3.1797, p_lng: 101.5156 }; // City of Elmina's centre

async function checks() {
  const admin = createAdminClient();
  const [aisyah, daniel, nur] = await Promise.all((['aisyah', 'daniel', 'nur'] as const).map(signIn));
  const { data: profile, error: profileError } = await admin.from('profiles').select('township_id').eq('id', daniel.id).single();
  if (profileError) throw new Error(`township: ${profileError.message}`);
  const township: string = profile.township_id;
  const now = new Date();

  console.log('— privacy');
  // Row-level security answers residents with no rows (only the office reads the table); they read public_reports.
  const senders = await daniel.client.from('reports').select('created_by');
  check('Daniel cannot read who sent a report', refused(senders) || senders.data?.length === 0, `${senders.data?.length} rows`);
  const units = await daniel.client.from('profile_private').select('id');
  check(
    'Daniel reads only his own unit',
    !units.error && units.data.length === 1 && units.data[0].id === daniel.id,
    units.error?.message ?? `${units.data?.length} rows`,
  );
  const { data: hidden } = await admin.from('reports').select('id').eq('created_by', aisyah.id).eq('is_private', true).limit(1).single();
  const [hers, his] = await Promise.all([aisyah, daniel].map((u) => u.client.from('public_reports').select('id').eq('id', hidden?.id)));
  check("Daniel cannot see Aisyah's private report (she can)", hers.data?.length === 1 && his.data?.length === 0, `${hers.data?.length} / ${his.data?.length}`);
  check('Daniel cannot read event check-in codes', refused(await daniel.client.from('events').select('checkin_code').limit(1)));
  check(
    'Daniel cannot give himself points',
    refused(await daniel.client.from('points_ledger').insert({ user_id: daniel.id, delta: 1000, reason: 'event', ref_id: crypto.randomUUID() })),
  );
  const games = ((await daniel.client.rpc('open_games')).data ?? []) as { booking_id: string; i_joined: boolean }[];
  const joiners = await daniel.client.from('booking_players').select('user_id').limit(1);
  const theirs = await daniel.client.rpc('game_players', { p_booking: games[0]?.booking_id });
  check(
    "Daniel cannot read who joined a neighbour's game",
    refused(joiners) && !theirs.error && theirs.data?.length === 0,
    `${said(joiners)} / ${theirs.error?.message ?? `${theirs.data?.length} rows`}`,
  );

  console.log('— pending users');
  check('Nur (pending) cannot drop an alert', refused(await nur.client.rpc('create_alert', { p_type: 'snake', p_severity: 'high', ...CENTRE }), 'not_verified'));
  check(
    'Nur (pending) cannot send a report',
    refused(await nur.client.rpc('create_report', { p_category: 'streetlight', p_title: 'Smoke test', p_description: 'Smoke test', ...CENTRE }), 'not_verified'),
  );

  console.log('— double taps');
  const { data: open, error: openError } = await aisyah.client
    .from('public_reports')
    .select('id, metoo_count')
    .eq('is_mine', false)
    .eq('has_metoo', false)
    .in('status', ['submitted', 'acknowledged', 'in_progress', 'reopened'])
    .limit(1)
    .single();
  if (openError) throw new Error(`an open report: ${openError.message}`);
  const taps = await Promise.all([1, 2].map(() => aisyah.client.rpc('metoo_report', { p_report: open.id })));
  const { data: backed } = await aisyah.client.from('public_reports').select('metoo_count').eq('id', open.id).single();
  check(
    'Me too twice at once counts once',
    taps.every((r) => !r.error) && backed?.metoo_count === open.metoo_count + 1,
    `${taps.map(said).join(' / ')}, ${open.metoo_count} -> ${backed?.metoo_count}`,
  );

  // A fresh official event, on now, whose code only this script knows.
  const code = crypto.randomUUID().replaceAll('-', '');
  const { data: event, error: eventError } = await admin
    .from('events')
    .insert({
      township_id: township,
      title: 'Smoke test check-in',
      category: 'official',
      is_official: true,
      approval_status: 'approved',
      points: 150,
      starts_at: now.toISOString(),
      ends_at: new Date(now.getTime() + HOUR).toISOString(),
      location_text: 'Smoke test',
      checkin_code: code,
    })
    .select('id')
    .single();
  if (eventError) throw new Error(`smoke event: ${eventError.message}`);
  const balanceOf = async (client: typeof daniel.client) => Number((await client.rpc('my_points')).data);
  const before = await balanceOf(daniel.client);
  const first = await daniel.client.rpc('check_in_event', { p_event: event.id, p_code: code });
  const second = await daniel.client.rpc('check_in_event', { p_event: event.id, p_code: code });
  const after = await balanceOf(daniel.client);
  check(
    'Checking in twice pays once',
    !first.error && refused(second, 'already_checked_in') && after === before + 150,
    `${said(first)} / ${said(second)}, ${before} -> ${after}`,
  );

  // A reward costing more than half of Aisyah's points: two presses at once (two request ids) can pay for one.
  const balance = await balanceOf(aisyah.client);
  const { data: reward, error: rewardError } = await admin
    .from('rewards')
    .insert({
      township_id: township,
      partner_name: 'Smoke test',
      title: 'Smoke test reward',
      title_ms: 'Ganjaran ujian',
      category: 'food',
      points_cost: Math.floor(balance / 2) + 1,
      emoji: '🧪',
    })
    .select('id')
    .single();
  if (rewardError) throw new Error(`smoke reward: ${rewardError.message}`);
  const presses = await Promise.all([1, 2].map(() => aisyah.client.rpc('redeem_reward', { p_reward: reward.id, p_request: crypto.randomUUID() })));
  check(
    'Two redeems at once, each over half the balance: one voucher',
    presses.filter((r) => !r.error).length === 1 && presses.some((r) => refused(r, 'insufficient_points')),
    presses.map(said).join(' / '),
  );

  const dates = bookableDates(now).slice(1); // from tomorrow, so no slot has started
  const { data: court, error: courtError } = await admin.from('facilities').select('id').eq('court_label', 'Badminton Court 2').single();
  if (courtError) throw new Error(`a court: ${courtError.message}`);
  const slot = { p_facility: court.id, p_date: dates[2], p_hour: 20, p_players_needed: 0 };
  const both = await Promise.all([aisyah, daniel].map((u) => u.client.rpc('book_slot', slot)));
  check(
    'Two bookings of one slot at once: one booking',
    both.filter((r) => !r.error).length === 1 && both.some((r) => refused(r, 'slot_taken')),
    both.map(said).join(' / '),
  );
  const game = games.find((g) => !g.i_joined);
  if (!game) throw new Error('no open game for Daniel to join');
  const joins = await Promise.all([1, 2].map(() => daniel.client.rpc('join_game', { p_booking: game.booking_id })));
  const { count } = await admin
    .from('booking_players')
    .select('user_id', { count: 'exact', head: true })
    .eq('booking_id', game.booking_id)
    .eq('user_id', daniel.id);
  check('Joining a game twice at once takes one spot', joins.every((r) => !r.error) && count === 1, `${joins.map(said).join(' / ')}, ${count} rows`);

  console.log('— limits');
  let day = dates[0];
  for (const d of dates) {
    if (Number((await aisyah.client.rpc('household_booked_hours', { p_date: d })).data) === 0) {
      day = d;
      break;
    }
  }
  const hours = [];
  for (const hour of [9, 10, 11]) hours.push(await aisyah.client.rpc('book_slot', { ...slot, p_date: day, p_hour: hour }));
  check(
    "A household's third hour on one day is refused",
    !hours[0].error && !hours[1].error && refused(hours[2], 'household_limit'),
    hours.map(said).join(' / '),
  );
  check('A wrong check-in code is refused', refused(await aisyah.client.rpc('check_in_event', { p_event: event.id, p_code: 'wrong-code' }), 'bad_code'));
  const posted = await aisyah.client.rpc('create_alert', { p_type: 'stray_dogs', p_severity: 'medium', ...CENTRE });
  const vote = await aisyah.client.rpc('vote_alert', { p_alert: posted.data, p_vote: 'still_there' });
  check('Voting on your own alert is refused', !posted.error && refused(vote, 'own_alert'), `${said(posted)} / ${said(vote)}`);
  check(
    'A resident cannot move a report on',
    refused(await daniel.client.rpc('update_report_status', { p_report: open.id, p_status: 'in_progress' }), 'not_management'),
  );
}

async function main() {
  try {
    await checks();
  } catch (error) {
    failures++;
    console.log(`FAIL  the smoke test stopped: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await seedAll(createAdminClient(), new Date());
    console.log('demo data seeded again');
  }
  console.log(failures === 0 ? 'all checks passed' : `${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
