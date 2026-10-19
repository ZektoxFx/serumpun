// Beyond the brief's two test files: the server actions' own logic (the answers to the pad, and signing in first).
vi.mock('server-only', () => ({}));
const h = vi.hoisted(() => ({ signedIn: true, lang: 'en' as 'en' | 'ms', rpc: vi.fn() }));
vi.mock('@/lib/supabase/auth', () => ({
  // The real one redirects, which Next implements by throwing.
  requireMember: async () => {
    if (!h.signedIn) throw new Error('NEXT_REDIRECT');
    return { lang: h.lang };
  },
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: h.rpc }) }));

import { generateSigningKey, publicJwkFromSigningKey, verifyPass, type PublicJwk } from '@/lib/card/crypto';
import { checkCardPin, renewPass } from '@/app/(app)/me/card/actions';

const browserKey = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } as PublicJwk;
const fields = { card: 'c18', unit: 'No. 18, Jalan Elmina Valley 3/2', township: 't', phone: 'p1', places: ['gym'], suspended: false, lease_end: null };
const answer = (data: unknown, error: { message: string } | null = null) => h.rpc.mockResolvedValueOnce({ data, error });

beforeEach(() => {
  h.signedIn = true;
  h.lang = 'en';
  h.rpc.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('checkCardPin', () => {
  it('turns away a PIN that is not six digits without spending a try', async () => {
    expect(await checkCardPin('12345')).toEqual({ ok: false, error: 'card.pin.error.format' });
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it('turns away a PIN that is not a string, even one that reads as six digits, without spending a try', async () => {
    // What the database would say if one got through: it counts each of these as a wrong try.
    h.rpc.mockResolvedValue({ data: { ok: false, tries_left: 3 }, error: null });
    for (const pin of [123456, ['123456'], { toString: 'x' }]) {
      expect(await checkCardPin(pin as never), JSON.stringify(pin)).toEqual({ ok: false, error: 'card.pin.error.format' });
    }
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it('lets a right PIN through', async () => {
    answer({ ok: true });
    expect(await checkCardPin('123456')).toEqual({ ok: true });
    expect(h.rpc).toHaveBeenCalledWith('verify_card_pin', { p_pin: '123456' });
  });
  it('counts the tries left after a wrong PIN', async () => {
    answer({ ok: false, tries_left: 3 });
    expect(await checkCardPin('000000')).toEqual({ ok: false, error: 'card.pin.error.wrong', triesLeft: 3 });
  });
  it('gives the time a locked PIN opens again, in Malaysia time and the resident\'s language, and the exact moment', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime('2026-10-24T10:00:00Z');
    h.lang = 'ms';
    answer({ ok: false, locked_until: '2026-10-24T10:15:00.123456+00:00' }); // how Postgres writes a timestamptz inside jsonb
    expect(await checkCardPin('000000')).toEqual({
      ok: false, error: 'card.pin.error.locked', lockedUntil: '2026-10-24T10:15:00.123Z', time: '6:15 PTG',
    });
  });
  it('says something went wrong when the database errors, for no PIN yet as for anything else', async () => {
    for (const message of ['no_pin', 'boom']) {
      answer(null, { message });
      expect(await checkCardPin('123456')).toEqual({ ok: false, error: 'common.error' });
    }
  });
});

describe('renewPass', () => {
  it('hands back a pass signed with the township key', async () => {
    const encoded = await generateSigningKey();
    vi.stubEnv('CARD_SIGNING_KEY', encoded);
    answer(fields);
    const result = (await renewPass(browserKey)) as { pass: string };
    expect(await verifyPass(result.pass, publicJwkFromSigningKey(encoded))).toMatchObject({ card: 'c18', key: browserKey });
  });
  it("tells a refusal in the card's own words and anything else with the generic error", async () => {
    vi.stubEnv('CARD_SIGNING_KEY', await generateSigningKey());
    answer(null, { message: 'card_full' });
    expect(await renewPass(browserKey)).toEqual({ error: 'card.error.card_full' });
    answer(null, { message: 'boom' });
    expect(await renewPass(browserKey)).toEqual({ error: 'common.error' });
  });
  it('answers something that is not a key with the bad key message, without asking the database', async () => {
    vi.stubEnv('CARD_SIGNING_KEY', await generateSigningKey());
    expect(await renewPass(null as never)).toEqual({ error: 'card.error.bad_key' });
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

it('does nothing for someone who is not signed in', async () => {
  h.signedIn = false;
  await expect(checkCardPin('123456')).rejects.toThrow('NEXT_REDIRECT');
  await expect(renewPass(browserKey)).rejects.toThrow('NEXT_REDIRECT');
  expect(h.rpc).not.toHaveBeenCalled();
});
