vi.mock('server-only', () => ({}));
// A fixed SMS code, so a code with leading zeros can be seen keeping all six digits.
vi.mock('node:crypto', async (importOriginal) => ({ ...(await importOriginal<typeof import('node:crypto')>()), randomInt: () => 4821 }));
import { hashCode } from '@/lib/card/codes';
import { checkSmsCode, finishRegistration, peekCode, startSmsCheck } from '@/lib/card/register';

type Step = [method: string, ...args: unknown[]];
type Answer = { data: unknown; error: { code?: string; message: string } | null };
/**
 * Records each query, RPC and Auth call, and answers it from `answers`: a table's query from `answers[table]`, an update
 * from `answers[table + '_update']`, an RPC from `answers.rpc`. Like the real builder, a query runs when it is awaited.
 */
function fakeAdmin(answers: Record<string, Answer>) {
  const queries: { table: string; steps: Step[] }[] = [];
  const calls: string[] = [];
  let rpcArgs: unknown;
  const answer = (key: string) => answers[key] ?? ok(null);
  const client = {
    from(table: string) {
      const steps: Step[] = [];
      const query: object = new Proxy({}, {
        get: (_, method) =>
          method === 'then'
            ? (resolve: (answer: Answer) => unknown) => {
                queries.push({ table, steps });
                return Promise.resolve(answer(steps.some(([m]) => m === 'update') ? `${table}_update` : table)).then(resolve);
              }
            : (...args: unknown[]) => (steps.push([String(method), ...args]), query),
      });
      return query;
    },
    async rpc(name: string, args: unknown) {
      calls.push(`rpc ${name}`);
      rpcArgs = args;
      return answer('rpc');
    },
    auth: {
      admin: {
        async createUser() {
          calls.push('createUser');
          return { data: { user: { id: 'u-new' } }, error: null };
        },
        async deleteUser(id: string) {
          calls.push(`deleteUser ${id}`);
          return { data: {}, error: null };
        },
      },
    },
  };
  const on = (table: string) => queries.filter((q) => q.table === table);
  return { queries, calls, on, client: client as never, get rpcArgs() { return rpcArgs; } };
}
/** The columns a query was narrowed by with `eq`. */
const eqs = (steps: Step[]) => Object.fromEntries(steps.filter(([method]) => method === 'eq').map(([, column, value]) => [column, value]));
const ok = (data: unknown): Answer => ({ data, error: null });
const failed = (code: string, message = 'boom'): Answer => ({ data: null, error: { code, message } });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const now = new Date('2026-10-25T04:00:00Z');
const OFFICE_ROW = { kind: 'office', name: null, role: null, created_at: '2026-10-24T02:00:00Z', inviter: null,
  unit: { label: 'No. 61, Jalan Elmina Green 5', neighbourhood: 'Elmina Green', record_name: 'Zulkifli Hassan', record_tenure: 'owner',
          record_phone: '+60100000061', lease_end: null, township: { name: 'City of Elmina' } } };
const finish = (db: ReturnType<typeof fakeAdmin>, pin = '123456') => finishRegistration(db.client, { code: 'K7Q4M29X', check: 'chk', pin, lang: 'en', now });

it('finds an open code by its hash and gives the home it is for', async () => {
  const db = fakeAdmin({ card_codes: ok(OFFICE_ROW) });
  expect(await peekCode(db.client, 'k7q4-m29x', now)).toMatchObject({ kind: 'office', name: 'Zulkifli Hassan', phone: '+60100000061', checkedAt: '2026-10-24T02:00:00Z' });
  expect(eqs(db.on('card_codes')[0].steps)).toEqual({ code_hash: await hashCode('K7Q4M29X') });
});
it('makes the account, then the card, and says who to sign in', async () => {
  const db = fakeAdmin({ card_codes: ok(OFFICE_ROW), rpc: ok('card-61') });
  expect(await finish(db)).toEqual({ userId: 'u-new' });
  expect(db.calls).toEqual(['createUser', 'rpc complete_registration']);
  expect(db.rpcArgs).toEqual({ p_code_hash: await hashCode('K7Q4M29X'), p_check: 'chk', p_user: 'u-new', p_pin: '123456', p_lang: 'en' });
});
it('deletes the new account when the database refuses, so nothing half-made is left', async () => {
  const db = fakeAdmin({ card_codes: ok(OFFICE_ROW), rpc: failed('P0001', 'bad_code') });
  expect(await finish(db)).toEqual({ error: 'bad_code' });
  expect(db.calls).toEqual(['createUser', 'rpc complete_registration', 'deleteUser u-new']);
});
it('makes no account for a code that is not open, or a PIN that is not six digits', async () => {
  const closed = fakeAdmin({ card_codes: ok(null) });
  const short = fakeAdmin({ card_codes: ok(OFFICE_ROW) });
  expect([await finish(closed), await finish(short, '12345')]).toEqual([{ error: 'bad_code' }, { error: 'bad_pin' }]);
  expect([...closed.calls, ...short.calls]).toEqual([]);
  // A PIN that is not six digits is refused with no call at all: not even a look at the code.
  expect(short.queries).toEqual([]);
});

