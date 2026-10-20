/**
 * The reader's side of its talk with the township while it is online: the request that decides a tap, and the time limit
 * every request to the township gets. Client only. A reader decides a tap by itself (`decideOffline`, lib/card/queue.ts)
 * ONLY when there is no answer to be had: the network failed, the request hung or its reply stopped half way, or the
 * township answered 5xx. A decision, granted or not, is final, and so is a pass the township could not read.
 */
import type { DenyReason, TapRequest } from './decide';

export const JSON_BODY = { 'Content-Type': 'application/json' };
/** How long a request to the township may take before the reader counts it as failed. */
export const REQUEST_MS = 4_000;

/** What the reader says about a tap. `bad_pass`: nothing this township signed, so not a card it can read at all. */
export type Answer = { granted: true; unit: string } | { granted: false; reason: DenyReason | 'bad_pass' };
export const BAD_PASS: Answer = { granted: false, reason: 'bad_pass' };

/**
 * The signal for one request to the township. It aborts after REQUEST_MS, so a hung connection fails the way a lost one
 * does (fetch throws), and sooner when `signal` does: the reader went offline, or the page closed.
 */
export function within(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_MS);
  // shortcut: Safari before 17.4 has no AbortSignal.any, so there a request keeps its time limit but the switch can't
  // cut it short; drop the check once Next's browser floor (Safari 16.4 now) passes 17.4.
  return signal && 'any' in AbortSignal ? AbortSignal.any([timeout, signal]) : timeout;
}

/**
 * The township's answer to an online tap, or null when there was none to be had: only then does the reader decide by
 * itself. A 200 with a true or false `granted` is a decision. Anything else the township says is a pass it could not
 * read (a 400 `bad_pass`, or a page that is not JSON, a captive portal's say): final, and never decided again offline.
 * `request` is `fetch`, a parameter so a test can stand in for the network.
 */
export async function askTownship(tap: TapRequest, request: typeof fetch = fetch): Promise<Answer | null> {
  try {
    const response = await request('/api/reader/tap', { method: 'POST', headers: JSON_BODY, body: JSON.stringify(tap), signal: within() });
    if (response.status >= 500) return null;
    const body = (await response.json()) as { granted?: unknown } | null;
    return typeof body?.granted === 'boolean' ? (body as Answer) : BAD_PASS;
  } catch (error) {
    // A reply that is not JSON is one the reader can't read. Whatever else threw gave no reply: no connection, the time limit, a drop half way.
    return error instanceof SyntaxError ? BAD_PASS : null;
  }
}
