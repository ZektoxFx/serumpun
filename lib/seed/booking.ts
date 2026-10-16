import type { SupabaseClient } from '@supabase/supabase-js';
import { bookableDates, type Sport } from '@/lib/domain/booking';
import { unitOf, type People, type PersonKey } from './people';

const PLACE = 'Elmina Valley Central Park courts';

/** Spec §8.9's sample courts, side by side in the park (about 3.1788, 101.5149). Court 1 first: the page opens on it. */
const FACILITIES: { key: string; sport: Sport; label: string; lat: number; lng: number }[] = [
  { key: 'badminton1', sport: 'badminton', label: 'Badminton Court 1', lat: 3.1788, lng: 101.5149 },
  { key: 'badminton2', sport: 'badminton', label: 'Badminton Court 2', lat: 3.1788, lng: 101.51505 },
  { key: 'futsal', sport: 'futsal', label: 'Futsal Court', lat: 3.17905, lng: 101.5152 },
  { key: 'tennis', sport: 'tennis', label: 'Tennis Court', lat: 3.17855, lng: 101.51535 },
  { key: 'hall', sport: 'hall', label: 'Multipurpose Hall', lat: 3.17915, lng: 101.51465 },
];

/** Court 1 on Saturday as the canvas shows it (8, 9 am; 3, 5, 6, 7, 9 pm), and Aisyah's 8 pm game that needs 2 players. */
const SATURDAY: { hour: number; who: PersonKey; players?: number }[] = [
  { hour: 8, who: 'jason' },
  { hour: 9, who: 'hafiz' },
  { hour: 15, who: 'ravi' },
  { hour: 17, who: 'weiMing' },
  { hour: 18, who: 'kavitha' },
  { hour: 19, who: 'siti' },
  { hour: 20, who: 'aisyah', players: 2 },
  { hour: 21, who: 'arif' },
];

/** The courts, and the coming Saturday's bookings (today's, on a Saturday), which is always one of the 7 bookable days. */
export function bookingRows(now: Date, people: People) {
  const ids = Object.fromEntries(FACILITIES.map((f) => [f.key, crypto.randomUUID()]));
  const facilities = FACILITIES.map((f) => ({
    id: ids[f.key],
    township_id: people.townshipId,
    sport: f.sport,
    court_label: f.label,
    place_name: PLACE,
    lat: f.lat,
    lng: f.lng,
  }));
  const saturday = bookableDates(now).find((d) => new Date(`${d}T12:00:00+08:00`).getUTCDay() === 6)!;
  const bookings = SATURDAY.map((b) => ({
    facility_id: ids.badminton1,
    township_id: people.townshipId,
    user_id: people.ids[b.who],
    unit_no: unitOf(b.who),
    date: saturday,
    start_hour: b.hour,
    players_needed: b.players ?? 0,
  }));
  return { facilities, bookings };
}

/** The five courts and Saturday's bookings on Court 1. */
export async function seedBooking(admin: SupabaseClient, now: Date, people: People): Promise<void> {
  const { facilities, bookings } = bookingRows(now, people);
  const tables: [string, Record<string, unknown>[]][] = [
    ['facilities', facilities],
    ['bookings', bookings],
  ];
  for (const [table, rows] of tables) {
    const { error } = await admin.from(table).insert(rows);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`courts: ${facilities.length} with ${bookings.length} bookings`);
}
