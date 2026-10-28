import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * The accounts behind the landing page's "Try as" buttons. All three use DEMO_PASSWORD. Nur is not one: "Try registering"
 * makes her afresh each time (lib/seed/cards.ts), so the reset deletes stage 1's `nur.demo@example.com` like any visitor's.
 */
export const DEMO_EMAIL = {
  aisyah: 'aisyah.demo@example.com',
  daniel: 'daniel.demo@example.com',
  office: 'office.demo@example.com',
} as const;
export type DemoAccount = keyof typeof DEMO_EMAIL;

const ELMINA = 'city-of-elmina';
const DAY = 86_400_000;

// Spec §6. Only Elmina is live; the other centres are approximate and unused until a township goes live.
const TOWNSHIPS = [
  { slug: ELMINA, name: 'City of Elmina', centre_lat: 3.1797, centre_lng: 101.5156, active: true },
  { slug: 'bandar-bukit-raja', name: 'Bandar Bukit Raja', centre_lat: 3.0905, centre_lng: 101.4426, active: false },
  { slug: 'serenia-city', name: 'Serenia City', centre_lat: 2.8653, centre_lng: 101.683, active: false },
  { slug: 'ara-damansara', name: 'Ara Damansara', centre_lat: 3.116, centre_lng: 101.583, active: false },
  { slug: 'bukit-jelutong', name: 'Bukit Jelutong', centre_lat: 3.099, centre_lng: 101.532, active: false },
  { slug: 'nilai-impian', name: 'Nilai Impian', centre_lat: 2.824, centre_lng: 101.801, active: false },
  { slug: 'bandar-ainsdale', name: 'Bandar Ainsdale', centre_lat: 2.684, centre_lng: 101.913, active: false },
  { slug: 'putra-heights', name: 'Putra Heights', centre_lat: 2.999, centre_lng: 101.574, active: false },
];

type Person = {
  email: string;
  name: string;
  neighbourhood: string;
  unit: string | null; // null: no home in the township (the Management Office)
  status: 'verified' | 'pending';
  role?: 'management';
  joinedDaysAgo: number;
};

const PEOPLE = {
  aisyah: { email: DEMO_EMAIL.aisyah, name: 'Aisyah Rahman', neighbourhood: 'Elmina Valley 3', unit: 'No. 18, Jalan Elmina Valley 3/2', status: 'verified', joinedDaysAgo: 420 },
  daniel: { email: DEMO_EMAIL.daniel, name: 'Daniel Tan', neighbourhood: 'Elmina Valley 3', unit: 'No. 7, Jalan Elmina Valley 3/4', status: 'verified', joinedDaysAgo: 380 },
  office: { email: DEMO_EMAIL.office, name: 'Puan Rozita', neighbourhood: 'City of Elmina', unit: null, status: 'verified', role: 'management', joinedDaysAgo: 900 },
  meiLing: { email: 'meiling.tan@example.com', name: 'Mei Ling Tan', neighbourhood: 'Elmina Valley 3', unit: 'No. 4, Jalan Elmina Valley 3/1', status: 'verified', joinedDaysAgo: 610 },
  priya: { email: 'priya.raman@example.com', name: 'Priya Raman', neighbourhood: 'Elmina Gardens', unit: 'No. 12, Jalan Elmina Gardens 2/5', status: 'verified', joinedDaysAgo: 540 },
  ahmad: { email: 'ahmad.hakim@example.com', name: 'Ahmad Hakim', neighbourhood: 'Elmina Valley 3', unit: 'No. 31, Jalan Elmina Valley 3/3', status: 'verified', joinedDaysAgo: 500 },
  ravi: { email: 'ravi.kumar@example.com', name: 'Ravi Kumar', neighbourhood: 'Elmina Green', unit: 'No. 9, Jalan Elmina Green 2/2', status: 'verified', joinedDaysAgo: 470 },
  farah: { email: 'cikgu.farah@example.com', name: 'Cikgu Farah', neighbourhood: 'Elmina Valley 3', unit: 'No. 22, Jalan Elmina Valley 3/2', status: 'verified', joinedDaysAgo: 450 },
  weiMing: { email: 'weiming.tan@example.com', name: 'Tan Wei Ming', neighbourhood: 'Elmina Gardens', unit: 'No. 15, Jalan Elmina Gardens 1/4', status: 'verified', joinedDaysAgo: 330 },
  siti: { email: 'siti.aminah@example.com', name: 'Siti Aminah', neighbourhood: 'Elmina Green', unit: 'No. 6, Jalan Elmina Green 1/1', status: 'verified', joinedDaysAgo: 300 },
  hafiz: { email: 'hafiz.rahman@example.com', name: 'Hafiz Rahman', neighbourhood: 'Elmina Valley 2', unit: 'No. 27, Jalan Elmina Valley 2/6', status: 'verified', joinedDaysAgo: 260 },
  kavitha: { email: 'kavitha.nair@example.com', name: 'Kavitha Nair', neighbourhood: 'Elmina Gardens', unit: 'No. 3, Jalan Elmina Gardens 3/1', status: 'verified', joinedDaysAgo: 210 },
  jason: { email: 'jason.lee@example.com', name: 'Jason Lee', neighbourhood: 'Elmina Green', unit: 'No. 19, Jalan Elmina Green 3/2', status: 'verified', joinedDaysAgo: 150 },
  nurul: { email: 'nurul.huda@example.com', name: 'Nurul Huda', neighbourhood: 'Elmina Valley 2', unit: 'No. 11, Jalan Elmina Valley 2/3', status: 'verified', joinedDaysAgo: 90 },
  arif: { email: 'arif.iskandar@example.com', name: 'Arif Iskandar', neighbourhood: 'Elmina Valley 3', unit: 'No. 40, Jalan Elmina Valley 3/5', status: 'verified', joinedDaysAgo: 40 },
  // The Co-owner and the child on Aisyah's household card, at the same home.
  imran: { email: 'imran.yusof@example.com', name: 'Imran Yusof', neighbourhood: 'Elmina Valley 3', unit: 'No. 18, Jalan Elmina Valley 3/2', status: 'verified', joinedDaysAgo: 400 },
  sara: { email: 'sara.imran@example.com', name: 'Sara Imran', neighbourhood: 'Elmina Valley 3', unit: 'No. 18, Jalan Elmina Valley 3/2', status: 'verified', joinedDaysAgo: 380 },
} satisfies Record<string, Person>;

