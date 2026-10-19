import { generateSigningKey, importSigningKey, publicJwkFromSigningKey, readPresentation, signPass, type PublicJwk } from '@/lib/card/crypto';
import { needsRenewal, openDevice, presentTap } from '@/lib/card/device';

const now = Date.parse('2026-10-24T10:00:00Z');

it('needs a new pass when there is none or less than an hour is left', () => {
  expect(needsRenewal(null, now)).toBe(true);
  expect(needsRenewal(now / 1000 + 3_599, now)).toBe(true);
  expect(needsRenewal(now / 1000 + 3_600, now)).toBe(false);
});
it("says the browser can't hold the card when IndexedDB is missing", async () => {
  expect(await openDevice(undefined)).toBe('unsupported');
});
it('signs tap notes the reader accepts, each with its own nonce', async () => {
  const encoded = await generateSigningKey();
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', keys.publicKey);
  const pass = await signPass({ v: 1, card: 'c18', unit: 'No. 18', township: 't', phone: 'p1', key: { kty, crv, x, y } as PublicJwk, places: ['pool'], suspended: false, leaseEnd: null, iat: now / 1000, exp: now / 1000 + 86_400 }, await importSigningKey(encoded));
  const first = await readPresentation(await presentTap({ keys, pass }, { place: 'pool', facility: null }, now), publicJwkFromSigningKey(encoded));
  const second = await readPresentation(await presentTap({ keys, pass }, { place: 'pool', facility: null }, now), publicJwkFromSigningKey(encoded));
  expect(first!.note).toMatchObject({ place: 'pool', facility: null, at: now });
  expect(first!.note.nonce).not.toBe(second!.note.nonce);
});
