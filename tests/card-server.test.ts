vi.mock('server-only', () => ({}));
import { generateSigningKey, publicJwkFromSigningKey, verifyPass, type PublicJwk } from '@/lib/card/crypto';
import { issuePass } from '@/lib/card/server';

const now = new Date('2026-10-24T10:00:00Z');
const fields = { card: 'c18', unit: 'No. 18, Jalan Elmina Valley 3/2', township: 't', phone: 'p1', places: ['facilities', 'gym', 'pool'], suspended: false, lease_end: null };
const fakeDb = (result: { data: unknown; error: { message: string } | null }) => {
  const calls: unknown[] = [];
  return { calls, client: { rpc: async (name: string, args: unknown) => (calls.push([name, args]), result) } as never };
};

// An unrecognised database error is logged (like book/actions.ts does); keep it out of the test output.
beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

it('signs a 24-hour pass for the key the browser sent', async () => {
  const encoded = await generateSigningKey();
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const jwk = { kty, crv, x, y } as PublicJwk;
  const db = fakeDb({ data: fields, error: null });
  const result = await issuePass(db.client, jwk, now, encoded);
  expect(db.calls).toEqual([['register_phone_key', { p_x: jwk.x, p_y: jwk.y }]]);
  const payload = await verifyPass((result as { pass: string }).pass, publicJwkFromSigningKey(encoded));
  expect(payload).toMatchObject({ card: 'c18', phone: 'p1', key: jwk, leaseEnd: null, suspended: false });
  expect(payload!.exp - payload!.iat).toBe(86_400);
});
it("passes the database's refusal through", async () => {
  const key = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } as PublicJwk;
  expect(await issuePass(fakeDb({ data: null, error: { message: 'card_full' } }).client, key, now, await generateSigningKey())).toEqual({ error: 'card_full' });
  expect(await issuePass(fakeDb({ data: null, error: { message: 'boom' } }).client, key, now, await generateSigningKey())).toEqual({ error: 'failed' });
});
it('says when the key waits for the old phone, has moved away, or sits on another card', async () => {
  const key = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } as PublicJwk;
  const issue = async (result: { data: unknown; error: { message: string } | null }) => issuePass(fakeDb(result).client, key, now, await generateSigningKey());
  expect(await issue({ data: { waiting: true }, error: null })).toEqual({ error: 'move_waiting' });
  expect(await issue({ data: { moved: true }, error: null })).toEqual({ error: 'moved' });
  expect(await issue({ data: null, error: { message: 'phone_elsewhere' } })).toEqual({ error: 'phone_elsewhere' });
});

// Beyond the brief.
const browserKey = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } as PublicJwk;

it('signs only the four fields of a public key, whatever else the browser sent along', async () => {
  const encoded = await generateSigningKey();
  const sent = { ...browserKey, kty: 'RSA', d: 'secret', junk: 'x'.repeat(100) } as never;
  const { pass } = (await issuePass(fakeDb({ data: fields, error: null }).client, sent, now, encoded)) as { pass: string };
  expect((await verifyPass(pass, publicJwkFromSigningKey(encoded)))!.key).toEqual(browserKey);
});
it('imports each signing key once, and signs with the key it is given', async () => {
  const importKey = vi.spyOn(crypto.subtle, 'importKey');
  const [a, b] = [await generateSigningKey(), await generateSigningKey()];
  const issue = async (encoded: string) => ((await issuePass(fakeDb({ data: fields, error: null }).client, browserKey, now, encoded)) as { pass: string }).pass;
  const first = await issue(a);
  await issue(a);
  expect(importKey).toHaveBeenCalledTimes(1);
  const second = await issue(b);
  expect(importKey).toHaveBeenCalledTimes(2);
  expect(await verifyPass(first, publicJwkFromSigningKey(a))).not.toBeNull();
  expect(await verifyPass(second, publicJwkFromSigningKey(b))).not.toBeNull();
  expect(await verifyPass(second, publicJwkFromSigningKey(a))).toBeNull();
});
it('logs a database error it does not recognise, but not a refusal it does', async () => {
  const encoded = await generateSigningKey();
  await issuePass(fakeDb({ data: null, error: { message: 'no_card' } }).client, browserKey, now, encoded);
  expect(console.error).not.toHaveBeenCalled();
  await issuePass(fakeDb({ data: null, error: { message: 'boom' } }).client, browserKey, now, encoded);
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
});
it('refuses anything that is not a key without asking the database', async () => {
  const db = fakeDb({ data: fields, error: null });
  const encoded = await generateSigningKey();
  // It arrives from the browser through a server action, so it can be anything. The last two lack one coordinate each.
  for (const sent of [null, undefined, 'x', {}, { x: 1, y: 2 }, { x: 'x' }, { y: 'y' }]) {
    expect(await issuePass(db.client, sent as never, now, encoded), JSON.stringify(sent) ?? 'undefined').toEqual({ error: 'bad_key' });
  }
  expect(db.calls).toEqual([]);
});
