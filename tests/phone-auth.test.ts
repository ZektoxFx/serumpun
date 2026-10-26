vi.mock('server-only', () => ({}));
import { phoneSignIn, startSession } from '@/lib/supabase/phone-auth';

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
const verified = { phone: '+60100000025', verified_at: '2026-10-25T03:59:00Z', used_at: null, expires_at: '2026-10-25T04:09:00Z' };
const signIn = (db: ReturnType<typeof fakeAdmin>) => phoneSignIn(db.client, { check: 'chk', pin: '123456', now });

it('signs in with a verified check and the right PIN, and uses the check up', async () => {
  const db = fakeAdmin({ sms_checks: ok(verified), sms_checks_update: ok([{ id: 'chk' }]), profile_private: ok({ id: 'u-nur' }), rpc: ok({ ok: true }) });
  expect(await signIn(db)).toEqual({ userId: 'u-nur' });
  expect(db.rpcArgs).toEqual({ p_user: 'u-nur', p_pin: '123456' });
  // Which check is read, and whose number is looked up, decide who is signed in.
  expect(eqs(db.on('sms_checks')[0].steps)).toEqual({ id: 'chk' });
  expect(eqs(db.on('profile_private')[0].steps)).toEqual({ phone: verified.phone });
});
it('answers an unknown number exactly as a wrong PIN', async () => {
  const unknown = fakeAdmin({ sms_checks: ok(verified), profile_private: ok(null) });
  const wrong = fakeAdmin({ sms_checks: ok(verified), profile_private: ok({ id: 'u-nur' }), rpc: ok({ ok: false, tries_left: 4 }) });
  expect([await signIn(unknown), await signIn(wrong)]).toEqual([{ error: 'wrong' }, { error: 'wrong' }]);
});
it('refuses a check that was never verified, was used, or ran out, before looking for anyone', async () => {
  for (const check of [{ ...verified, verified_at: null }, { ...verified, used_at: '2026-10-25T03:59:30Z' }, { ...verified, expires_at: '2026-10-25T03:59:59Z' }, null]) {
    const db = fakeAdmin({ sms_checks: ok(check) });
    expect(await signIn(db)).toEqual({ error: 'expired' });
    expect(db.on('profile_private')).toEqual([]);
  }
});
it('starts the session from a magic link it never sends', async () => {
  const generateLink = vi.fn(async () => ({ data: { properties: { hashed_token: 'th' } }, error: null }));
  const verifyOtp = vi.fn(async () => ({ error: null }));
  const getUserById = vi.fn(async () => ({ data: { user: { email: 'resident-1@example.com' } }, error: null }));
  const admin = { auth: { admin: { getUserById, generateLink } } };
  await startSession(admin as never, { auth: { verifyOtp } } as never, 'u-nur');
  expect(getUserById).toHaveBeenCalledWith('u-nur');
  expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'resident-1@example.com' });
  expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'th', type: 'magiclink' });
});

// Beyond the brief's tests. Whether a number has an account must not show, in the answer or in how long it takes.
it('checks a PIN for an unknown number too, against an id nobody has, so it asks what a wrong PIN asks', async () => {
  const unknown = fakeAdmin({ sms_checks: ok(verified), profile_private: ok(null), rpc: failed('P0001', 'no_pin') });
  const wrong = fakeAdmin({ sms_checks: ok(verified), profile_private: ok({ id: 'u-nur' }), rpc: ok({ ok: false, tries_left: 4 }) });
  expect([await signIn(unknown), await signIn(wrong)]).toEqual([{ error: 'wrong' }, { error: 'wrong' }]);
  expect([unknown.queries, unknown.calls]).toEqual([wrong.queries, wrong.calls]);
  expect(unknown.rpcArgs).toEqual({ p_user: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/), p_pin: '123456' });
});
it('fails alike for every number when the PIN check breaks, and logs why', async () => {
  const broken = (person: unknown) => fakeAdmin({ sms_checks: ok(verified), profile_private: ok(person), rpc: failed('57P01', 'connection lost') });
  expect([await signIn(broken(null)), await signIn(broken({ id: 'u-nur' }))]).toEqual([{ error: 'failed' }, { error: 'failed' }]);
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining('connection lost'));
});
it('answers a locked PIN, a PIN nobody set, and one that is not six digits exactly as a wrong PIN', async () => {
  const known = (rpc: Answer) => fakeAdmin({ sms_checks: ok(verified), profile_private: ok({ id: 'u-nur' }), rpc });
  // Only a number with an account can lock, so a lock that looked different would show that someone lives with that number.
  const locked = known(ok({ ok: false, locked_until: '2026-10-25T04:15:00+00:00' }));
  const unknown = fakeAdmin({ sms_checks: ok(verified), profile_private: ok(null), rpc: failed('P0001', 'no_pin') });
  expect([await signIn(locked), await signIn(unknown)]).toEqual([{ error: 'wrong' }, { error: 'wrong' }]);
  expect([locked.queries, locked.calls]).toEqual([unknown.queries, unknown.calls]);
  expect(await signIn(known(failed('P0001', 'no_pin')))).toEqual({ error: 'wrong' });
  // Not a PIN, so wrong for any number, before anything is asked: it costs nobody a try.
  const db = known(ok({ ok: true }));
  for (const pin of ['12345', 123456, undefined]) expect(await phoneSignIn(db.client, { check: 'chk', pin: pin as never, now }), String(pin)).toEqual({ error: 'wrong' });
  expect([db.queries, db.calls]).toEqual([[], []]);
});
it('signs in once with a check: another sign-in that used it at the same moment leaves this one expired', async () => {
  const db = fakeAdmin({ sms_checks: ok(verified), sms_checks_update: ok([]), profile_private: ok({ id: 'u-nur' }), rpc: ok({ ok: true }) });
  expect(await signIn(db)).toEqual({ error: 'expired' });
  expect(db.on('sms_checks')[1].steps).toEqual(expect.arrayContaining([['eq', 'id', 'chk'], ['is', 'used_at', null]]));
});
it('reads a check id that is not an id as no check', async () => {
  expect(await signIn(fakeAdmin({ sms_checks: failed('22P02', 'invalid input syntax for type uuid') }))).toEqual({ error: 'expired' });
});
it('throws when Auth refuses the session', async () => {
  const admin = { auth: { admin: {
    getUserById: async () => ({ data: { user: { email: 'resident-1@example.com' } }, error: null }),
    generateLink: async () => ({ data: { properties: { hashed_token: 'th' } }, error: null }),
  } } };
  const verifyOtp = async () => ({ error: { message: 'Token has expired or is invalid' } });
  await expect(startSession(admin as never, { auth: { verifyOtp } } as never, 'u-nur')).rejects.toThrow('Token has expired or is invalid');
});
