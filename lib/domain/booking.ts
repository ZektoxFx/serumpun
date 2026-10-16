import type { Lang, MessageKey } from '@/lib/i18n';
import { intlLocale } from './events';
import { TZ, mytDate } from './time';

// supabase/migrations/0011_booking.sql keeps the same sports, hours, days and household limit.

export const SPORTS = ['badminton', 'futsal', 'tennis', 'hall'] as const;
export type Sport = (typeof SPORTS)[number];
export const SPORT_ICON: Record<Sport, string> = { badminton: '🏸', futsal: '⚽', tennis: '🎾', hall: '🏛️' };

/** Spec §8.9: 1-hour slots from 7 am, the last starting at 10 pm; up to 7 days ahead; 2 hours a day per household. */
export const OPEN_HOUR = 7;
export const LAST_START_HOUR = 22;
export const DAYS_AHEAD = 7;
export const HOUSEHOLD_DAILY_HOURS = 2;

const HOUR_MS = 3_600_000;
/** Free cancellation ends this long before the start. */
const CANCEL_NOTICE_MS = 2 * HOUR_MS;

/** A court, as residents read it. */
export type Facility = { id: string; sport: Sport; court_label: string; place_name: string; lat: number; lng: number };
export const FACILITY_COLUMNS = 'id, sport, court_label, place_name, lat, lng';

/** One of the reader's own bookings, with its court. */
export type MyBooking = { id: string; date: string; start_hour: number; status: 'booked' | 'cancelled'; facility: Facility };
export const MY_BOOKING_COLUMNS = `id, date, start_hour, status, facility:facilities(${FACILITY_COLUMNS})`;

export type SlotState = 'available' | 'booked' | 'past';

/** Today and the next six days, as Malaysian dates (no daylight saving there: a day is always 24 hours). */
export function bookableDates(now: Date): string[] {
  return Array.from({ length: DAYS_AHEAD }, (_, i) => mytDate(new Date(now.getTime() + i * 24 * HOUR_MS)));
}

/** The moment a slot starts: `hour` o'clock on a Malaysian date, which is UTC+8 all year. */
export function slotStartUtc(date: string, hour: number): Date {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+08:00`);
}

/** The day's slots, 7 am to 10 pm: past once started (booked or not), else booked or available. */
export function slotStates(date: string, bookedHours: number[], now: Date): { hour: number; state: SlotState }[] {
  return Array.from({ length: LAST_START_HOUR - OPEN_HOUR + 1 }, (_, i) => {
    const hour = OPEN_HOUR + i;
    const state: SlotState =
      slotStartUtc(date, hour).getTime() <= now.getTime() ? 'past' : bookedHours.includes(hour) ? 'booked' : 'available';
    return { hour, state };
  });
}

/** Cancelling is free until 2 hours before the start, and closed after. */
export function canCancel(date: string, hour: number, now: Date): boolean {
  return now.getTime() <= slotStartUtc(date, hour).getTime() - CANCEL_NOTICE_MS;
}

/** The hours a household may still book on a day it has already booked `bookedByHouseholdThatDate` hours. */
export function householdHoursLeft(bookedByHouseholdThatDate: number): number {
  return Math.max(0, HOUSEHOLD_DAILY_HOURS - bookedByHouseholdThatDate);
}

/** "8 pm" / "8 PTG": a slot's button. */
export function slotLabel(date: string, hour: number, lang: Lang): string {
  return new Intl.DateTimeFormat(intlLocale(lang), { timeZone: TZ, hour: 'numeric' }).format(slotStartUtc(date, hour));
}

/** "8:00 – 9:00 pm": the hour a slot covers. */
export function slotRange(date: string, hour: number, lang: Lang): string {
  const start = slotStartUtc(date, hour);
  return new Intl.DateTimeFormat(intlLocale(lang), { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).formatRange(
    start,
    new Date(start.getTime() + HOUR_MS),
  );
}

// RFC 5545 text: backslash, comma and semicolon are escaped, and a line break becomes \n.
const icsText = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
// 2026-10-17T12:00:00.000Z -> 20261017T120000Z
const icsTime = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');

/**
 * One booking as a calendar file, in UTC so every calendar shows it in its own time zone. DTSTAMP is the start, so the
 * file is the same on every download.
 * shortcut: no line folding (RFC 5545 wants lines under 75 bytes); fine for court and park names, fold if longer text goes in.
 */
export function toIcs(b: { title: string; location: string; date: string; hour: number; uid: string }): string {
  const start = slotStartUtc(b.date, b.hour);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Serumpun//Book a Court//EN',
    'BEGIN:VEVENT',
    `UID:${b.uid}@serumpun`,
    `DTSTAMP:${icsTime(start)}`,
    `DTSTART:${icsTime(start)}`,
    `DTEND:${icsTime(new Date(start.getTime() + HOUR_MS))}`,
    `SUMMARY:${icsText(b.title)}`,
    `LOCATION:${icsText(b.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

// The `raise exception` codes of book_slot and cancel_booking.
const BOOKING_ERRORS: Record<string, MessageKey> = {
  not_verified: 'common.pendingCantAct',
  not_found: 'book.error.notFound',
  bad_date: 'book.error.date',
  bad_slot: 'book.error.date',
  bad_players: 'book.error.players',
  slot_started: 'book.error.started',
  slot_taken: 'book.error.taken',
  household_limit: 'book.error.household',
  no_unit: 'book.error.noUnit',
  too_late: 'book.error.tooLate',
};

/** What to tell a resident whose booking or cancellation failed. Anything unexpected is the generic error. */
export function bookingErrorKey(code: string | undefined): MessageKey {
  return code !== undefined && Object.hasOwn(BOOKING_ERRORS, code) ? BOOKING_ERRORS[code] : 'common.error';
}
