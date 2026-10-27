// Beyond the brief's two test files: the server actions' own logic (the answers to the pad, and signing in first).
vi.mock('server-only', () => ({}));
const h = vi.hoisted(() => ({ signedIn: true, lang: 'en' as 'en' | 'ms', rpc: vi.fn(), adminRpc: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/supabase/auth', () => ({
  // The real one redirects, which Next implements by throwing.
  requireMember: async () => {
    if (!h.signedIn) throw new Error('NEXT_REDIRECT');
    return { id: 'u1', lang: h.lang };
  },
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: h.rpc }) }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: h.adminRpc }) }));
vi.mock('next/cache', () => ({ refresh: h.refresh }));

import { generateSigningKey, importSigningKey, publicJwkFromSigningKey, signNote, signPass, verifyPass, type PublicJwk } from '@/lib/card/crypto';
import { checkCardPin, declineMove, moveCard, renewPass } from '@/app/(app)/me/card/actions';

const browserKey = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } as PublicJwk;
const fields = { card: 'c18', unit: 'No. 18, Jalan Elmina Valley 3/2', township: 't', phone: 'p1', places: ['gym'], suspended: false, lease_end: null };
const answer = (data: unknown, error: { message: string } | null = null) => h.rpc.mockResolvedValueOnce({ data, error });

beforeEach(() => {
  h.signedIn = true;
  h.lang = 'en';
  h.rpc.mockReset();
  h.adminRpc.mockReset();
  h.refresh.mockReset();
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
  it('tells a browser whose key waits for the old phone, has moved away, or sits on another card', async () => {
    vi.stubEnv('CARD_SIGNING_KEY', await generateSigningKey());
    answer({ waiting: true });
    expect(await renewPass(browserKey)).toEqual({ error: 'card.move.waiting' });
    answer({ moved: true });
    expect(await renewPass(browserKey)).toEqual({ error: 'card.move.moved' });
    answer(null, { message: 'phone_elsewhere' });
    expect(await renewPass(browserKey)).toEqual({ error: 'card.error.phone_elsewhere' });
  });
});

describe('moveCard', () => {
  // The township's key, and the old browser's key pair, whose public half its pass carries.
  let township: string;
  let phone: CryptoKeyPair;
  let phoneKey: PublicJwk;
  beforeAll(async () => {
    township = await generateSigningKey();
    phone = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', phone.publicKey);
    phoneKey = { kty, crv, x, y } as PublicJwk;
  });
  beforeEach(() => vi.stubEnv('CARD_SIGNING_KEY', township));
  /** What the old browser sends, as card-reader.test.ts's setup makes it: a pass for phoneKey, and a note it signed at `at`. */
  async function presentation(at: number) {
    const sec = Math.floor(at / 1000);
    const pass = await signPass(
      { v: 1, card: 'c18', unit: fields.unit, township: 't', phone: 'p1', key: phoneKey, places: ['gym'], suspended: false, leaseEnd: null, iat: sec, exp: sec + 86_400 },
      await importSigningKey(township),
    );
    return signNote(pass, { place: null, facility: null, at, nonce: 'nonce-move-00001' }, phone.privateKey);
  }

  it('moves nothing for a presentation the township did not sign, or one older than a minute', async () => {
    expect(await moveCard('a.b.c.d', '123456')).toEqual({ ok: false, error: 'card.move.error.proof' });
    expect(await moveCard(await presentation(Date.now() - 120_000), '123456')).toEqual({ ok: false, error: 'card.move.error.proof' });
    expect(h.adminRpc).not.toHaveBeenCalled();
  });
  it('moves the key the presentation proves, for the signed-in person, through the service role', async () => {
    h.adminRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    expect(await moveCard(await presentation(Date.now()), '123456')).toEqual({ ok: true });
    expect(h.adminRpc).toHaveBeenCalledWith('move_phone_key', { p_user: 'u1', p_x: phoneKey.x, p_y: phoneKey.y, p_pin: '123456' });
  });

  // Beyond the brief: the rest of what the old browser can send.
  it('moves nothing for a note more than a minute ahead, another township key, or something that is not text', async () => {
    const other = await generateSigningKey();
    for (const sent of [await presentation(Date.now() + 120_000), 42, null, ['a.b.c.d']]) {
      expect(await moveCard(sent as never, '123456'), String(sent)).toEqual({ ok: false, error: 'card.move.error.proof' });
    }
    const fresh = await presentation(Date.now());
    vi.stubEnv('CARD_SIGNING_KEY', other);
    expect(await moveCard(fresh, '123456')).toEqual({ ok: false, error: 'card.move.error.proof' });
    expect(h.adminRpc).not.toHaveBeenCalled();
  });
  it('turns away a PIN that is not six digits before anything else, so it costs no try', async () => {
    for (const pin of ['12345', 123456, null]) {
      expect(await moveCard(await presentation(Date.now()), pin as never), String(pin)).toEqual({ ok: false, error: 'card.pin.error.format' });
    }
    expect(h.adminRpc).not.toHaveBeenCalled();
  });
  it("hands back the old phone's wrong PIN as the pad expects, and names a refusal", async () => {
    h.adminRpc.mockResolvedValueOnce({ data: { ok: false, tries_left: 3 }, error: null });
    expect(await moveCard(await presentation(Date.now()), '000000')).toEqual({ ok: false, error: 'card.pin.error.wrong', triesLeft: 3 });
    for (const code of ['not_this_phone', 'nothing_waiting']) {
      h.adminRpc.mockResolvedValueOnce({ data: null, error: { message: code } });
      expect(await moveCard(await presentation(Date.now()), '123456'), code).toEqual({ ok: false, error: `household.error.${code}` });
    }
    expect(console.error).not.toHaveBeenCalled();
  });
  it('says something went wrong for anything else, and logs the message but never the PIN or the presentation', async () => {
    const sent = await presentation(Date.now());
    h.adminRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await moveCard(sent, '123456')).toEqual({ ok: false, error: 'common.error' });
    expect(console.error).toHaveBeenCalledWith('move_phone_key failed: boom');
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    for (const secret of ['123456', sent, phoneKey.x]) expect(logged).not.toContain(secret);
  });
});

describe('declineMove', () => {
  it('turns the waiting browsers away as the signed-in person, then refreshes the page', async () => {
    answer(null);
    expect(await declineMove()).toEqual({});
    expect(h.rpc).toHaveBeenCalledWith('decline_phone_move');
    expect(h.adminRpc).not.toHaveBeenCalled();
    expect(h.refresh).toHaveBeenCalledOnce();
  });
  it('says something went wrong when the database errors, and logs it', async () => {
    answer(null, { message: 'boom' });
    expect(await declineMove()).toEqual({ error: 'common.error' });
    expect(console.error).toHaveBeenCalledWith('decline_phone_move failed: boom');
  });
});

it('does nothing for someone who is not signed in', async () => {
  h.signedIn = false;
  await expect(checkCardPin('123456')).rejects.toThrow('NEXT_REDIRECT');
  await expect(renewPass(browserKey)).rejects.toThrow('NEXT_REDIRECT');
  await expect(moveCard('a.b.c.d', '123456')).rejects.toThrow('NEXT_REDIRECT');
  await expect(declineMove()).rejects.toThrow('NEXT_REDIRECT');
  expect(h.rpc).not.toHaveBeenCalled();
  expect(h.adminRpc).not.toHaveBeenCalled();
  expect(h.refresh).not.toHaveBeenCalled();
});
