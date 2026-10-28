// "Try as Aisyah" puts No. 18's card back as seeded, for her only, and signs her in whatever the restore does.
// "Try registering (Nur)" starts her registration over and hands Register its code in a cookie.
vi.mock('server-only', () => ({}));
const h = vi.hoisted(() => ({
  calls: [] as string[],
  admin: { isAdmin: true },
  createAdmin: vi.fn(),
  restore: vi.fn(),
  restart: vi.fn(),
  cookieSet: vi.fn(),
  signIn: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: h.cookieSet }) }));
vi.mock('next/navigation', () => ({
  // The real redirect() ends the action by throwing, which is how Next stops it.
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock('@/lib/seed/cards', () => ({ restoreDemoCard: h.restore, restartDemoRegistration: h.restart }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: h.createAdmin }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { signInWithPassword: h.signIn },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'resident', status: 'verified' } }) }) }) }),
  }),
}));

import { signInDemo, tryRegistering } from '@/app/(auth)/actions';
import { REGISTER_CODE_COOKIE } from '@/lib/card/register';
import { DEMO_EMAIL } from '@/lib/seed/people';

beforeEach(() => {
  h.calls.length = 0;
  h.createAdmin.mockReset().mockReturnValue(h.admin);
  h.restore.mockReset().mockImplementation(async () => void h.calls.push('restore'));
  h.restart.mockReset();
  h.cookieSet.mockReset();
  h.signIn.mockReset().mockImplementation(async () => (h.calls.push('signIn'), { data: { user: { id: 'u1' } }, error: null }));
  vi.stubEnv('DEMO_PASSWORD', 'a-test-password');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("puts No. 18's card back, with the service-role client, before signing Aisyah in", async () => {
  await expect(signInDemo('aisyah')).rejects.toThrow('NEXT_REDIRECT /home');
  expect(h.restore).toHaveBeenCalledWith(h.admin);
  expect(h.signIn).toHaveBeenCalledWith({ email: DEMO_EMAIL.aisyah, password: 'a-test-password' });
  expect(h.calls).toEqual(['restore', 'signIn']);
});

it('leaves every card alone for the other demo accounts', async () => {
  for (const who of ['daniel', 'office'] as const) await expect(signInDemo(who), who).rejects.toThrow('NEXT_REDIRECT');
  expect(h.signIn).toHaveBeenCalledTimes(2);
  expect(h.createAdmin).not.toHaveBeenCalled();
  expect(h.restore).not.toHaveBeenCalled();
});

it('still signs Aisyah in, and logs why, when the restore fails', async () => {
  h.restore.mockRejectedValueOnce(new Error('cards: boom'));
  await expect(signInDemo('aisyah')).rejects.toThrow('NEXT_REDIRECT /home');
  expect(h.signIn).toHaveBeenCalledOnce();
  expect(console.error).toHaveBeenCalledWith('restore demo card failed: cards: boom');
});

it('still signs Aisyah in when the service-role client cannot even be made', async () => {
  h.createAdmin.mockImplementationOnce(() => {
    throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
  });
  await expect(signInDemo('aisyah')).rejects.toThrow('NEXT_REDIRECT /home');
  expect(h.restore).not.toHaveBeenCalled();
  expect(h.signIn).toHaveBeenCalledOnce();
  expect(console.error).toHaveBeenCalledOnce();
});

it('does not touch a card for a name that is not a demo account', async () => {
  expect(await signInDemo('__proto__' as never)).toEqual({ error: 'landing.demo.error' });
  expect(h.createAdmin).not.toHaveBeenCalled();
  expect(h.signIn).not.toHaveBeenCalled();
});

it('no longer signs anyone in as Nur: she registers instead', async () => {
  expect(await signInDemo('nur' as never)).toEqual({ error: 'landing.demo.error' });
  expect(h.signIn).not.toHaveBeenCalled();
});

it("starts Nur's registration over and opens Register with the code in a cookie, never in the URL", async () => {
  h.restart.mockResolvedValue('K7Q4M29X');
  await expect(tryRegistering()).rejects.toThrow('NEXT_REDIRECT /register');
  expect(h.cookieSet).toHaveBeenCalledWith(REGISTER_CODE_COOKIE, 'K7Q4M29X', expect.objectContaining({ httpOnly: true, path: '/register', maxAge: 600 }));
});
it('says the demo did not work, and logs why, when the restart fails', async () => {
  h.restart.mockRejectedValueOnce(new Error('units: boom'));
  expect(await tryRegistering()).toEqual({ error: 'landing.demo.error' });
  expect(console.error).toHaveBeenCalled();
});
// Beyond the brief: the restart deletes accounts, so it gets the service-role client, and a failed one sets no cookie.
it('restarts with the service-role client, sets a same-site cookie, and sets none when the restart fails', async () => {
  h.restart.mockResolvedValueOnce('K7Q4M29X');
  await expect(tryRegistering()).rejects.toThrow('NEXT_REDIRECT /register');
  expect(h.restart).toHaveBeenCalledWith(h.admin);
  expect(h.cookieSet).toHaveBeenCalledWith(REGISTER_CODE_COOKIE, 'K7Q4M29X', expect.objectContaining({ sameSite: 'lax', secure: false }));
  // Secure in production, where the site is https; not on the plain http of a laptop's dev server.
  vi.stubEnv('NODE_ENV', 'production');
  h.restart.mockResolvedValueOnce('K7Q4M29X');
  await expect(tryRegistering()).rejects.toThrow('NEXT_REDIRECT /register');
  expect(h.cookieSet).toHaveBeenLastCalledWith(REGISTER_CODE_COOKIE, 'K7Q4M29X', expect.objectContaining({ secure: true }));
  h.cookieSet.mockClear();
  h.restart.mockRejectedValueOnce(new Error('units: boom'));
  await tryRegistering();
  expect(h.cookieSet).not.toHaveBeenCalled();
});
