import { env, readEnv } from '@/lib/env';

it('returns the first key that is set', () => {
  expect(readEnv({ B: 'x' }, ['A', 'B'])).toBe('x');
});

it('names every accepted key when none is set', () => {
  expect(() => readEnv({}, ['A', 'B'])).toThrow(/Missing env: A or B/);
});

// Beyond the brief: the two edges that decide which Supabase key wins and what counts as "set".
it('prefers the earlier key, and treats an empty value as missing', () => {
  expect(readEnv({ A: 'a', B: 'b' }, ['A', 'B'])).toBe('a');
  expect(readEnv({ A: '', B: 'b' }, ['A', 'B'])).toBe('b');
  expect(() => readEnv({ A: '' }, ['A'])).toThrow(/Missing env: A/);
});

describe('env', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is lazy: importing it never throws, reading a missing value does', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expect(() => env.supabaseUrl).toThrow(/Missing env: NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('accepts either name for the anon key and the service key', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'pub');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sec');
    expect(env.supabaseAnonKey).toBe('pub');
    expect(env.serviceRoleKey).toBe('sec');
  });

  it('refuses to hand out server secrets inside a browser', () => {
    vi.stubEnv('DEMO_PASSWORD', 'pw');
    expect(env.demoPassword).toBe('pw');
    vi.stubGlobal('window', {});
    expect(() => env.demoPassword).toThrow(/server-only/);
    expect(() => env.serviceRoleKey).toThrow(/server-only/);
    expect(() => env.databaseUrl).toThrow(/server-only/);
    expect(() => env.cardSigningKey).toThrow(/server-only/);
  });

  // A paste, or `echo … | vercel env add`, leaves a newline on the key, and lib/card/crypto.ts refuses any whitespace.
  it('trims the card signing key', () => {
    vi.stubEnv('CARD_SIGNING_KEY', '  fake-key_123\r\n');
    expect(env.cardSigningKey).toBe('fake-key_123');
  });

  it.each(['', '   ', '\n', ' \t\r\n '])('treats a card signing key of %j as missing', (value) => {
    vi.stubEnv('CARD_SIGNING_KEY', value);
    expect(() => env.cardSigningKey).toThrow(/Missing env: CARD_SIGNING_KEY/);
  });
});
