// The public steps of Register and Sign in: which number gets the SMS code, what each answer says, and where a new or
// returning resident goes.
vi.mock('server-only', () => ({}));
const h = vi.hoisted(() => ({
  admin: { isAdmin: true },
  client: { isCookieClient: true },
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
  peek: vi.fn(),
  start: vi.fn(),
  finish: vi.fn(),
  check: vi.fn(),
  signIn: vi.fn(),
  startSession: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  // The real redirect() ends the action by throwing, which is how Next stops it.
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: h.cookieGet, delete: h.cookieDelete }) }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => h.admin }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.client }));
vi.mock('@/lib/i18n/server', () => ({ getLang: async () => 'en' }));
vi.mock('@/lib/supabase/auth', async (real) => ({ ...(await real<object>()), getSessionProfile: async () => null }));
vi.mock('@/lib/card/register', async (real) => ({
  ...(await real<object>()),
  peekCode: h.peek,
  startSmsCheck: h.start,
  checkSmsCode: h.check,
  finishRegistration: h.finish,
}));
vi.mock('@/lib/supabase/phone-auth', async (real) => ({ ...(await real<object>()), phoneSignIn: h.signIn, startSession: h.startSession }));

import { checkSms, sendSignInSms, signInWithPin } from '@/app/(auth)/actions';
import { readCode, register, sendSms } from '@/app/(auth)/register/actions';
import { REGISTER_CODE_COOKIE } from '@/lib/card/register';

const OFFICE_HOME = { kind: 'office', unit: 'No. 61, Jalan Elmina Green 5', township: 'City of Elmina', name: 'Zulkifli Hassan', tenure: 'owner', checkedAt: '2026-10-24T02:00:00Z', leaseEnd: null, phone: '+60100000061' };
const INVITE_HOME = { kind: 'invite', unit: 'No. 18, Jalan Elmina Valley 3/2', township: 'City of Elmina', name: 'Adam', role: 'child', invitedBy: 'Aisyah Rahman' };

