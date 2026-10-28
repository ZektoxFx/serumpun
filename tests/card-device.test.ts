import { generateSigningKey, importSigningKey, publicJwkFromSigningKey, readPresentation, signPass, type PublicJwk } from '@/lib/card/crypto';
import { clearPass, forgetDevice, needsRenewal, openDevice, presentTap, renewalOutcome, savePass, type Device } from '@/lib/card/device';
import type { MessageKey } from '@/lib/i18n';
import en from '@/lib/i18n/en';

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

// Beyond the brief: dropping a pass, and what each answer to a renewal means for the pass this browser holds.
/** An IndexedDB with one store in a Map: only what device.ts asks of it, in the order the real one keeps (a request answers before its transaction completes). */
function fakeIdb(records: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(records));
  const objects = {
    get: (key: string) => {
      const request = { result: store.get(key), onsuccess: null as (() => void) | null };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
    put: (value: unknown, key: string) => void store.set(key, value),
    delete: (key: string) => void store.delete(key),
  };
  const transaction = () => {
    const made = { objectStore: () => objects, oncomplete: null as (() => void) | null };
    setTimeout(() => made.oncomplete?.());
    return made;
  };
  const idb = {
    open: () => {
      const opening = { result: { createObjectStore: () => {}, close: () => {}, transaction }, onsuccess: null as (() => void) | null };
      setTimeout(() => opening.onsuccess?.());
      return opening;
    },
  };
  return { idb: idb as unknown as IDBFactory, store };
}
const held = { keys: {} as CryptoKeyPair, publicKey: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }, pass: 'old.pass', passExp: 1_800_000_000 };

it('keeps a pass and when it ends with the stored keys, and only where a device is stored', async () => {
  const { idb, store } = fakeIdb({ 'this-browser': { ...held, pass: null, passExp: null } });
  await savePass(idb, 'new.pass', 1_900_000_000);
  expect(store.get('this-browser')).toEqual({ ...held, pass: 'new.pass', passExp: 1_900_000_000 });
  const empty = fakeIdb();
  await savePass(empty.idb, 'new.pass', 1_900_000_000);
  expect(empty.store.size).toBe(0);
});
it('drops the pass and keeps the keys, so a refused browser has nothing to present and still has its key', async () => {
  const { idb, store } = fakeIdb({ 'this-browser': held });
  await clearPass(idb);
  expect(store.get('this-browser')).toEqual({ ...held, pass: null, passExp: null });
});
it('has nothing to drop in a browser that holds no device, and makes none', async () => {
  const { idb, store } = fakeIdb();
  await clearPass(idb);
  expect(store.size).toBe(0);
});
it('forgets the device, so the next one opened has a key of its own', async () => {
  const { idb, store } = fakeIdb();
  const first = (await openDevice(idb)) as Device;
  expect(store.has('this-browser')).toBe(true);
  await forgetDevice(idb);
  expect(store.has('this-browser')).toBe(false);
  const second = (await openDevice(idb)) as Device;
  expect(second.publicKey.x).not.toBe(first.publicKey.x);
});

describe('what an answer to a renewal means', () => {
  it('waits for the card to move here: no pass to drop, and asks again in a few seconds', () => {
    expect(renewalOutcome('card.move.waiting')).toEqual({ dropPass: false, retry: 'soon' });
  });
  it('drops the pass and stops asking once the card is on another phone', () => {
    expect(renewalOutcome('card.move.moved')).toEqual({ dropPass: true, retry: 'never' });
  });
  it('drops the pass and stops asking for every other card error', () => {
    const errors = Object.keys(en).filter((key) => key.startsWith('card.error.')) as MessageKey[];
    expect(errors).toEqual(expect.arrayContaining(['card.error.no_card', 'card.error.card_full', 'card.error.bad_key', 'card.error.phone_elsewhere']));
    for (const key of errors) expect(renewalOutcome(key), key).toEqual({ dropPass: true, retry: 'never' });
  });
  it('keeps the pass and asks again on the usual schedule when the township could not be reached', () => {
    expect(renewalOutcome('common.error')).toEqual({ dropPass: false, retry: 'usual' });
  });
});
