'use server';

import type { PublicJwk } from '@/lib/card/crypto';
import { cardErrorKey, isPinFormat, pinAnswer, type PinAnswer } from '@/lib/card/pin';
import { issuePass } from '@/lib/card/server';
import { env } from '@/lib/env';
import type { MessageKey } from '@/lib/i18n';
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
