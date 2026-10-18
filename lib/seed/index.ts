import type { SupabaseClient } from '@supabase/supabase-js';
import { seedAlerts } from './alerts';
import { seedBooking } from './booking';
import { seedCommunity } from './community';
import { seedEvents } from './events';
import { seedMessages } from './messages';
import { seedNotices } from './notices';
import { seedPeople, type People } from './people';
import { seedReports } from './reports';
import { seedRewards } from './rewards';
import { seedTopics } from './topics';

/** A feature seeder. Later tasks add theirs to `seeders`; each runs after the people exist, in list order. */
export type Seeder = (admin: SupabaseClient, now: Date, people: People) => Promise<void>;

// seedCommunity after seedEvents: it pins some of the events in their groups. seedMessages after seedCommunity: a
// conversation is about Priya's stroller post. seedTopics after seedCommunity (General chat) and seedAlerts (the
// announcement it copies into Announcements).
const seeders: Seeder[] = [seedAlerts, seedReports, seedEvents, seedRewards, seedCommunity, seedTopics, seedMessages, seedBooking, seedNotices];

/**
 * Every uploaded photo goes with the reports and alerts that held them (the seed has none). Public photos sit at the root
 * of `photos`; private ones in their uploader's folder of `private-photos`.
 */
async function emptyPhotoBuckets(admin: SupabaseClient) {
  for (const bucket of ['photos', 'private-photos']) {
    const store = admin.storage.from(bucket);
    // shortcut: up to 1000 entries per folder per reset; page through them if a demo ever collects more.
    const { data: top, error } = await store.list('', { limit: 1000 });
    if (error) throw new Error(`${bucket}: ${error.message}`);
    const paths: string[] = [];
    for (const item of top) {
      if (item.id) {
        paths.push(item.name); // a file
        continue;
      }
      const { data: inside, error: folderError } = await store.list(item.name, { limit: 1000 });
      if (folderError) throw new Error(`${bucket}/${item.name}: ${folderError.message}`);
      paths.push(...inside.map((file) => `${item.name}/${file.name}`));
    }
    if (paths.length === 0) continue;
    const { error: removeError } = await store.remove(paths);
    if (removeError) throw new Error(`${bucket}: ${removeError.message}`);
    console.log(`${bucket}: ${paths.length} photos removed`);
  }
}

/**
 * Rebuilds the demo: empties every feature table and both photo buckets, restores the people (deleting visitors'
 * accounts), then runs each feature seeder. `admin` must be the service-role client. Times are relative to `now`, so
 * the demo always looks fresh. The dashboard's "Reset demo data" runs this too.
 */
export async function seedAll(admin: SupabaseClient, now: Date): Promise<void> {
  const { error } = await admin.rpc('wipe_demo_data');
  if (error) throw new Error(`wipe_demo_data: ${error.message}`);
  await emptyPhotoBuckets(admin);
  const people = await seedPeople(admin, now);
  for (const seed of seeders) await seed(admin, now, people);
}
