/**
 * This browser's half of the household card, kept in IndexedDB (database `serumpun-card`, one store): the key pair that
 * signs every tap, and the pass the township last signed for its public half. The private key is made non-extractable,
 * so this browser can use it but nothing can read it out. Client only; the reader and the server never import it.
 */
// From core, not the index: the index brings React context, and this is library code.
import type { MessageKey } from '@/lib/i18n/core';
import { signNote, type Place, type PublicJwk } from './crypto';

export type Device = { keys: CryptoKeyPair; publicKey: PublicJwk; pass: string | null; passExp: number | null };

const DATABASE = 'serumpun-card';
const STORE = 'device';
const RECORD = 'this-browser'; // the store's one record, a Device
const RENEW_WITHIN_SECONDS = 3_600;

/**
 * Runs `work` in one transaction on the store and answers once that transaction has committed. `work` starts its
 * requests and hands back a reader of what they found, which is only called after the commit.
 */
function inStore<T>(idb: IDBFactory, mode: IDBTransactionMode, work: (store: IDBObjectStore) => () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    const opening = idb.open(DATABASE, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      try {
        const transaction = db.transaction(STORE, mode);
        const outcome = work(transaction.objectStore(STORE));
        transaction.oncomplete = () => {
          db.close();
          resolve(outcome());
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error);
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    };
  });
}

/**
 * This browser's device record; the first time, it makes the key pair and stores it. 'unsupported' when the browser
 * cannot hold it: no IndexedDB (some in-app browsers), storage refused (private windows), or no WebCrypto (a page that
 * is not served over https).
 */
export async function openDevice(idb: IDBFactory | undefined): Promise<Device | 'unsupported'> {
  if (!idb) return 'unsupported';
  try {
    const saved = await inStore(idb, 'readonly', (store) => {
      const found = store.get(RECORD);
      return () => found.result as Device | undefined;
    });
    if (saved) return saved;
    const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', keys.publicKey);
    const made: Device = { keys, publicKey: { kty, crv, x, y } as PublicJwk, pass: null, passExp: null };
    // A second tab, or a second run of an effect, may have stored a device while this one was made: the first one stored wins.
    return await inStore(idb, 'readwrite', (store) => {
      const found = store.get(RECORD);
      found.onsuccess = () => {
        if (found.result === undefined) store.put(made, RECORD);
      };
      return () => (found.result as Device | undefined) ?? made;
    });
  } catch (error) {
    console.warn('the household card cannot be kept in this browser', error);
    return 'unsupported';
  }
}

/** Sets the stored device's pass and when it ends. With no stored device there is nothing to set it on. */
function setPass(idb: IDBFactory, pass: string | null, passExp: number | null): Promise<void> {
  return inStore(idb, 'readwrite', (store) => {
    const found = store.get(RECORD);
    found.onsuccess = () => {
      if (found.result !== undefined) store.put({ ...found.result, pass, passExp }, RECORD);
    };
    return () => undefined;
  });
}

/** Keeps `pass` (which ends at `exp`, in seconds) with the stored keys. With no stored device there is nothing to attach it to. */
export function savePass(idb: IDBFactory, pass: string, exp: number): Promise<void> {
  return setPass(idb, pass, exp);
}

/** Drops the stored pass and keeps the keys: the browser still has its key, but nothing to present. */
export function clearPass(idb: IDBFactory): Promise<void> {
  return setPass(idb, null, null);
}

/** Deletes the stored device, keys and all, so the next `openDevice` makes a new key: how a browser asks for the card again after it moved away. */
export function forgetDevice(idb: IDBFactory): Promise<void> {
  return inStore(idb, 'readwrite', (store) => {
    store.delete(RECORD);
    return () => undefined;
  });
}

/**
 * What an error answer to a renewal means for the pass this browser holds, and when it asks again:
 * - the key waits for the card to move to it: there is no pass to drop, and it asks again in a few seconds;
 * - the card moved away, or any other card error (no card, a full card, a bad key, a phone on another card): the township
 *   refused, so no pass is left to present, and asking again would only get the same answer until the page loads again;
 * - anything else (the township could not be reached): the pass it has may still be good, so it stays, and the usual schedule
 *   (when the pass is down to its last hour, or the browser comes back online) asks again.
 * Any error not named here counts as a refusal: the pass goes rather than stays.
 */
export type RenewalOutcome = { dropPass: boolean; retry: 'soon' | 'usual' | 'never' };
export function renewalOutcome(error: MessageKey): RenewalOutcome {
  if (error === 'card.move.waiting') return { dropPass: false, retry: 'soon' };
  if (error === 'common.error') return { dropPass: false, retry: 'usual' };
  return { dropPass: true, retry: 'never' };
}

/** No pass at all, or less than an hour left on it. `passExp` is in seconds, `now` in milliseconds. */
export function needsRenewal(passExp: number | null, now: number): boolean {
  return passExp === null || passExp - now / 1000 < RENEW_WITHIN_SECONDS;
}

/**
 * The pass plus a note this browser signs with its own key: where it is held, when, and a random number so that a note
 * never repeats. `place: null` is the QR, which any reader takes. The reader judges the pass and the note, not this.
 */
export async function presentTap(
  device: Pick<Device, 'keys' | 'pass'>,
  at: { place: Place | null; facility: string | null },
  now: number,
): Promise<string> {
  if (device.pass === null) throw new Error('there is no pass to present yet');
  // 16 random bytes in base64url, the alphabet of the rest of the wire format.
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return signNote(device.pass, { place: at.place, facility: at.facility, at: now, nonce }, device.keys.privateKey);
}
