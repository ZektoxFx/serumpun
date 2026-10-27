'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { finishRegistration, peekCode, REGISTER_CODE_COOKIE, startSmsCheck, type Home, type RegisterResult } from '@/lib/card/register';
import { normalizePhone } from '@/lib/domain/phone';
import type { MessageKey } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { startSession } from '@/lib/supabase/phone-auth';
import { createClient } from '@/lib/supabase/server';

// Public: nobody is signed in yet, so the service role reads the code, and the database checks every rule again.
// Codes, SMS codes and PINs arrive as arguments and are never logged.

const REGISTER_ERRORS: Record<Extract<RegisterResult, { error: string }>['error'], MessageKey> = {
  bad_code: 'register.error.code',
  bad_check: 'sms.error.expired',
  phone_taken: 'register.error.phoneTaken',
  has_card: 'register.error.hasCard',
  card_full: 'card.error.card_full',
  bad_pin: 'card.pin.error.format',
  failed: 'common.error',
};

function logged(what: string, error: unknown) {
  console.error(`${what} failed: ${error instanceof Error ? error.message : error}`);
}

/** The home an open code is for: "Is this your home?", or the card an invite joins. */
export async function readCode(code: string): Promise<{ home: Home } | { error: MessageKey }> {
  try {
    const home = await peekCode(createAdminClient(), code, new Date());
    return home ? { home } : { error: 'register.error.code' };
  } catch (error) {
    logged('reading a code', error);
    return { error: 'common.error' };
  }
}

/** Starts the SMS check: an office code's to the number on the office's record, an invite's to the number typed in. */
export async function sendSms(code: string, phone: string | null): Promise<{ check: string; sms: string; phone: string } | { error: MessageKey }> {
  try {
    const admin = createAdminClient();
    const home = await peekCode(admin, code, new Date());
    if (!home) return { error: 'register.error.code' };
    // An office code texts the number the office checked, never one typed in.
    const to = home.kind === 'office' ? home.phone : normalizePhone(phone);
    if (!to) return { error: home.kind === 'office' ? 'register.error.noPhone' : 'phone.error.format' };
    return { ...(await startSmsCheck(admin, to)), phone: to };
  } catch (error) {
    logged('sending an SMS code', error);
    return { error: 'common.error' };
  }
}

/** Makes the account and puts it on the card, then signs it in on this browser and opens Me. */
export async function register(code: string, check: string, pin: string): Promise<{ error: MessageKey }> {
  const admin = createAdminClient();
  const registered = await finishRegistration(admin, { code, check, pin, lang: await getLang(), now: new Date() });
  if ('error' in registered) return { error: REGISTER_ERRORS[registered.error] };
  // The code is used now, so Try registering's cookie has nothing left to fill in.
  (await cookies()).delete({ name: REGISTER_CODE_COOKIE, path: '/register' });
  try {
    await startSession(admin, await createClient(), registered.userId);
  } catch (error) {
    // The account is made and on the card, so they can sign in with their phone and PIN instead.
    logged('signing a new resident in', error);
    return { error: 'register.error.session' };
  }
  redirect('/me?ready=1');
}
