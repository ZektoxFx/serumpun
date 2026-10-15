import type { Lang, MessageKey } from '@/lib/i18n';
import { TZ, mytDate } from './time';

// supabase/migrations/0005_events_points.sql enforces the same categories, points and check-in window.

/** Official events are the Management Office's; residents pick one of the others. */
export const EVENT_CATEGORIES = ['official', 'sports', 'family', 'green', 'other'] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export const RESIDENT_CATEGORIES = ['sports', 'family', 'green', 'other'] as const satisfies readonly EventCategory[];

export const EVENT_ICON: Record<EventCategory, string> = {
  official: '🏢',
  sports: '⚽',
  family: '👨‍👩‍👧',
  green: '🌱',
  other: '📅',
};

/** Spec §8.5: official events are worth 150 at once; a resident event earns 100 once the office approves it. */
export const DEFAULT_POINTS = { official: 150, resident: 100 } as const;

/** Check-in opens an hour before the start and closes three hours after it (both ends included). */
export const CHECKIN_BEFORE_MS = 3_600_000;
export const CHECKIN_AFTER_MS = 10_800_000;

export function isWithinCheckinWindow(startsAt: Date, now: Date): boolean {
  const t = now.getTime();
  return t >= startsAt.getTime() - CHECKIN_BEFORE_MS && t <= startsAt.getTime() + CHECKIN_AFTER_MS;
}

/** A row of the public_events view: no check-in code; who organises it, and whether the caller is going. */
export type PublicEvent = {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  starts_at: string;
  ends_at: string;
  location_text: string;
  is_official: boolean;
  approval_status: 'none' | 'pending' | 'approved' | 'rejected';
  points: number;
  going_count: number;
  organizer_name: string | null;
  is_mine: boolean;
  is_going: boolean;
  checked_in_at: string | null;
};
export const PUBLIC_EVENT_COLUMNS =
  'id, title, description, category, starts_at, ends_at, location_text, is_official, approval_status, points, going_count, organizer_name, is_mine, is_going, checked_in_at';

/**
 * A date and a time typed into the event form ("2026-10-17", "07:00") as the Malaysian moment they mean, or null when
 * either is not a real date or time (the browser's pickers send these formats; anything else came from elsewhere).
 */
export function mytDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const at = new Date(`${date}T${time}:00+08:00`);
  return !Number.isNaN(at.getTime()) && mytDate(at) === date ? at : null; // 31 Feb would roll over into March
}

const intlLocale = (lang: Lang) => (lang === 'ms' ? 'ms-MY' : 'en-MY');

/** The card's date block in Malaysia: { weekday: 'SAT', day: '17', month: 'OCT' }. */
export function eventDateParts(d: Date, lang: Lang): { weekday: string; day: string; month: string } {
  const parts: Record<string, string> = {};
  for (const { type, value } of new Intl.DateTimeFormat(intlLocale(lang), {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(d)) {
    parts[type] = value;
  }
  return { weekday: parts.weekday.toLocaleUpperCase(), day: parts.day, month: parts.month.toLocaleUpperCase() };
}

/** "7:00 am" (or "7:00 PG") in Malaysia. */
export function eventTime(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(intlLocale(lang), { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(d);
}

/** "Sat, 17 Oct" in Malaysia, for the event's facts. */
export function eventDay(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(intlLocale(lang), { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}

const lookup = (keys: Record<string, MessageKey>, code: string | undefined): MessageKey =>
  code !== undefined && Object.hasOwn(keys, code) ? keys[code] : 'common.error';

// The `raise exception` codes of check_in_event.
const CHECKIN_ERRORS: Record<string, MessageKey> = {
  not_verified: 'checkin.error.notVerified',
  bad_code: 'checkin.error.badCode',
  not_approved: 'checkin.error.notApproved',
  outside_window: 'checkin.error.window',
  already_checked_in: 'checkin.error.already',
};

/** What to tell a resident whose check-in failed. Anything unexpected is the generic error. */
export function checkinErrorKey(code: string | undefined): MessageKey {
  return lookup(CHECKIN_ERRORS, code);
}

// The `raise exception` codes of the other event RPCs (create, RSVP, points requests and approvals, the QR link).
const EVENT_ERRORS: Record<string, MessageKey> = {
  not_verified: 'common.pendingCantAct',
  bad_category: 'event.error.category',
  bad_title: 'event.error.title',
  bad_place: 'event.error.place',
  bad_time: 'event.error.time',
  not_found: 'event.error.notFound',
  event_over: 'event.error.over',
  checked_in: 'event.error.checkedIn',
  not_organizer: 'event.error.notOrganizer',
  not_pending: 'event.error.notPending',
  bad_points: 'event.error.points',
  not_management: 'map.error.notManagement',
  not_allowed: 'event.error.notAllowed',
};

export function eventErrorKey(code: string | undefined): MessageKey {
  return lookup(EVENT_ERRORS, code);
}
