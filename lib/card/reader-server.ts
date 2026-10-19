/**
 * The township's side of the reader, behind three public routes (app/api/reader). An online reader sends each tap and
 * gets the decision on live state; an offline reader sends later the taps it decided by itself; and a sync gives a reader
 * the stop list and bookings it needs to decide offline. Nothing here returns or stores a name, only cards and units.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mytDate, mytHour } from '@/lib/domain/time';
import { PLACES, readPresentation, type PassPayload, type Place, type PublicJwk, type TapNote } from './crypto';
import { DENY_REASONS, decideTap, type DenyReason, type OfflineVisit, type ReaderCache, type TapRequest, type TapState } from './decide';

/** One row of `card_visits`: the card (so the unit), never the person or the phone. */
export type VisitRow = {
  township_id: string; card_id: string; place: Place; facility_id: string | null; granted: boolean;
  reason: DenyReason | null; offline: boolean; nonce: string; at: string;
};
export type ReaderDeps = {
  publicKey: PublicJwk;
  now: () => Date;
  loadState: (pass: PassPayload, facility: string | null, now: Date) => Promise<TapState>;
  /** 'duplicate': the visit was not saved, because this nonce was used already or the row can never be saved (see `saveVisit` below). */
  saveVisit: (visit: VisitRow) => Promise<'saved' | 'duplicate'>;
};
export type TapResponse = { granted: true; unit: string } | { granted: false; reason: DenyReason } | { error: 'bad_pass' };

// A real presentation (a pass, a note and two signatures) runs to about 900 characters. Past this it is not one, and it
// is not worth the two signature checks.
const MAX_PRESENTATION = 4096;
// How many visits one request is worked through for. The reader's offline queue holds no more, so it sends all of it.
const MAX_VISITS = 500;

/**
 * A tap request, or null for anything else. The body comes off the wire from a page anyone can open, so only what is
 * checked here is believed. The signatures are checked by `readPresentation`.
 */
function parseTap(body: unknown): TapRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { presentation, place, facility } = body as { [K in keyof TapRequest]?: unknown };
  if (typeof presentation !== 'string' || presentation.length > MAX_PRESENTATION) return null;
  if (!PLACES.includes(place as Place) || (facility !== null && typeof facility !== 'string')) return null;
  return { presentation, place: place as Place, facility };
}

/** A visit an offline reader queued, or null. A grant has no reason and a refusal has one: the database insists on it too. */
function parseVisit(item: unknown): OfflineVisit | null {
  const tap = parseTap(item);
  if (!tap) return null;
  const { at, granted, reason } = item as { [K in keyof OfflineVisit]?: unknown };
  const consistent = typeof granted === 'boolean' && (reason === null || DENY_REASONS.includes(reason as DenyReason)) && granted === (reason === null);
  // A time `toISOString` can write: past ±8.64e15 ms a Date is invalid, and the call throws.
  const timed = Number.isFinite(at) && Number.isFinite(new Date(at as number).getTime());
  return consistent && timed ? { ...tap, at: at as number, granted, reason: reason as DenyReason | null } : null;
}

function visitRow(
  { pass, note }: { pass: PassPayload; note: TapNote }, tap: TapRequest, result: { granted: boolean; reason: DenyReason | null },
  offline: boolean, at: Date,
): VisitRow {
  // The nonce is the note's own, signed by the phone. Replay protection keys on it alone (the unique `card_visits.nonce`):
  // signatures are malleable, so two different presentation texts can carry one note.
  return {
    township_id: pass.township, card_id: pass.card, place: tap.place, facility_id: tap.facility,
    granted: result.granted, reason: result.reason, offline, nonce: note.nonce, at: at.toISOString(),
  };
}

/**
 * An online reader's tap: the server checks the signatures and decides on the live state, then logs the visit, refusals
 * included. The booking is looked up at the reader's own facility, never at the one a QR note names: a QR fits any reader.
 */
