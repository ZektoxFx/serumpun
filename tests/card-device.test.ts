import { generateSigningKey, importSigningKey, publicJwkFromSigningKey, readPresentation, signPass, type PublicJwk } from '@/lib/card/crypto';
import { clearPass, dropForeignPass, forgetDevice, needsRenewal, openDevice, presentTap, renewalOutcome, savePass, type Device } from '@/lib/card/device';
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
/**
 * An IndexedDB with one store in a Map: only what device.ts asks of it, in the order the real one keeps (a request answers
 * before its transaction completes). As in the real one, a 'readonly' transaction refuses a put or a delete (ReadOnlyError),
 * and a request handler that throws aborts the transaction.
 */
function fakeIdb(records: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(records));
  const transaction = (_store: string, mode: IDBTransactionMode) => {
    let failure: unknown;
    const writable = () => {
      if (mode === 'readonly') throw new DOMException('The transaction is read-only.', 'ReadOnlyError');
    };
    const objects = {
      get: (key: string) => {
        const request = { result: store.get(key), onsuccess: null as (() => void) | null };
        queueMicrotask(() => {
          try {
            request.onsuccess?.();
          } catch (error) {
            failure = error;
          }
        });
        return request;
      },
      put: (value: unknown, key: string) => {
        writable();
        store.set(key, value);
      },
      delete: (key: string) => {
        writable();
        store.delete(key);
      },
    };
    const made = {
      objectStore: () => objects,
      oncomplete: null as (() => void) | null,
      onabort: null as (() => void) | null,
      get error() {
        return failure;
      },
    };
    setTimeout(() => (failure === undefined ? made.oncomplete : made.onabort)?.());
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
  // A waiting key has no pass of its own (keys only go waiting, active, retired), so a pass this browser holds is another
  // key's: one left by an account that signed out here. It must not stay to present.
  it('drops the pass while the card waits to move here, and asks again in a few seconds', () => {
    expect(renewalOutcome('card.move.waiting', false)).toEqual({ problem: 'card.move.waiting', dropPass: true, retry: 'soon' });
  });
  it('drops the pass and stops asking once the card is on another phone', () => {
    expect(renewalOutcome('card.move.moved', false)).toEqual({ problem: 'card.move.moved', dropPass: true, retry: 'never' });
  });
  it('drops the pass and stops asking for every other card error', () => {
    const errors = Object.keys(en).filter((key) => key.startsWith('card.error.')) as MessageKey[];
    expect(errors).toEqual(expect.arrayContaining(['card.error.no_card', 'card.error.card_full', 'card.error.bad_key', 'card.error.phone_elsewhere']));
    for (const key of errors) expect(renewalOutcome(key, false), key).toEqual({ problem: key, dropPass: true, retry: 'never' });
  });
  it('keeps the pass and asks again on the usual schedule when the township could not be reached', () => {
    expect(renewalOutcome('common.error', false)).toEqual({ problem: 'common.error', dropPass: false, retry: 'usual' });
  });

  // While the note says the card is waiting, no pass means no passExp, so the usual schedule would ask only every 5 minutes.
  it('keeps the waiting note and the few-second asking when the township cannot be reached during a wait', () => {
    expect(renewalOutcome('common.error', true)).toEqual({ problem: 'card.move.waiting', dropPass: true, retry: 'soon' });
  });
  it('still ends a wait for the card moving away or for any card error', () => {
    const errors = ['card.move.moved', ...Object.keys(en).filter((key) => key.startsWith('card.error.'))] as MessageKey[];
    for (const key of errors) expect(renewalOutcome(key, true), key).toEqual({ problem: key, dropPass: true, retry: 'never' });
  });
  it('goes on waiting when the answer is waiting again', () => {
    expect(renewalOutcome('card.move.waiting', true)).toEqual({ problem: 'card.move.waiting', dropPass: true, retry: 'soon' });
  });
});

describe('a pass left by another card', () => {
  const device = (pass: string | null): Device => ({ ...held, publicKey: held.publicKey as PublicJwk, pass, passExp: pass === null ? null : held.passExp });
  /** A pass the township signed for `card`. */
  async function passOf(card: string) {
    const township = await importSigningKey(await generateSigningKey());
    return signPass({ v: 1, card, unit: 'No. 18', township: 't', phone: 'p1', key: held.publicKey as PublicJwk, places: ['pool'], suspended: false, leaseEnd: null, iat: now / 1000, exp: now / 1000 + 86_400 }, township);
  }
  const json = (value: unknown) => `${Buffer.from(JSON.stringify(value)).toString('base64url')}.sig`;

  it('stays when it is for this card', async () => {
    const mine = device(await passOf('c18'));
    expect(dropForeignPass(mine, 'c18')).toBe(mine);
  });
  it('goes when it is for another card, and the keys stay', async () => {
    const theirs = device(await passOf('c7'));
    expect(dropForeignPass(theirs, 'c18')).toEqual({ ...theirs, pass: null, passExp: null });
  });
  it('has nothing to drop when there is no pass', () => {
    const empty = device(null);
    expect(dropForeignPass(empty, 'c18')).toBe(empty);
  });
  it.each([
    ['nothing at all', ''],
    ['text that is not a pass', 'not a pass'],
    ['a dot', '.'],
    ['a payload that is not base64url', '%%%.sig'],
    ['a payload that is not JSON', 'bm90IGpzb24.sig'],
    ['a payload with no card', json({})],
    ['a payload that is null', json(null)],
    ['a payload that is a number', json(18)],
    ['a card that is not text', json({ card: 18 })],
  ])('goes when it is unreadable: %s', (_what, pass) => {
    expect(dropForeignPass(device(pass), 'c18')).toEqual({ ...device(pass), pass: null, passExp: null });
  });
});
