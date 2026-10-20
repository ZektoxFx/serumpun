vi.mock('server-only', () => ({}));
import { generateSigningKey, importSigningKey, publicJwkFromSigningKey, readPresentation, signNote, signPass, type PassPayload, type PublicJwk, type TapNote } from '@/lib/card/crypto';
import type { TapState } from '@/lib/card/decide';
import { handleTap, handleVisits, type ReaderDeps, type VisitRow } from '@/lib/card/reader-server';

const now = new Date('2026-10-24T10:00:00Z');
const active: TapState = { suspended: false, leaseEnd: null, phoneFrozen: false, places: ['facilities', 'gym', 'pool'], hasBooking: false };

async function setup(state: TapState = active, save: 'saved' | 'duplicate' = 'saved') {
  const encoded = await generateSigningKey();
  const phone = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', phone.publicKey);
  const sec = now.getTime() / 1000;
  const payload: PassPayload = { v: 1, card: 'c18', unit: 'No. 18, Jalan Elmina Valley 3/2', township: 't', phone: 'p1', key: { kty, crv, x, y } as PublicJwk, places: ['facilities', 'gym', 'pool'], suspended: false, leaseEnd: null, iat: sec, exp: sec + 86_400 };
  const pass = await signPass(payload, await importSigningKey(encoded));
  const present = (place: 'pool' | 'gym', nonce: string) => signNote(pass, { place, facility: null, at: now.getTime(), nonce }, phone.privateKey);
  const saved: VisitRow[] = [];
  const deps: ReaderDeps = {
    publicKey: publicJwkFromSigningKey(encoded), now: () => now, loadState: async () => state,
    saveVisit: async (v) => (saved.push(v), save),
  };
  return { deps, present, saved };
}

it('grants a valid tap and logs the visit by unit, not by person', async () => {
  const { deps, present, saved } = await setup();
  expect(await handleTap({ presentation: await present('pool', 'n1'), place: 'pool', facility: null }, deps)).toEqual({ granted: true, unit: 'No. 18, Jalan Elmina Valley 3/2' });
  expect(saved).toEqual([{ township_id: 't', card_id: 'c18', place: 'pool', facility_id: null, granted: true, reason: null, offline: false, nonce: 'n1', at: now.toISOString() }]);
});
it('refuses an online tap for a card suspended after its pass was issued', async () => {
  const { deps, present, saved } = await setup({ ...active, suspended: true });
  expect(await handleTap({ presentation: await present('pool', 'n2'), place: 'pool', facility: null }, deps)).toEqual({ granted: false, reason: 'card_suspended' });
  expect(saved[0]).toMatchObject({ granted: false, reason: 'card_suspended' });
});
it('refuses a replayed note', async () => {
  const { deps, present } = await setup(active, 'duplicate');
  expect(await handleTap({ presentation: await present('pool', 'n3'), place: 'pool', facility: null }, deps)).toEqual({ granted: false, reason: 'pass_expired' });
});
it('answers bad_pass for junk, and saves nothing', async () => {
  const { deps, saved } = await setup();
  for (const body of [null, {}, { presentation: 'a.b.c.d', place: 'pool', facility: null }, { presentation: 'x', place: 'lift', facility: null }]) {
    expect(await handleTap(body, deps)).toEqual({ error: 'bad_pass' });
  }
  expect(saved).toEqual([]);
});
it('saves offline visits as the reader decided them and skips bad ones', async () => {
  const { deps, present, saved } = await setup();
  const at = now.getTime();
  const visits = [
    { presentation: await present('pool', 'o1'), place: 'pool', facility: null, at, granted: true, reason: null },
    { presentation: await present('gym', 'o2'), place: 'gym', facility: null, at, granted: false, reason: 'no_booking' },
    { presentation: 'junk', place: 'pool', facility: null, at, granted: true, reason: null },
  ];
  expect(await handleVisits({ visits }, deps)).toEqual({ saved: 2, skipped: 1 });
  expect(saved.map((v) => [v.nonce, v.offline, v.granted, v.reason])).toEqual([['o1', true, true, null], ['o2', true, false, 'no_booking']]);
});

// Beyond the brief. These routes are public: anyone can post anything, so the same few lines must survive all of it.
const UNIT = 'No. 18, Jalan Elmina Valley 3/2';

