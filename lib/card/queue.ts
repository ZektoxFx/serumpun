/**
 * The reader's own side when it is offline: deciding a tap by itself, the taps it decided that way (kept until the
 * township takes them), and what it kept from its last sync. Both live in this browser's localStorage. Storage can be
 * missing or blocked (private windows, cleared site data): reading then finds nothing and writing is skipped, so the
 * reader keeps working on what it holds in memory. Client only.
 */
import { readPresentation } from './crypto';
import { decideTap, offlineState, type OfflineVisit, type ReaderCache, type TapDecision, type TapRequest } from './decide';

/** As many visits as the township takes in one send (`/api/reader/visits`), so one flush always empties the queue. */
export const QUEUE_MAX = 500;
const QUEUE_KEY = 'serumpun-reader-queue-v1';
const CACHE_KEY = 'serumpun-reader-cache-v1';

/** The queue with `visit` at the end. Past QUEUE_MAX the oldest go. */
export function enqueue(queue: OfflineVisit[], visit: OfflineVisit): OfflineVisit[] {
  return [...queue, visit].slice(-QUEUE_MAX);
}

/** What is left once the township has taken the first `sent` (its `saved + skipped`). */
export function afterFlush(queue: OfflineVisit[], sent: number): OfflineVisit[] {
  return queue.slice(sent);
}

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null; // storage blocked, or something that is not ours
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked or full: the reader still has it in memory until the page closes
  }
}

export function loadQueue(): OfflineVisit[] {
  const saved = read(QUEUE_KEY);
  // Each visit is checked again by the township when it is sent, and a bad one is skipped there.
  return Array.isArray(saved) ? saved : [];
}

export function saveQueue(queue: OfflineVisit[]): void {
  write(QUEUE_KEY, queue);
}

/** The last sync, or null for none. One that can't be decided on is none too: a clock offset that is not a number would stop every decision. */
export function loadCache(): ReaderCache | null {
  const saved = read(CACHE_KEY) as Partial<ReaderCache> | null;
  const usable =
    Number.isFinite(saved?.offsetMs) && Array.isArray(saved?.bookings) && Array.isArray(saved?.stop?.cards) && Array.isArray(saved?.stop?.phones);
  return usable ? (saved as ReaderCache) : null;
}

export function saveCache(cache: ReaderCache): void {
  write(CACHE_KEY, cache);
}

/**
 * An offline reader's decision on one tap, from what its last sync left it. `now` is this reader's own clock, which is
 * corrected by the sync's `offsetMs`, so the note's freshness and the pass's expiry are judged on the township's time
 * (Review Focus 1). A note already in `seen` (this page load's) is refused like a stale pass; `seen` keeps the new one.
 * Null when the presentation is no card's this township signed: there is nothing to decide, or to queue.
 */
export async function decideOffline(
  tap: TapRequest,
  cache: ReaderCache,
  seen: Set<string>,
  now: number,
): Promise<{ decision: TapDecision; unit: string; visit: OfflineVisit } | null> {
  const found = await readPresentation(tap.presentation, cache.publicKey);
  if (!found) return null;
  const at = new Date(now + cache.offsetMs);
  const { pass, note } = found;
  const decision: TapDecision = seen.has(note.nonce)
    ? { granted: false, reason: 'pass_expired' }
    : decideTap({ pass, note, place: tap.place, facility: tap.facility, state: offlineState(pass, cache, tap.facility, at), now: at });
  seen.add(note.nonce);
  return {
    decision,
    unit: pass.unit,
    visit: { ...tap, at: at.getTime(), granted: decision.granted, reason: decision.granted ? null : decision.reason },
  };
}
