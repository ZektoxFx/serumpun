import type { SupabaseClient } from '@supabase/supabase-js';
import { bookableDates, type Sport } from '@/lib/domain/booking';
import { unitOf, type People, type PersonKey } from './people';

const PLACE = 'Elmina Valley Central Park courts';
const CLUBHOUSE = 'Central Park Clubhouse';

/**
 * Spec §8.9's sample courts, side by side in the park (about 3.1788, 101.5149), then the facilities feedback asked for
 * (17 Oct): the clubhouse gym and function room, and a BBQ pit by the lake. Court 1 first: the page opens on it.
 */
const FACILITIES: { key: string; sport: Sport; label: string; place?: string; lat: number; lng: number }[] = [
  { key: 'badminton1', sport: 'badminton', label: 'Badminton Court 1', lat: 3.1788, lng: 101.5149 },
  { key: 'badminton2', sport: 'badminton', label: 'Badminton Court 2', lat: 3.1788, lng: 101.51505 },
  { key: 'futsal', sport: 'futsal', label: 'Futsal Court', lat: 3.17905, lng: 101.5152 },
  { key: 'tennis', sport: 'tennis', label: 'Tennis Court', lat: 3.17855, lng: 101.51535 },
  { key: 'hall', sport: 'hall', label: 'Multipurpose Hall', lat: 3.17915, lng: 101.51465 },
  { key: 'gym', sport: 'gym', label: 'Clubhouse Gym', place: CLUBHOUSE, lat: 3.1795, lng: 101.5143 },
  { key: 'bbq', sport: 'bbq', label: 'Lakeside BBQ Pit', place: 'Central Park lakeside', lat: 3.1781, lng: 101.5158 },
  { key: 'room', sport: 'room', label: 'Function Room', place: CLUBHOUSE, lat: 3.17955, lng: 101.51435 },
];

type SeedBooking = { court?: string; day?: 'tomorrow'; hour: number; who: PersonKey; players?: number; joined?: PersonKey[] };

/**
 * Court 1 on Saturday as the canvas shows it (8, 9 am; 3, 5, 6, 7, 9 pm), with open games: Aisyah's 8 pm needs 2 players
 * and has none yet (Daniel joins in the demo), Ravi's 3 pm and Arif's 9 pm have a spot left. Nurul's futsal game is
 * tomorrow, so Open games still has one once Saturday's are over.
 */
const BOOKINGS: SeedBooking[] = [
  { hour: 8, who: 'jason' },
  { hour: 9, who: 'hafiz' },
  { hour: 15, who: 'ravi', players: 3, joined: ['hafiz', 'jason'] },
  { hour: 17, who: 'weiMing' },
  { hour: 18, who: 'kavitha' },
  { hour: 19, who: 'siti' },
  { hour: 20, who: 'aisyah', players: 2 },
  { hour: 21, who: 'arif', players: 1 },
  { court: 'futsal', day: 'tomorrow', hour: 20, who: 'nurul', players: 4, joined: ['arif', 'ahmad'] },
];
const HOUR = 3_600_000;

/**
 * The courts, the coming Saturday's bookings (today's, on a Saturday), which is always one of the 7 bookable days, one
 * for tomorrow, and who joined the open games (a few hours ago).
 */
export function bookingRows(now: Date, people: People) {
  const ids = Object.fromEntries(FACILITIES.map((f) => [f.key, crypto.randomUUID()]));
  const facilities = FACILITIES.map((f) => ({
    id: ids[f.key],
    township_id: people.townshipId,
    sport: f.sport,
    court_label: f.label,
    place_name: f.place ?? PLACE,
    lat: f.lat,
    lng: f.lng,
  }));
  const dates = bookableDates(now);
  const saturday = dates.find((d) => new Date(`${d}T12:00:00+08:00`).getUTCDay() === 6)!;
  const bookings = BOOKINGS.map((b) => ({
    id: crypto.randomUUID(),
    facility_id: ids[b.court ?? 'badminton1'],
    township_id: people.townshipId,
    user_id: people.ids[b.who],
    unit_no: unitOf(b.who),
    date: b.day === 'tomorrow' ? dates[1] : saturday,
    start_hour: b.hour,
    players_needed: b.players ?? 0,
  }));
  const players = BOOKINGS.flatMap((b, i) =>
    (b.joined ?? []).map((who, j) => ({
      booking_id: bookings[i].id,
      user_id: people.ids[who],
      created_at: new Date(now.getTime() - (5 - j) * HOUR).toISOString(),
    })),
  );
  return { facilities, bookings, players };
}

/** The facilities, the bookings and the players who joined. */
export async function seedBooking(admin: SupabaseClient, now: Date, people: People): Promise<void> {
  const { facilities, bookings, players } = bookingRows(now, people);
  const tables: [string, Record<string, unknown>[]][] = [
    ['facilities', facilities],
    ['bookings', bookings],
    ['booking_players', players],
  ];
  for (const [table, rows] of tables) {
    const { error } = await admin.from(table).insert(rows);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`courts: ${facilities.length} with ${bookings.length} bookings and ${players.length} players`);
}
