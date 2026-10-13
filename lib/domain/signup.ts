import type { MessageKey } from '@/lib/i18n';

export type SignupInput = {
  fullName: string;
  email: string;
  password: string;
  townshipSlug: string;
  neighbourhood: string;
  unitNo: string;
};

export type SignupErrors = Partial<Record<keyof SignupInput, MessageKey>>;

/** Townships open for sign-up. The sign-up page lists the others as "coming soon". */
export const ACTIVE_TOWNSHIPS = ['city-of-elmina'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checks a sign-up before any account exists. Each error is the message key shown under that field. */
export function validateSignup(input: SignupInput): { ok: true } | { ok: false; errors: SignupErrors } {
  const errors: SignupErrors = {};
  if (!input.fullName.trim()) errors.fullName = 'signup.error.required';
  if (!EMAIL.test(input.email.trim())) errors.email = 'signup.error.email';
  // Supabase Auth refuses passwords over 72 bytes (the bcrypt limit), so say so here rather than fail later.
  if (input.password.length < 8 || new TextEncoder().encode(input.password).length > 72) {
    errors.password = 'signup.error.password';
  }
  if (!ACTIVE_TOWNSHIPS.includes(input.townshipSlug)) errors.townshipSlug = 'signup.error.townshipSoon';
  if (!input.neighbourhood.trim()) errors.neighbourhood = 'signup.error.required';
  if (!input.unitNo.trim()) errors.unitNo = 'signup.error.required';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}
