import { QUEUE_MAX, afterFlush, enqueue, decideOffline } from '@/lib/card/queue';
import type { OfflineVisit, ReaderCache, TapRequest } from '@/lib/card/decide';
import { generateSigningKey, importSigningKey, publicJwkFromSigningKey, signNote, signPass, type PublicJwk } from '@/lib/card/crypto';

const visit = (i: number): OfflineVisit => ({ presentation: `p${i}`, place: 'pool', facility: null, at: i, granted: true, reason: null });

it('keeps visits in order and drops the oldest beyond 500', () => {
  let queue: OfflineVisit[] = [];
  for (let i = 0; i < QUEUE_MAX + 2; i++) queue = enqueue(queue, visit(i));
  expect(queue).toHaveLength(500);
  expect([queue[0].at, queue.at(-1)!.at]).toEqual([2, 501]);
});
it('removes only what the server took', () => {
  expect(afterFlush([visit(1), visit(2), visit(3)], 2)).toEqual([visit(3)]);
});

// Beyond the brief: the offline decision itself, on the reader's clock as its last sync corrected it (Review Focus 1).
it("decides offline on the township's clock, refuses a note it has seen, and queues nothing it can't read", async () => {
  const serverNow = Date.parse('2026-10-24T10:00:00Z');
  const signing = await generateSigningKey();
  const phone = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', phone.publicKey);
  const pass = await signPass(
    { v: 1, card: 'c18', unit: 'No. 18', township: 't', phone: 'p1', key: { kty, crv, x, y } as PublicJwk, places: ['pool'], suspended: false, leaseEnd: null, iat: serverNow / 1000, exp: serverNow / 1000 + 86_400 },
    await importSigningKey(signing),
  );
  const tapAt = async (nonce: string): Promise<TapRequest> => ({
    presentation: await signNote(pass, { place: 'pool', facility: null, at: serverNow, nonce }, phone.privateKey),
    place: 'pool',
    facility: null,
  });
  // This reader's own clock is 5 minutes slow, and its last sync measured that: the server's time minus its own.
  const slowClock = serverNow - 300_000;
  const cache: ReaderCache = { publicKey: publicJwkFromSigningKey(signing), offsetMs: 300_000, syncedAt: slowClock, stop: { cards: [], phones: [] }, bookings: [] };
  const seen = new Set<string>();
  const tap = await tapAt('n1');

  expect(await decideOffline(tap, cache, seen, slowClock)).toEqual({
    decision: { granted: true },
    unit: 'No. 18',
    visit: { ...tap, at: serverNow, granted: true, reason: null },
  });
  // The same note again is refused like a stale pass. Its visit is queued like any other; the township skips the copy.
  expect((await decideOffline(tap, cache, seen, slowClock))!.visit).toEqual({ ...tap, at: serverNow, granted: false, reason: 'pass_expired' });
  // Without the correction that fresh note would look 5 minutes old.
  expect((await decideOffline(await tapAt('n2'), { ...cache, offsetMs: 0 }, seen, slowClock))!.decision).toEqual({ granted: false, reason: 'pass_expired' });
  // A card on the stop list since its pass was signed is refused.
  const stopped = { ...cache, stop: { cards: ['c18'], phones: [] } };
  expect((await decideOffline(await tapAt('n3'), stopped, seen, slowClock))!.decision).toEqual({ granted: false, reason: 'card_suspended' });
  // Something no township key signed is nothing to decide on, or to queue.
  expect(await decideOffline({ ...tap, presentation: 'not.a.card.pass' }, cache, seen, slowClock)).toBeNull();
  expect(await decideOffline(tap, { ...cache, publicKey: publicJwkFromSigningKey(await generateSigningKey()) }, new Set(), slowClock)).toBeNull();
});