/** A township key, a phone and its pass, with notes of any shape signed by that phone. The store answers like the unique index on card_visits.nonce. */
async function world() {
  const encoded = await generateSigningKey();
  const phone = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', phone.publicKey);
  const sec = now.getTime() / 1000;
  const payload: PassPayload = { v: 1, card: 'c18', unit: UNIT, township: 't', phone: 'p1', key: { kty, crv, x, y } as PublicJwk, places: ['facilities', 'gym', 'pool'], suspended: false, leaseEnd: null, iat: sec, exp: sec + 86_400 };
  const pass = await signPass(payload, await importSigningKey(encoded));
  const stored: VisitRow[] = [];
  const deps: ReaderDeps = {
    publicKey: publicJwkFromSigningKey(encoded), now: () => now, loadState: async () => active,
    saveVisit: async (visit) => {
      if (stored.some((v) => v.nonce === visit.nonce)) return 'duplicate';
      stored.push(visit);
      return 'saved';
    },
  };
  const note = (fields: Partial<TapNote>) => signNote(pass, { place: 'pool', facility: null, at: now.getTime(), nonce: 'n', ...fields }, phone.privateKey);
  return { deps, stored, note };
}
const tapAt = (presentation: string, place: 'pool' | 'gym' = 'pool', facility: string | null = null) => ({ presentation, place, facility });

const B64U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** The same signature spelled another way: the last of its 86 base64url characters has two spare bits, which the decoder drops. */
const respelled = (presentation: string) => {
  const i = B64U.indexOf(presentation.at(-1)!);
  return presentation.slice(0, -1) + B64U[(i & ~3) | ((i + 1) & 3)];
};

it('refuses a note shown again with its signature respelled: replay keys on the signed nonce, not on the text', async () => {
  const w = await world();
  const first = await w.note({ nonce: 'r1' });
  const again = respelled(first);
  // The premise: a different text that still verifies, so only the nonce can tell the two are one note.
  expect(again).not.toBe(first);
  expect(await readPresentation(again, w.deps.publicKey)).not.toBeNull();
  expect(await handleTap(tapAt(first), w.deps)).toEqual({ granted: true, unit: UNIT });
  expect(await handleTap(tapAt(again), w.deps)).toEqual({ granted: false, reason: 'pass_expired' });
  expect(w.stored.map((v) => v.nonce)).toEqual(['r1']);
});
it('skips a respelled copy of an offline visit, and one the server already took online', async () => {
  const w = await world();
  const first = await w.note({ nonce: 'r2' });
  const queued = await w.note({ nonce: 'r3' });
  const visit = (presentation: string) => ({ ...tapAt(presentation), at: now.getTime(), granted: true, reason: null });
  expect(await handleTap(tapAt(first), w.deps)).toEqual({ granted: true, unit: UNIT }); // the answer to this was lost, so the reader queued it too
  expect(await handleVisits({ visits: [visit(first), visit(queued), visit(respelled(queued))] }, w.deps)).toEqual({ saved: 1, skipped: 2 });
  expect(w.stored.map((v) => v.nonce)).toEqual(['r2', 'r3']);
});

it('answers bad_pass to every body that is not a tap request, before it checks a signature or touches the database', async () => {
  const w = await world();
  const presentation = await w.note({ nonce: 'b1' });
  const loadState = vi.fn(w.deps.loadState);
  const saveVisit = vi.fn(w.deps.saveVisit);
  const bodies = [
    undefined, 'x', 5, true, [], [presentation], {}, { presentation }, { presentation, place: 'pool' },
    { presentation: 5, place: 'pool', facility: null }, { presentation, place: 'Pool', facility: null },
    { presentation, place: 'pool', facility: 5 }, { presentation, place: 'pool', facility: undefined },
  ];
  for (const body of bodies) {
    expect(await handleTap(body, { ...w.deps, loadState, saveVisit }), JSON.stringify(body) ?? 'undefined').toEqual({ error: 'bad_pass' });
  }
  expect(loadState).not.toHaveBeenCalled();
  expect(saveVisit).not.toHaveBeenCalled();
});
it('answers bad_pass to a pass another township signed', async () => {
  const w = await world();
  const other = { ...w.deps, publicKey: publicJwkFromSigningKey(await generateSigningKey()) };
  expect(await handleTap(tapAt(await w.note({ nonce: 'b2' })), other)).toEqual({ error: 'bad_pass' });
  expect(w.stored).toEqual([]);
});
it('takes a presentation up to 4096 characters and refuses the next size up', async () => {
  const w = await world();
  // The nonce stretches it. The text grows with the nonce, so search for the longest nonce that still fits.
  const length = async (n: number) => (await w.note({ nonce: 'x'.repeat(n) })).length;
  let [fits, over] = [1, 4000];
  while (fits < over) {
    const mid = Math.ceil((fits + over) / 2);
    if ((await length(mid)) <= 4096) fits = mid;
    else over = mid - 1;
  }
  const [inside, outside] = [await w.note({ nonce: 'x'.repeat(fits) }), await w.note({ nonce: 'x'.repeat(fits + 1) })];
  expect(inside.length).toBeGreaterThan(4090);
  expect(inside.length).toBeLessThanOrEqual(4096);
  expect(outside.length).toBeGreaterThan(4096);
  expect(await readPresentation(outside, w.deps.publicKey)).not.toBeNull(); // otherwise valid: only its size is wrong
  expect(await handleTap(tapAt(inside), w.deps)).toEqual({ granted: true, unit: UNIT });
  expect(await handleTap(tapAt(outside), w.deps)).toEqual({ error: 'bad_pass' });
});
it("looks up the booking at the reader's court, never at the court a QR note names", async () => {
  const w = await world();
  const asked: (string | null)[] = [];
  const deps = { ...w.deps, loadState: async (_pass: PassPayload, facility: string | null) => (asked.push(facility), { ...active, hasBooking: facility === 'court-a' }) };
  // A QR note fits any reader, so what it says about a court must not choose which booking is looked up.
  const qr = await w.note({ place: null, facility: 'court-a', nonce: 'q1' });
  expect(await handleTap(tapAt(qr, 'gym', 'gym-1'), deps)).toEqual({ granted: false, reason: 'no_booking' });
  expect(asked).toEqual(['gym-1']);
  expect(w.stored[0]).toMatchObject({ place: 'gym', facility_id: 'gym-1', granted: false, reason: 'no_booking' });
});

