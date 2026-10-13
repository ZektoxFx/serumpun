import type { SupabaseClient } from '@supabase/supabase-js';
import { seedPeople, type People } from './people';

/** A feature seeder. Later tasks add theirs to `seeders`; each runs after the people exist, in list order. */
export type Seeder = (admin: SupabaseClient, now: Date, people: People) => Promise<void>;

const seeders: Seeder[] = [];

/**
 * Rebuilds the demo: empties every feature table, restores the people, then runs each feature seeder.
 * `admin` must be the service-role client. Times are relative to `now`, so the demo always looks fresh.
 */
export async function seedAll(admin: SupabaseClient, now: Date): Promise<void> {
  const { error } = await admin.rpc('wipe_demo_data');
  if (error) throw new Error(`wipe_demo_data: ${error.message}`);
  const people = await seedPeople(admin, now);
  for (const seed of seeders) await seed(admin, now, people);
}
