// Beyond the brief: the one new thing Me reads, whether the caller's own phone has a key waiting for the card to move to it.
import { loadMyCard } from '@/lib/card/summary';

type Answer = { data?: unknown; count?: number | null; error: { message: string } | null };
/** A Supabase client whose queries on `table` all end with `answers[table]`, and that remembers each query's steps. */
function fakeDb(answers: Record<string, Answer>) {
  const steps: Record<string, unknown[][]> = {};
  const client = {
    from(table: string) {
      const mine: unknown[][] = (steps[table] = []);
      const query: object = new Proxy({}, {
        get: (_, method) =>
          method === 'then'
            ? (resolve: (answer: Answer) => unknown) => Promise.resolve(answers[table]).then(resolve)
            : (...args: unknown[]) => (mine.push([String(method), ...args]), query),
      });
      return query;
    },
  };
  return { client: client as never, steps };
}
const member = {
  role: 'owner',
  card: { id: 'c18', status: 'active', suspended_reason: null, places: ['pool'], phone_limit: 4, unit: { label: 'No. 18', lease_end: null } },
};
const db = (keys: Answer) => fakeDb({ card_members: { data: member, error: null }, card_phones: { count: 3, error: null }, phone_keys: keys });

it('says a phone is waiting for the card when a key of the caller\'s own phone waits', async () => {
  const waiting = db({ count: 1, error: null });
  expect(await loadMyCard(waiting.client, 'u1')).toMatchObject({ id: 'c18', phones: 3, moveWaiting: true });
  // Row-level security shows the caller only their own phone's keys, so the state is the only filter.
  expect(waiting.steps.phone_keys).toContainEqual(['eq', 'state', 'waiting']);
});
it('says none is waiting when no key of the caller waits', async () => {
  for (const count of [0, null]) expect((await loadMyCard(db({ count, error: null }).client, 'u1'))!.moveWaiting, String(count)).toBe(false);
});
it('fails loudly when the keys cannot be read, as it does for the phones', async () => {
  await expect(loadMyCard(db({ count: null, error: { message: 'boom' } }).client, 'u1')).rejects.toThrow('card keys lookup failed: boom');
});
