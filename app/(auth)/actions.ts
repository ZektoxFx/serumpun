'use server';

import { redirect } from 'next/navigation';
import { returnPath } from '@/lib/domain/notifications';
import { validateSignup, type SignupErrors, type SignupInput } from '@/lib/domain/signup';
import { env } from '@/lib/env';
import type { MessageKey } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { DEMO_EMAIL, type DemoAccount } from '@/lib/seed/people';
import { createAdminClient } from '@/lib/supabase/admin';
import { homePath } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What a failed action hands back to its form (a successful one redirects). Passwords are never sent back. */
export type AuthResult = {
  error?: MessageKey;
  errors?: SignupErrors;
  values?: Partial<Omit<SignupInput, 'password'>>;
} | null;

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
  // `who` comes from the browser: only these four accounts can be entered this way.
  if (!Object.hasOwn(DEMO_EMAIL, who)) return { error: 'landing.demo.error' };
  return signInWith(DEMO_EMAIL[who], env.demoPassword, 'landing.demo.error', next);
}

/** Creates a pending resident (the Management Office verifies them later), then signs them in. */
export async function signUp(formData: FormData): Promise<AuthResult> {
  const input: SignupInput = {
    fullName: field(formData, 'fullName').trim(),
    email: field(formData, 'email').trim().toLowerCase(),
    password: field(formData, 'password'),
    townshipSlug: field(formData, 'townshipSlug'),
    neighbourhood: field(formData, 'neighbourhood').trim(),
    unitNo: field(formData, 'unitNo').trim(),
  };
  const { password, ...values } = input;
  const checked = validateSignup(input);
  if (!checked.ok) return { errors: checked.errors, values };

  const admin = createAdminClient();
  const { data: township } = await admin
    .from('townships')
    .select('id')
    .eq('slug', input.townshipSlug)
    .eq('active', true)
    .maybeSingle();
  if (!township) return { errors: { townshipSlug: 'signup.error.townshipSoon' }, values };

  // Email confirmation is on for this project, and residents are verified by the Management Office instead.
  const { data: created, error } = await admin.auth.admin.createUser({ email: input.email, password, email_confirm: true });
  if (error) {
    if (error.code === 'email_exists' || error.code === 'user_already_exists') {
      return { errors: { email: 'signup.error.emailTaken' }, values };
    }
    if (error.code === 'email_address_invalid') return { errors: { email: 'signup.error.email' }, values };
    if (error.code === 'weak_password') return { errors: { password: 'signup.error.password' }, values };
    return { error: 'common.error', values };
  }

  const id = created.user.id;
  const profile = {
    id,
    township_id: township.id,
    full_name: input.fullName,
    neighbourhood: input.neighbourhood,
    role: 'resident',
    status: 'pending',
    lang: await getLang(),
  };
  const saved =
    !(await admin.from('profiles').insert(profile)).error &&
    !(await admin.from('profile_private').insert({ id, unit_no: input.unitNo })).error;
  if (!saved) {
    // No half-made accounts: an auth user without a profile could never sign up again with this email.
    await admin.auth.admin.deleteUser(id);
    return { error: 'common.error', values };
  }

  return signInWith(input.email, password, 'common.error');
}

export async function signOut() {
  const supabase = await createClient();
  // This device only: demo accounts are shared, and the default (global) would end every visitor's session.
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/');
}
