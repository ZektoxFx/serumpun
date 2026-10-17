import type { SupabaseClient } from '@supabase/supabase-js';
import { mytDate } from '@/lib/domain/time';
import type { People } from './people';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Notices residents sent the Management Office: Aisyah's renovation, already noted with a reply (her My notices shows
 * it), and two still to note on the dashboard.
 */
export function noticeRows(now: Date, people: People) {
  const day = (n: number) => mytDate(new Date(now.getTime() + n * DAY));
  const ago = (hours: number) => new Date(now.getTime() - hours * HOUR).toISOString();
  const base = { township_id: people.townshipId };
  return [
    {
      ...base,
      user_id: people.ids.aisyah,
      kind: 'renovation',
      starts_on: day(3),
      ends_on: day(7),
      details:
        'Kitchen renovation. Drilling and hacking on weekdays, 9 am to 5 pm. The contractor will bring materials and take debris out through the side lane.',
      status: 'noted',
      reply: 'Noted, thank you for telling us. Please keep the work between 9 am and 6 pm and clear any debris from the walkway each day.',
      created_at: ago(50),
      noted_at: ago(26),
    },
    {
      ...base,
      user_id: people.ids.ahmad,
      kind: 'moving',
      starts_on: day(2),
      ends_on: day(2),
      details: 'Moving out. A lorry will park outside the house from 8 am to 12 pm, and movers will be in and out with furniture.',
      status: 'sent',
      reply: null,
      created_at: ago(3),
      noted_at: null,
    },
    {
      ...base,
      user_id: people.ids.siti,
      kind: 'event',
      starts_on: day(5),
      ends_on: day(5),
      details: 'Kenduri at home for about 60 guests, 12 pm to 4 pm. Some cars may park along the road; we will keep the junction clear.',
      status: 'sent',
      reply: null,
      created_at: ago(20),
      noted_at: null,
    },
  ];
}

export async function seedNotices(admin: SupabaseClient, now: Date, people: People): Promise<void> {
  const rows = noticeRows(now, people);
  const { error } = await admin.from('resident_notices').insert(rows);
  if (error) throw new Error(`resident_notices: ${error.message}`);
  console.log(`notices: ${rows.length}`);
}
