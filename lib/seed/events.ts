import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_POINTS, type EventCategory } from '@/lib/domain/events';
import { mytDate } from '@/lib/domain/time';
import type { People, PersonKey } from './people';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** `days` after today in Malaysia, at hh:mm Malaysia time. */
function mytAt(now: Date, days: number, hh: number, mm = 0): Date {
  const [y, m, d] = mytDate(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, hh - 8, mm)); // Malaysia is UTC+8 all year
}

/** The next given weekday (0 Sunday … 6 Saturday) after today in Malaysia, at hh:mm. */
function nextWeekday(now: Date, weekday: number, hh: number, mm = 0): Date {
  const [y, m, d] = mytDate(now).split('-').map(Number);
  const today = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return mytAt(now, (weekday - today + 7) % 7 || 7, hh, mm);
}

type SeedEvent = {
  title: string;
  category: EventCategory;
  place: string;
  by: PersonKey;
  starts: Date;
  hours: number;
  approval: 'none' | 'pending' | 'approved';
  /** The count shown; the neighbours with demo accounts among them get real RSVPs. */
  going: number;
  goingBy?: PersonKey[];
  description?: string;
};

/**
 * The events the demo opens with, and the past ones behind Aisyah's points (10 official × 150 + 5 approved × 100 =
 * 2,000; her two seeded vouchers spend 750, leaving 1,250: ruling R7). One event is on right now, so the check-in QR
 * can be shown live: reseed shortly before a demo.
 */
