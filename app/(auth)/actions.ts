'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isPinFormat, type PinAnswer } from '@/lib/card/pin';
import { checkSmsCode, REGISTER_CODE_COOKIE, startSmsCheck } from '@/lib/card/register';
import { returnPath } from '@/lib/domain/notifications';
import { normalizePhone } from '@/lib/domain/phone';
import { env } from '@/lib/env';
import type { MessageKey } from '@/lib/i18n';
import { restartDemoRegistration, restoreDemoCard } from '@/lib/seed/cards';
import { DEMO_EMAIL, type DemoAccount } from '@/lib/seed/people';
import { createAdminClient } from '@/lib/supabase/admin';
import { homePath } from '@/lib/supabase/auth';
import { phoneSignIn, startSession, type PhoneSignInResult } from '@/lib/supabase/phone-auth';
import { createClient } from '@/lib/supabase/server';

/** What a failed action hands back to its form (a successful one redirects). Passwords are never sent back. */
export type AuthResult = { error?: MessageKey; values?: { email: string } } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');

/** Signs in, then goes to `next` (where the visitor was sent away from, e.g. a check-in QR) or the user's home. */
async function signInWith(email: string, password: string, failure: MessageKey, next?: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: failure, values: { email } };
  const { data: profile } = await supabase.from('profiles').select('role, status').eq('id', data.user.id).maybeSingle();
  redirect((profile?.status !== 'rejected' && returnPath(next)) || homePath(profile));
}

export async function signIn(formData: FormData): Promise<AuthResult> {
  return signInWith(
    field(formData, 'email').trim().toLowerCase(),
    field(formData, 'password'),
    'auth.error.signIn',
    field(formData, 'next'),
  );
}

/** One tap into a seeded demo account. The password stays on the server. */
export async function signInDemo(who: DemoAccount, next?: string): Promise<AuthResult> {
  // `who` comes from the browser: only these three accounts can be entered this way.
  if (!Object.hasOwn(DEMO_EMAIL, who)) return { error: 'landing.demo.error' };
  // Each judge starts with a working card. Only on this tap, so an office suspension made during a take stays put.
  // A failed restore is logged and never blocks the sign-in.
  if (who === 'aisyah') {
    try {
      await restoreDemoCard(createAdminClient());
    } catch (error) {
      console.error(`restore demo card failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  return signInWith(DEMO_EMAIL[who], env.demoPassword, 'landing.demo.error', next);
}

/**
 * "Try registering (Nur)": starts her registration over (lib/seed/cards.ts) and opens Register with the fresh office code
 * filled in. The code travels in an httpOnly cookie, never the URL, scoped to /register where the page reads it and the
 * register action deletes it (app/(auth)/register), and it lasts 10 minutes.
 */
export async function tryRegistering(): Promise<AuthResult> {
  let code: string;
  try {
    code = await restartDemoRegistration(createAdminClient());
  } catch (error) {
    logged('starting the demo registration', error);
    return { error: 'landing.demo.error' };
  }
  (await cookies()).set(REGISTER_CODE_COOKIE, code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/register',
    maxAge: 600,
  });
  redirect('/register');
}

// Register and Sign in with a phone (components/auth). Nobody is signed in yet, so the service role asks the database,
// which checks every rule again. SMS codes and PINs arrive as arguments and are never logged.

function logged(what: string, error: unknown) {
  console.error(`${what} failed: ${error instanceof Error ? error.message : error}`);
}

/** One try at an SMS code, for Register and Sign in. The database counts the tries (5) and knows the code only hashed. */
export async function checkSms(check: string, sms: string): Promise<{ ok: true } | { ok: false; error: MessageKey; triesLeft?: number }> {
  // Six digits, like a PIN: anything else is not sent, so it costs no try.
  if (!isPinFormat(sms)) return { ok: false, error: 'card.pin.error.format' };
  try {
    const answer = await checkSmsCode(createAdminClient(), check, sms);
    if (answer.ok) return answer;
    // The fifth wrong try leaves none, and then only a new code helps.
    if ('triesLeft' in answer && answer.triesLeft > 0) return { ok: false, error: 'sms.error.wrong', triesLeft: answer.triesLeft };
    return { ok: false, error: 'sms.error.expired' };
  } catch (error) {
    logged('checking an SMS code', error);
    return { ok: false, error: 'common.error' };
  }
}

/** Starts the SMS check of a number to sign in with. Any Malaysian mobile number gets one: no account is looked for. */
export async function sendSignInSms(phone: string): Promise<{ check: string; sms: string; phone: string } | { error: MessageKey }> {
  const to = normalizePhone(phone);
  if (!to) return { error: 'phone.error.format' };
  try {
    return { ...(await startSmsCheck(createAdminClient(), to)), phone: to };
  } catch (error) {
    logged('sending a sign-in SMS code', error);
    return { error: 'common.error' };
  }
}

// A locked PIN answers `wrong` too (lib/supabase/phone-auth.ts), so phone sign-in never shows a lock.
const SIGN_IN_ERRORS: Record<Extract<PhoneSignInResult, { error: string }>['error'], MessageKey> = {
  wrong: 'signIn.error.wrong',
  expired: 'sms.error.expired',
  failed: 'common.error',
};

/**
 * The PIN after a checked SMS code. An unknown number and a wrong PIN get the same answer, so a number never shows that
 * someone lives here. The right PIN signs in on this browser and goes to `next` (checked again) or Home.
 */
export async function signInWithPin(check: string, pin: string, next?: string): Promise<PinAnswer> {
  const admin = createAdminClient();
  const signedIn = await phoneSignIn(admin, { check, pin, now: new Date() });
  if ('error' in signedIn) return { ok: false, error: SIGN_IN_ERRORS[signedIn.error] };
  try {
    await startSession(admin, await createClient(), signedIn.userId);
  } catch (error) {
    // Auth keeps one live sign-in link per account, so of two sign-ins to one account at the same moment one can fail.
    logged('starting a phone sign-in session', error);
    return { ok: false, error: 'common.error' };
  }
  redirect(returnPath(next) ?? '/home');
}

export async function signOut() {
  const supabase = await createClient();
  // This device only: demo accounts are shared, and the default (global) would end every visitor's session.
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/');
}
