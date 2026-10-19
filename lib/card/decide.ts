/**
 * The one decision behind every tap. The township server runs it on live state and an offline reader on what it cached
 * (`offlineState`), so the two cannot drift apart. Pure: the caller brings the clock and the state.
 * `readPresentation` has already checked the signatures; the pass's expiry and the note's freshness are judged here.
 */
import { mytDate, mytHour } from '@/lib/domain/time';
// From core, not the index: the index brings React context, and the server and the seed script import this file.
import type { MessageKey } from '@/lib/i18n/core';
import type { PassPayload, Place, PublicJwk, TapNote } from './crypto';

export const DENY_REASONS = ['pass_expired', 'phone_off', 'card_suspended', 'lease_ended', 'place_off', 'no_booking'] as const;
export type DenyReason = (typeof DENY_REASONS)[number];
export type TapDecision = { granted: true } | { granted: false; reason: DenyReason };
export type TapState = { suspended: boolean; leaseEnd: string | null; phoneFrozen: boolean; places: readonly Place[]; hasBooking: boolean };

/** The places that open only with a booking for the hour; the pool is walk-in. */
export const BOOKED_PLACES: readonly Place[] = ['facilities', 'gym'];
/** How far a note's time may sit from the reader's clock, either way: room for the phone's clock and the trip. */
export const NOTE_FRESH_MS = 60_000;

/** A lease runs to the end of its last day in Malaysia. Both sides are YYYY-MM-DD, so comparing the text compares the days. */
export function leaseEnded(leaseEnd: string | null, now: Date): boolean {
  return leaseEnd !== null && mytDate(now) > leaseEnd;
}

/** The first check that fails names the reason, in the order below; none failing grants. */
export function decideTap({ pass, note, place, facility, state, now }: {
  pass: PassPayload; note: TapNote; place: Place; facility: string | null; state: TapState; now: Date;
}): TapDecision {
  const deny = (reason: DenyReason): TapDecision => ({ granted: false, reason });
  // Written as "still good" tests, so a clock that is NaN refuses instead of slipping past every comparison.
  const passGood = now.getTime() < pass.exp * 1000;
  const noteFresh = Math.abs(now.getTime() - note.at) <= NOTE_FRESH_MS;
  // A QR note names no reader, so any reader takes it. A note that names one must name this one, court included.
  const forThisReader = note.place === null || (note.place === place && note.facility === facility);
  if (!passGood || !noteFresh || !forThisReader) return deny('pass_expired');
  if (state.phoneFrozen) return deny('phone_off');
  if (state.suspended) return deny('card_suspended');
  if (leaseEnded(state.leaseEnd, now)) return deny('lease_ended');
  if (!state.places.includes(place)) return deny('place_off');
  if (BOOKED_PLACES.includes(place) && !state.hasBooking) return deny('no_booking');
  return { granted: true };
}

/** What a reader keeps from its last sync. `offsetMs` is the server's clock minus the reader's. */
export type ReaderCache = {
  publicKey: PublicJwk; offsetMs: number; syncedAt: number;
  stop: { cards: string[]; phones: string[] };
  bookings: { card: string; facility: string; date: string; hour: number }[];
};

/** The state an offline reader can know: the pass itself, plus the stop list and the bookings from its last sync. */
export function offlineState(pass: PassPayload, cache: ReaderCache, facility: string | null, now: Date): TapState {
  const date = mytDate(now);
  const hour = mytHour(now);
  return {
    suspended: pass.suspended || cache.stop.cards.includes(pass.card),
    phoneFrozen: cache.stop.phones.includes(pass.phone),
    leaseEnd: pass.leaseEnd,
    places: pass.places,
    hasBooking: cache.bookings.some((b) => b.card === pass.card && b.facility === facility && b.date === date && b.hour === hour),
  };
}

/** What a reader sends the server for one tap: the presentation as it read it, and which reader read it. */
export type TapRequest = { presentation: string; place: Place; facility: string | null };
/** A tap an offline reader decided itself, queued until it is back online. `at` is ms. */
export type OfflineVisit = TapRequest & { at: number; granted: boolean; reason: DenyReason | null };

/** The copy for a refusal. `place_off` has a `{place}` hole: fill it with the place's `reader.place.*` text. */
export function reasonKey(reason: DenyReason): MessageKey {
  return `reader.reason.${reason}`;
}
