'use server';

import { refresh } from 'next/cache';
import { formatCode, hashCode, newCode } from '@/lib/card/codes';
import { householdErrorKey, type InviteRole } from '@/lib/card/household';
import { isPinFormat, pinAnswer, type PinAnswer } from '@/lib/card/pin';
import type { MessageKey } from '@/lib/i18n';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

// A refusal is told in words; anything unexpected is logged, and only its message.
function refused(rpc: string, message: string): MessageKey {
  const key = householdErrorKey(message);
  if (key === 'common.error') console.error(`${rpc} failed: ${message}`);
  return key;
}

/**
 * A manager invites someone to the card, confirmed with their PIN. The code is made here and only its hash goes to the
 * database; it exists in this answer alone, so it is never logged, kept or put in a URL, and the sheet shows it once.
 * A wrong PIN or a locked one comes back as the PIN pad expects it, and a refusal in words.
 */
export async function createInvite(
  name: string,
  role: InviteRole,
  pin: string,
): Promise<PinAnswer | { ok: true; code: string; expiresAt: string }> {
  const { lang } = await requireMember();
  // It arrives from the browser: a PIN that is not six digits is not sent, or the database would count it as a wrong try.
  if (!isPinFormat(pin)) return { ok: false, error: 'card.pin.error.format' };
  const code = newCode();
  const { data, error } = await (await createClient()).rpc('create_invite', {
    p_name: typeof name === 'string' ? name.trim() : '', // create_invite refuses an empty one as bad_name
    p_role: role,
    p_pin: pin,
    p_code_hash: await hashCode(code),
  });
  if (error) return { ok: false, error: refused('create_invite', error.message) };
  if (!data.ok) return pinAnswer(data, new Date(), lang);
  refresh();
  return { ok: true, code: formatCode(code), expiresAt: new Date(data.expires_at).toISOString() };
}

/**
 * Cancels an open invite: whoever made it, or a manager may. The page is refreshed after a refusal too, because a refusal
 * means it was out of date (the invite was used, or cancelled elsewhere), and it should not stay on the page.
 */
export async function cancelInvite(invite: string): Promise<{ error?: MessageKey }> {
  await requireMember();
  const { error } = await (await createClient()).rpc('cancel_invite', { p_invite: invite });
  refresh();
  return error ? { error: refused('cancel_invite', error.message) } : {};
}
