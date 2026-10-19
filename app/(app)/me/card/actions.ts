'use server';

import type { PublicJwk } from '@/lib/card/crypto';
import { cardErrorKey, isPinFormat } from '@/lib/card/pin';
import { issuePass } from '@/lib/card/server';
import { clockTime } from '@/lib/domain/time';
import { env } from '@/lib/env';
import type { MessageKey } from '@/lib/i18n';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * What the PIN pad gets back. A wrong try fills `{n}` of the message from `triesLeft`. A locked PIN fills `{time}` from
 * `time` (when it opens again, in Malaysia time and the resident's language), and `lockedUntil` is that moment as an
 * ISO string, for a countdown.
 */
export type PinAnswer =
  | { ok: true }
  | { ok: false; error: MessageKey; triesLeft?: number; lockedUntil?: string; time?: string };

/**
 * A fresh pass for this browser's key. register_phone_key checks the caller, the key and the card's phone limit itself,
 * so this passes the key on and signs what comes back.
 */
export async function renewPass(key: PublicJwk): Promise<{ pass: string } | { error: MessageKey }> {
  await requireMember();
  const result = await issuePass(await createClient(), key, new Date(), env.cardSigningKey);
  return 'pass' in result ? result : { error: cardErrorKey(result.error) };
}

/** The PIN pad's check. verify_card_pin counts the tries and does the lockout; this only keeps a malformed PIN from costing a try. */
export async function checkCardPin(pin: string): Promise<PinAnswer> {
  const { lang } = await requireMember();
  if (!isPinFormat(pin)) return { ok: false, error: 'card.pin.error.format' };
  const { data, error } = await (await createClient()).rpc('verify_card_pin', { p_pin: pin });
  if (error) {
    // `no_pin` (a member nobody set a PIN for) or anything else: the pad can only say try again.
    console.error(`verify_card_pin failed: ${error.message}`);
    return { ok: false, error: 'common.error' };
  }
  if (data.ok) return { ok: true };
  if (data.locked_until) {
    const until = new Date(data.locked_until);
    return { ok: false, error: 'card.pin.error.locked', lockedUntil: until.toISOString(), time: clockTime(until, new Date(), lang) };
  }
  return { ok: false, error: 'card.pin.error.wrong', triesLeft: data.tries_left };
}
