// From core, not the index: the index brings React context, and the seed script imports this file.
import type { MessageKey } from '@/lib/i18n/core';

export const DEMO_PIN = '123456';
export const PIN_TRIES = 5;
export const PIN_LOCK_MS = 900_000; // 15 minutes

/** Exactly six digits, the PIN `set_member_pins` stores. A PIN that fails this is never sent: the database would count it as a wrong try. */
export function isPinFormat(pin: string): boolean {
  return /^[0-9]{6}$/.test(pin);
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

// The `raise exception` codes of register_phone_key that a resident can act on.
const CARD_ERRORS: Record<string, MessageKey> = {
  no_card: 'card.error.no_card',
  card_full: 'card.error.card_full',
  bad_key: 'card.error.bad_key',
};

/** What to tell a resident whose pass could not be issued. Anything unexpected is the generic error. */
export function cardErrorKey(code: string | undefined): MessageKey {
  return code !== undefined && Object.hasOwn(CARD_ERRORS, code) ? CARD_ERRORS[code] : 'common.error';
}