export async function handleTap(body: unknown, deps: ReaderDeps): Promise<TapResponse> {
  const tap = parseTap(body);
  if (!tap) return { error: 'bad_pass' };
  const read = await readPresentation(tap.presentation, deps.publicKey);
  if (!read) return { error: 'bad_pass' };
  const now = deps.now();
  const state = await deps.loadState(read.pass, tap.facility, now);
  const decision = decideTap({ pass: read.pass, note: read.note, place: tap.place, facility: tap.facility, state, now });
  const result = decision.granted ? { granted: true, reason: null } : decision;
  // A note that has been used before is a copy, which no pass or note check can tell from the first.
  if ((await deps.saveVisit(visitRow(read, tap, result, false, now))) === 'duplicate') return { granted: false, reason: 'pass_expired' };
  return decision.granted ? { granted: true, unit: read.pass.unit } : decision;
}

/**
 * The taps an offline reader queued, sent once it is back online. The reader decided each one with what it had, so its
 * decision and its time are kept as they are; only the signatures are checked again. Junk and duplicates are skipped.
 * `saved + skipped` is how many it took off the front of the list: the reader removes that many, and a list over the
 * limit is sent again for the rest.
 */
export async function handleVisits(body: unknown, deps: Omit<ReaderDeps, 'loadState'>): Promise<{ saved: number; skipped: number }> {
  const list = typeof body === 'object' && body !== null ? (body as { visits?: unknown }).visits : undefined;
  const visits = Array.isArray(list) ? list.slice(0, MAX_VISITS) : [];
  let saved = 0;
  // shortcut: one insert per visit, in order, so a full queue of 500 takes seconds; batch the insert if readers queue that many.
  for (const item of visits) {
    const visit = parseVisit(item);
    const read = visit && (await readPresentation(visit.presentation, deps.publicKey));
    if (!visit || !read) continue;
    if ((await deps.saveVisit(visitRow(read, visit, visit, true, new Date(visit.at)))) === 'saved') saved++;
  }
  return { saved, skipped: visits.length - saved };
}

type CardRow = { status: string; places: Place[]; unit: { lease_end: string | null } };
type UserRow = { user_id: string };

/** Whether someone on the card holds the booking for this court and hour. A reader with no facility has no booking to find. */
async function hasBooking(admin: SupabaseClient, cardId: string, facility: string | null, now: Date): Promise<boolean> {
  if (facility === null) return false;
  // One booking at most holds a court for an hour (the unique slot index), so the booker is one row; the card's people are few.
  const [slot, members] = await Promise.all([
    admin
      .from('bookings')
      .select('user_id')
      .eq('facility_id', facility)
      .eq('date', mytDate(now))
      .eq('start_hour', mytHour(now))
      .eq('status', 'booked')
      .overrideTypes<UserRow[], { merge: false }>(),
    admin.from('card_members').select('user_id').eq('card_id', cardId).overrideTypes<UserRow[], { merge: false }>(),
  ]);
  // The facility comes from the reader, and Postgres refuses text that is not an id (22P02). Nothing is booked at that.
  if (slot.error?.code === '22P02') return false;
  if (slot.error) throw new Error(`bookings lookup failed: ${slot.error.message}`);
  if (members.error) throw new Error(`card members lookup failed: ${members.error.message}`);
  return slot.data.some((booking) => members.data.some((member) => member.user_id === booking.user_id));
}

/** The state of the card and phone a pass names as they are now, so a suspension or a freeze after the pass was signed counts. */
async function loadState(admin: SupabaseClient, pass: PassPayload, facility: string | null, now: Date): Promise<TapState> {
  const [card, phone, booked] = await Promise.all([
    admin.from('cards').select('status, places, unit:units(lease_end)').eq('id', pass.card).maybeSingle().overrideTypes<CardRow, { merge: false }>(),
    admin.from('card_phones').select('frozen_at').eq('id', pass.phone).maybeSingle().overrideTypes<{ frozen_at: string | null }, { merge: false }>(),
    hasBooking(admin, pass.card, facility, now),
  ]);
  if (card.error) throw new Error(`card lookup failed: ${card.error.message}`);
  if (phone.error) throw new Error(`phone lookup failed: ${phone.error.message}`);
  // A card or phone that is gone since the pass was signed (a demo reset, say) opens nothing.
  return {
    suspended: card.data?.status !== 'active',
    leaseEnd: card.data?.unit.lease_end ?? null,
    phoneFrozen: !phone.data || phone.data.frozen_at !== null,
    places: card.data?.places ?? [],
    hasBooking: booked,
  };
}

