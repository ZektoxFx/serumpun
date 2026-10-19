// Beyond the brief's test file: the live state, the visit insert and the sync data, against a stand-in for the service-role client.
vi.mock('server-only', () => ({}));
import type { PassPayload, PublicJwk } from '@/lib/card/crypto';
import { adminReaderDeps, loadSync, type VisitRow } from '@/lib/card/reader-server';

const now = new Date('2026-10-24T10:00:00Z'); // 6 pm on the 24th in Malaysia
const publicKey = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } as PublicJwk;
// What the pass says is not what the database says, so a test can tell which one the state came from.
const pass = {
  v: 1, card: 'card-1', unit: 'No. 18, Jalan Elmina Valley 3/2', township: 'town-1', phone: 'phone-1', key: publicKey,
  places: ['pool'], suspended: false, leaseEnd: null, iat: 0, exp: 0,
} as PassPayload;

type Step = [method: string, ...args: unknown[]];
type Answer = { data: unknown; error: { code?: string; message: string } | null };
/** Records each query and answers it from `answer`. Like the real builder, a query runs when it is awaited. */
function fakeAdmin(answer: (table: string, steps: Step[]) => Answer) {
  const queries: { table: string; steps: Step[] }[] = [];
  const client = {
    from(table: string) {
      const steps: Step[] = [];
      const query: object = new Proxy({}, {
        get: (_, method) =>
          method === 'then'
            ? (resolve: (answer: Answer) => unknown) => {
                queries.push({ table, steps });
                return Promise.resolve(answer(table, steps)).then(resolve);
              }
            : (...args: unknown[]) => (steps.push([String(method), ...args]), query),
      });
      return query;
    },
  };
  const on = (table: string) => queries.filter((q) => q.table === table);
  return { queries, on, client: client as never };
}
/** The columns a query was narrowed by with `eq`. */
const eqs = (steps: Step[]) => Object.fromEntries(steps.filter(([method]) => method === 'eq').map(([, column, value]) => [column, value]));
const step = (steps: Step[], method: string) => steps.find(([m]) => m === method)?.slice(1);
const ok = (data: unknown): Answer => ({ data, error: null });
const failed = (code: string, message = 'boom'): Answer => ({ data: null, error: { code, message } });

