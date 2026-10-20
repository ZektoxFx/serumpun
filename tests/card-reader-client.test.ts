import type { TapRequest } from '@/lib/card/decide';
import { BAD_PASS, REQUEST_MS, askTownship, within } from '@/lib/card/reader-client';

const tap: TapRequest = { presentation: 'a.b.c.d', place: 'pool', facility: null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const answering = (body: unknown, status = 200): typeof fetch => async () => json(body, status);
/** A request that never answers until its signal aborts, and then fails the way fetch does. */
const hangs: typeof fetch = (_url, init) =>
  new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) reject(signal.reason);
    signal?.addEventListener('abort', () => reject(signal.reason));
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// The ruling: the reader decides by itself ONLY when there is no answer to be had (the network failed, the request hung,
// or the township answered 5xx). A decision, granted or not, is final, and so is a pass the township could not read.
it('posts the tap as JSON and returns the township\'s decision as it is, a grant or a refusal', async () => {
  const granted = vi.fn(answering({ granted: true, unit: 'No. 18' }));
  expect(await askTownship(tap, granted)).toEqual({ granted: true, unit: 'No. 18' });
  expect(granted).toHaveBeenCalledWith('/api/reader/tap', expect.objectContaining({ method: 'POST', body: JSON.stringify(tap) }));
  expect(await askTownship(tap, answering({ granted: false, reason: 'no_booking' }))).toEqual({ granted: false, reason: 'no_booking' });
});

it('takes a 400 bad_pass as final: the township could not read the card', async () => {
  expect(await askTownship(tap, answering({ error: 'bad_pass' }, 400))).toEqual(BAD_PASS);
});

it.each([
  ['an empty object', {}],
  ['null', null],
  ['a string', 'granted'],
  ['a number', 5],
  ['true', true],
  ['a list', [true]],
  ['a granted that is not true or false', { granted: 'yes' }],
  ['only an error', { error: 'bad_pass' }],
])('takes a 200 with %s as a card it could not read, for good', async (_what, body) => {
  expect(await askTownship(tap, answering(body))).toEqual(BAD_PASS);
});

it('takes a 200 that is not JSON, a captive portal say, as a card it could not read too', async () => {
  expect(await askTownship(tap, async () => new Response('<h1>Sign in to the Wi-Fi</h1>', { status: 200 }))).toEqual(BAD_PASS);
});

it.each([500, 502, 503])('gives no answer for a %i, so the reader decides by itself', async (status) => {
  expect(await askTownship(tap, async () => new Response('<h1>Service unavailable</h1>', { status }))).toBeNull();
});

it('gives no answer when the fetch throws', async () => {
  expect(await askTownship(tap, async () => { throw new TypeError('Failed to fetch'); })).toBeNull();
});

it('gives no answer when the township\'s reply drops half way', async () => {
  const dropped: typeof fetch = async () =>
    new Response(new ReadableStream({ start: (controller) => controller.error(new TypeError('network error')) }), { status: 200 });
  expect(await askTownship(tap, dropped)).toBeNull();
});

it('gives up on a request that hangs, which is no answer either', async () => {
  const limit = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(limit.signal);
  const asked = askTownship(tap, hangs);
  limit.abort(new DOMException('The request took too long', 'TimeoutError'));
  expect(await asked).toBeNull();
  expect(timeout).toHaveBeenCalledWith(REQUEST_MS);
}, 1000);

it('limits a request in time, and ends it sooner with the reader\'s own signal', () => {
  const limit = new AbortController();
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(limit.signal);
  const offline = new AbortController();
  const flush = within(offline.signal);
  const sync = within();
  expect([flush.aborted, sync.aborted]).toEqual([false, false]);
  offline.abort();
  expect([flush.aborted, sync.aborted]).toEqual([true, false]);
  limit.abort();
  expect(sync.aborted).toBe(true);
  // A run that was cancelled before its request starts never sends it.
  expect(within(AbortSignal.abort()).aborted).toBe(true);
});

it('keeps the time limit where AbortSignal.any is missing (Safari before 17.4)', () => {
  const limit = new AbortController();
  vi.stubGlobal('AbortSignal', { timeout: () => limit.signal });
  expect(within(new AbortController().signal)).toBe(limit.signal);
});
