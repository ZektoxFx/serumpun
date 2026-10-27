import { clockTime } from '@/lib/domain/time';
// From core, not the index: the index brings React context, and the seed script imports this file.
import type { Lang, MessageKey } from '@/lib/i18n/core';

export const DEMO_PIN = '123456';
export const PIN_TRIES = 5;
export const PIN_LOCK_MS = 900_000; // 15 minutes

/**
 * Exactly six digits, the PIN `set_member_pins` stores. A PIN that fails this is never sent: the database would count it
 * as a wrong try. It arrives from the browser, so a non-string fails too: `test` would read 123456 or ['123456'] as text.
 */
export function isPinFormat(pin: string): boolean {
  return typeof pin === 'string' && /^[0-9]{6}$/.test(pin);
}

/**
 * What the PIN pad gets back. A wrong try fills `{n}` of the message from `triesLeft`. A locked PIN fills `{time}` from
 * `time` (when it opens again, in Malaysia time and the resident's language), and `lockedUntil` is that moment as an
 * ISO string, for a countdown.
 */
export type PinAnswer =
  | { ok: true }
  | { ok: false; error: MessageKey; triesLeft?: number; lockedUntil?: string; time?: string };

/** A PIN check's answer from the database (`check_member_pin`), as the pad shows it. */
export function pinAnswer(data: { ok: boolean; tries_left?: number; locked_until?: string }, now: Date, lang: Lang): PinAnswer {
  if (data.ok) return { ok: true };
  if (data.locked_until) {
    const until = new Date(data.locked_until);
    return { ok: false, error: 'card.pin.error.locked', lockedUntil: until.toISOString(), time: clockTime(until, now, lang) };
  }
  return { ok: false, error: 'card.pin.error.wrong', triesLeft: data.tries_left };
}

/**
 * A demo account's wrong tries and lock, kept in the browser: every visitor shares the account, so the database can't
 * count for one of them (`verify_card_pin` always answers 5 tries left). `until` is when the lock ends, in ms.
 */
export type DemoLock = { fails: number; until: number | null };

export function demoLocked(lock: DemoLock, now: number): boolean {
  return lock.until !== null && now < lock.until;
}

/** The lock after one try. As on the server, a locked PIN takes no tries, and the 5th wrong try locks it and starts the count again. */
export function afterDemoTry(lock: DemoLock, ok: boolean, now: number): DemoLock {
  if (demoLocked(lock, now)) return lock;
  if (ok) return { fails: 0, until: null };
  const fails = lock.fails + 1;
  return fails < PIN_TRIES ? { fails, until: null } : { fails: 0, until: now + PIN_LOCK_MS };
}

// What a resident can act on when issuePass gives no pass: register_phone_key's `raise exception` codes, and its answers
// for a key that waits for the card or that the card has moved away from.
const CARD_ERRORS: Record<string, MessageKey> = {
  no_card: 'card.error.no_card',
  card_full: 'card.error.card_full',
  bad_key: 'card.error.bad_key',
  phone_elsewhere: 'card.error.phone_elsewhere',
  move_waiting: 'card.move.waiting',
  moved: 'card.move.moved',
};

/** What to tell a resident whose pass could not be issued. Anything unexpected is the generic error. */
export function cardErrorKey(code: string | undefined): MessageKey {
  return code !== undefined && Object.hasOwn(CARD_ERRORS, code) ? CARD_ERRORS[code] : 'common.error';
}
