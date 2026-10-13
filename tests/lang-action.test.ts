const h = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  signedInAs: null as string | null,
  saves: [] as { table: string; values: unknown; column: string; value: string }[],
  saveError: null as { message: string } | null,
}));

vi.mock('next/headers', () => ({ cookies: async () => ({ set: h.cookieSet }) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: h.signedInAs ? { claims: { sub: h.signedInAs } } : null }) },
    from: (table: string) => ({
      update: (values: unknown) => ({
        eq: async (column: string, value: string) => {
          h.saves.push({ table, values, column, value });
          return { error: h.saveError };
        },
      }),
    }),
  }),
}));

import { setLang } from '@/lib/i18n/actions';

beforeEach(() => {
  h.cookieSet.mockClear();
  h.signedInAs = null;
  h.saves.length = 0;
  h.saveError = null;
});

it('remembers the language in a cookie for a year', async () => {
  await setLang('ms');
  expect(h.cookieSet).toHaveBeenCalledWith('lang', 'ms', expect.objectContaining({ path: '/', maxAge: 31_536_000 }));
});

it('also saves it on the profile of the signed-in user', async () => {
  h.signedInAs = 'user-1';
  await setLang('ms');
  expect(h.saves).toEqual([{ table: 'profiles', values: { lang: 'ms' }, column: 'id', value: 'user-1' }]);
});

it('only sets the cookie when nobody is signed in (the landing page)', async () => {
  await setLang('en');
  expect(h.cookieSet).toHaveBeenCalledTimes(1);
  expect(h.saves).toEqual([]);
});

it('ignores a language the app does not have', async () => {
  h.signedInAs = 'user-1';
  await setLang('fr' as never);
  expect(h.cookieSet).not.toHaveBeenCalled();
  expect(h.saves).toEqual([]);
});

it('still switches the page when the profile cannot be saved', async () => {
  h.signedInAs = 'user-1';
  h.saveError = { message: 'boom' };
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(setLang('ms')).resolves.toBeUndefined();
  expect(h.cookieSet).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