export function eventRows(now: Date, people: People) {
  const SAT = 6;
  const SUN = 0;
  const upcoming: SeedEvent[] = [
    {
      title: 'Elmina Fun Run 5K', category: 'sports', place: 'Elmina Valley Central Park', by: 'arif',
      starts: nextWeekday(now, SAT, 7), hours: 2, approval: 'approved', going: 214, goingBy: ['aisyah', 'meiLing', 'ahmad', 'jason'],
      description: 'A friendly 5 km loop around the lake, all paces welcome. Water and bananas at the finish line.',
    },
    {
      title: 'Gotong-royong: Central Park clean-up', category: 'official', place: 'Central Park West entrance', by: 'office',
      starts: nextWeekday(now, SUN, 8), hours: 3, approval: 'approved', going: 86, goingBy: ['daniel', 'priya', 'ravi'],
      description: 'Gloves, bags and drinks are provided. Meet at the West entrance.',
    },
    {
      title: 'Toddler playdate', category: 'family', place: 'Central Park playground', by: 'siti',
      starts: nextWeekday(now, SAT, 10), hours: 2, approval: 'none', going: 9, goingBy: ['nurul'],
    },
    {
      title: 'Futsal friendly match', category: 'sports', place: 'Elmina futsal court', by: 'hafiz',
      starts: nextWeekday(now, SUN, 17), hours: 2, approval: 'pending', going: 12, goingBy: ['jason'],
      description: 'Five-a-side, mixed teams. Bring a light and a dark shirt.',
    },
    {
      title: 'Yoga in the park', category: 'sports', place: 'Central Park lawn', by: 'farah',
      // On now: started half an hour ago (to the minute), so check-in is open for the next two and a half hours.
      starts: new Date(Math.floor((now.getTime() - 30 * MINUTE) / MINUTE) * MINUTE), hours: 2, approval: 'approved', going: 18,
      goingBy: ['aisyah', 'kavitha', 'priya'],
      description: 'Gentle flow for all levels. Bring a mat and water.',
    },
    {
      title: 'Recycling drive', category: 'official', place: 'Elmina Green community hall', by: 'office',
      starts: mytAt(now, 9, 9), hours: 3, approval: 'approved', going: 41, goingBy: ['weiMing'],
      description: 'Bring paper, cans, plastic bottles and old electronics. Sorted on the spot.',
    },
    {
      title: 'Tree planting at Elmina Green', category: 'green', place: 'Elmina Green field', by: 'kavitha',
      starts: mytAt(now, 12, 8), hours: 2.5, approval: 'approved', going: 33, goingBy: ['siti'],
    },
    {
      title: 'Family movie night', category: 'family', place: 'Central Park amphitheatre', by: 'priya',
      starts: mytAt(now, 6, 20), hours: 2.5, approval: 'none', going: 25, goingBy: ['meiLing'],
    },
  ];

  const past: [title: string, category: EventCategory, by: PersonKey, daysAgo: number][] = [
    ['Gotong-royong: Elmina Valley clean-up', 'official', 'office', 6],
    ['Elmina Fun Run 5K (September)', 'sports', 'arif', 13],
    ['Tree planting at Elmina Valley 3', 'green', 'kavitha', 20],
    ['Recycling drive (September)', 'official', 'office', 27],
    ['Badminton social night', 'sports', 'jason', 34],
    ['Kids art in the park', 'family', 'priya', 41],
    ['Merdeka family carnival', 'official', 'office', 48],
    ['Night walk for heart health', 'sports', 'farah', 55],
    ['Fire safety talk', 'official', 'office', 62],
    ['Gotong-royong: lake clean-up', 'official', 'office', 75],
    // The 750 her two seeded vouchers cost (lib/seed/rewards.ts), so she still stands at 1,250.
    ['Recycling drive (August)', 'official', 'office', 82],
    ['Gotong-royong: drain clean-up', 'official', 'office', 89],
    ['Community health screening', 'official', 'office', 96],
    ['Earth Hour lantern walk', 'official', 'office', 103],
    ['Hari Raya open house', 'official', 'office', 110],
  ];

  const events = [];
  const rsvps = [];
  const ledger = [];
  const iso = (d: Date) => d.toISOString();

  for (const e of upcoming) {
    const id = crypto.randomUUID();
    const official = e.category === 'official';
    events.push({
      id,
      township_id: people.townshipId,
      title: e.title,
      description: e.description ?? null,
      category: e.category,
      starts_at: iso(e.starts),
      ends_at: iso(new Date(e.starts.getTime() + e.hours * HOUR)),
      location_text: e.place,
      organizer_id: people.ids[e.by],
      is_official: official,
      approval_status: e.approval,
      points: e.approval === 'approved' ? (official ? DEFAULT_POINTS.official : DEFAULT_POINTS.resident) : 0,
      going_count: e.going,
      created_at: iso(new Date(Math.min(e.starts.getTime(), now.getTime()) - 5 * 24 * HOUR)),
    });
    // The organiser of a resident event is going to it, as create_event makes them.
    const goers = new Set<PersonKey>([...(official ? [] : [e.by]), ...(e.goingBy ?? [])]);
    for (const who of goers) rsvps.push({ event_id: id, user_id: people.ids[who], created_at: iso(new Date(now.getTime() - 2 * 24 * HOUR)), checked_in_at: null });
  }

  for (const [title, category, by, daysAgo] of past) {
    const id = crypto.randomUUID();
    const official = category === 'official';
    const starts = mytAt(now, -daysAgo, official ? 8 : 18);
    const checkedIn = new Date(starts.getTime() + 10 * MINUTE);
    const points = official ? DEFAULT_POINTS.official : DEFAULT_POINTS.resident;
    events.push({
      id,
      township_id: people.townshipId,
      title,
      description: null,
      category,
      starts_at: iso(starts),
      ends_at: iso(new Date(starts.getTime() + 2 * HOUR)),
      location_text: official ? 'Central Park West entrance' : 'Elmina Valley Central Park',
      organizer_id: people.ids[by],
      is_official: official,
      approval_status: 'approved',
      points,
      going_count: 40 + ((daysAgo * 7) % 80),
      created_at: iso(new Date(starts.getTime() - 7 * 24 * HOUR)),
    });
    rsvps.push({ event_id: id, user_id: people.ids.aisyah, created_at: iso(new Date(starts.getTime() - 24 * HOUR)), checked_in_at: iso(checkedIn) });
    ledger.push({ user_id: people.ids.aisyah, delta: points, reason: 'event', ref_id: id, created_at: iso(checkedIn) });
  }

  return { events, rsvps, ledger };
}

/** 8 upcoming events (one on now, one waiting for approval) and Aisyah's past check-ins, worth 2,000 points. */
export async function seedEvents(admin: SupabaseClient, now: Date, people: People): Promise<void> {
  const { events, rsvps, ledger } = eventRows(now, people);
  const tables: [string, Record<string, unknown>[]][] = [
    ['events', events],
    ['event_rsvps', rsvps],
    ['points_ledger', ledger],
  ];
  for (const [table, rows] of tables) {
    const { error } = await admin.from(table).insert(rows);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`events: ${events.length} with ${rsvps.length} RSVPs and ${ledger.length} points entries`);
}