describe('loadState', () => {
  const rows = (o: Partial<Record<string, Answer>> = {}) => (table: string) =>
    o[table] ?? {
      cards: ok({ status: 'active', places: ['facilities', 'gym', 'pool'], unit: { lease_end: null } }),
      card_phones: ok({ frozen_at: null }),
      bookings: ok([]),
      card_members: ok([]),
    }[table]!;

  it('takes the state from the database, not from the pass', async () => {
    const db = fakeAdmin(rows({
      cards: ok({ status: 'suspended', places: ['gym'], unit: { lease_end: '2026-10-25' } }),
      card_phones: ok({ frozen_at: '2026-10-24T01:00:00Z' }),
    }));
    expect(await adminReaderDeps(db.client, publicKey).loadState(pass, null, now)).toEqual({
      suspended: true, leaseEnd: '2026-10-25', phoneFrozen: true, places: ['gym'], hasBooking: false,
    });
    expect(eqs(db.on('cards')[0].steps)).toEqual({ id: 'card-1' });
    expect(eqs(db.on('card_phones')[0].steps)).toEqual({ id: 'phone-1' });
  });
  it('calls an active card and an unfrozen phone good', async () => {
    const db = fakeAdmin(rows());
    expect(await adminReaderDeps(db.client, publicKey).loadState(pass, null, now)).toEqual({
      suspended: false, leaseEnd: null, phoneFrozen: false, places: ['facilities', 'gym', 'pool'], hasBooking: false,
    });
  });
  it('refuses a card or a phone that is gone since the pass was signed, such as after a reset', async () => {
    const db = fakeAdmin(rows({ cards: ok(null), card_phones: ok(null) }));
    expect(await adminReaderDeps(db.client, publicKey).loadState(pass, null, now)).toEqual({
      suspended: true, leaseEnd: null, phoneFrozen: true, places: [], hasBooking: false,
    });
  });

  it("finds a booking by someone on the card, for the reader's court and this hour in Malaysia", async () => {
    const db = fakeAdmin(rows({ bookings: ok([{ user_id: 'u2' }]), card_members: ok([{ user_id: 'u1' }, { user_id: 'u2' }]) }));
    const state = await adminReaderDeps(db.client, publicKey).loadState(pass, 'gym-1', now);
    expect(state.hasBooking).toBe(true);
    const booking = db.on('bookings')[0].steps;
    expect(eqs(booking)).toEqual({ facility_id: 'gym-1', date: '2026-10-24', start_hour: 18, status: 'booked' });
    expect(eqs(db.on('card_members')[0].steps)).toEqual({ card_id: 'card-1' });
  });
  it('uses the Malaysian day and hour when UTC is still the day before', async () => {
    const db = fakeAdmin(rows());
    await adminReaderDeps(db.client, publicKey).loadState(pass, 'gym-1', new Date('2026-10-24T17:30:00Z')); // 1:30 am on the 25th
    expect(eqs(db.on('bookings')[0].steps)).toMatchObject({ date: '2026-10-25', start_hour: 1 });
  });
  it("does not count a booking by someone who is not on the card, or no booking at all", async () => {
    const state = (o: Partial<Record<string, Answer>>) => adminReaderDeps(fakeAdmin(rows(o)).client, publicKey).loadState(pass, 'gym-1', now);
    expect((await state({ bookings: ok([{ user_id: 'stranger' }]), card_members: ok([{ user_id: 'u1' }]) })).hasBooking).toBe(false);
    expect((await state({ bookings: ok([]), card_members: ok([{ user_id: 'u1' }]) })).hasBooking).toBe(false);
  });
  it('looks up no booking at a reader with no facility', async () => {
    const db = fakeAdmin(rows());
    await adminReaderDeps(db.client, publicKey).loadState(pass, null, now);
    expect(db.queries.map((q) => q.table).sort()).toEqual(['card_phones', 'cards']);
  });
  it('finds no booking at a facility that is not an id, instead of failing', async () => {
    const db = fakeAdmin(rows({ bookings: failed('22P02', 'invalid input syntax for type uuid') }));
    expect((await adminReaderDeps(db.client, publicKey).loadState(pass, 'not-an-id', now)).hasBooking).toBe(false);
  });

  it('throws on a failed lookup, so the reader decides for itself instead of being told a guess', async () => {
    for (const table of ['cards', 'card_phones', 'bookings', 'card_members']) {
      const db = fakeAdmin(rows({ [table]: failed('57P01', 'connection lost') }));
      await expect(adminReaderDeps(db.client, publicKey).loadState(pass, 'gym-1', now), table).rejects.toThrow('connection lost');
    }
  });
  it('reads no name and no phone number', async () => {
    const db = fakeAdmin(rows({ bookings: ok([{ user_id: 'u2' }]), card_members: ok([{ user_id: 'u2' }]) }));
    await adminReaderDeps(db.client, publicKey).loadState(pass, 'gym-1', now);
    const selected = db.queries.map((q) => String(step(q.steps, 'select')?.[0])).join(' | ');
    expect(selected).toContain('lease_end');
    expect(selected).not.toMatch(/name|record_|email|phone/);
  });
});

describe('saveVisit', () => {
  const visit: VisitRow = { township_id: 'town-1', card_id: 'card-1', place: 'pool', facility_id: null, granted: true, reason: null, offline: false, nonce: 'n1', at: now.toISOString() };
  const save = (answer: Answer) => {
    const db = fakeAdmin(() => answer);
    return { db, result: adminReaderDeps(db.client, publicKey).saveVisit(visit) };
  };

  it('inserts the visit into card_visits as it is', async () => {
    const { db, result } = save(ok(null));
    expect(await result).toBe('saved');
    expect(db.queries).toEqual([{ table: 'card_visits', steps: [['insert', visit]] }]);
  });
  it('answers duplicate when the nonce was used already', async () => {
    expect(await save(failed('23505', 'duplicate key value violates unique constraint "card_visits_nonce_key"')).result).toBe('duplicate');
  });
  it('answers duplicate for a visit that can never be saved, so a reader does not send it forever', async () => {
    // 23503: the card or court is gone since the pass was signed (a reset). 22P02, 22021: text the column cannot hold.
    for (const code of ['23503', '23514', '22P02', '22021']) expect(await save(failed(code)).result, code).toBe('duplicate');
  });
  it('throws on any other failure, so the reader keeps the visit and tries again', async () => {
    for (const code of ['', '57P01', '08006', 'PGRST301', '42501']) {
      await expect(save(failed(code, 'connection lost')).result, code).rejects.toThrow('connection lost');
    }
  });
});

