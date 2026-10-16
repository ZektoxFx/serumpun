import {
  HOUSEHOLD_DAILY_HOURS,
  bookableDates,
  bookingErrorKey,
  canCancel,
  householdHoursLeft,
  slotStartUtc,
  slotStates,
  spotsLeft,
  toIcs,
} from '@/lib/domain/booking';
import { t } from '@/lib/i18n';
import { bookingRows } from '@/lib/seed/booking';
import { unitOf, type People } from '@/lib/seed/people';

describe('days and slots, in Malaysia time', () => {
  it('7 bookable dates starting today in MYT', () => {
    expect(bookableDates(new Date('2026-10-12T16:30:00Z'))).toEqual([
      '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19',
    ]);
  });
  it('turns the day over at midnight in Malaysia, which is 4 pm UTC', () => {
    expect(bookableDates(new Date('2026-10-12T15:59:59Z'))[0]).toBe('2026-10-12');
    expect(bookableDates(new Date('2026-10-12T16:00:00Z'))[0]).toBe('2026-10-13');
  });
  it('slots from 7 to 22, past and booked marked', () => {
    const s = slotStates('2026-10-13', [8], new Date('2026-10-13T01:30:00Z')); // 09:30 MYT
    expect(s).toHaveLength(16);
    expect(s[0]).toEqual({ hour: 7, state: 'past' });
    expect(s[1].state).toBe('past');
    expect(s[2]).toEqual({ hour: 9, state: 'past' });
    expect(s[3]).toEqual({ hour: 10, state: 'available' });
    expect(s.at(-1)).toEqual({ hour: 22, state: 'available' });
  });
  it('booked beats available', () => {
    expect(slotStates('2026-10-17', [20], new Date('2026-10-13T01:30:00Z')).find((x) => x.hour === 20)?.state).toBe('booked');
  });
  it('closes the whole day once its last slot (10 pm) has started', () => {
    expect(slotStates('2026-10-13', [], new Date('2026-10-13T14:00:00Z')).every((s) => s.state === 'past')).toBe(true);
  });
  it('slot start converts MYT to UTC', () => {
    expect(slotStartUtc('2026-10-17', 20).toISOString()).toBe('2026-10-17T12:00:00.000Z');
    expect(slotStartUtc('2026-10-17', 7).toISOString()).toBe('2026-10-16T23:00:00.000Z');
  });
});

describe('the rules', () => {
  it('cancel needs 2 hours notice', () => {
    expect(canCancel('2026-10-17', 20, new Date('2026-10-17T10:00:00Z'))).toBe(true);
    expect(canCancel('2026-10-17', 20, new Date('2026-10-17T10:00:01Z'))).toBe(false);
  });
  it('a household books up to 2 hours a day', () => {
    expect(HOUSEHOLD_DAILY_HOURS).toBe(2);
    expect([0, 1, 2, 3].map(householdHoursLeft)).toEqual([2, 1, 0, 0]);
  });
  it('counts the spots a game has left, never below none', () => {
    expect(spotsLeft(2, 1)).toBe(1);
    expect(spotsLeft(2, 3)).toBe(0);
    expect(spotsLeft(2, 0)).toBe(2);
  });
  it('names every booking and game error in both languages', () => {
    const codes = [
      'not_verified', 'not_found', 'bad_date', 'bad_slot', 'bad_players', 'slot_started', 'slot_taken', 'household_limit',
      'no_unit', 'too_late', 'own_game', 'game_full', 'game_started',
    ];
    for (const code of codes) {
      const key = bookingErrorKey(code);
      expect(key, code).not.toBe('common.error');
      expect(t('ms', key)).not.toBe(t('en', key));
    }
    expect(bookingErrorKey('__proto__')).toBe('common.error');
  });
});

