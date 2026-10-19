// Beyond the brief's test file: the three public routes, which anyone can post anything to. The service-role client is faked.
vi.mock('server-only', () => ({}));
const h = vi.hoisted(() => ({ client: undefined as unknown, made: 0 }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ((h.made += 1), h.client) }));

import { NextRequest } from 'next/server';
import { GET as sync } from '@/app/api/reader/sync/route';
import { POST as tap } from '@/app/api/reader/tap/route';
import { POST as visits } from '@/app/api/reader/visits/route';
import { generateSigningKey, importSigningKey, signNote, signPass, type PublicJwk } from '@/lib/card/crypto';

const now = new Date('2026-10-24T10:00:00Z');
const UNIT = 'No. 18, Jalan Elmina Valley 3/2';
const TOWNSHIP = '3f0c9a52-1b7e-4c1d-9a3e-2b8f6d4e1a90';
let signingKey: string;

/** A client that answers every query on a table with one fixed result, and keeps what was inserted. */
function fakeDb(answer: (table: string) => unknown) {
  const inserted: { table: string; row: unknown }[] = [];
  const from = (table: string) => {
    const query: object = new Proxy({}, {
      get: (_, method) =>
        method === 'then'
          ? (resolve: (result: unknown) => unknown) => Promise.resolve({ data: answer(table), error: null }).then(resolve)
          : (...args: unknown[]) => (method === 'insert' && inserted.push({ table, row: args[0] }), query),
    });
    return query;
  };
  return { inserted, from };
}
const live = (card: Record<string, unknown> = {}) => (table: string) =>
  ({
    cards: { status: 'active', places: ['facilities', 'gym', 'pool'], unit: { lease_end: null }, ...card },
    card_phones: { frozen_at: null },
  })[table] ?? [];

async function presentation(nonce: string) {
  const phone = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', phone.publicKey);
  const sec = now.getTime() / 1000;
  const pass = await signPass(
    { v: 1, card: 'c18', unit: UNIT, township: 't', phone: 'p1', key: { kty, crv, x, y } as PublicJwk, places: ['facilities', 'gym', 'pool'], suspended: false, leaseEnd: null, iat: sec, exp: sec + 86_400 },
    await importSigningKey(signingKey),
  );
  return signNote(pass, { place: 'pool', facility: null, at: now.getTime(), nonce }, phone.privateKey);
}
const post = (route: typeof tap, body: string) => route(new Request('https://serumpun.test/api/reader', { method: 'POST', body }));
const get = (township?: string) => {
  const url = new URL('https://serumpun.test/api/reader/sync');
  if (township !== undefined) url.searchParams.set('township', township);
  return sync(new NextRequest(url));
};

beforeAll(async () => { signingKey = await generateSigningKey(); });
beforeEach(() => {
  vi.stubEnv('CARD_SIGNING_KEY', signingKey);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  h.made = 0;
  h.client = fakeDb(live());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('GET /api/reader/sync', () => {
  it('answers 400 to a missing or malformed township before it touches the database', async () => {
    const bad = [undefined, '', 'abc', '1', "x' or '1'='1", `${TOWNSHIP} `, TOWNSHIP.slice(1), `${TOWNSHIP},id.neq.x`, TOWNSHIP.replace('3f0c', 'zzzz')];
    for (const township of bad) {
      const res = await get(township);
      expect(res.status, String(township)).toBe(400);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
    expect(h.made).toBe(0);
  });
  it('answers the public key, the clock and the stop list, with no name and no private key in them', async () => {
    h.client = fakeDb((table) =>
      ({
        cards: [{ id: 'card-9' }],
        card_phones: [{ id: 'phone-3' }],
        bookings: [{ facility_id: 'gym-1', start_hour: 18, user_id: 'u1' }],
        card_members: [{ user_id: 'u1', card_id: 'card-1' }],
      })[table],
    );
    const res = await get(TOWNSHIP);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['bookings', 'publicKey', 'serverTime', 'stop']);
    expect(Object.keys(body.publicKey).sort()).toEqual(['crv', 'kty', 'x', 'y']);
    expect(body).toMatchObject({
      serverTime: now.getTime(),
      stop: { cards: ['card-9'], phones: ['phone-3'] },
      bookings: [{ card: 'card-1', facility: 'gym-1', date: '2026-10-24', hour: 18 }],
    });
  });
});

describe('POST /api/reader/tap', () => {
  it('answers 400 bad_pass to a body that is not JSON, or not a tap', async () => {
    for (const body of ['', '{{{', 'null', '[]', '5', '"x"', '{}', JSON.stringify({ presentation: 'junk', place: 'pool', facility: null })]) {
      const res = await post(tap, body);
      expect(res.status, body).toBe(400);
      expect(await res.json()).toEqual({ error: 'bad_pass' });
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });
  it('grants a good tap and logs the visit for the card', async () => {
    const db = fakeDb(live());
    h.client = db;
    const res = await post(tap, JSON.stringify({ presentation: await presentation('t1'), place: 'pool', facility: null }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ granted: true, unit: UNIT });
    expect(db.inserted).toEqual([{ table: 'card_visits', row: { township_id: 't', card_id: 'c18', place: 'pool', facility_id: null, granted: true, reason: null, offline: false, nonce: 't1', at: now.toISOString() } }]);
  });
  it('answers a refusal as a normal 200 with the reason, since the reader understood the card', async () => {
    h.client = fakeDb(live({ status: 'suspended' }));
    const res = await post(tap, JSON.stringify({ presentation: await presentation('t2'), place: 'pool', facility: null }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ granted: false, reason: 'card_suspended' });
  });
});

describe('POST /api/reader/visits', () => {
  it('saves nothing from a body that is not JSON, or not a list of visits, and still answers', async () => {
    const db = fakeDb(live());
    h.client = db;
    for (const body of ['', '{{{', 'null', '[]', '{}', '{"visits":"x"}']) {
      const res = await post(visits, body);
      expect(res.status, body).toBe(200);
      expect(await res.json()).toEqual({ saved: 0, skipped: 0 });
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
    expect(db.inserted).toEqual([]);
  });
  it('saves a good visit, skips junk, and counts both', async () => {
    const db = fakeDb(live());
    h.client = db;
    const at = now.getTime();
    const visit = { place: 'pool', facility: null, at, granted: true, reason: null };
    const res = await post(visits, JSON.stringify({ visits: [{ ...visit, presentation: await presentation('v1') }, { ...visit, presentation: 'junk' }] }));
    expect(await res.json()).toEqual({ saved: 1, skipped: 1 });
    expect(db.inserted).toHaveLength(1);
    expect(db.inserted[0].row).toMatchObject({ nonce: 'v1', offline: true, card_id: 'c18' });
  });
});
