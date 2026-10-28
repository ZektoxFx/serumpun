'use server';

import { refresh } from 'next/cache';
import { publicJwkFromSigningKey, readPresentation, type PublicJwk } from '@/lib/card/crypto';
import { NOTE_FRESH_MS } from '@/lib/card/decide';
import { refused } from '@/lib/card/household';
import { cardErrorKey, isPinFormat, pinAnswer, type PinAnswer } from '@/lib/card/pin';
import { issuePass } from '@/lib/card/server';
import { env } from '@/lib/env';
import type { MessageKey } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * A fresh pass for this browser's key. The key comes from the browser, so issuePass first refuses anything that is not an
 * x and a y; register_phone_key then checks the caller, the format of x and y, and the card's phone limit.
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
  return pinAnswer(data, new Date(), lang);
}

/**
 * The old browser moves the signed-in person's card to the browser that waits, with their PIN. `presentation` is a tap
 * note this browser signed just now on its pass, which proves it holds the key that is moving. A wrong PIN comes back as
 * the PIN pad expects it, and a refusal in words. The presentation, the PIN and the key are never logged.
 */
export async function moveCard(presentation: string, pin: string): Promise<PinAnswer> {
  const { id, lang } = await requireMember();
  if (!isPinFormat(pin)) return { ok: false, error: 'card.pin.error.format' };
  const read = await readPresentation(presentation, publicJwkFromSigningKey(env.cardSigningKey));
  // Within a minute either way, as a reader judges a note, so a presentation seen once can't be used later.
  const fresh = read !== null && Math.abs(Date.now() - read.note.at) <= NOTE_FRESH_MS;
  if (!fresh) return { ok: false, error: 'card.move.error.proof' };
  // The service role, because the database can't check an ECDSA signature, and a person can read their own phone's
  // public keys: only this action, after checking the signature above, may move a key.
  const { data, error } = await createAdminClient().rpc('move_phone_key', {
    p_user: id, p_x: read.pass.key.x, p_y: read.pass.key.y, p_pin: pin,
  });
  if (error) return { ok: false, error: refused('move_phone_key', error.message) };
  return pinAnswer(data, new Date(), lang);
}

/** "No, that wasn't me": the browsers waiting for the signed-in person's card are turned away, and say it is elsewhere. */
export async function declineMove(): Promise<{ error?: MessageKey }> {
  await requireMember();
  const { error } = await (await createClient()).rpc('decline_phone_move');
  refresh();
  if (!error) return {};
  console.error(`decline_phone_move failed: ${error.message}`);
  return { error: 'common.error' };
}
