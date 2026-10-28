// Beyond the brief's test files: which accounts "Try registering (Nur)", "Try as Aisyah" and the reset delete, and which they
// must leave alone. The database here is a small in-memory one that applies the filters each query is given, so a test sees
// the accounts a query really reaches; a recorded query would only show its shape.
import { hashCode, normalizeCode } from '@/lib/card/codes';
import { DEMO_CARD_UNIT, DEMO_REGISTER, cardRows, restartDemoRegistration, restoreDemoCard, seedCards } from '@/lib/seed/cards';
import { seedPeople, type People } from '@/lib/seed/people';

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
type Answer = { data: unknown; error: { message: string } | null };

/** What deleting a card or an account takes with it in the database (their foreign keys cascade). */
const CASCADES = {
  cards: [['card_members', 'card_id'], ['card_phones', 'card_id'], ['card_codes', 'card_id']],
  user: [['profile_private', 'id'], ['card_members', 'user_id'], ['card_phones', 'user_id']],
} as const;

interface Query extends PromiseLike<Answer> {
  select(columns?: string): Query;
  insert(rows: Row | Row[]): Query;
  upsert(rows: Row[], options?: { onConflict?: string }): Query;
  update(patch: Row): Query;
  delete(): Query;
  eq(column: string, value: unknown): Query;
  in(column: string, values: unknown[]): Query;
  is(column: string, value: null): Query;
  not(column: string, operator: 'is', value: null): Query;
  gt(column: string, value: string): Query;
  single(): Query;
  maybeSingle(): Query;
}

/** A Supabase client over `seed`. A query method it doesn't know throws, so a new kind of query can't pass unseen. */
function memoryAdmin(seed: Tables, { deleteFails, users = [] }: { deleteFails?: string; users?: Row[] } = {}) {
  const tables: Tables = structuredClone(seed);
  const deleted: string[] = [];
  const rpcs: { name: string; args: Row }[] = [];
  const ok = (data: unknown): Answer => ({ data, error: null });
  const failed = (message: string): Answer => ({ data: null, error: { message } });
  const dropWhere = (table: string, column: string, values: unknown[]) => {
    tables[table] = (tables[table] ?? []).filter((row) => !values.includes(row[column]));
  };

  const client = {
    from(table: string) {
      const rows = (tables[table] ??= []);
      let op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
      let payload: Row | Row[] = {};
      let onConflict = 'id';
      let one: 'single' | 'maybe' | null = null;
      const filters: ((row: Row) => boolean)[] = [];
      const run = (): Answer => {
        const hit = rows.filter((row) => filters.every((keep) => keep(row)));
        let out = hit;
        if (op === 'update') for (const row of hit) Object.assign(row, payload);
        if (op === 'delete') {
          tables[table] = rows.filter((row) => !hit.includes(row));
          if (table === 'cards') for (const [child, column] of CASCADES.cards) dropWhere(child, column, hit.map((card) => card.id));
        }
        if (op === 'insert' || op === 'upsert') {
          out = [];
          for (const row of [payload].flat()) {
            const keys = onConflict.split(',');
            const found = op === 'upsert' ? rows.find((existing) => keys.every((key) => existing[key] === row[key])) : undefined;
            if (found) Object.assign(found, row);
            else rows.push({ id: `${table}:${rows.length + 1}`, ...row });
            out.push(found ?? rows[rows.length - 1]);
          }
        }
        if (one === 'single') return out.length === 1 ? ok(out[0]) : failed('JSON object requested, multiple (or no) rows returned');
        if (one === 'maybe') return out.length <= 1 ? ok(out[0] ?? null) : failed('multiple (or no) rows returned');
        return ok(out);
      };
      const query: Query = {
        select: () => query,
        insert: (rows) => ((op = 'insert'), (payload = rows), query),
        upsert: (rows, options) => ((op = 'upsert'), (payload = rows), (onConflict = options?.onConflict ?? 'id'), query),
        update: (patch) => ((op = 'update'), (payload = patch), query),
        delete: () => ((op = 'delete'), query),
        eq: (column, value) => (filters.push((row) => row[column] === value), query),
        in: (column, values) => (filters.push((row) => values.includes(row[column])), query),
        is: (column, value) => (filters.push((row) => (row[column] ?? null) === value), query),
        not: (column, _operator, value) => (filters.push((row) => (row[column] ?? null) !== value), query),
        gt: (column, value) => (filters.push((row) => String(row[column]) > value), query),
        single: () => ((one = 'single'), query),
        maybeSingle: () => ((one = 'maybe'), query),
        then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
      };
      return query;
    },
    async rpc(name: string, args: Row) {
      rpcs.push({ name, args });
      return ok(name === 'issue_unit_code' ? '2026-11-01T00:00:00.000Z' : null);
    },
    auth: {
      admin: {
        async deleteUser(id: string) {
          if (id === deleteFails) return failed('boom');
          deleted.push(id);
          for (const [table, column] of CASCADES.user) dropWhere(table, column, [id]);
          return ok({});
        },
        async listUsers() {
          return ok({ users });
        },
        async createUser({ email }: { email: string }) {
          return ok({ user: { id: `new:${email}` } });
        },
      },
    },
  };
  return { client: client as never, tables, deleted, rpcs };
}

