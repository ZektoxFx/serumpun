import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/** The accounts behind the landing page's "Try as" buttons. All four use DEMO_PASSWORD. */
export const DEMO_EMAIL = {
  aisyah: 'aisyah.demo@example.com',
  daniel: 'daniel.demo@example.com',
  nur: 'nur.demo@example.com',
  office: 'office.demo@example.com',
} as const;
export type DemoAccount = keyof typeof DEMO_EMAIL;

const DEMO_EMAILS = new Set<string>(Object.values(DEMO_EMAIL));
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
  nur: { email: DEMO_EMAIL.nur, name: 'Nur Iman', neighbourhood: 'Elmina Green', unit: 'No. 25, Jalan Elmina Green 1/3', status: 'pending', joinedDaysAgo: 1 / 12 }, // 2 hours ago
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
} satisfies Record<string, Person>;

export type PersonKey = keyof typeof PEOPLE;
/** What every feature seeder gets: Elmina's id and each seeded person's user id. */
export type People = { townshipId: string; ids: Record<PersonKey, string> };

/** Every auth user's id by email. Lets a re-run find accounts instead of creating duplicates. */
async function userIdsByEmail(admin: SupabaseClient) {
  const byEmail = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth users: ${error.message}`);
    for (const user of data.users) if (user.email) byEmail.set(user.email, user.id);
    if (data.users.length < 1000) return byEmail;
  }
}

/** Creates (or finds) the townships and the people, and puts their profiles back to the seeded state. */
export async function seedPeople(admin: SupabaseClient, now: Date): Promise<People> {
  const { data: townships, error: townshipError } = await admin
    .from('townships')
    .upsert(TOWNSHIPS, { onConflict: 'slug' })
    .select('id, slug');
  if (townshipError) throw new Error(`townships: ${townshipError.message}`);
  const townshipId: string = townships.find((row) => row.slug === ELMINA)!.id;

  const existing = await userIdsByEmail(admin);
  const people = Object.entries(PEOPLE) as [PersonKey, Person][];
  const ids = {} as Record<PersonKey, string>;
  let created = 0;
  for (const [key, person] of people) {
    let id = existing.get(person.email);
    if (!id) {
      const { data, error } = await admin.auth.admin.createUser({
        email: person.email,
        // Background residents never sign in, so a random password keeps their accounts shut.
        password: DEMO_EMAILS.has(person.email) ? env.demoPassword : crypto.randomUUID(),
        email_confirm: true,
      });
      if (error) throw new Error(`create ${person.email}: ${error.message}`);
      id = data.user.id;
      created++;
    }
    ids[key] = id;
  }

  // Upserts, so a reset also undoes what a demo changed (Nur approved, a name edited).
  const { error: profileError } = await admin.from('profiles').upsert(
    people.map(([key, person]) => ({
      id: ids[key],
      township_id: townshipId,
      full_name: person.name,
      neighbourhood: person.neighbourhood,
      role: person.role ?? 'resident',
      status: person.status,
      created_at: new Date(now.getTime() - person.joinedDaysAgo * DAY).toISOString(),
    })),
  );
  if (profileError) throw new Error(`profiles: ${profileError.message}`);
  const { error: privateError } = await admin
    .from('profile_private')
    .upsert(people.filter(([, person]) => person.unit).map(([key, person]) => ({ id: ids[key], unit_no: person.unit })));
  if (privateError) throw new Error(`profile_private: ${privateError.message}`);

  console.log(`people: ${created} created, ${people.length - created} already there`);
  return { townshipId, ids };
}
