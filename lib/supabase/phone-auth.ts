/**
 * Signing a resident in with their phone: a verified SMS check, then their PIN, then a session. Nobody is signed in yet,
 * so `admin` is the service-role client. Phone numbers, SMS codes, PINs and sign-in links are never logged.
 */
import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isPinFormat } from '@/lib/card/pin';

export type PhoneSignInResult = { userId: string } | { error: 'wrong' | 'expired' | 'failed' };

type SmsCheckRow = { phone: string; verified_at: string | null; used_at: string | null; expires_at: string };

function failure(what: string, error: { message: string }): PhoneSignInResult {
  console.error(`${what} failed: ${error.message}`);
  return { error: 'failed' };
}

/**
 * Who a verified SMS check's number belongs to, when their PIN is right. A number with no account answers exactly as a
 * wrong PIN does, after the same questions to the database, and so does a locked PIN (only a number with an account can
 * lock), so neither the answer nor the trips to the database show that someone with that number lives in the township.
 * A right PIN uses the check up, so it signs in once.
 */
export async function phoneSignIn(
  admin: SupabaseClient,
  { check, pin, now }: { check: string; pin: string; now: Date },
): Promise<PhoneSignInResult> {
  // Not a PIN, so wrong for every number, and asking nothing costs nobody a try.
  if (!isPinFormat(pin)) return { error: 'wrong' };
  const { data: sms, error: smsError } = await admin
    .from('sms_checks')
    .select('phone, verified_at, used_at, expires_at')
    .eq('id', check)
    .maybeSingle()
    .overrideTypes<SmsCheckRow, { merge: false }>();
  // The check id comes from the browser, and Postgres refuses text that is not an id (22P02): there is no such check.
  if (smsError && smsError.code !== '22P02') return failure('sms check lookup', smsError);
  if (!sms || !sms.verified_at || sms.used_at || new Date(sms.expires_at) <= now) return { error: 'expired' };

  const { data: person, error: personError } = await admin
    .from('profile_private')
    .select('id')
    .eq('phone', sms.phone)
    .maybeSingle()
    .overrideTypes<{ id: string }, { merge: false }>();
  if (personError) return failure('account lookup', personError);
  // With no account, a PIN is still checked, for an id nobody has (no_pin): the same trip to the database as a wrong PIN.
  // shortcut: check_member_pin raises no_pin before it hashes, so this is one bcrypt (about 6 ms) quicker than a wrong
  // PIN; a dummy crypt before that raise, in a later migration, would even it out.
  const { data: pinCheck, error: pinError } = await admin.rpc('check_member_pin', { p_user: person?.id ?? randomUUID(), p_pin: pin });
  if (pinError && pinError.message !== 'no_pin') return failure('check_member_pin', pinError);
  if (!person || pinError) return { error: 'wrong' };
  if (!pinCheck.ok) return { error: 'wrong' };

  // Of two sign-ins with one check at the same moment, only the first to mark it used goes on.
  const { data: used, error: useError } = await admin
    .from('sms_checks')
    .update({ used_at: now.toISOString() })
    .eq('id', check)
    .is('used_at', null)
    .select('id');
  if (useError) return failure('using the sms check', useError);
  return used.length === 1 ? { userId: person.id } : { error: 'expired' };
}

/**
 * Signs `userId` in on this browser. A magic link is made for their made-up email and never sent: its hashed token is
 * used here at once, so `supabase`, the cookie client of the server action or route handler, sets the session cookies
 * the usual way. Throws if Auth refuses.
 */
export async function startSession(admin: SupabaseClient, supabase: SupabaseClient, userId: string): Promise<void> {
  const { data: found, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !found.user.email) throw new Error(`user lookup failed: ${userError?.message ?? 'no email'}`);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: found.user.email });
  if (linkError) throw new Error(`generateLink failed: ${linkError.message}`);
  const { error } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (error) throw new Error(`verifyOtp failed: ${error.message}`);
}