beforeEach(() => {
  for (const spy of [h.cookieGet, h.cookieDelete, h.peek, h.start, h.finish, h.check, h.signIn, h.startSession]) spy.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

it("texts an office code's own number, never one typed in", async () => {
  h.peek.mockResolvedValue(OFFICE_HOME);
  h.start.mockResolvedValue({ check: 'chk', sms: '482913' });
  expect(await sendSms('k7q4-m29x', '0129999999')).toEqual({ check: 'chk', sms: '482913', phone: '+60100000061' });
  expect(h.start).toHaveBeenCalledWith(h.admin, '+60100000061');
});
it('texts the number an invited person types, read the Malaysian way', async () => {
  h.peek.mockResolvedValue(INVITE_HOME);
  h.start.mockResolvedValue({ check: 'chk', sms: '482913' });
  await sendSms('K7Q4M29X', '012-345 6789');
  expect(h.start).toHaveBeenCalledWith(h.admin, '+60123456789');
});
it('signs the new resident in, forgets the demo code and opens Me', async () => {
  h.finish.mockResolvedValue({ userId: 'u-new' });
  await expect(register('K7Q4M29X', 'chk', '123456')).rejects.toThrow('NEXT_REDIRECT /me?ready=1');
  expect(h.startSession).toHaveBeenCalledWith(h.admin, h.client, 'u-new');
  expect(h.cookieDelete).toHaveBeenCalledWith({ name: REGISTER_CODE_COOKIE, path: '/register' });
});
it('says the same for an unknown number and a wrong PIN, and goes back only inside the app', async () => {
  h.signIn.mockResolvedValueOnce({ error: 'wrong' });
  expect(await signInWithPin('chk', '123456')).toEqual({ ok: false, error: 'signIn.error.wrong' });
  h.signIn.mockResolvedValue({ userId: 'u-nur' });
  await expect(signInWithPin('chk', '123456', '/checkin/abc')).rejects.toThrow('NEXT_REDIRECT /checkin/abc');
  await expect(signInWithPin('chk', '123456', '//evil.example')).rejects.toThrow('NEXT_REDIRECT /home');
});

// Beyond the brief: the words each refusal gets, and what happens when the database or Auth fails.
it('refuses a code that is not open, an office record with no phone, and a landline or foreign number, in words', async () => {
  h.peek.mockResolvedValueOnce(null);
  expect(await readCode('K7Q4M29X')).toEqual({ error: 'register.error.code' });
  h.peek.mockResolvedValueOnce(null);
  expect(await sendSms('K7Q4M29X', null)).toEqual({ error: 'register.error.code' });
  h.peek.mockResolvedValueOnce({ ...OFFICE_HOME, phone: null });
  expect(await sendSms('K7Q4M29X', '012-345 6789')).toEqual({ error: 'register.error.noPhone' });
  h.peek.mockResolvedValue(INVITE_HOME);
  for (const phone of ['03-1234 5678', '+65 9123 4567', null]) expect(await sendSms('K7Q4M29X', phone), String(phone)).toEqual({ error: 'phone.error.format' });
  for (const phone of ['03-1234 5678', '+65 9123 4567']) expect(await sendSignInSms(phone), phone).toEqual({ error: 'phone.error.format' });
  expect(h.start).not.toHaveBeenCalled();
});
it('starts a sign-in check for any Malaysian mobile number, without looking for an account', async () => {
  h.start.mockResolvedValue({ check: 'chk', sms: '004821' });
  expect(await sendSignInSms('+60 12-345 6789')).toEqual({ check: 'chk', sms: '004821', phone: '+60123456789' });
  expect(h.start).toHaveBeenCalledWith(h.admin, '+60123456789');
  expect(h.peek).not.toHaveBeenCalled();
});
it('says try again when the database fails, and logs why without the code', async () => {
  h.peek.mockRejectedValue(new Error('code lookup failed: boom'));
  expect(await readCode('K7Q4M29X')).toEqual({ error: 'common.error' });
  expect(await sendSms('K7Q4M29X', null)).toEqual({ error: 'common.error' });
  h.start.mockRejectedValue(new Error('start_sms_check failed: boom'));
  expect(await sendSignInSms('012-345 6789')).toEqual({ error: 'common.error' });
  h.check.mockRejectedValue(new Error('verify_sms_check failed: boom'));
  expect(await checkSms('chk', '482913')).toEqual({ ok: false, error: 'common.error' });
  expect(console.error).toHaveBeenCalledTimes(4);
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/K7Q4M29X|3456789|482913/);
});
it('checks an SMS code: six digits, the tries left, then a new code', async () => {
  expect(await checkSms('chk', '48291')).toEqual({ ok: false, error: 'card.pin.error.format' });
  expect(h.check).not.toHaveBeenCalled();
  h.check.mockResolvedValueOnce({ ok: true });
  expect(await checkSms('chk', '482913')).toEqual({ ok: true });
  expect(h.check).toHaveBeenCalledWith(h.admin, 'chk', '482913');
  h.check.mockResolvedValueOnce({ ok: false, triesLeft: 3 });
  expect(await checkSms('chk', '000000')).toEqual({ ok: false, error: 'sms.error.wrong', triesLeft: 3 });
  // The fifth wrong try leaves none: the check can't be passed any more, so the answer asks for a new code.
  h.check.mockResolvedValueOnce({ ok: false, triesLeft: 0 });
  expect(await checkSms('chk', '000000')).toEqual({ ok: false, error: 'sms.error.expired' });
  h.check.mockResolvedValueOnce({ ok: false, expired: true });
  expect(await checkSms('chk', '000000')).toEqual({ ok: false, error: 'sms.error.expired' });
});
it.each([
  ['bad_code', 'register.error.code'],
  ['bad_check', 'sms.error.expired'],
  ['phone_taken', 'register.error.phoneTaken'],
  ['has_card', 'register.error.hasCard'],
  ['card_full', 'card.error.card_full'],
  ['bad_pin', 'card.pin.error.format'],
  ['failed', 'common.error'],
])('answers a registration refused with %s by %s, signing nobody in', async (refusal, key) => {
  h.finish.mockResolvedValue({ error: refusal });
  expect(await register('K7Q4M29X', 'chk', '123456')).toEqual({ error: key });
  expect(h.finish).toHaveBeenCalledWith(h.admin, { code: 'K7Q4M29X', check: 'chk', pin: '123456', lang: 'en', now: expect.any(Date) });
  expect(h.startSession).not.toHaveBeenCalled();
});
it('says so, and logs why, when the account is made but its session is not; a sign-in says try again', async () => {
  h.finish.mockResolvedValue({ userId: 'u-new' });
  h.startSession.mockRejectedValue(new Error('verifyOtp failed: Token has expired or is invalid'));
  expect(await register('K7Q4M29X', 'chk', '123456')).toEqual({ error: 'register.error.session' });
  h.signIn.mockResolvedValue({ userId: 'u-nur' });
  expect(await signInWithPin('chk', '123456')).toEqual({ ok: false, error: 'common.error' });
  expect(console.error).toHaveBeenCalledTimes(2);
});
it('asks for a new SMS code when the check is used up, and says try again when the sign-in fails', async () => {
  h.signIn.mockResolvedValueOnce({ error: 'expired' });
  expect(await signInWithPin('chk', '123456')).toEqual({ ok: false, error: 'sms.error.expired' });
  h.signIn.mockResolvedValueOnce({ error: 'failed' });
  expect(await signInWithPin('chk', '123456')).toEqual({ ok: false, error: 'common.error' });
  expect(h.startSession).not.toHaveBeenCalled();
});