// Beyond the brief's tests: an invite, what "open" means, the SMS check, and a failure that is not a refusal.
it("gives an invite's name, role and inviter, asking only for a code that is open now", async () => {
  const db = fakeAdmin({ card_codes: ok({ ...OFFICE_ROW, kind: 'invite', name: 'Adam', role: 'child', inviter: { full_name: 'Aisyah Rahman' } }) });
  expect(await peekCode(db.client, 'K7Q4M29X', now)).toEqual({
    kind: 'invite', unit: 'No. 61, Jalan Elmina Green 5', township: 'City of Elmina', name: 'Adam', role: 'child', invitedBy: 'Aisyah Rahman',
  });
  const { steps } = db.on('card_codes')[0];
  expect(steps).toEqual(expect.arrayContaining([['is', 'used_at', null], ['is', 'cancelled_at', null], ['gt', 'expires_at', now.toISOString()]]));
  expect(String(steps.find(([method]) => method === 'select')?.[1])).toContain('profiles!card_codes_created_by_fkey(full_name)');
});
it('asks the database nothing about text that is not a code', async () => {
  const db = fakeAdmin({ card_codes: ok(OFFICE_ROW) });
  expect(await peekCode(db.client, 'K7Q4-M2OX', now)).toBeNull();
  expect(await finishRegistration(db.client, { code: 'K7Q4-M2OX', check: 'chk', pin: '123456', lang: 'en', now })).toEqual({ error: 'bad_code' });
  expect([db.queries, db.calls]).toEqual([[], []]);
});
it('texts a 6-digit code, leading zeros and all, and reads what the database says of a try', async () => {
  const db = fakeAdmin({ rpc: ok('chk-1') });
  expect(await startSmsCheck(db.client, '+60100000025')).toEqual({ check: 'chk-1', sms: '004821' });
  expect(db.rpcArgs).toEqual({ p_phone: '+60100000025', p_code: '004821' });
  const tryCode = (rpc: Answer) => checkSmsCode(fakeAdmin({ rpc }).client, 'chk-1', '004821');
  expect(await tryCode(ok({ ok: true }))).toEqual({ ok: true });
  expect(await tryCode(ok({ ok: false, tries_left: 4 }))).toEqual({ ok: false, triesLeft: 4 });
  expect(await tryCode(ok({ ok: false, expired: true }))).toEqual({ ok: false, expired: true });
  // The check id comes from the browser: one that is not an id is no check at all.
  expect(await tryCode(failed('22P02', 'invalid input syntax for type uuid'))).toEqual({ ok: false, expired: true });
});
it('deletes the new account and says it failed, logging why, when the database breaks', async () => {
  const db = fakeAdmin({ card_codes: ok(OFFICE_ROW), rpc: failed('23514', 'violates check constraint') });
  expect(await finish(db)).toEqual({ error: 'failed' });
  expect(db.calls).toEqual(['createUser', 'rpc complete_registration', 'deleteUser u-new']);
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining('violates check constraint'));
});
it('reads a check id that is not an id as no check: bad_check, the new account deleted, nothing logged', async () => {
  // The check id comes from the browser, and Postgres refuses text that is not an id (22P02).
  const db = fakeAdmin({ card_codes: ok(OFFICE_ROW), rpc: failed('22P02', 'invalid input syntax for type uuid') });
  expect(await finish(db)).toEqual({ error: 'bad_check' });
  expect(db.calls).toEqual(['createUser', 'rpc complete_registration', 'deleteUser u-new']);
  expect(console.error).not.toHaveBeenCalled();
});
