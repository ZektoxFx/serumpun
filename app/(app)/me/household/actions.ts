'use server';

import { refresh } from 'next/cache';
import { formatCode, hashCode, newCode } from '@/lib/card/codes';
import { refused, type InviteRole } from '@/lib/card/household';
import { isPinFormat, pinAnswer, type PinAnswer } from '@/lib/card/pin';
import type { MessageKey } from '@/lib/i18n';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

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

/**
 * For a lost phone: a manager moves `member`'s card to the phone that waits for it, confirmed with the manager's own PIN.
 * approve_phone_move decides who may. The page is refreshed whatever the answer, as after cancelling an invite: a
 * refusal means it was out of date (the phone moved, or stopped waiting, elsewhere).
 */
export async function approveMove(member: string, pin: string): Promise<PinAnswer> {
  const { lang } = await requireMember();
  // It arrives from the browser: a PIN that is not six digits is not sent, or the database would count it as a wrong try.
  if (!isPinFormat(pin)) return { ok: false, error: 'card.pin.error.format' };
  const { data, error } = await (await createClient()).rpc('approve_phone_move', { p_member: member, p_pin: pin });
  refresh();
  return error ? { ok: false, error: refused('approve_phone_move', error.message) } : pinAnswer(data, new Date(), lang);
}