const DAY = 86_400_000;
const future = new Date(Date.now() + DAY).toISOString();
const past = new Date(Date.now() - DAY).toISOString();

const unit = (id: string, label: string, extra: Row = {}): Row => ({
  id, label, neighbourhood: 'Elmina', record_name: 'Owner', record_tenure: 'owner', record_phone: null, lease_end: null, ...extra,
});
const invite = (id: string, card_id: string, extra: Row = {}): Row => ({
  id, card_id, kind: 'invite', used_at: null, cancelled_at: null, expires_at: future, ...extra,
});

/**
 * Three homes with a card, and the people on them. A person with a phone on record came in through an invite (or, at
 * No. 25, registered as Nur); the seeded people have none. Daniel's household is "another unit's people".
 */
const world = (): Tables => ({
  units: [
    unit('u18', DEMO_CARD_UNIT),
    // A visitor's earlier turn left No. 25 changed.
    unit('u25', DEMO_REGISTER.label, { record_name: 'Someone Else', record_tenure: 'tenant', record_phone: '+60100000099', lease_end: '2027-03-01' }),
    unit('u7', 'No. 7, Jalan Elmina Valley 3/4'),
    unit('u61', 'No. 61, Jalan Elmina Green 5'),
  ],
  cards: [
    { id: 'c18', unit_id: 'u18', status: 'suspended', suspended_reason: 'rent', suspended_at: past, places: ['pool'] },
    { id: 'c25', unit_id: 'u25', status: 'active', suspended_reason: null, suspended_at: null, places: ['pool'] },
    { id: 'c7', unit_id: 'u7', status: 'suspended', suspended_reason: 'rent', suspended_at: past, places: ['pool'] },
  ],
  card_members: [
    { card_id: 'c18', user_id: 'aisyah' }, { card_id: 'c18', user_id: 'imran' }, { card_id: 'c18', user_id: 'sara' }, { card_id: 'c18', user_id: 'adam' },
    { card_id: 'c25', user_id: 'nur' }, { card_id: 'c25', user_id: 'nurChild' },
    { card_id: 'c7', user_id: 'daniel' }, { card_id: 'c7', user_id: 'danielWife' },
  ],
  profile_private: [
    { id: 'aisyah', phone: null }, { id: 'imran', phone: null }, { id: 'sara', phone: null }, { id: 'adam', phone: '+60100000018' },
    { id: 'nur', phone: DEMO_REGISTER.phone }, { id: 'nurChild', phone: '+60100000125' },
    { id: 'daniel', phone: null }, { id: 'danielWife', phone: '+60100000007' },
  ],
  card_phones: [
    { id: 'p-aisyah', card_id: 'c18', user_id: 'aisyah', frozen_at: past },
    { id: 'p-adam', card_id: 'c18', user_id: 'adam', frozen_at: past },
    { id: 'p-daniel', card_id: 'c7', user_id: 'daniel', frozen_at: past },
  ],
  card_codes: [
    invite('open-18', 'c18'),
    invite('used-18', 'c18', { used_at: past, used_by: 'adam' }),
    invite('cancelled-18', 'c18', { cancelled_at: past }),
    invite('expired-18', 'c18', { expires_at: past }),
    invite('open-25', 'c25'), // another card's invite
    { id: 'office-61', card_id: null, kind: 'office', used_at: null, cancelled_at: null, expires_at: future }, // a home's code
  ],
});
const original = world();
const ids = (rows: Row[], column: string) => rows.map((row) => row[column]).sort();
const people = { townshipId: 'elmina', ids: new Proxy({}, { get: (_, key) => String(key) }) } as People;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubEnv('DEMO_PASSWORD', 'a-test-password');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('restartDemoRegistration (Try registering)', () => {
  it("deletes the accounts on No. 25's card and no others, then the card, and gives the fresh code", async () => {
    const db = memoryAdmin(world());
    const code = await restartDemoRegistration(db.client);

    expect(db.deleted.sort()).toEqual(['nur', 'nurChild']);
    // Nobody else's account or card went: not No. 18's people (with or without a phone), nor Daniel's household.
    expect(ids(db.tables.cards, 'id')).toEqual(['c18', 'c7']);
    expect(ids(db.tables.card_members, 'user_id')).toEqual(['adam', 'aisyah', 'daniel', 'danielWife', 'imran', 'sara']);
    expect(ids(db.tables.profile_private, 'id')).toEqual(['adam', 'aisyah', 'daniel', 'danielWife', 'imran', 'sara']);
    // The code is well-formed, and only its hash reached the database.
    expect(normalizeCode(code)).toBe(code);
    expect(db.rpcs).toEqual([{ name: 'issue_unit_code', args: { p_unit: 'u25', p_code_hash: await hashCode(code), p_by: null } }]);
  });

  it('puts the record back exactly as the seed has it, and changes no other home', async () => {
    const db = memoryAdmin(world());
    await restartDemoRegistration(db.client);
    const seeded = cardRows(new Date(), people).units.find((u) => u.label === DEMO_REGISTER.label)!;
    expect(db.tables.units.find((u) => u.id === 'u25')).toMatchObject({
      record_name: seeded.record_name, record_tenure: seeded.record_tenure, record_phone: seeded.record_phone, lease_end: seeded.lease_end,
    });
    expect(db.tables.units.filter((u) => u.id !== 'u25')).toEqual(original.units.filter((u) => u.id !== 'u25'));
  });

  it("also takes whoever holds Nur's number, even on another home's card, and still nobody else", async () => {
    // No. 25 has no card now (an earlier turn deleted it), but Adam registered at No. 18 with the made-up number.
    const w = world();
    w.cards = w.cards.filter((c) => c.id !== 'c25');
    w.card_members = w.card_members.filter((m) => m.card_id !== 'c25');
    w.profile_private = w.profile_private.filter((p) => !['nur', 'nurChild'].includes(p.id as string));
    w.profile_private.find((p) => p.id === 'adam')!.phone = DEMO_REGISTER.phone;
    const db = memoryAdmin(w);
    await restartDemoRegistration(db.client);
    expect(db.deleted).toEqual(['adam']);
    expect(ids(db.tables.card_members, 'user_id')).toEqual(['aisyah', 'daniel', 'danielWife', 'imran', 'sara']);
    expect(ids(db.tables.cards, 'id')).toEqual(['c18', 'c7']);
  });

  it('deletes nobody when nobody has registered, and still gives a code', async () => {
    const w = world();
    w.cards = w.cards.filter((c) => c.id !== 'c25');
    w.card_members = w.card_members.filter((m) => m.card_id !== 'c25');
    w.profile_private = w.profile_private.filter((p) => !['nur', 'nurChild'].includes(p.id as string));
    const db = memoryAdmin(w);
    await restartDemoRegistration(db.client);
    expect(db.deleted).toEqual([]);
    expect(db.rpcs.map((r) => r.name)).toEqual(['issue_unit_code']);
  });

  it('gives no code, and leaves the card, when an account cannot be deleted', async () => {
    const db = memoryAdmin(world(), { deleteFails: 'nur' });
    await expect(restartDemoRegistration(db.client)).rejects.toThrow('boom');
    expect(db.rpcs).toEqual([]);
    expect(ids(db.tables.cards, 'id')).toContain('c25');
  });

  it("says so when Nur's home is not on record", async () => {
    const w = world();
    w.units = w.units.filter((u) => u.id !== 'u25');
    await expect(restartDemoRegistration(memoryAdmin(w).client)).rejects.toThrow('units');
  });
});