/**
 * Inserts the visit. The unique `card_visits.nonce` is the replay check, so a second insert of one note answers
 * 'duplicate' (23505). So does a row the database can never take, such as one for a card that a reset has removed (23503)
 * or text it cannot hold (classes 22 and 23): trying again cannot save it, and a reader that was told to retry would be
 * stuck on it for good. Anything else, a lost connection say, throws, and the reader keeps the visit.
 */
async function saveVisit(admin: SupabaseClient, visit: VisitRow): Promise<'saved' | 'duplicate'> {
  const { error } = await admin.from('card_visits').insert(visit);
  if (!error) return 'saved';
  if (/^2[23]/.test(error.code)) return 'duplicate';
  throw new Error(`visit save failed: ${error.message}`);
}

/** The reader API's deps on the live database. `admin` is the service-role client: only trusted server code may hold it. */
export function adminReaderDeps(admin: SupabaseClient, publicKey: PublicJwk): ReaderDeps {
  return {
    publicKey,
    now: () => new Date(),
    loadState: (pass, facility, now) => loadState(admin, pass, facility, now),
    saveVisit: (visit) => saveVisit(admin, visit),
  };
}

/**
 * What an offline reader keeps from a sync: the township's suspended cards and frozen phones, and today's bookings, each
 * as the booker's card. Ids, facilities and hours only. `serverTime` (ms) lets the reader correct its own clock.
 */
export async function loadSync(
  admin: SupabaseClient, townshipId: string, now: Date,
): Promise<Pick<ReaderCache, 'stop' | 'bookings'> & { serverTime: number }> {
  const date = mytDate(now);
  // shortcut: PostgREST answers at most 1000 rows a query, ample for one township's stop list and day; page these when one outgrows it.
  const [cards, phones, bookings] = await Promise.all([
    admin.from('cards').select('id').eq('township_id', townshipId).eq('status', 'suspended').overrideTypes<{ id: string }[], { merge: false }>(),
    admin
      .from('card_phones')
      .select('id, cards!inner(township_id)')
      .eq('cards.township_id', townshipId)
      .not('frozen_at', 'is', null)
      .overrideTypes<{ id: string }[], { merge: false }>(),
    admin
      .from('bookings')
      .select('facility_id, start_hour, user_id')
      .eq('township_id', townshipId)
      .eq('date', date)
      .eq('status', 'booked')
      .overrideTypes<{ facility_id: string; start_hour: number; user_id: string }[], { merge: false }>(),
  ]);
  for (const { error } of [cards, phones, bookings]) if (error) throw new Error(`sync lookup failed: ${error.message}`);

  // shortcut: the bookers go in one `in (…)`, which is a long URL by the time a day has a few hundred; embed the members then.
  const bookers = [...new Set(bookings.data!.map((b) => b.user_id))];
  const members = bookers.length
    ? await admin.from('card_members').select('user_id, card_id').in('user_id', bookers).overrideTypes<(UserRow & { card_id: string })[], { merge: false }>()
    : { data: [], error: null };
  if (members.error) throw new Error(`card members lookup failed: ${members.error.message}`);
  const cardOf = new Map(members.data.map((m) => [m.user_id, m.card_id]));

  return {
    serverTime: now.getTime(),
    stop: { cards: cards.data!.map((c) => c.id), phones: phones.data!.map((p) => p.id) },
    // A booker who is on no card has nothing to open, so their booking is left out.
    bookings: bookings.data!.flatMap((b) => {
      const card = cardOf.get(b.user_id);
      return card ? [{ card, facility: b.facility_id, date, hour: b.start_hour }] : [];
    }),
  };
}
