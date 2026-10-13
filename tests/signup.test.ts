import { validateSignup, type SignupInput } from '@/lib/domain/signup';

const valid: SignupInput = {
  fullName: 'Aisyah Rahman',
  email: 'aisyah@example.com',
  password: 'longenough',
  townshipSlug: 'city-of-elmina',
  neighbourhood: 'Elmina Valley 3',
  unitNo: 'No. 18, Jalan Elmina Valley 3/2',
};

it('accepts a complete sign-up', () => { expect(validateSignup(valid)).toEqual({ ok: true }); });
it('rejects inactive township', () => { expect(validateSignup({ ...valid, townshipSlug: 'serenia-city' })).toEqual({ ok: false, errors: { townshipSlug: 'signup.error.townshipSoon' } }); });
it('requires unit number and 8+ char password', () => { const r = validateSignup({ ...valid, unitNo: ' ', password: 'short' });
  expect(r.ok).toBe(false); expect(Object.keys((r as { errors: object }).errors).sort()).toEqual(['password','unitNo']); });

// Beyond the brief: every other field, and the 72-character limit Supabase Auth puts on passwords.
it('names each missing or malformed field', () => {
  expect(validateSignup({ ...valid, fullName: '  ', email: 'aisyah@', neighbourhood: '', password: 'x'.repeat(73) })).toEqual({
    ok: false,
    errors: {
      fullName: 'signup.error.required',
      email: 'signup.error.email',
      neighbourhood: 'signup.error.required',
      password: 'signup.error.password',
    },
  });
  expect(validateSignup({ ...valid, password: 'x'.repeat(72) })).toEqual({ ok: true });
});