describe('restoreDemoCard (Try as Aisyah)', () => {
  it("cancels No. 18's open invites and nobody else's", async () => {
    const db = memoryAdmin(world());
    await restoreDemoCard(db.client);
    const state = (id: string) => db.tables.card_codes.find((c) => c.id === id)!;
    expect(state('open-18').cancelled_at).toEqual(expect.any(String));
    // Used, already cancelled and expired invites stay as they were, and so do another card's invite and a home's code.
    for (const id of ['used-18', 'cancelled-18', 'expired-18', 'open-25', 'office-61']) {
      expect(state(id), id).toEqual(original.card_codes.find((c) => c.id === id));
    }
  });

  it("deletes the accounts on No. 18's card that came in with a phone on record, and not the seeded people", async () => {
    const db = memoryAdmin(world());
    await restoreDemoCard(db.client);
    expect(db.deleted).toEqual(['adam']);
    // Aisyah, Imran and Sara have no phone on record. Other homes' people with a phone (the Nur turn's, Daniel's wife) stay too.
    expect(ids(db.tables.card_members, 'user_id')).toEqual(['aisyah', 'daniel', 'danielWife', 'imran', 'nur', 'nurChild', 'sara']);
    expect(ids(db.tables.card_phones, 'user_id')).toEqual(['aisyah', 'daniel']); // "3 of 4" again once Adam's phone goes with him
  });

  it("still puts No. 18's card and phones back, and no other home's", async () => {
    const db = memoryAdmin(world());
    await restoreDemoCard(db.client);
    expect(db.tables.cards.find((c) => c.id === 'c18')).toMatchObject({ status: 'active', suspended_reason: null, suspended_at: null, places: ['facilities', 'gym', 'pool'] });
    expect(db.tables.cards.find((c) => c.id === 'c7')).toEqual(original.cards.find((c) => c.id === 'c7'));
    expect(db.tables.card_phones.find((p) => p.id === 'p-aisyah')!.frozen_at).toBeNull();
    expect(db.tables.card_phones.find((p) => p.id === 'p-daniel')!.frozen_at).toBe(past);
  });

  it('says why when an account cannot be deleted, so the sign-in logs it and goes on', async () => {
    const db = memoryAdmin(world(), { deleteFails: 'adam' });
    await expect(restoreDemoCard(db.client)).rejects.toThrow('boom');
  });
});