it("records an offline visit at the reader's own time and decision, for the card and nothing else", async () => {
  const w = await world();
  const at = now.getTime() + 5_000; // the reader's clock, not the phone's
  const presentation = await w.note({ nonce: 'o3' });
  expect(await handleVisits({ visits: [{ ...tapAt(presentation), at, granted: false, reason: 'place_off' }] }, w.deps)).toEqual({ saved: 1, skipped: 0 });
  expect(w.stored).toEqual([{ township_id: 't', card_id: 'c18', place: 'pool', facility_id: null, granted: false, reason: 'place_off', offline: true, nonce: 'o3', at: new Date(at).toISOString() }]);
});
it('saves nothing from a body that is not { visits: [...] }', async () => {
  const w = await world();
  const visit = { ...tapAt(await w.note({ nonce: 'j1' })), at: now.getTime(), granted: true, reason: null };
  for (const body of [undefined, null, 'x', 5, [], [visit], {}, { visits: 'x' }, { visits: visit }, { visits: { 0: visit, length: 1 } }]) {
    expect(await handleVisits(body, w.deps), JSON.stringify(body) ?? 'undefined').toEqual({ saved: 0, skipped: 0 });
  }
  expect(w.stored).toEqual([]);
});
it('skips each queued visit that is not the shape a reader queues, without trusting any of it', async () => {
  const w = await world();
  const good = { ...tapAt(await w.note({ nonce: 'j2' })), at: now.getTime(), granted: true, reason: null };
  const junk = [
    null, 5, 'x', [], {},
    { ...good, presentation: 5 }, { ...good, place: 'lift' }, { ...good, facility: 5 }, { ...good, facility: undefined },
    { ...good, at: '1' }, { ...good, at: null }, { ...good, at: 1e20 }, { ...good, at: Infinity },
    { ...good, granted: 'yes' }, { ...good, reason: 'because' }, { ...good, granted: true, reason: 'no_booking' }, { ...good, granted: false, reason: null },
    { ...good, presentation: 'a'.repeat(4097) },
  ];
  expect(await handleVisits({ visits: junk }, w.deps)).toEqual({ saved: 0, skipped: junk.length });
  expect(w.stored).toEqual([]);
});
it('takes at most 500 visits and says how many it took, so the reader keeps the rest', async () => {
  const w = await world();
  const junk = { ...tapAt('junk'), at: now.getTime(), granted: true, reason: null };
  const valid = { ...tapAt(await w.note({ nonce: 'j3' })), at: now.getTime(), granted: true, reason: null };
  // The 501st is a good one: it is left alone, not skipped, because the reader removes only as many as the answer counts.
  expect(await handleVisits({ visits: [...Array.from({ length: 500 }, () => junk), valid] }, w.deps)).toEqual({ saved: 0, skipped: 500 });
  expect(w.stored).toEqual([]);
  expect(await handleVisits({ visits: Array.from({ length: 500 }, () => valid) }, w.deps)).toEqual({ saved: 1, skipped: 499 });
}, 20_000); // about 1,000 signature checks: past the 5 s default when every test file runs in parallel
