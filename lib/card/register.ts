/**
 * Registering with a code, on the server: the home a code is for, the SMS check, and making the account and its place
 * on the card. Nobody is signed in yet, so `admin` is the service-role client, and the database checks every rule again
 * (complete_registration). Codes, SMS codes and PINs are never logged.
 */
import 'server-only';
import { randomInt, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lang } from '@/lib/i18n/core';
import { hashCode, normalizeCode } from './codes';
import { isPinFormat } from './pin';

/** The httpOnly cookie that takes Try registering's code to Register, so a code is never in a URL. */
export const REGISTER_CODE_COOKIE = 'serumpun-register-code';

/** The home a code is for: the office's record of the unit, or the name and role an invite gives on a card. */
export type Home =
  | { kind: 'office'; unit: string; township: string; name: string; tenure: 'owner' | 'tenant'; checkedAt: string; leaseEnd: string | null; phone: string | null }
  | { kind: 'invite'; unit: string; township: string; name: string; role: 'co_owner' | 'adult' | 'child'; invitedBy: string | null };

type CodeRow = {
  kind: 'office' | 'invite';
  // The table's check gives an invite both, and an office code neither.
  name: string | null;
  role: 'co_owner' | 'adult' | 'child' | null;
  created_at: string;
  unit: {
    label: string; record_name: string; record_tenure: 'owner' | 'tenant'; record_phone: string | null; lease_end: string | null;
    township: { name: string };
  };
  inviter: { full_name: string } | null;
};

/** The home an open code is for, or null: a code that is used, cancelled, out of date or unknown, or not a code at all. */
export async function peekCode(admin: SupabaseClient, code: string, now: Date): Promise<Home | null> {
  const typed = normalizeCode(code);
  if (!typed) return null;
  const { data: row, error } = await admin
    .from('card_codes')
    // Two foreign keys point at profiles (who made the code, who used it), so the inviter's is named.
    .select(
      'kind, name, role, created_at, ' +
        'unit:units(label, record_name, record_tenure, record_phone, lease_end, township:townships(name)), ' +
        'inviter:profiles!card_codes_created_by_fkey(full_name)',
    )
    .eq('code_hash', await hashCode(typed))
    .is('used_at', null)
    .is('cancelled_at', null)
    .gt('expires_at', now.toISOString())
    .maybeSingle()
    .overrideTypes<CodeRow, { merge: false }>();
  if (error) throw new Error(`code lookup failed: ${error.message}`);
  if (!row) return null;
  const { unit } = row;
  // The office checked the IC and the title or tenancy when it gave the code.
  if (row.kind === 'office') {
    return {
      kind: 'office', unit: unit.label, township: unit.township.name, name: unit.record_name, tenure: unit.record_tenure,
      checkedAt: row.created_at, leaseEnd: unit.lease_end, phone: unit.record_phone,
    };
  }
  return { kind: 'invite', unit: unit.label, township: unit.township.name, name: row.name!, role: row.role!, invitedBy: row.inviter?.full_name ?? null };
}

/** Starts an SMS check of `phone` (+601…), and answers its id and the code. There is no SMS provider: the code is shown on screen. */
export async function startSmsCheck(admin: SupabaseClient, phone: string): Promise<{ check: string; sms: string }> {
  const sms = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const { data, error } = await admin.rpc('start_sms_check', { p_phone: phone, p_code: sms });
  if (error) throw new Error(`start_sms_check failed: ${error.message}`);
  return { check: data, sms };
}

export type SmsAnswer = { ok: true } | { ok: false; triesLeft: number } | { ok: false; expired: true };

/** One try at an SMS code. The database counts the tries (5) and knows the code only as a bcrypt hash. */
export async function checkSmsCode(admin: SupabaseClient, check: string, sms: string): Promise<SmsAnswer> {
  const { data, error } = await admin.rpc('verify_sms_check', { p_check: check, p_code: sms });
  // The check id comes from the browser, and Postgres refuses text that is not an id (22P02): there is no such check.
  if (error?.code === '22P02') return { ok: false, expired: true };
  if (error) throw new Error(`verify_sms_check failed: ${error.message}`);
  if (data.ok) return { ok: true };
  return data.expired ? { ok: false, expired: true } : { ok: false, triesLeft: data.tries_left };
}

/** What `complete_registration` refuses with; any other error is `failed`. */
export const REGISTER_REFUSALS = ['bad_code', 'bad_check', 'phone_taken', 'has_card', 'card_full', 'bad_pin'] as const;
export type RegisterResult = { userId: string } | { error: (typeof REGISTER_REFUSALS)[number] | 'failed' };

/**
 * Makes the account, puts it on the card, and answers who to sign in. The account has a made-up email that can't receive
 * mail and a random password nobody keeps: residents sign in with their phone and PIN. If the database refuses, the
 * account is deleted again, so nothing is left half-made.
 */
export async function finishRegistration(
  admin: SupabaseClient,
  { code, check, pin, lang, now }: { code: string; check: string; pin: string; lang: Lang; now: Date },
): Promise<RegisterResult> {
  const typed = normalizeCode(code);
  if (!typed) return { error: 'bad_code' };
  if (!isPinFormat(pin)) return { error: 'bad_pin' };
  if (!(await peekCode(admin, typed, now))) return { error: 'bad_code' };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: `resident-${randomUUID()}@example.com`,
    password: randomUUID() + randomUUID(),
    email_confirm: true,
  });
  if (createError) {
    console.error(`createUser failed: ${createError.message}`);
    return { error: 'failed' };
  }
  const userId = created.user.id;
  const { error } = await admin.rpc('complete_registration', {
    p_code_hash: await hashCode(typed), p_check: check, p_user: userId, p_pin: pin, p_lang: lang,
  });
  if (!error) return { userId };

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) console.error(`deleting a refused registration's account failed: ${deleteError.message}`);
  const refusal = REGISTER_REFUSALS.find((refused) => refused === error.message);
  if (!refusal) console.error(`complete_registration failed: ${error.message}`);
  return { error: refusal ?? 'failed' };
}