describe('seedCards (the seed gives No. 61 a code)', () => {
  it("gives No. 61 an office code through issue_unit_code, from the office, and no other home one", async () => {
    const db = memoryAdmin({});
    await seedCards(db.client, new Date('2026-10-19T04:00:00Z'), people);
    const issued = db.rpcs.filter((r) => r.name === 'issue_unit_code');
    expect(issued).toHaveLength(1);
    const no61 = db.tables.units.find((u) => u.label === 'No. 61, Jalan Elmina Green 5')!;
    expect(issued[0].args).toEqual({ p_unit: no61.id, p_code_hash: expect.stringMatching(/^[0-9a-f]{64}$/), p_by: 'office' });
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/25 units, 14 cards, 16 people on cards, 16 phones, 1 code given, PINs set$/));
  });
});

describe('seedPeople (the reset)', () => {
  it("deletes every account the roster does not name: stage 1's Nur, a leftover registration, a visitor's sign-up", async () => {
    const accounts = [
      { id: 'u-priya', email: 'priya.raman@example.com', app_metadata: {} },
      { id: 'u-nur', email: 'nur.demo@example.com', app_metadata: { demo: 'nur' } },
      // A registration whose clean-up failed leaves an account with no profile, found by the list, not by a profile.
      { id: 'u-resident', email: 'resident-6d1b7d8e-0f6c-4a53-9d0c-2f3d6a0e3f11@example.com', app_metadata: {} },
      { id: 'u-visitor', email: 'a.visitor@example.com', app_metadata: {} },
    ];
    const db = memoryAdmin({}, { users: accounts });
    await seedPeople(db.client, new Date('2026-10-19T04:00:00Z'));
    expect(db.deleted.sort()).toEqual(['u-nur', 'u-resident', 'u-visitor']);
  });
});