describe('the calendar file', () => {
  const booking = { title: 'Badminton Court 1', location: 'Elmina Valley Central Park courts', date: '2026-10-17', hour: 20, uid: 'b1' };
  it('ics has UTC start and end', () => {
    const ics = toIcs(booking);
    expect(ics).toContain('DTSTART:20261017T120000Z');
    expect(ics).toContain('DTEND:20261017T130000Z');
  });
  it('is one event in CRLF lines, with its text escaped', () => {
    const lines = toIcs({ ...booking, title: 'Court 1, side; A', location: 'Park\\courts' }).split('\r\n');
    expect(lines).toEqual(
      expect.arrayContaining([
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:b1@serumpun', 'SUMMARY:Court 1\\, side\\; A',
        'LOCATION:Park\\\\courts', 'END:VEVENT', 'END:VCALENDAR',
      ]),
    );
  });
});

describe('the seeded courts', () => {
  const now = new Date('2026-10-13T02:00:00Z'); // Tue 13 Oct, 10 am in Malaysia
  const people = { townshipId: 'elmina', ids: new Proxy({}, { get: (_, key) => String(key) }) } as People;
  const { facilities, bookings, players } = bookingRows(now, people);

  it('are the five courts of Elmina Valley Central Park', () => {
    expect(facilities.map((f) => [f.sport, f.court_label])).toEqual([
      ['badminton', 'Badminton Court 1'],
      ['badminton', 'Badminton Court 2'],
      ['futsal', 'Futsal Court'],
      ['tennis', 'Tennis Court'],
      ['hall', 'Multipurpose Hall'],
    ]);
    expect(new Set(facilities.map((f) => f.place_name))).toEqual(new Set(['Elmina Valley Central Park courts']));
  });

  it("fill Saturday on Court 1 as the canvas does, with Aisyah's 8 pm game needing 2 players", () => {
    const saturday = bookings.filter((b) => b.facility_id === facilities[0].id && b.date === '2026-10-17');
    expect(saturday.map((b) => b.start_hour).sort((a, b) => a - b)).toEqual([8, 9, 15, 17, 18, 19, 20, 21]);
    expect(saturday.find((b) => b.user_id === 'aisyah')).toMatchObject({ start_hour: 20, players_needed: 2 });
  });

  it('keep the rules book_slot keeps', () => {
    expect(new Set(bookings.map((b) => `${b.facility_id} ${b.date} ${b.start_hour}`)).size).toBe(bookings.length);
    const perHouseholdDay = new Map<string, number>();
    for (const b of bookings) {
      expect(b.unit_no, b.user_id).toBeTruthy();
      expect(bookableDates(now)).toContain(b.date);
      perHouseholdDay.set(`${b.unit_no} ${b.date}`, (perHouseholdDay.get(`${b.unit_no} ${b.date}`) ?? 0) + 1);
    }
    expect(Math.max(...perHouseholdDay.values())).toBeLessThanOrEqual(HOUSEHOLD_DAILY_HOURS);
  });

  it('leave Daniel a household of his own, and Sunday free for Aisyah', () => {
    expect(unitOf('daniel')).not.toBe(unitOf('aisyah'));
    expect(bookings.some((b) => b.user_id === 'aisyah' && b.date === '2026-10-18')).toBe(false);
  });

  it('have open games with a spot left, joined by neighbours other than their host, and one tomorrow', () => {
    const games = bookings.filter((b) => b.players_needed > 0);
    expect(games.length).toBeGreaterThanOrEqual(3);
    for (const game of games) {
      const joined = players.filter((p) => p.booking_id === game.id).map((p) => p.user_id);
      expect(joined.length, game.user_id).toBeLessThan(game.players_needed);
      expect(joined).not.toContain(game.user_id);
    }
    expect(players.length).toBeGreaterThan(0);
    expect(players.every((p) => games.some((g) => g.id === p.booking_id))).toBe(true);
    // Daniel joins Aisyah's game in the demo (canvas: "1 spot left · Daniel joined"), so nobody has yet.
    expect(players.filter((p) => p.booking_id === games.find((g) => g.user_id === 'aisyah')?.id)).toEqual([]);
    expect(players.some((p) => p.user_id === 'daniel')).toBe(false);
    // A game on another day still shows when Saturday's are over.
    expect(games.some((g) => g.date === '2026-10-14')).toBe(true);
  });
});
