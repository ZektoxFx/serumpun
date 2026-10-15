import {
  CHECKIN_AFTER_MS,
  CHECKIN_BEFORE_MS,
  DEFAULT_POINTS,
  EVENT_CATEGORIES,
  checkinErrorKey,
  eventDateParts,
  eventErrorKey,
  eventTime,
  isWithinCheckinWindow,
  mytDateTime,
} from '@/lib/domain/events';
import { t } from '@/lib/i18n';
import { eventRows } from '@/lib/seed/events';
import type { People } from '@/lib/seed/people';

const start = new Date('2026-10-16T23:00:00Z'); // Sat 17 Oct 07:00 MYT

describe('the check-in window', () => {
  it('opens 1 h before', () => {
    expect(isWithinCheckinWindow(start, new Date('2026-10-16T22:00:00Z'))).toBe(true);
    expect(isWithinCheckinWindow(start, new Date('2026-10-16T21:59:59Z'))).toBe(false);
  });
  it('closes 3 h after', () => {
    expect(isWithinCheckinWindow(start, new Date('2026-10-17T02:00:00Z'))).toBe(true);
    expect(isWithinCheckinWindow(start, new Date('2026-10-17T02:00:01Z'))).toBe(false);
  });
  it('is the same 1 h / 3 h as the database (0005_events_points.sql)', () => {
    expect([CHECKIN_BEFORE_MS, CHECKIN_AFTER_MS]).toEqual([3_600_000, 10_800_000]);
  });
});

it('maps RPC errors to messages', () => {
  expect(checkinErrorKey('already_checked_in')).toBe('checkin.error.already');
});

it('names every check-in and event error in both languages, and nothing else', () => {
  for (const code of ['not_verified', 'bad_code', 'not_approved', 'outside_window', 'already_checked_in']) {
    const key = checkinErrorKey(code);
    expect(key, code).not.toBe('common.error');
    expect(t('ms', key)).not.toBe(t('en', key));
  }
  const eventCodes = [
    'not_verified', 'bad_category', 'bad_title', 'bad_place', 'bad_time', 'not_found', 'event_over', 'checked_in',
    'not_organizer', 'not_pending', 'bad_points', 'not_management', 'not_allowed',
  ];
  for (const code of eventCodes) {
    const key = eventErrorKey(code);
    expect(key, code).not.toBe('common.error');
    expect(t('ms', key)).not.toBe(t('en', key));
  }
  for (const unknown of ['__proto__', 'duplicate key value', undefined]) {
    expect(checkinErrorKey(unknown)).toBe('common.error');
    expect(eventErrorKey(unknown)).toBe('common.error');
  }
});

it('gives official events 150 points and approved resident events 100', () => {
  expect(DEFAULT_POINTS).toEqual({ official: 150, resident: 100 });
});

it('names every category in both languages', () => {
  for (const category of EVENT_CATEGORIES) {
    expect(t('en', `event.category.${category}`)).not.toBe(`event.category.${category}`);
    expect(t('ms', `event.category.${category}`)).not.toBe(t('en', `event.category.${category}`));
  }
});

describe('times typed into the event form', () => {
  it('are Malaysian times', () => {
    expect(mytDateTime('2026-10-17', '07:00')?.toISOString()).toBe('2026-10-16T23:00:00.000Z');
    expect(mytDateTime('2026-10-17', '23:30')?.toISOString()).toBe('2026-10-17T15:30:00.000Z');
  });
  it('must be real dates and times', () => {
    for (const [date, time] of [['2026-02-31', '07:00'], ['2026-10-17', '24:00'], ['17/10/2026', '07:00'], ['2026-10-17', '7am'], ['', '']]) {
      expect(mytDateTime(date, time), `${date} ${time}`).toBeNull();
    }
  });
});

describe('seeded events', () => {
  const people = { townshipId: 'elmina', ids: new Proxy({}, { get: (_, key) => String(key) }) } as People;
  // A Thursday afternoon in Malaysia, and the last minutes of a Saturday (the next Saturday is a week away).
  it.each(['2026-10-15T06:00:00Z', '2026-10-17T15:50:00Z'])('make a demo that works at any time (now = %s)', (iso) => {
    const now = new Date(iso);
    const { events, rsvps, ledger } = eventRows(now, people);
    const upcoming = events.filter((e) => Date.parse(e.ends_at) > now.getTime());
    expect(upcoming).toHaveLength(8);
    expect(upcoming.filter((e) => e.approval_status === 'pending')).toHaveLength(1);
    // The one on now can be checked in to, and it has points.
    const live = upcoming.filter((e) => Date.parse(e.starts_at) <= now.getTime());
    expect(live).toHaveLength(1);
    expect(isWithinCheckinWindow(new Date(live[0].starts_at), now)).toBe(true);
    expect(live[0].points).toBe(DEFAULT_POINTS.resident);
    // Aisyah: 1,250 points (ruling R7), each from an event she checked in to; going to two upcoming events.
    expect(ledger.filter((l) => l.user_id === 'aisyah').reduce((sum, l) => sum + l.delta, 0)).toBe(1250);
    for (const l of ledger) expect(rsvps.some((r) => r.event_id === l.ref_id && r.user_id === l.user_id && r.checked_in_at)).toBe(true);
    expect(rsvps.filter((r) => r.user_id === 'aisyah' && upcoming.some((e) => e.id === r.event_id))).toHaveLength(2);
    // What the table allows (0005_events_points.sql).
    for (const e of events) {
      expect(Date.parse(e.ends_at)).toBeGreaterThan(Date.parse(e.starts_at));
      expect(e.is_official).toBe(e.category === 'official');
      expect(e.points === 0 || e.approval_status === 'approved').toBe(true);
      if (e.is_official) expect(e.points).toBe(DEFAULT_POINTS.official);
    }
  });
});

it('shows the date block and the time in Malaysia, not UTC', () => {
  // 16 Oct 23:00 UTC is already Saturday 17 Oct in Malaysia.
  expect(eventDateParts(start, 'en')).toEqual({ weekday: 'SAT', day: '17', month: 'OCT' });
  expect(eventDateParts(start, 'ms')).toEqual({ weekday: 'SAB', day: '17', month: 'OKT' });
  expect(eventTime(start, 'en')).toBe('7:00 am');
});