export type PersonKey = keyof typeof PEOPLE;
/** What every feature seeder gets: Elmina's id and each seeded person's user id. */
export type People = { townshipId: string; ids: Record<PersonKey, string> };
/** Everyone seeded with their details, in the order of PEOPLE: a household's first person comes first. */
export const ROSTER = Object.entries(PEOPLE) as [PersonKey, Person][];

/** A seeded person's unit (null for the Management Office), for rows that copy it: a court booking's household. */
export const unitOf = (key: PersonKey) => PEOPLE[key].unit;

/**
 * Existing auth users by email, plus the demo accounts by the key stamped in their app_metadata (which users cannot
 * edit), so a demo account is still found after a visitor changed its email. Lets a re-run reuse accounts.
 */
async function existingUsers(admin: SupabaseClient) {
  const all: User[] = [];
  const byEmail = new Map<string, User>();
  const byDemoKey = new Map<string, User>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth users: ${error.message}`);
    for (const user of data.users) {
      all.push(user);
      if (user.email) byEmail.set(user.email, user);
      if (typeof user.app_metadata.demo === 'string') byDemoKey.set(user.app_metadata.demo, user);
    }
    if (data.users.length < 1000) return { all, byEmail, byDemoKey };
  }
}

/**
 * Whether the demo password still opens this account: a test sign-in, signed straight back out. Only a wrong password
 * says no; a rate limit or an outage throws, so a hiccup never resets the password (which would end every session).
 */
async function demoPasswordWorks(email: string) {
  const probe = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password: env.demoPassword });
  if (error?.code === 'invalid_credentials') return false;
  if (error) throw new Error(`check ${email}: ${error.message}`);
  const { error: outError } = await probe.auth.signOut({ scope: 'local' });
  if (outError) throw new Error(`sign ${email} back out: ${outError.message}`);
  return true;
}

/**
 * Every visitor who taps "Try as …" holds a real session on a shared account, so one Auth API call could change its
 * password or email and lock everyone else out. Put both back. Setting a password ends every session of the account
 * (tested), so it only happens when the demo password no longer works.
 */
async function restoreDemoLogin(admin: SupabaseClient, key: DemoAccount, user: User) {
  const email = DEMO_EMAIL[key];
  const emailChanged = user.email !== email;
  const passwordBroken = emailChanged || !(await demoPasswordWorks(email));
  const unmarked = user.app_metadata.demo !== key;
  if (!emailChanged && !passwordBroken && !unmarked) return;
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: true,
    app_metadata: { demo: key },
    ...(passwordBroken ? { password: env.demoPassword } : {}),
  });
  if (error) throw new Error(`restore ${email}: ${error.message}`);
  const what = [emailChanged && 'email', passwordBroken && 'password', unmarked && 'demo marker'].filter(Boolean);
  console.log(`restored ${email}: ${what.join(', ')}`);
}

const demoKeyOf = (key: PersonKey) => (Object.hasOwn(DEMO_EMAIL, key) ? (key as DemoAccount) : null);

/** Every auth user, and the account of each seeded person who has one: a demo account by its marker, anyone by email. */
async function findAccounts(admin: SupabaseClient) {
  const existing = await existingUsers(admin);
  const found = new Map(
    ROSTER.map(([key, person]) => [key, (demoKeyOf(key) && existing.byDemoKey.get(demoKeyOf(key)!)) || existing.byEmail.get(person.email)]),
  );
  return { all: existing.all, found };
}

async function createAccount(admin: SupabaseClient, key: PersonKey, person: Person) {
  const demoKey = demoKeyOf(key);
  const { data, error } = await admin.auth.admin.createUser({
    email: person.email,
    // Background residents never sign in, so a random password keeps their accounts shut.
    password: demoKey ? env.demoPassword : crypto.randomUUID(),
    email_confirm: true,
    app_metadata: demoKey ? { demo: demoKey } : {},
  });
  if (error) throw new Error(`create ${person.email}: ${error.message}`);
  return data.user.id;
}

/**
 * Everyone's profile, and the unit of those who have a home. 'rewrite' puts each back to the seeded state, so a reset also
 * undoes what a demo changed (a name or language edited); 'keep' adds only the missing ones.
 */
async function saveProfiles(admin: SupabaseClient, townshipId: string, ids: Record<PersonKey, string>, now: Date, onExisting: 'keep' | 'rewrite') {
  const options = { ignoreDuplicates: onExisting === 'keep' };
  const { error: profileError } = await admin.from('profiles').upsert(
    ROSTER.map(([key, person]) => ({
      id: ids[key],
      township_id: townshipId,
      full_name: person.name,
      neighbourhood: person.neighbourhood,
      role: person.role ?? 'resident',
      status: person.status,
      lang: 'en',
      favourites: null, // Home's default favourites again
      created_at: new Date(now.getTime() - person.joinedDaysAgo * DAY).toISOString(),
    })),
    options,
  );
  if (profileError) throw new Error(`profiles: ${profileError.message}`);
  const { error: privateError } = await admin
    .from('profile_private')
    .upsert(ROSTER.filter(([, person]) => person.unit).map(([key, person]) => ({ id: ids[key], unit_no: person.unit })), options);
  if (privateError) throw new Error(`profile_private: ${privateError.message}`);
}

/** Creates (or finds) the townships and the people, and puts their profiles back to the seeded state. */
export async function seedPeople(admin: SupabaseClient, now: Date): Promise<People> {
  const { data: townships, error: townshipError } = await admin
    .from('townships')
    .upsert(TOWNSHIPS, { onConflict: 'slug' })
    .select('id, slug');
  if (townshipError) throw new Error(`townships: ${townshipError.message}`);
  const townshipId: string = townships.find((row) => row.slug === ELMINA)!.id;

  const { all, found } = await findAccounts(admin);

  // Every other account is a visitor's: a registration (even a `resident-…` one whose clean-up failed and left no profile)
  // or stage 1's Nur. On the public demo anyone can open the Management Office, so a reset must not leave their names and
  // house numbers readable there (Task 3 ruling). Deleting the auth user removes the profile with it. Going first also
  // frees a demo email a visitor took, before restoreDemoLogin puts it back.
  const keep = new Set([...found.values()].map((user) => user?.id));
  let removed = 0;
  for (const user of all.filter((u) => !keep.has(u.id))) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`delete a visitor account: ${error.message}`);
    removed++;
  }

  const ids = {} as Record<PersonKey, string>;
  let created = 0;
  for (const [key, person] of ROSTER) {
    const demoKey = demoKeyOf(key);
    const user = found.get(key);
    if (user) {
      ids[key] = user.id;
      if (demoKey) await restoreDemoLogin(admin, demoKey, user);
      continue;
    }
    ids[key] = await createAccount(admin, key, person);
    created++;
  }

  await saveProfiles(admin, townshipId, ids, now, 'rewrite');
  // Pay parking: Aisyah's car is saved, so the demo is one tap.
  const { error: carError } = await admin.from('vehicles').insert({ user_id: ids.aisyah, plate: 'WXY 1234' });
  if (carError) throw new Error(`vehicles: ${carError.message}`);

  console.log(`people: ${created} created, ${ROSTER.length - created} already there, ${removed} visitor accounts deleted`);
  return { townshipId, ids };
}

/**
 * Finds each person's account and makes the missing ones, with their profile and unit (scripts/seed-cards.ts). Unlike
 * seedPeople it deletes no account and rewrites no profile, so it is safe on the shared live database between resets.
 */
export async function ensurePeople(admin: SupabaseClient, now: Date): Promise<People> {
  const { data: township, error: townshipError } = await admin.from('townships').select('id').eq('slug', ELMINA).single();
  if (townshipError) throw new Error(`township ${ELMINA}: ${townshipError.message}`);
  const { found } = await findAccounts(admin);

  const ids = {} as Record<PersonKey, string>;
  let created = 0;
  for (const [key, person] of ROSTER) {
    const user = found.get(key);
    if (user) {
      ids[key] = user.id;
      continue;
    }
    ids[key] = await createAccount(admin, key, person);
    created++;
  }

  // Also covers an account that an interrupted run made before its profile.
  await saveProfiles(admin, township.id, ids, now, 'keep');
  console.log(`people: ${created} created, ${ROSTER.length - created} already there`);
  return { townshipId: township.id, ids };
}
