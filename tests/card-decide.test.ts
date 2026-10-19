import { DENY_REASONS, decideTap, offlineState, reasonKey, type ReaderCache, type TapState } from '@/lib/card/decide';
import type { PassPayload, TapNote } from '@/lib/card/crypto';
import { t } from '@/lib/i18n';

const now = new Date('2026-10-24T10:00:00Z'); // 6 pm in Malaysia
const sec = now.getTime() / 1000;
const pass = {
  v: 1, card: 'c18', unit: 'No. 18, Jalan Elmina Valley 3/2', township: 't', phone: 'p1',
  key: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }, places: ['facilities', 'gym', 'pool'],
  suspended: false, leaseEnd: null, iat: sec - 60, exp: sec + 86_340,
} as PassPayload;
const note = (o: Partial<TapNote> = {}): TapNote => ({ place: 'pool', facility: null, at: now.getTime(), nonce: 'n', ...o });
const state = (o: Partial<TapState> = {}): TapState => ({ suspended: false, leaseEnd: null, phoneFrozen: false, places: ['facilities', 'gym', 'pool'], hasBooking: false, ...o });
const tap = (o: Partial<Parameters<typeof decideTap>[0]> = {}) =>
  decideTap({ pass, note: note(), place: 'pool', facility: null, state: state(), now, ...o });
const no = (reason: string) => ({ granted: false, reason });

it('grants a walk-in pool tap for an active card with the pool on', () => expect(tap()).toEqual({ granted: true }));
it('refuses an expired pass', () => expect(tap({ pass: { ...pass, exp: sec - 1 } })).toEqual(no('pass_expired')));
it('refuses a note more than a minute old', () => expect(tap({ note: note({ at: now.getTime() - 61_000 }) })).toEqual(no('pass_expired')));
it('accepts a phone clock 45 seconds ahead of the reader', () => expect(tap({ note: note({ at: now.getTime() + 45_000 }) })).toEqual({ granted: true }));
it('refuses a note made for another reader', () => expect(tap({ note: note({ place: 'gym' }) })).toEqual(no('pass_expired')));
it('accepts a QR note at any reader', () => expect(tap({ note: note({ place: null }) })).toEqual({ granted: true }));
it('checks a frozen phone before the card', () => expect(tap({ state: state({ phoneFrozen: true, suspended: true }) })).toEqual(no('phone_off')));
it('refuses a suspended card', () => expect(tap({ state: state({ suspended: true }) })).toEqual(no('card_suspended')));
it('ends a lease at the end of its last day in Malaysia', () => {
  const s = state({ leaseEnd: '2026-10-26' });
  const at = (iso: string) => { const d = new Date(iso); return tap({ state: s, now: d, note: note({ at: d.getTime() }), pass: { ...pass, exp: d.getTime() / 1000 + 600 } }); };
  expect(at('2026-10-26T15:59:00Z')).toEqual({ granted: true }); // 11:59 pm in Malaysia
  expect(at('2026-10-26T16:00:00Z')).toEqual(no('lease_ended')); // midnight in Malaysia
});
it('refuses a place switched off for the card', () => expect(tap({ state: state({ places: ['facilities', 'gym'] }) })).toEqual(no('place_off')));
it('needs a booking at the gym and the courts, not at the pool', () => {
  const gym = { place: 'gym' as const, facility: 'f-gym', note: note({ place: 'gym', facility: 'f-gym' }) };
  expect(tap(gym)).toEqual(no('no_booking'));
  expect(tap({ ...gym, state: state({ hasBooking: true }) })).toEqual({ granted: true });
  expect(tap()).toEqual({ granted: true });
});

// Beyond the brief: the branches and decisions its tests leave unpinned.
it('accepts a note exactly a minute off, either way: "more than a minute" is strict', () => {
  for (const off of [-60_000, 60_000]) expect(tap({ note: note({ at: now.getTime() + off }) })).toEqual({ granted: true });
});
it("refuses, rather than grants, when the reader's clock is not a time", () => expect(tap({ now: new Date(NaN) })).toEqual(no('pass_expired')));
it('refuses a note made for another court at the same place', () => {
  const court = { place: 'facilities' as const, facility: 'court-1', state: state({ hasBooking: true }) };
  expect(tap({ ...court, note: note({ place: 'facilities', facility: 'court-1' }) })).toEqual({ granted: true });
  expect(tap({ ...court, note: note({ place: 'facilities', facility: 'court-2' }) })).toEqual(no('pass_expired'));
});
it('accepts a QR note at a gym or court reader, which still wants the booking', () => {
  const gym = { place: 'gym' as const, facility: 'f-gym', note: note({ place: null }) };
  expect(tap(gym)).toEqual(no('no_booking'));
  expect(tap({ ...gym, state: state({ hasBooking: true }) })).toEqual({ granted: true });
});
it('gives the first reason in the check order when several apply', () => {
  const gym = { place: 'gym' as const, note: note({ place: 'gym' }) };
  const worst = state({ phoneFrozen: true, suspended: true, leaseEnd: '2026-10-23', places: [] });
  const run = (o: Partial<TapState>, exp = sec + 600) => {
    const d = tap({ ...gym, pass: { ...pass, exp }, state: { ...worst, ...o } });
    return d.granted ? 'granted' : d.reason;
  };
  expect([
    run({}, sec - 1),
    run({}),
    run({ phoneFrozen: false }),
    run({ phoneFrozen: false, suspended: false }),
    run({ phoneFrozen: false, suspended: false, leaseEnd: null }),
    run({ phoneFrozen: false, suspended: false, leaseEnd: null, places: ['gym'] }),
  ]).toEqual(['pass_expired', 'phone_off', 'card_suspended', 'lease_ended', 'place_off', 'no_booking']);
});

describe('offlineState', () => {
  const cache = (o: Partial<ReaderCache> = {}): ReaderCache => ({
    publicKey: pass.key, offsetMs: 0, syncedAt: 0, stop: { cards: [], phones: [] }, bookings: [], ...o,
  });
  it('treats a card on the stop list as suspended and a listed phone as frozen', () => {
    const s = offlineState(pass, cache({ stop: { cards: ['c18'], phones: ['p1'] } }), null, now);
    expect([s.suspended, s.phoneFrozen]).toEqual([true, true]);
  });
  it("finds this hour's booking for the card at this facility", () => {
    const bookings = [{ card: 'c18', facility: 'f-gym', date: '2026-10-24', hour: 18 }];
    expect(offlineState(pass, cache({ bookings }), 'f-gym', now).hasBooking).toBe(true);
    expect(offlineState(pass, cache({ bookings: [{ ...bookings[0], hour: 17 }] }), 'f-gym', now).hasBooking).toBe(false);
  });
  it('takes the places and the lease end from the pass', () => {
    const s = offlineState({ ...pass, places: ['pool'], leaseEnd: '2027-01-31' }, cache(), null, now);
    expect([s.places, s.leaseEnd]).toEqual([['pool'], '2027-01-31']);
  });
});

it('names every deny reason in both languages', () => {
  for (const reason of DENY_REASONS) {
    expect(t('en', reasonKey(reason))).not.toBe(reasonKey(reason));
    expect(t('ms', reasonKey(reason))).not.toBe(t('en', reasonKey(reason)));
  }
});