describe('loadSync', () => {
  const answers = (table: string, steps: Step[]): Answer => {
    if (table === 'cards') return ok([{ id: 'card-9' }]);
    if (table === 'card_phones') return ok([{ id: 'phone-3' }, { id: 'phone-4' }]);
    if (table === 'bookings') {
      return ok([
        { facility_id: 'gym-1', start_hour: 18, user_id: 'u1' },
        { facility_id: 'court-2', start_hour: 19, user_id: 'u2' },
        { facility_id: 'court-2', start_hour: 20, user_id: 'u3' },
        { facility_id: 'gym-1', start_hour: 21, user_id: 'u1' },
      ]);
    }
    return ok(step(steps, 'in') ? [{ user_id: 'u1', card_id: 'card-1' }, { user_id: 'u2', card_id: 'card-2' }] : []);
  };

  it("lists the township's suspended cards and frozen phones, and today's bookings by the booker's card", async () => {
    const db = fakeAdmin(answers);
    expect(await loadSync(db.client, 'town-1', now)).toEqual({
      serverTime: now.getTime(),
      stop: { cards: ['card-9'], phones: ['phone-3', 'phone-4'] },
      // u3 is on no card, so that booking is dropped.
      bookings: [
        { card: 'card-1', facility: 'gym-1', date: '2026-10-24', hour: 18 },
        { card: 'card-2', facility: 'court-2', date: '2026-10-24', hour: 19 },
        { card: 'card-1', facility: 'gym-1', date: '2026-10-24', hour: 21 },
      ],
    });
  });
  it('asks only for this township, and only for what the reader needs', async () => {
    const db = fakeAdmin(answers);
    await loadSync(db.client, 'town-1', now);
    expect(eqs(db.on('cards')[0].steps)).toEqual({ township_id: 'town-1', status: 'suspended' });
    expect(eqs(db.on('card_phones')[0].steps)).toMatchObject({ 'cards.township_id': 'town-1' });
    expect(step(db.on('card_phones')[0].steps, 'not')).toEqual(['frozen_at', 'is', null]);
    expect(eqs(db.on('bookings')[0].steps)).toEqual({ township_id: 'town-1', date: '2026-10-24', status: 'booked' });
    expect(step(db.on('card_members')[0].steps, 'in')).toEqual(['user_id', ['u1', 'u2', 'u3']]);
    const selected = db.queries.map((q) => String(step(q.steps, 'select')?.[0])).join(' | ');
    expect(selected).not.toMatch(/name|record_|email|phone\b|unit/);
  });
  it('asks for no cards at all when nothing is booked', async () => {
    const db = fakeAdmin((table) => ok(table === 'cards' ? [{ id: 'card-9' }] : []));
    expect(await loadSync(db.client, 'town-1', now)).toEqual({ serverTime: now.getTime(), stop: { cards: ['card-9'], phones: [] }, bookings: [] });
    expect(db.on('card_members')).toEqual([]);
  });
  it("uses Malaysia's day, not UTC's", async () => {
    const db = fakeAdmin(answers);
    await loadSync(db.client, 'town-1', new Date('2026-10-24T17:30:00Z'));
    expect(eqs(db.on('bookings')[0].steps)).toMatchObject({ date: '2026-10-25' });
  });
  it('throws when a lookup fails', async () => {
    for (const table of ['cards', 'card_phones', 'bookings', 'card_members']) {
      const db = fakeAdmin((t, steps) => (t === table ? failed('57P01', 'connection lost') : answers(t, steps)));
      await expect(loadSync(db.client, 'town-1', now), table).rejects.toThrow('connection lost');
    }
  });
});
