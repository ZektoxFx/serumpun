# Household access card, stage 1 (the tap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three things:
- a household card in Me that opens with the 6-digit PIN;
- a public reader screen that takes the card by drag or Tap and shows a green tick or a red reason, even with the Wi-Fi off;
- Dashboard › Units, where the office suspends and lifts a card.

**Architecture:**
- **Data.** Migration 0024 adds new tables (units, cards, card_members, card_phones, phone_keys, card_visits, member_pins) with row-level security and security-definer RPCs.
- **Passes.** The server signs a 24-hour pass for each phone with an ECDSA P-256 key kept in env. Each browser holds its own non-exportable key in IndexedDB and signs a short note at every tap.
- **Decisions.** One pure `decideTap` decides every tap. The server feeds it live state when the reader is online; the reader feeds it its cached stop list and bookings when offline.

**Tech Stack:**
- Next.js 16 App Router: server components, server actions and route handlers.
- Supabase Postgres: RLS, definer RPCs and pgcrypto.
- WebCrypto (ECDSA P-256 with SHA-256) on Node and in the browser; IndexedDB.
- Vitest; the installed `qrcode`; Tailwind 4 tokens.

**Spec:** `docs/superpowers/specs/2026-10-19-household-access-card-design.md`. This plan is stage 1 of its section 11. Read sections 2, 5, 6, 7.2, 8 and 9 of the spec before starting.

## Global Constraints

- **Next.js 16:** read the relevant guide in `node_modules/next/dist/docs/` before writing route handlers, server actions or pages (AGENTS.md).
- **Supabase access model** (from `supabase/migrations/0001_core.sql`):
  - RLS is on for every table, and every policy is `to authenticated`.
  - Column grants decide which columns can be written.
  - Security-definer functions pin `search_path = ''`, lose EXECUTE for public, anon and authenticated, and get it back only where the app calls them.
  - New migrations follow `0023_…`.
- **Time:** all times are Malaysia time, using the helpers in `lib/domain/time.ts` (`mytDate`, `mytHour`).
- **Privacy:**
  - Unit numbers and phone numbers are seen only by the office (`profile_private`). Neighbours see name and neighbourhood.
  - The reader never shows a name. The visit log records the unit, never the person or the phone.
- **Copy and look:**
  - Every new string goes in English and Malay (`lib/i18n/en.ts`, `lib/i18n/ms.ts`). `tests/i18n.test.ts` fails on a missing Malay string or a mismatched `{placeholder}`.
  - Icons go through `Glyph` and `Icon`.
  - Never colour alone: red and green results also carry ✕ or ✓ and words.
- **Crons:** Vercel Hobby allows one daily cron (`/api/cron/reminders`). Stage 1 adds none.
- **The live demo is shared.** "Reset demo" (`seedAll`) must restore every card state.
- **The card signing key** lives in env (`CARD_SIGNING_KEY` in `.env.local` and Vercel). It is never committed or printed.
- **Dependencies:** no new dependency in stage 1. QR codes use the installed `qrcode`.
- **Database during the build** (decision 17):
  - Migrations only add tables, and seeders only fill them, without wiping anything.
  - Changes to what the live app does wait for the stage's deploy.
  - The full reset (`npm run db:seed`) and `npm run smoke` run only with the user's OK.
- **Git and deploys:**
  - Production deploys and moving GitHub `main` need the user's OK each time.
  - Only `feat/serumpun-mvp` is pushed.
  - Never print secret values from `.env.local` or `vercel env`.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The phone's and the reader's clocks disagree** (a laptop reader with a slow clock). A note up to a minute either way must still be accepted, and the reader corrects its own clock by the server time from its last sync. Tests: Task 2 *accepts a phone clock 45 seconds ahead of the reader*; Task 8's reader offset.
2. **A browser that can't store the key** (Safari private windows, some in-app browsers with IndexedDB missing) must say so plainly instead of breaking. Test: Task 6 *says the browser can't hold the card when IndexedDB is missing*.
3. **Many demo visitors sign in as Aisyah at once.** Every browser's key must join her one seeded phone, so the card keeps showing 3 of 4 phones. Test: Task 3 check 4.
4. **"Reset demo" empties the card tables while a browser still holds a key.** The next renewal must register that key again instead of failing forever. Test: Task 3 check 5.
5. **A lease ends at the end of its last day in Malaysia, not at UTC midnight.** Tests: Task 2 *ends a lease at the end of its last day in Malaysia*; Task 9 *shows a tenant's card as lease ended after the last day*.

## Files

| File | Responsibility |
|---|---|
| `lib/card/crypto.ts` (new) | Pass and tap-note signing and checking, on Node and in the browser |
| `lib/card/decide.ts` (new) | The one tap decision, the offline state, and the reader's shared types |
| `lib/card/pin.ts` (new) | The PIN format, the demo PIN, the browser-side lock for demo accounts, card error keys |
| `lib/card/server.ts` (new, server-only) | Issuing a pass after the database registers the phone key |
| `lib/card/summary.ts` (new, server) | The signed-in person's card for Me and the reader |
| `lib/card/reader-server.ts` (new, server-only) | Tap and offline-visit handling, the live state, sync data |
| `lib/card/device.ts` (new, client) | The browser's key pair and pass in IndexedDB; signing a tap |
| `lib/card/queue.ts` (new, client) | The reader's offline queue and cache in localStorage |
| `lib/domain/units.ts` (new) | Unit states and office error keys |
| `supabase/migrations/0024_access_cards.sql` (new) | Tables, RLS, grants and RPCs |
| `lib/seed/cards.ts` (new), `lib/seed/people.ts`, `lib/seed/index.ts`, `scripts/seed-cards.ts` (new) | Households, phones and PINs, seeded without wiping anything |
| `app/(app)/me/card/actions.ts` (new), `app/(app)/me/page.tsx` | Renewing the pass and checking the PIN; the card in Me |
| `components/card/*` (new) | CardFace, PinPad, CardQr, HouseholdCard |
| `app/reader/page.tsx` (new), `components/reader/ReaderScreen.tsx` (new), `app/api/reader/{sync,tap,visits}/route.ts` (new) | The public reader |
| `app/dashboard/units/*` (new), `components/dashboard/CardSuspension.tsx` (new), `app/dashboard/layout.tsx` | Dashboard › Units |
| `app/(auth)/actions.ts`, `lib/content/help.ts`, `scripts/smoke.ts`, `docs/SYSTEM.md`, `lib/env.ts`, `scripts/card-key.ts` (new), `package.json` | Demo restore, privacy line, smoke checks, docs, the key |

---

### Task 1: Pass crypto and the signing key

**Files:**
- Create: `lib/card/crypto.ts`
- Create: `scripts/card-key.ts`
- Modify: `lib/env.ts` (a `cardSigningKey` getter)
- Modify: `package.json` (script `"card:key": "tsx scripts/card-key.ts"`)
- Test: `tests/card-crypto.test.ts`; `tests/env.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (`lib/card/crypto.ts`, WebCrypto only, no `server-only`):

```ts
export type Place = 'facilities' | 'gym' | 'pool';
export const PLACES: readonly Place[]; // ['facilities', 'gym', 'pool']
export type PublicJwk = { kty: 'EC'; crv: 'P-256'; x: string; y: string };
export type PassPayload = {
  v: 1; card: string; unit: string; township: string; phone: string; key: PublicJwk;
  places: Place[]; suspended: boolean; leaseEnd: string | null; iat: number; exp: number; // iat, exp: seconds
};
export type TapNote = { place: Place | null; facility: string | null; at: number; nonce: string }; // at: ms; place null = the QR
export const PASS_TTL_SECONDS = 86_400;
export function generateSigningKey(): Promise<string>; // base64url of the private JWK's JSON
export function importSigningKey(encoded: string): Promise<CryptoKey>; // ECDSA P-256, usage ['sign']
export function publicJwkFromSigningKey(encoded: string): PublicJwk; // kty, crv, x, y only
export function signPass(payload: PassPayload, key: CryptoKey): Promise<string>; // "<b64url json>.<b64url sig>"
export function verifyPass(token: string, publicKey: PublicJwk): Promise<PassPayload | null>;
export function signNote(pass: string, note: TapNote, phoneKey: CryptoKey): Promise<string>; // "<pass>.<b64url note>.<b64url sig>"
export function readPresentation(presentation: string, publicKey: PublicJwk): Promise<{ pass: PassPayload; note: TapNote } | null>;
```

- `lib/env.ts` gains `get cardSigningKey() { return readServerEnv(['CARD_SIGNING_KEY']); }`.

**Encoding** (the one choice the tests don't pin):
- ECDSA with SHA-256. The signature is WebCrypto's raw `r||s` (64 bytes), in base64url.
- A pass signs the ASCII bytes of its base64url payload.
- A note signs the ASCII bytes of `<pass>.<b64url note>`, so a note can't be moved onto another pass.
- Every failure returns `null` and never throws: bad base64, bad JSON, the wrong number of parts, a bad signature.

- [ ] **Step 1: Write the failing test** `tests/card-crypto.test.ts`

```ts
import {
  generateSigningKey, importSigningKey, publicJwkFromSigningKey, readPresentation, signNote, signPass, verifyPass,
  type PassPayload, type PublicJwk, type TapNote,
} from '@/lib/card/crypto';

async function phone() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { privateKey: pair.privateKey, jwk: { kty, crv, x, y } as PublicJwk };
}
const payload = (key: PublicJwk): PassPayload => ({
  v: 1, card: 'card-18', unit: 'No. 18, Jalan Elmina Valley 3/2', township: 'elmina', phone: 'phone-1', key,
  places: ['facilities', 'gym', 'pool'], suspended: false, leaseEnd: null, iat: 1_792_000_000, exp: 1_792_086_400,
});
const NOTE: TapNote = { place: 'pool', facility: null, at: 1_792_000_100_000, nonce: 'n-1' };

describe('passes', () => {
  it('verify with the township key and give back their payload', async () => {
    const encoded = await generateSigningKey();
    const p = payload((await phone()).jwk);
    const token = await signPass(p, await importSigningKey(encoded));
    expect(await verifyPass(token, publicJwkFromSigningKey(encoded))).toEqual(p);
  });
  it('expose only the public half of the township key', async () => {
    expect(Object.keys(publicJwkFromSigningKey(await generateSigningKey())).sort()).toEqual(['crv', 'kty', 'x', 'y']);
  });
  it('fail when their payload is changed', async () => {
    const encoded = await generateSigningKey();
    const p = payload((await phone()).jwk);
    const [, sig] = (await signPass(p, await importSigningKey(encoded))).split('.');
    const forged = `${Buffer.from(JSON.stringify({ ...p, suspended: true })).toString('base64url')}.${sig}`;
    expect(await verifyPass(forged, publicJwkFromSigningKey(encoded))).toBeNull();
  });
  it('fail against another township key', async () => {
    const token = await signPass(payload((await phone()).jwk), await importSigningKey(await generateSigningKey()));
    expect(await verifyPass(token, publicJwkFromSigningKey(await generateSigningKey()))).toBeNull();
  });
});

describe('tap notes', () => {
  it('verify against the phone key inside the pass', async () => {
    const encoded = await generateSigningKey();
    const device = await phone();
    const p = payload(device.jwk);
    const presentation = await signNote(await signPass(p, await importSigningKey(encoded)), NOTE, device.privateKey);
    expect(await readPresentation(presentation, publicJwkFromSigningKey(encoded))).toEqual({ pass: p, note: NOTE });
  });
  it('fail when another phone signed them', async () => {
    const encoded = await generateSigningKey();
    const pass = await signPass(payload((await phone()).jwk), await importSigningKey(encoded));
    const presentation = await signNote(pass, NOTE, (await phone()).privateKey);
    expect(await readPresentation(presentation, publicJwkFromSigningKey(encoded))).toBeNull();
  });
  it('cannot be moved onto another pass', async () => {
    const encoded = await generateSigningKey();
    const key = await importSigningKey(encoded);
    const device = await phone();
    const passA = await signPass(payload(device.jwk), key);
    const passB = await signPass({ ...payload(device.jwk), card: 'card-7' }, key);
    const [, , noteB64, noteSig] = (await signNote(passA, NOTE, device.privateKey)).split('.');
    expect(await readPresentation(`${passB}.${noteB64}.${noteSig}`, publicJwkFromSigningKey(encoded))).toBeNull();
  });
  it('come back null, never throw, for junk', async () => {
    const pub = publicJwkFromSigningKey(await generateSigningKey());
    for (const junk of ['', 'a.b.c', 'x.y.z.w', '!!!.???.***.###']) expect(await readPresentation(junk, pub)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/card-crypto.test.ts`
Expected: FAIL. It can't resolve `@/lib/card/crypto`.

- [ ] **Step 3: Implement `lib/card/crypto.ts`** with the interface and the encoding rule above.

Read keys with `crypto.subtle.importKey('jwk', …)`. `generateSigningKey` exports the private key as a JWK.

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/card-crypto.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Add the env getter, test first.**

In `tests/env.test.ts`, add `expect(() => env.cardSigningKey).toThrow(/server-only/);` beside the three server-only expectations at lines 42–44.
Run `npx vitest run tests/env.test.ts`. Expected: FAIL, because `env.cardSigningKey` is undefined and does not throw.
Then add the getter.
Run again. Expected: PASS.

- [ ] **Step 6: Write `scripts/card-key.ts` and the `card:key` script.**

The script works like this:
- If `.env.local` already has a `CARD_SIGNING_KEY=` line, it prints `CARD_SIGNING_KEY already in .env.local` and stops.
- Otherwise it appends `CARD_SIGNING_KEY=<generateSigningKey()>` and prints `CARD_SIGNING_KEY added to .env.local`.
- It never prints the key.

Run: `npm run card:key`
Expected: `CARD_SIGNING_KEY added to .env.local`. A second run prints `CARD_SIGNING_KEY already in .env.local`.

- [ ] **Step 7: Commit**

`.env.local` is git-ignored; never add it.

```bash
git add lib/card/crypto.ts lib/env.ts scripts/card-key.ts package.json tests/card-crypto.test.ts tests/env.test.ts
git commit -m "feat(card): sign and verify household passes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: The tap decision

**Files:**
- Create: `lib/card/decide.ts`
- Modify: `lib/i18n/en.ts`, `lib/i18n/ms.ts` (`reader.reason.*`, `reader.place.*`)
- Test: `tests/card-decide.test.ts`

**Interfaces:**
- Consumes: `Place`, `PLACES`, `PassPayload`, `TapNote`, `PublicJwk` (Task 1); `mytDate`, `mytHour` (`lib/domain/time.ts`).
- Produces (`lib/card/decide.ts`, pure):

```ts
export const DENY_REASONS = ['pass_expired', 'phone_off', 'card_suspended', 'lease_ended', 'place_off', 'no_booking'] as const;
export type DenyReason = (typeof DENY_REASONS)[number];
export type TapDecision = { granted: true } | { granted: false; reason: DenyReason };
export type TapState = { suspended: boolean; leaseEnd: string | null; phoneFrozen: boolean; places: readonly Place[]; hasBooking: boolean };
export const BOOKED_PLACES: readonly Place[]; // ['facilities', 'gym']
export const NOTE_FRESH_MS = 60_000;
export function leaseEnded(leaseEnd: string | null, now: Date): boolean; // mytDate(now) > leaseEnd
export function decideTap(i: { pass: PassPayload; note: TapNote; place: Place; facility: string | null; state: TapState; now: Date }): TapDecision;
export type ReaderCache = {
  publicKey: PublicJwk; offsetMs: number; syncedAt: number;
  stop: { cards: string[]; phones: string[] };
  bookings: { card: string; facility: string; date: string; hour: number }[];
};
export function offlineState(pass: PassPayload, cache: ReaderCache, facility: string | null, now: Date): TapState;
export type TapRequest = { presentation: string; place: Place; facility: string | null };
export type OfflineVisit = TapRequest & { at: number; granted: boolean; reason: DenyReason | null };
export function reasonKey(reason: DenyReason): MessageKey; // `reader.reason.${reason}`
```

**Check order**, which pins the reason when several apply:
1. `pass_expired`: the pass has expired, or the note is more than `NOTE_FRESH_MS` off either way, or the note was made for another reader (its place isn't null and differs from this reader's, or its facility differs).
2. `phone_off`: the phone is frozen.
3. `card_suspended`
4. `lease_ended`
5. `place_off`: the place is switched off for the card.
6. `no_booking`: Facilities or the Gym, with no booking.

`offlineState` builds the state like this:
- `suspended` = `pass.suspended` or the card is on `stop.cards`;
- `phoneFrozen` = the phone is on `stop.phones`;
- `places` and `leaseEnd` come from the pass;
- `hasBooking` = a cached booking for this card and facility on `mytDate(now)` at `mytHour(now)`.

**Copy (English / Malay):**
- `reader.reason.pass_expired`: "Pass expired" / "Pas tamat tempoh"
- `reader.reason.phone_off`: "This phone is switched off" / "Telefon ini telah dimatikan"
- `reader.reason.card_suspended`: "Card suspended" / "Kad digantung"
- `reader.reason.lease_ended`: "Lease ended" / "Tempoh sewa tamat"
- `reader.reason.place_off`: "{place} is switched off for this card" / "{place} dimatikan untuk kad ini"
- `reader.reason.no_booking`: "No booking at this time" / "Tiada tempahan pada waktu ini"
- `reader.place.facilities` / `gym` / `pool`: "Facilities" / "Kemudahan", "Gym" / "Gim", "Pool" / "Kolam renang"

- [ ] **Step 1: Write the failing test** `tests/card-decide.test.ts`

```ts
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
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/card-decide.test.ts`
Expected: FAIL. It can't resolve `@/lib/card/decide`.

- [ ] **Step 3: Implement `lib/card/decide.ts`** and add the copy above to `en.ts` and `ms.ts`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/card-decide.test.ts tests/i18n.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/card/decide.ts lib/i18n/en.ts lib/i18n/ms.ts tests/card-decide.test.ts
git commit -m "feat(card): decide each tap the same way online and offline" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Database: cards, phones, visits and PINs

**Files:**
- Create: `supabase/migrations/0024_access_cards.sql`
- Scratch, never committed: a rolled-back check script in the session scratchpad. It uses `postgres` with `env.databaseUrl`, as `scripts/migrate.ts` does.
- Modify: `lib/i18n/en.ts`, `lib/i18n/ms.ts` (`notify.card.suspended`, `notify.card.lifted`, `notify.card.pinLocked`)

**Interfaces:**
- Consumes: `townships`, `profiles`, `facilities`, `notify()`, `my_township()`, `is_management()` (existing).
- Produces the tables, columns and constraints below. Each `text` length bound applies after `btrim`.

```
units        id uuid pk, township_id → townships, label text 1–80, neighbourhood text 1–80, record_name text 1–80,
             record_tenure text in ('owner','tenant'), record_phone text ≤ 30 null, lease_end date null,
             unique (township_id, label), check (record_tenure = 'tenant' or lease_end is null)
cards        id uuid pk, township_id → townships, unit_id uuid unique → units on delete cascade,
             status text default 'active' in ('active','suspended'), suspended_reason text 1–200 null, suspended_at timestamptz null,
             places text[] not null default '{facilities,gym,pool}' check (places <@ '{facilities,gym,pool}'),
             phone_limit int not null default 4 check (between 4 and 40), created_at timestamptz default now(),
             check ((status = 'suspended') = (suspended_reason is not null))
card_members card_id → cards on delete cascade, user_id uuid unique → profiles on delete cascade,
             role text in ('owner','co_owner','adult','child'), ic_checked_at timestamptz null, created_at, pk (card_id, user_id);
             unique index (card_id) where role = 'owner'; unique index (card_id) where role = 'co_owner'
card_phones  id uuid pk, card_id → cards on delete cascade, user_id uuid null → profiles on delete cascade,
             label text 1–60, frozen_at timestamptz null, created_at, unique (card_id, label);
             unique index (user_id) where user_id is not null
phone_keys   id uuid pk, phone_id → card_phones on delete cascade, x text, y text, created_at, unique (phone_id, x, y)
card_visits  id uuid pk, township_id → townships, card_id → cards on delete cascade, place text in ('facilities','gym','pool'),
             facility_id uuid null → facilities on delete set null, granted boolean, reason text null
             in ('pass_expired','phone_off','card_suspended','lease_ended','place_off','no_booking'), offline boolean default false,
             nonce text unique, at timestamptz, created_at, check (granted = (reason is null)); index (card_id, at desc)
member_pins  user_id uuid pk → profiles on delete cascade, pin_hash text, failed_count int default 0, locked_until timestamptz null
```

**Functions.** All are `security definer set search_path = ''`, and errors are `raise exception '<code>'`.
- **`my_card() returns uuid`** (stable): the caller's card id, or null.
- **`register_phone_key(p_x text, p_y text) returns jsonb`** (authenticated):
  - The caller must be on a card, else `no_card`.
  - Each of `p_x` and `p_y` must be 43 base64url characters, else `bad_key`.
  - The caller's phone is their `card_phones` row. If it's missing, create it as `<first word of full_name>'s phone`, unless the card already has `phone_limit` phones (`card_full`).
  - Add the key with `on conflict do nothing`.
  - Return `{card, unit, township, phone, places, suspended, lease_end}`, where `unit` is the unit label and `suspended` is `status = 'suspended'`.
  - Until stage 2's move-to-a-new-phone rule, every browser of a person joins their one phone, which is also what shared demo accounts need.
- **`set_member_pins(p_users uuid[], p_pin text) returns void`** (service_role only):
  - `p_pin` must match `^\d{6}$`, else `bad_pin`.
  - Upsert `pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))`, with `failed_count = 0` and `locked_until = null`.
- **`verify_card_pin(p_pin text) returns jsonb`** (authenticated). It returns `{"ok": true}`, `{"ok": false, "tries_left": n}` or `{"ok": false, "locked_until": <timestamptz>}`.
  - A caller with no `member_pins` row: raise `no_pin`.
  - While `locked_until > now()`: return the locked answer without checking.
  - Right PIN: reset `failed_count` and `locked_until`.
  - Wrong PIN: `failed_count + 1`. At 5, set `locked_until = now() + interval '15 minutes'` and `failed_count = 0`, and `notify()` the card's owner and co-owner (`'card', 'notify.card.pinLocked', null, '/me'`).
  - Demo accounts (`auth.users.raw_app_meta_data ? 'demo'`) never count wrong tries. Their lockout lives in the browser (Task 5), so one visitor can't lock everyone out.
- **`suspend_card(p_card uuid, p_reason text) returns void`** (authenticated):
  - Errors: `not_management` unless `is_management()`; `not_found` unless the card is in the caller's township; `bad_reason` unless the trimmed reason is 1–200 characters.
  - Sets `status = 'suspended'`, the reason, and `suspended_at = now()`. Suspending again only changes the reason.
  - Notifies every member (`'card', 'notify.card.suspended', <reason>, '/me'`).
- **`lift_card_suspension(p_card uuid) returns void`** (authenticated):
  - Same checks as `suspend_card`, plus `not_suspended` when the card is active.
  - Sets `status = 'active'` and clears the reason and `suspended_at`.
  - Notifies every member (`'card', 'notify.card.lifted', null, '/me'`).

**Policies** (select only; writes go only through the RPCs and the service role):
- **`units`, `cards`, `card_members`, `card_phones`:**
  - The office reads its township's rows (`is_management()` and township = `my_township()`, through `cards` for members and phones).
  - A member reads their own card's rows: `cards.id = my_card()`, `units.id` = that card's `unit_id`, and `card_id = my_card()` for members and phones.
- **`phone_keys`:** a person reads the keys of their own phone.
- **`card_visits`:** members read their card's visits. The office reads none; incident lookups come in stage 5.
- **`member_pins`:** no policy.

**Grants:**
- Revoke all on the seven tables from anon and authenticated. Grant select on all of them except `member_pins` to authenticated, and select/insert/update/delete on all seven to service_role.
- Functions: revoke execute from public, anon and authenticated. Grant `my_card`, `register_phone_key`, `verify_card_pin`, `suspend_card` and `lift_card_suspension` to authenticated, and `set_member_pins` to service_role.
- Start the file with `create extension if not exists pgcrypto with schema extensions;` and end it with `notify pgrst, 'reload schema';`.

**Copy:**
- `notify.card.suspended`: "Your household card was suspended" / "Kad isi rumah anda telah digantung"
- `notify.card.lifted`: "Your household card works again" / "Kad isi rumah anda boleh digunakan semula"
- `notify.card.pinLocked`: "Too many wrong PINs on your household card" / "Terlalu banyak PIN salah pada kad isi rumah anda"

- [ ] **Step 1: Watch it be missing (RED)**

Run the scratch script's first query on the shared database: `select to_regclass('public.cards')`.
Expected: `null`.

- [ ] **Step 2: Write `supabase/migrations/0024_access_cards.sql`** as specified, and add the three notification strings to `en.ts` and `ms.ts`.

- [ ] **Step 3: Apply it**

This is additive, which decision 17 allows during the build.

Run: `npm run db:migrate`
Expected: `applied 0024_access_cards.sql`.

- [ ] **Step 4: Run the rolled-back checks (GREEN).**

The scratch script opens one transaction:
- It creates a unit and card for Aisyah (owner, a demo account) and one for Daniel (owner), from their existing profile ids.
- It runs each check as a user with `set local role authenticated` and `set local request.jwt.claims = '{"sub":"<id>"}'`.
- It ends with `rollback`.

Expected: every check prints `PASS`, and afterwards `select count(*) from cards` is still 0.
1. As Daniel, `select count(*) from cards` is 1. As Aisyah it's 1.
2. As Aisyah, `select public.suspend_card(<Daniel's card>, 'x')` fails with `not_management`.
3. As the office (Puan Rozita), `suspend_card(<Aisyah's card>, 'Landlord''s request')` sets her card to `suspended` and adds a `notify.card.suspended` notification for Aisyah.
4. As Daniel, `register_phone_key` with two different key pairs returns the same `phone` both times, and Daniel's card still has 1 phone. (Review Focus 3)
5. Delete Daniel's `card_phones` row as the service role, the way "Reset demo" would. Then, as Daniel, `register_phone_key` with his first key works again and returns a new phone id. (Review Focus 4)
6. As the service role, run `set_member_pins(array[<Daniel>], '123456')`. Then, as Daniel:
   - four wrong tries return `tries_left` 4, 3, 2, 1;
   - the fifth returns `locked_until` about 15 minutes ahead;
   - `verify_card_pin('123456')` still returns the locked answer.
7. As Aisyah (demo), after `set_member_pins(array[<Aisyah>], '123456')`, six wrong tries never lock, and then `'123456'` returns `{"ok": true}`.
8. As Daniel, `select * from member_pins` fails with permission denied.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0024_access_cards.sql lib/i18n/en.ts lib/i18n/ms.ts
git commit -m "feat(card): units, household cards, phones, visits and PINs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Seed the households, without wiping anything

**Files:**
- Modify: `lib/seed/people.ts` (add `imran` and `sara`; export `ensurePeople`)
- Create: `lib/seed/cards.ts`
- Create: `lib/card/pin.ts` with only `export const DEMO_PIN = '123456';` (Task 5 adds the rest)
- Modify: `lib/seed/index.ts` (append `seedCards` to `seeders`)
- Create: `scripts/seed-cards.ts`
- Modify: `package.json` (`"db:seed:cards": "tsx --conditions=react-server --env-file=.env.local scripts/seed-cards.ts"`)
- Test: `tests/card-seed.test.ts`

**Interfaces:**
- Consumes: the Task 3 tables and `set_member_pins`; `mytDate`.
- Produces:

```ts
// lib/seed/people.ts: PEOPLE gains
//   imran: { email: 'imran.yusof@example.com', name: 'Imran Yusof', neighbourhood: 'Elmina Valley 3', unit: 'No. 18, Jalan Elmina Valley 3/2', status: 'verified', joinedDaysAgo: 400 }
//   sara:  { email: 'sara.imran@example.com',  name: 'Sara Imran',  neighbourhood: 'Elmina Valley 3', unit: 'No. 18, Jalan Elmina Valley 3/2', status: 'verified', joinedDaysAgo: 380 }
export function ensurePeople(admin: SupabaseClient, now: Date): Promise<People>; // finds or creates each person; never deletes or rewrites anyone

// lib/seed/cards.ts: rows are keyed by unit label; seedCards resolves the ids
export const DEMO_CARD_UNIT = 'No. 18, Jalan Elmina Valley 3/2';
export type UnitRow = { label: string; neighbourhood: string; record_name: string; record_tenure: 'owner' | 'tenant'; record_phone: string | null; lease_end: string | null };
export type CardRow = { unit_label: string; status: 'active' | 'suspended'; suspended_reason: string | null; suspended_at: string | null; places: Place[] };
export type MemberRow = { unit_label: string; user_id: string; role: 'owner' | 'co_owner' | 'adult' | 'child'; ic_checked_at: string | null };
export type PhoneRow = { unit_label: string; user_id: string; label: string };
export function cardRows(now: Date, people: People): { units: UnitRow[]; cards: CardRow[]; members: MemberRow[]; phones: PhoneRow[] };
export const DEMO_CARD_RESET: { card: Pick<CardRow, 'status' | 'suspended_reason' | 'suspended_at' | 'places'>; phones: { frozen_at: null } };
export function seedCards(admin: SupabaseClient, now: Date, people: People): Promise<void>;
export function restoreDemoCard(admin: SupabaseClient): Promise<void>; // applies DEMO_CARD_RESET to No. 18's card and phones
```

**What the seed holds** (the tests pin it):
- **Units:**
  - One unit for each distinct `unit` among the seeded people. No. 18 holds Aisyah, Imran and Sara.
  - `record_name` is the first person listed at the unit, with `record_tenure: 'owner'`, except for three tenants:
    - Daniel, lease end 180 days after today in Malaysia;
    - Jason, card suspended 2 days ago with reason `Landlord's request: rent unpaid`;
    - Kavitha, lease ended yesterday in Malaysia.
  - Ten more units with no card: No. 61 to No. 70, Jalan Elmina Green 5, neighbourhood `Elmina Green`, with made-up owners' names.
  - Nur's unit (she's pending) also has no card, so 11 units have no card.
- **Cards:** one for each unit with a verified resident, so 14 cards. Every card has all three places on.
- **Members:** every verified resident, 16 people with Imran and Sara.
  - Role `owner`, except Imran (`co_owner`) and Sara (`child`).
  - `ic_checked_at` is the join date for owners and the co-owner.
- **Phones:** one per member. No. 18 has "Aisyah's iPhone", "Imran's Pixel" and "Sara's iPhone"; everyone else has `<first name>'s phone`.
- **How `seedCards` writes:**
  - It upserts without ids, on the natural keys: units on `township_id,label`, cards on `unit_id`, members on `user_id`, phones on `card_id,label`. It reads the ids back and calls `set_member_pins(<all members>, DEMO_PIN)`.
  - It deletes nothing, so it can run again.

- [ ] **Step 1: Write the failing test** `tests/card-seed.test.ts`

```ts
import { DEMO_CARD_RESET, DEMO_CARD_UNIT, cardRows } from '@/lib/seed/cards';
import type { People } from '@/lib/seed/people';

const now = new Date('2026-10-19T04:00:00Z'); // noon in Malaysia
const people = { townshipId: 'elmina', ids: new Proxy({}, { get: (_, key) => String(key) }) } as People;
const { units, cards, members, phones } = cardRows(now, people);
const VERIFIED = ['ahmad', 'aisyah', 'arif', 'daniel', 'farah', 'hafiz', 'imran', 'jason', 'kavitha', 'meiLing', 'nurul', 'priya', 'ravi', 'sara', 'siti', 'weiMing'];

it('puts every verified resident on exactly one card, and nobody else', () => {
  expect(members.map((m) => m.user_id).sort()).toEqual(VERIFIED);
});
it('gives No. 18 an Owner, a Co-owner, a child and their three phones', () => {
  const at18 = members.filter((m) => m.unit_label === DEMO_CARD_UNIT);
  expect(Object.fromEntries(at18.map((m) => [m.user_id, m.role]))).toEqual({ aisyah: 'owner', imran: 'co_owner', sara: 'child' });
  expect(phones.filter((p) => p.unit_label === DEMO_CARD_UNIT).map((p) => p.label).sort()).toEqual(["Aisyah's iPhone", "Imran's Pixel", "Sara's iPhone"]);
});
it('gives each of the 14 cards exactly one Owner', () => {
  expect(cards).toHaveLength(14);
  for (const card of cards) expect(members.filter((m) => m.unit_label === card.unit_label && m.role === 'owner'), card.unit_label).toHaveLength(1);
});
it('opens all three places on every card', () => {
  for (const card of cards) expect(card.places).toEqual(['facilities', 'gym', 'pool']);
});
it("suspends one tenant's card with the landlord's reason", () => {
  const suspended = cards.filter((c) => c.status === 'suspended');
  expect(suspended.map((c) => [c.unit_label, c.suspended_reason])).toEqual([['No. 19, Jalan Elmina Green 3/2', "Landlord's request: rent unpaid"]]);
});
it('ended one lease yesterday and runs another for 180 more days, in Malaysia', () => {
  const lease = (label: string) => units.find((u) => u.label === label)!.lease_end;
  expect(lease('No. 3, Jalan Elmina Gardens 3/1')).toBe('2026-10-18');
  expect(lease('No. 7, Jalan Elmina Valley 3/4')).toBe('2027-04-17');
});
it("leaves Nur's unit and ten more without a card", () => {
  const withCard = new Set(cards.map((c) => c.unit_label));
  const without = units.filter((u) => !withCard.has(u.label)).map((u) => u.label);
  expect(without).toHaveLength(11);
  expect(without).toContain('No. 25, Jalan Elmina Green 1/3');
});
it('restores No. 18 to exactly how it was seeded', () => {
  const seeded = cards.find((c) => c.unit_label === DEMO_CARD_UNIT)!;
  expect(DEMO_CARD_RESET.card).toEqual({ status: seeded.status, suspended_reason: seeded.suspended_reason, suspended_at: seeded.suspended_at, places: seeded.places });
  expect(DEMO_CARD_RESET.phones).toEqual({ frozen_at: null });
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/card-seed.test.ts`
Expected: FAIL. It can't resolve `@/lib/seed/cards`.

- [ ] **Step 3: Implement.**
- Add `imran` and `sara` to `PEOPLE`, and write `ensurePeople`. It looks users up by email or by their demo key as `seedPeople` does, creates only the missing ones with their profile and `profile_private` rows, and returns `People`.
- Write `lib/card/pin.ts` (just `DEMO_PIN`) and `lib/seed/cards.ts`.

- [ ] **Step 4: Run the whole suite**

The other seeders must still pass with the two new people.

Run: `npm test`
Expected: PASS, including the 8 new tests.

- [ ] **Step 5: Wire it in.**
- Append `seedCards` to `seeders` in `lib/seed/index.ts`.
- `scripts/seed-cards.ts` runs `seedCards(admin, now, await ensurePeople(admin, now))` with `createAdminClient()`. It prints `cards: <units> units, <cards> cards, <members> people on cards, <phones> phones, PINs set`, and starts with a comment that it only adds and updates card rows.
- Add the `db:seed:cards` script to `package.json`.

- [ ] **Step 6: Fill the shared database (additive, allowed by decision 17)**

Run: `npm run db:seed:cards` twice.
Expected, both times: `cards: 25 units, 14 cards, 16 people on cards, 16 phones, PINs set`.

- [ ] **Step 7: Commit**

```bash
git add lib/seed/people.ts lib/seed/cards.ts lib/seed/index.ts lib/card/pin.ts scripts/seed-cards.ts package.json tests/card-seed.test.ts
git commit -m "feat(card): seed households, phones and demo PINs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Issuing passes and checking the PIN

**Files:**
- Create: `lib/card/server.ts` (starts with `import 'server-only'`)
- Modify: `lib/card/pin.ts`
- Create: `app/(app)/me/card/actions.ts` (`'use server'`)
- Modify: `lib/i18n/en.ts`, `lib/i18n/ms.ts` (`card.error.*`, `card.pin.*`)
- Test: `tests/card-pin.test.ts`, `tests/card-server.test.ts`

**Interfaces:**
- Consumes: `signPass`, `importSigningKey`, `PASS_TTL_SECONDS`, `PublicJwk`, `PassPayload` (Task 1); `register_phone_key`, `verify_card_pin` (Task 3); `env.cardSigningKey`; `requireMember`, `createClient` (existing).
- Produces:

```ts
// lib/card/pin.ts (pure)
export const DEMO_PIN = '123456';
export const PIN_TRIES = 5;
export const PIN_LOCK_MS = 900_000; // 15 minutes
export function isPinFormat(pin: string): boolean; // exactly six digits
export type DemoLock = { fails: number; until: number | null };
export function afterDemoTry(lock: DemoLock, ok: boolean, now: number): DemoLock; // the browser-side lock for demo accounts
export function demoLocked(lock: DemoLock, now: number): boolean;
export function cardErrorKey(code: string | undefined): MessageKey; // card.error.<no_card|card_full|bad_key>, else common.error

// lib/card/server.ts
export type IssueResult = { pass: string } | { error: 'no_card' | 'card_full' | 'bad_key' | 'failed' };
export function issuePass(supabase: SupabaseClient, key: PublicJwk, now: Date, signingKey: string): Promise<IssueResult>;

// app/(app)/me/card/actions.ts
export async function renewPass(key: PublicJwk): Promise<{ pass: string } | { error: MessageKey }>;
export async function checkCardPin(pin: string): Promise<{ ok: true } | { ok: false; error: MessageKey; triesLeft?: number; lockedUntil?: string }>;
```

**Behaviour:**
- **`issuePass`** calls `rpc('register_phone_key', { p_x: key.x, p_y: key.y })`.
  - A database error whose message is `no_card`, `card_full` or `bad_key` becomes that error; anything else becomes `failed`.
  - On success it builds `{ v: 1, card, unit, township, phone, key, places, suspended, leaseEnd: lease_end, iat: ⌊now/1000⌋, exp: iat + PASS_TTL_SECONDS }` and signs it. Import the signing key once per server instance.
- **`renewPass`** calls `requireMember()`, then `issuePass(await createClient(), key, new Date(), env.cardSigningKey)`, mapping errors through `cardErrorKey`.
- **`checkCardPin`** answers:
  - `card.pin.error.format` when `!isPinFormat`;
  - otherwise it calls `rpc('verify_card_pin', { p_pin })` and maps the answer to `{ ok: true }`, `{ error: 'card.pin.error.wrong', triesLeft }` or `{ error: 'card.pin.error.locked', lockedUntil }`.

**Copy:**
- `card.error.no_card`: "You're not on a household card yet" / "Anda belum berada pada kad isi rumah"
- `card.error.card_full`: "This card already has 4 phones. Ask the office for an extra card." / "Kad ini sudah ada 4 telefon. Minta kad tambahan daripada pejabat."
- `card.error.bad_key`: "This browser's key didn't work. Reload and try again." / "Kunci pelayar ini tidak berfungsi. Muat semula dan cuba lagi."
- `card.pin.error.format`: "Enter all 6 digits" / "Masukkan kesemua 6 digit"
- `card.pin.error.wrong`: "Wrong PIN. {n} tries left." / "PIN salah. Tinggal {n} percubaan."
- `card.pin.error.locked`: "Too many wrong tries. Try again at {time}." / "Terlalu banyak percubaan salah. Cuba lagi pada {time}."

- [ ] **Step 1: Write the failing tests**

`tests/card-pin.test.ts`:

```ts
import { afterDemoTry, cardErrorKey, demoLocked, isPinFormat, type DemoLock } from '@/lib/card/pin';
import { t } from '@/lib/i18n';

it('accepts exactly six digits', () => {
  expect(isPinFormat('123456')).toBe(true);
  for (const pin of ['12345', '1234567', '12a456', ' 123456', '']) expect(isPinFormat(pin), pin).toBe(false);
});
it('locks a demo browser for 15 minutes after 5 wrong tries', () => {
  const now = 1_000_000;
  let lock: DemoLock = { fails: 0, until: null };
  for (let i = 0; i < 5; i++) lock = afterDemoTry(lock, false, now);
  expect(lock.until).toBe(now + 900_000);
  expect(demoLocked(lock, now + 899_999)).toBe(true);
  expect(demoLocked(lock, now + 900_000)).toBe(false);
});
it('clears the wrong tries after a right PIN', () => {
  expect(afterDemoTry({ fails: 3, until: null }, true, 0)).toEqual({ fails: 0, until: null });
});
it('names every card error in both languages', () => {
  for (const code of ['no_card', 'card_full', 'bad_key']) {
    expect(cardErrorKey(code), code).not.toBe('common.error');
    expect(t('ms', cardErrorKey(code))).not.toBe(t('en', cardErrorKey(code)));
  }
  expect(cardErrorKey('__proto__')).toBe('common.error');
  expect(cardErrorKey(undefined)).toBe('common.error');
});
```

`tests/card-server.test.ts`:

```ts
vi.mock('server-only', () => ({}));
import { generateSigningKey, publicJwkFromSigningKey, verifyPass, type PublicJwk } from '@/lib/card/crypto';
import { issuePass } from '@/lib/card/server';

const now = new Date('2026-10-24T10:00:00Z');
const fields = { card: 'c18', unit: 'No. 18, Jalan Elmina Valley 3/2', township: 't', phone: 'p1', places: ['facilities', 'gym', 'pool'], suspended: false, lease_end: null };
const fakeDb = (result: { data: unknown; error: { message: string } | null }) => {
  const calls: unknown[] = [];
  return { calls, client: { rpc: async (name: string, args: unknown) => (calls.push([name, args]), result) } as never };
};

it('signs a 24-hour pass for the key the browser sent', async () => {
  const encoded = await generateSigningKey();
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const jwk = { kty, crv, x, y } as PublicJwk;
  const db = fakeDb({ data: fields, error: null });
  const result = await issuePass(db.client, jwk, now, encoded);
  expect(db.calls).toEqual([['register_phone_key', { p_x: jwk.x, p_y: jwk.y }]]);
  const payload = await verifyPass((result as { pass: string }).pass, publicJwkFromSigningKey(encoded));
  expect(payload).toMatchObject({ card: 'c18', phone: 'p1', key: jwk, leaseEnd: null, suspended: false });
  expect(payload!.exp - payload!.iat).toBe(86_400);
});
it("passes the database's refusal through", async () => {
  const key = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } as PublicJwk;
  expect(await issuePass(fakeDb({ data: null, error: { message: 'card_full' } }).client, key, now, await generateSigningKey())).toEqual({ error: 'card_full' });
  expect(await issuePass(fakeDb({ data: null, error: { message: 'boom' } }).client, key, now, await generateSigningKey())).toEqual({ error: 'failed' });
});
```

- [ ] **Step 2: Run them to watch them fail**

Run: `npx vitest run tests/card-pin.test.ts tests/card-server.test.ts`
Expected: FAIL. `afterDemoTry`, `issuePass` and the others don't exist yet.

- [ ] **Step 3: Implement** the rest of `lib/card/pin.ts`, `lib/card/server.ts` and `app/(app)/me/card/actions.ts`, and add the copy.

- [ ] **Step 4: Run them**

Run: `npx vitest run tests/card-pin.test.ts tests/card-server.test.ts tests/i18n.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/card/pin.ts lib/card/server.ts "app/(app)/me/card/actions.ts" lib/i18n/en.ts lib/i18n/ms.ts tests/card-pin.test.ts tests/card-server.test.ts
git commit -m "feat(card): issue passes and check the PIN" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: The card in Me

**Files:**
- Create: `lib/card/summary.ts`, `lib/card/device.ts`
- Create: `components/card/CardFace.tsx`, `components/card/PinPad.tsx`, `components/card/CardQr.tsx`, `components/card/HouseholdCard.tsx`
- Modify: `app/(app)/me/page.tsx`
- Modify: `lib/i18n/en.ts`, `lib/i18n/ms.ts` (`card.*`)
- Test: `tests/card-device.test.ts`

**Interfaces:**
- Consumes: `renewPass`, `checkCardPin`, `DEMO_PIN`, `afterDemoTry`, `demoLocked` (Task 5); `signNote`, `Place`, `PublicJwk` (Task 1); `leaseEnded` (Task 2); `Sheet`, `Button` (`components/ui`).
- Produces:

```ts
// lib/card/summary.ts (server)
export type CardSummary = {
  id: string; unit: string; places: Place[]; suspended: boolean; reason: string | null; leaseEnd: string | null;
  phones: number; phoneLimit: number; role: 'owner' | 'co_owner' | 'adult' | 'child';
};
export function loadMyCard(supabase: SupabaseClient, userId: string): Promise<CardSummary | null>; // RLS: the caller's own card

// lib/card/device.ts (client)
export type Device = { keys: CryptoKeyPair; publicKey: PublicJwk; pass: string | null; passExp: number | null };
export function openDevice(idb: IDBFactory | undefined): Promise<Device | 'unsupported'>; // makes and stores the key pair the first time
export function savePass(idb: IDBFactory, pass: string, exp: number): Promise<void>;
export function needsRenewal(passExp: number | null, now: number): boolean; // no pass, or under an hour left
export function presentTap(device: Pick<Device, 'keys' | 'pass'>, at: { place: Place | null; facility: string | null }, now: number): Promise<string>;

// components/card/HouseholdCard.tsx (client)
export function HouseholdCard(props: {
  summary: CardSummary;
  demoPin: string | null;
  reader?: { place: Place; facility: string | null; onPresent: (presentation: string) => void; result: 'granted' | 'denied' | null };
}): React.JSX.Element;
```

**Behaviour** (spec sections 7.2 and 9):
- **Opening:** a closed card face says "Tap to open". Tapping it opens the 6-digit `PinPad` in a `Sheet`.
  - Demo accounts (`demoPin` set) see "Demo PIN: 123456" above the keypad. Their wrong tries also go through `afterDemoTry`, and the pad shows "Wrong PIN. {n} tries left."
  - A right PIN pops the card up: scale and fade over about 200 ms, with no motion under `prefers-reduced-motion`.
  - The card stays open until the person leaves it, or for 60 seconds after the last tap.
- **The open card:**
  - `CardFace`: the Serumpun gradient, "HOUSEHOLD CARD", the unit label, PLACES and PHONES fields ("3 of 4"), the contactless mark, and no names.
  - "Add to Apple Wallet (demo)" opens a `Sheet` that explains it's a look-alike: a real Wallet pass needs a paid Apple Developer account, and passes that open doors need Apple's approval.
  - "Show QR instead" shows `CardQr`, which draws `presentTap(device, { place: null, facility: null })` with `qrcode`'s `toString` and redraws it every 30 seconds.
  - On a real phone (no `reader` prop), the open card shows "Hold near a reader" and no Tap button. In reader mode it shows a **Tap** button and can be dragged; letting go over the element marked `data-reader-drop` (found with `document.elementFromPoint`) counts as a tap. Both call `reader.onPresent(await presentTap(...))`. When `reader.result` is set, it shows ✓ or ✕ and buzzes: `navigator.vibrate?.(granted ? 60 : [80, 60, 80])`, plus a shake on ✕.
- **Renewing:** on mount, and whenever the browser is online and `needsRenewal`, call `renewPass(device.publicKey)` and `savePass`. Errors show their message.
- **Card states:**
  - A suspended card shows "Suspended · {reason}" on the face, and a lease that has ended shows "Lease ended". The card still opens, so the reader can show the red result.
  - When `openDevice` answers `'unsupported'`, the face says "This browser can't hold the card. Open Serumpun in a normal window." and there's no PIN pad.
- **Me page:**
  - When `loadMyCard` returns a card, render `<HouseholdCard>` as the first item of `<main>`, above the points.
  - Its `demoPin` is `DEMO_PIN` when `(await supabase.auth.getClaims()).data?.claims.app_metadata?.demo` is set, else null.

- [ ] **Step 1: Write the failing test** `tests/card-device.test.ts`

```ts
import { generateSigningKey, importSigningKey, publicJwkFromSigningKey, readPresentation, signPass, type PublicJwk } from '@/lib/card/crypto';
import { needsRenewal, openDevice, presentTap } from '@/lib/card/device';

const now = Date.parse('2026-10-24T10:00:00Z');

it('needs a new pass when there is none or less than an hour is left', () => {
  expect(needsRenewal(null, now)).toBe(true);
  expect(needsRenewal(now / 1000 + 3_599, now)).toBe(true);
  expect(needsRenewal(now / 1000 + 3_600, now)).toBe(false);
});
it("says the browser can't hold the card when IndexedDB is missing", async () => {
  expect(await openDevice(undefined)).toBe('unsupported');
});
it('signs tap notes the reader accepts, each with its own nonce', async () => {
  const encoded = await generateSigningKey();
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', keys.publicKey);
  const pass = await signPass({ v: 1, card: 'c18', unit: 'No. 18', township: 't', phone: 'p1', key: { kty, crv, x, y } as PublicJwk, places: ['pool'], suspended: false, leaseEnd: null, iat: now / 1000, exp: now / 1000 + 86_400 }, await importSigningKey(encoded));
  const first = await readPresentation(await presentTap({ keys, pass }, { place: 'pool', facility: null }, now), publicJwkFromSigningKey(encoded));
  const second = await readPresentation(await presentTap({ keys, pass }, { place: 'pool', facility: null }, now), publicJwkFromSigningKey(encoded));
  expect(first!.note).toMatchObject({ place: 'pool', facility: null, at: now });
  expect(first!.note.nonce).not.toBe(second!.note.nonce);
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/card-device.test.ts`
Expected: FAIL. It can't resolve `@/lib/card/device`.

- [ ] **Step 3: Implement** the summary, the device module, the four components and the Me page change, and add the `card.*` copy.

The nonce is 16 random bytes in base64url. IndexedDB uses one database, `serumpun-card`, with one store.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Check it in the browser.**

Start the dev server with `preview_start`, using the project's configuration (or add one for `npm run dev` on port 3000 to `.claude/launch.json`). Then:
1. Sign in with "Try as Aisyah" and open `/me`. Expected: the card at the top shows "No. 18, Jalan Elmina Valley 3/2" and "3 of 4".
2. Tap the card. Expected: the PIN pad shows "Demo PIN: 123456".
3. Enter `000000`. Expected: "Wrong PIN. 4 tries left."
4. Enter `123456`. Expected: the card pops up, with "Hold near a reader" and no Tap button.
5. Tap "Show QR instead". Expected: a QR code that changes within 30 seconds.
6. Expected: no console errors.

- [ ] **Step 6: Commit**

```bash
git add lib/card/summary.ts lib/card/device.ts components/card "app/(app)/me/page.tsx" lib/i18n/en.ts lib/i18n/ms.ts tests/card-device.test.ts
git commit -m "feat(card): open the household card with the PIN in Me" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: The reader API

**Files:**
- Create: `lib/card/reader-server.ts` (starts with `import 'server-only'`)
- Create: `app/api/reader/sync/route.ts`, `app/api/reader/tap/route.ts`, `app/api/reader/visits/route.ts`
- Test: `tests/card-reader.test.ts`

**Interfaces:**
- Consumes: `readPresentation`, `publicJwkFromSigningKey`, `PLACES` (Task 1); `decideTap`, `TapState`, `DenyReason`, `ReaderCache`, `TapRequest`, `OfflineVisit` (Task 2); the Task 3 tables; `createAdminClient`; `mytDate`, `mytHour`.
- Produces:

```ts
export type VisitRow = { township_id: string; card_id: string; place: Place; facility_id: string | null; granted: boolean; reason: DenyReason | null; offline: boolean; nonce: string; at: string };
export type ReaderDeps = {
  publicKey: PublicJwk;
  now: () => Date;
  loadState: (pass: PassPayload, facility: string | null, now: Date) => Promise<TapState>;
  saveVisit: (visit: VisitRow) => Promise<'saved' | 'duplicate'>; // 'duplicate': this nonce was used already
};
export type TapResponse = { granted: true; unit: string } | { granted: false; reason: DenyReason } | { error: 'bad_pass' };
export function handleTap(body: unknown, deps: ReaderDeps): Promise<TapResponse>;
export function handleVisits(body: unknown, deps: Omit<ReaderDeps, 'loadState'>): Promise<{ saved: number; skipped: number }>;
export function adminReaderDeps(admin: SupabaseClient, publicKey: PublicJwk): ReaderDeps;
export function loadSync(admin: SupabaseClient, townshipId: string, now: Date): Promise<Pick<ReaderCache, 'stop' | 'bookings'> & { serverTime: number }>;
```

**Behaviour:**
- **`handleTap`:**
  - The body must be a `TapRequest`: `presentation` a string of at most 4096 characters, `place` one of `PLACES`, `facility` a string or null. Anything else answers `{ error: 'bad_pass' }`, as does a presentation `readPresentation` rejects.
  - Otherwise it runs `decideTap` with `loadState` and saves one visit with `offline: false` and `at = deps.now()`. When `saveVisit` answers `'duplicate'`, the response is `{ granted: false, reason: 'pass_expired' }` (a replayed note), and nothing is saved twice.
  - A granted tap answers `{ granted: true, unit: pass.unit }`.
- **`handleVisits`:**
  - Takes `{ visits: OfflineVisit[] }`, at most 500.
  - Each valid presentation is saved with `offline: true` and the reader's own decision and time.
  - Junk and duplicates count as skipped.
- **The live `loadState`** works from the database:
  - card `status` and `places` by `pass.card`;
  - the unit's `lease_end`;
  - the phone's `frozen_at` by `pass.phone`;
  - `hasBooking`: a `bookings` row with `facility_id = facility`, `date = mytDate(now)`, `start_hour = mytHour(now)`, `status = 'booked'`, booked by someone on the card. Players who joined are stage 4.
- **`loadSync`:**
  - `stop.cards` are the township's suspended cards, and `stop.phones` its frozen phones.
  - `bookings` are today's booked rows, each mapped to the booker's card. Bookers who aren't on a card are dropped.
- **Routes:** all public, all with `Cache-Control: no-store`. None returns a name: only card and phone ids, unit labels and hours.
  - `GET /api/reader/sync?township=<uuid>` answers `{ publicKey, serverTime, stop, bookings }`, or 400 for a missing or malformed id.
  - `POST /api/reader/tap` answers `handleTap`, with 400 for `bad_pass`.
  - `POST /api/reader/visits` answers `handleVisits`.

- [ ] **Step 1: Write the failing test** `tests/card-reader.test.ts`

```ts
vi.mock('server-only', () => ({}));
import { generateSigningKey, importSigningKey, publicJwkFromSigningKey, signNote, signPass, type PassPayload, type PublicJwk } from '@/lib/card/crypto';
import type { TapState } from '@/lib/card/decide';
import { handleTap, handleVisits, type ReaderDeps, type VisitRow } from '@/lib/card/reader-server';

const now = new Date('2026-10-24T10:00:00Z');
const active: TapState = { suspended: false, leaseEnd: null, phoneFrozen: false, places: ['facilities', 'gym', 'pool'], hasBooking: false };

async function setup(state: TapState = active, save: 'saved' | 'duplicate' = 'saved') {
  const encoded = await generateSigningKey();
  const phone = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', phone.publicKey);
  const sec = now.getTime() / 1000;
  const payload: PassPayload = { v: 1, card: 'c18', unit: 'No. 18, Jalan Elmina Valley 3/2', township: 't', phone: 'p1', key: { kty, crv, x, y } as PublicJwk, places: ['facilities', 'gym', 'pool'], suspended: false, leaseEnd: null, iat: sec, exp: sec + 86_400 };
  const pass = await signPass(payload, await importSigningKey(encoded));
  const present = (place: 'pool' | 'gym', nonce: string) => signNote(pass, { place, facility: null, at: now.getTime(), nonce }, phone.privateKey);
  const saved: VisitRow[] = [];
  const deps: ReaderDeps = {
    publicKey: publicJwkFromSigningKey(encoded), now: () => now, loadState: async () => state,
    saveVisit: async (v) => (saved.push(v), save),
  };
  return { deps, present, saved };
}

it('grants a valid tap and logs the visit by unit, not by person', async () => {
  const { deps, present, saved } = await setup();
  expect(await handleTap({ presentation: await present('pool', 'n1'), place: 'pool', facility: null }, deps)).toEqual({ granted: true, unit: 'No. 18, Jalan Elmina Valley 3/2' });
  expect(saved).toEqual([{ township_id: 't', card_id: 'c18', place: 'pool', facility_id: null, granted: true, reason: null, offline: false, nonce: 'n1', at: now.toISOString() }]);
});
it('refuses an online tap for a card suspended after its pass was issued', async () => {
  const { deps, present, saved } = await setup({ ...active, suspended: true });
  expect(await handleTap({ presentation: await present('pool', 'n2'), place: 'pool', facility: null }, deps)).toEqual({ granted: false, reason: 'card_suspended' });
  expect(saved[0]).toMatchObject({ granted: false, reason: 'card_suspended' });
});
it('refuses a replayed note', async () => {
  const { deps, present } = await setup(active, 'duplicate');
  expect(await handleTap({ presentation: await present('pool', 'n3'), place: 'pool', facility: null }, deps)).toEqual({ granted: false, reason: 'pass_expired' });
});
it('answers bad_pass for junk, and saves nothing', async () => {
  const { deps, saved } = await setup();
  for (const body of [null, {}, { presentation: 'a.b.c.d', place: 'pool', facility: null }, { presentation: 'x', place: 'lift', facility: null }]) {
    expect(await handleTap(body, deps)).toEqual({ error: 'bad_pass' });
  }
  expect(saved).toEqual([]);
});
it('saves offline visits as the reader decided them and skips bad ones', async () => {
  const { deps, present, saved } = await setup();
  const at = now.getTime();
  const visits = [
    { presentation: await present('pool', 'o1'), place: 'pool', facility: null, at, granted: true, reason: null },
    { presentation: await present('gym', 'o2'), place: 'gym', facility: null, at, granted: false, reason: 'no_booking' },
    { presentation: 'junk', place: 'pool', facility: null, at, granted: true, reason: null },
  ];
  expect(await handleVisits({ visits }, deps)).toEqual({ saved: 2, skipped: 1 });
  expect(saved.map((v) => [v.nonce, v.offline, v.granted, v.reason])).toEqual([['o1', true, true, null], ['o2', true, false, 'no_booking']]);
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/card-reader.test.ts`
Expected: FAIL. It can't resolve `@/lib/card/reader-server`.

- [ ] **Step 3: Implement** `lib/card/reader-server.ts` and the three route handlers.

`saveVisit` inserts into `card_visits` and answers `'duplicate'` on a unique-violation of `nonce` (Postgres code `23505`). The routes build their deps with `adminReaderDeps(createAdminClient(), publicJwkFromSigningKey(env.cardSigningKey))`.

- [ ] **Step 4: Run it**

Run: `npx vitest run tests/card-reader.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/card/reader-server.ts app/api/reader tests/card-reader.test.ts
git commit -m "feat(card): reader API that decides online and logs offline visits" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: The reader screen

**Files:**
- Create: `app/reader/page.tsx`
- Create: `components/reader/ReaderScreen.tsx` (client)
- Create: `lib/card/queue.ts`
- Modify: `lib/i18n/en.ts`, `lib/i18n/ms.ts` (`reader.*`)
- Test: `tests/card-queue.test.ts`; `tests/proxy.test.ts`

**Interfaces:**
- Consumes:
  - `HouseholdCard` in reader mode and `loadMyCard` (Task 6);
  - `readPresentation`, `publicJwkFromSigningKey` (Task 1);
  - `decideTap`, `offlineState`, `ReaderCache`, `OfflineVisit`, `reasonKey` (Task 2);
  - `/api/reader/*` (Task 7);
  - `getSessionProfile`, `createAdminClient`, `DemoButtons` (existing), `DEMO_PIN` (Task 5);
  - `Segmented`, `Switch`.
- Produces (`lib/card/queue.ts`):

```ts
export const QUEUE_MAX = 500;
export function enqueue(queue: OfflineVisit[], visit: OfflineVisit): OfflineVisit[]; // drops the oldest beyond QUEUE_MAX
export function afterFlush(queue: OfflineVisit[], sent: number): OfflineVisit[]; // removes the first `sent`
export function loadQueue(): OfflineVisit[]; // localStorage 'serumpun-reader-queue-v1'; [] when missing or unreadable
export function saveQueue(queue: OfflineVisit[]): void; // swallows storage errors
export function loadCache(): ReaderCache | null; // localStorage 'serumpun-reader-cache-v1'
export function saveCache(cache: ReaderCache): void;
```

**The page:** `app/reader/page.tsx` is a public server component. It isn't in `SIGNED_IN_ONLY`, so the proxy lets it through. It loads:
- the active township, through `createAdminClient`;
- that township's facilities (`id`, `sport`, `court_label`);
- the public key;
- the signed-in resident's card (`getSessionProfile` then `loadMyCard`) and the demo flag.

It renders `<ReaderScreen>`, with the metadata title "Reader".

**`ReaderScreen` behaviour** (spec sections 6 and 9):
- **Place picker:** `Segmented` with Facilities, Gym and Pool. Facilities adds a choice among the courts, the hall, the BBQ pit and the function room. Gym uses the gym facility's id, and Pool has no facility.
- **The device:**
  - a dark panel with "POOL · READER" (the chosen place);
  - a glowing contactless ring;
  - "Hold your iPhone near the reader";
  - a drop zone marked `data-reader-drop` for the dragged card.
- **Phone mockup:** beside the device on wide screens, below it on narrow ones. It holds `<HouseholdCard reader>` when there's a card. Otherwise it shows the demo buttons with `next=/reader`.
- **On a tap:**
  - Online with the Wi-Fi switch on, it posts to `/api/reader/tap`. If the request fails, it decides offline instead.
  - Offline (switch off, `navigator.onLine` false, or a failed request), it checks with `readPresentation(cache.publicKey)` and `decideTap(offlineState(...))`, using `now = Date.now() + cache.offsetMs`. It refuses a nonce already seen in this page load as `pass_expired`, and adds the visit to the queue.
- **Results:**
  - Green: a big tick drawing itself, "Access granted · {place}" and "Visit logged for {unit}".
  - Red: ✕, "Not allowed" and the reason.
  - After 3 seconds it goes back to waiting. The phone mockup gets `result` for its ✓ or ✕ and buzz.
- **Sync:**
  - On load, and every 30 seconds while online, it calls `GET /api/reader/sync` and saves the cache with `offsetMs = serverTime − Date.now()` (Review Focus 1).
  - Coming back online, it flushes the queue to `/api/reader/visits` (`afterFlush` by `saved + skipped`), then syncs.
- **Wi-Fi switch:** a `Switch` labelled "Wi-Fi". Off, it shows "Off: the reader checks cards by itself". Under the switch: "Last sync {time}".

- [ ] **Step 1: Write the failing tests**

`tests/card-queue.test.ts`:

```ts
import { QUEUE_MAX, afterFlush, enqueue } from '@/lib/card/queue';
import type { OfflineVisit } from '@/lib/card/decide';

const visit = (i: number): OfflineVisit => ({ presentation: `p${i}`, place: 'pool', facility: null, at: i, granted: true, reason: null });

it('keeps visits in order and drops the oldest beyond 500', () => {
  let queue: OfflineVisit[] = [];
  for (let i = 0; i < QUEUE_MAX + 2; i++) queue = enqueue(queue, visit(i));
  expect(queue).toHaveLength(500);
  expect([queue[0].at, queue.at(-1)!.at]).toEqual([2, 501]);
});
it('removes only what the server took', () => {
  expect(afterFlush([visit(1), visit(2), visit(3)], 2)).toEqual([visit(3)]);
});
```

In `tests/proxy.test.ts`, add `'/reader'` to the list in *guards whole path segments only, so the landing page and look-alike paths stay public*.

- [ ] **Step 2: Run them to watch them fail**

Run: `npx vitest run tests/card-queue.test.ts tests/proxy.test.ts`
Expected: the queue test FAILs, because it can't resolve `@/lib/card/queue`. The proxy test already passes: `/reader` is public by construction, and this test pins it.

- [ ] **Step 3: Implement** `lib/card/queue.ts`, the page and `ReaderScreen`, and add the `reader.*` copy.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Check it in the browser** (preview):
1. Open `/reader` signed out. Expected: the reader, with demo buttons in the mockup.
2. "Try as Aisyah". Expected: back on `/reader` with No. 18's card in the mockup.
3. Pool. Open the card with `123456` and drag it onto the reader. Expected: the phone buzzes, a green tick and "Access granted · Pool".
4. Gym, with no booking this hour. Expected: red, "No booking at this time".
5. Switch Wi-Fi off and tap at the Pool. Expected: green again.
6. Switch Wi-Fi on. Expected: in the network tab, `POST /api/reader/visits` answers `{"saved":1,"skipped":0}`.
7. Expected: no console errors.

- [ ] **Step 6: Commit**

```bash
git add app/reader components/reader lib/card/queue.ts lib/i18n/en.ts lib/i18n/ms.ts tests/card-queue.test.ts tests/proxy.test.ts
git commit -m "feat(card): the reader screen with drag, Tap and Wi-Fi off" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Dashboard › Units with Suspend and Lift

**Files:**
- Create: `lib/domain/units.ts`
- Create: `app/dashboard/units/page.tsx`, `app/dashboard/units/actions.ts`
- Create: `components/dashboard/CardSuspension.tsx` (client)
- Modify: `app/dashboard/layout.tsx` (a Units item right after Residents, icon `🏘️`; Residents stays until stage 2 ends self sign-up)
- Modify: `lib/i18n/en.ts`, `lib/i18n/ms.ts` (`dashboard.nav.units`, `units.*`)
- Test: `tests/units.test.ts`

**Interfaces:**
- Consumes: `suspend_card`, `lift_card_suspension` and the office's RLS reads (Task 3); `leaseEnded` (Task 2); `requireManagement`, `createClient` (existing).
- Produces:

```ts
// lib/domain/units.ts
export const UNIT_STATES = ['not_registered', 'active', 'suspended', 'lease_ended'] as const;
export type UnitState = (typeof UNIT_STATES)[number];
export function unitState(unit: { lease_end: string | null; card: { status: 'active' | 'suspended' } | null }, now: Date): UnitState;
export function unitErrorKey(code: string | undefined): MessageKey; // units.error.<not_management|not_found|bad_reason|not_suspended>, else common.error
// app/dashboard/units/actions.ts
export async function suspendCard(card: string, reason: string): Promise<{ error?: MessageKey }>;
export async function liftSuspension(card: string): Promise<{ error?: MessageKey }>;
```

`unitState` checks in this order: no card → `not_registered`; suspended → `suspended`; lease ended → `lease_ended`; otherwise `active`.

**The page:**
- `requireManagement`. It lists the township's units by label, each with its card's status, reason and `phone_limit`, and its phone count.
- Columns: Unit · On record (name · Owner or Tenant) · Card (a state chip with words, plus "3 of 4 phones" or the reason) · Suspend… or Lift.
- A header link: "Open reader screen" → `/reader`.

The actions call `requireManagement`, trim the reason, call the RPC, map errors with `unitErrorKey`, then `refresh()`.

- [ ] **Step 1: Write the failing test** `tests/units.test.ts`

```ts
import { UNIT_STATES, unitErrorKey, unitState } from '@/lib/domain/units';
import { t } from '@/lib/i18n';

const now = new Date('2026-10-24T10:00:00Z');

it('calls a unit with no card not registered', () => expect(unitState({ lease_end: null, card: null }, now)).toBe('not_registered'));
it('shows a suspension before a lease that has also ended', () =>
  expect(unitState({ lease_end: '2026-10-01', card: { status: 'suspended' } }, now)).toBe('suspended'));
it("shows a tenant's card as lease ended after the last day in Malaysia", () => {
  const unit = { lease_end: '2026-10-26', card: { status: 'active' as const } };
  expect(unitState(unit, new Date('2026-10-26T15:59:00Z'))).toBe('active');
  expect(unitState(unit, new Date('2026-10-26T16:00:00Z'))).toBe('lease_ended');
});
it('names every unit state and office error in both languages', () => {
  for (const state of UNIT_STATES) expect(t('ms', `units.state.${state}` as const)).not.toBe(t('en', `units.state.${state}` as const));
  for (const code of ['not_management', 'not_found', 'bad_reason', 'not_suspended']) {
    expect(unitErrorKey(code), code).not.toBe('common.error');
    expect(t('ms', unitErrorKey(code))).not.toBe(t('en', unitErrorKey(code)));
  }
  expect(unitErrorKey('__proto__')).toBe('common.error');
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/units.test.ts`
Expected: FAIL. It can't resolve `@/lib/domain/units`.

- [ ] **Step 3: Implement** `lib/domain/units.ts`, the page, the actions, `CardSuspension` (the reason field is required, 1–200 characters) and the nav item, and add the copy.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Check it in the browser.**

Use the office in one browser and Aisyah's reader in a second browser, or in a private window.
1. Dashboard › Units. Expected: Jason's unit shows Suspended with "Landlord's request: rent unpaid", and No. 18 shows Active, "3 of 4 phones".
2. Suspend No. 18 with the reason "Landlord's request". Expected: on Aisyah's reader, the next Pool tap is red, "Card suspended".
3. Lift it. Expected: the next tap is green.

- [ ] **Step 6: Commit**

```bash
git add lib/domain/units.ts app/dashboard/units components/dashboard/CardSuspension.tsx app/dashboard/layout.tsx lib/i18n/en.ts lib/i18n/ms.ts tests/units.test.ts
git commit -m "feat(card): Units in the dashboard with Suspend and Lift" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: Keep the demo working, the privacy line, smoke checks and docs

**Files:**
- Modify: `app/(auth)/actions.ts` (`signInDemo`)
- Modify: `lib/content/help.ts` ("Your privacy" and "Privasi anda")
- Modify: `scripts/smoke.ts`
- Modify: `docs/SYSTEM.md`

**Interfaces:**
- Consumes: `restoreDemoCard` (Task 4); `createAdminClient`.
- Produces: no new interface.

- [ ] **Step 1: Restore No. 18 on every "Try as Aisyah"** (decision 18).

In `signInDemo`, when `who === 'aisyah'`, run `await restoreDemoCard(createAdminClient())` before signing in. A failed restore is logged with `console.error` and doesn't stop the sign-in.

The restore runs only on that tap, so a suspension made from the office during a video take stays put. Its unit test is Task 4's *restores No. 18 to exactly how it was seeded*.

- [ ] **Step 2: Add the privacy line** as one more step in "Your privacy" and in "Privasi anda".
- English: "When your household card is tapped at a reader, the visit is recorded with your unit, the place and the time, never your name. The reader shows no names either."
- Malay: "Apabila kad isi rumah anda diketuk di pembaca, lawatan direkodkan dengan unit, tempat dan masa sahaja, bukan nama anda. Pembaca juga tidak menunjukkan nama."

Stage 5 adds the 90-day rule when it exists.

Run: `npx vitest run tests/help.test.ts`
Expected: PASS.

- [ ] **Step 3: Add smoke checks** in a new `— household cards` section. Don't run them now: smoke resets the live demo (Task 11).
- `Daniel sees only his own card`: `daniel.client.from('cards').select('id')` returns 1 row.
- `A resident cannot suspend a card`: `daniel.client.rpc('suspend_card', { p_card: <any card id>, p_reason: 'x' })` is refused with `not_management`.
- `Nobody reads the PINs`: `daniel.client.from('member_pins').select('user_id')` is refused.

- [ ] **Step 4: Update `docs/SYSTEM.md`:**
- §2: the demo script for the card in Me and the reader.
- §5: the seven tables.
- §6: passes, phone keys, PINs and the RLS rules.
- §10: demo PIN 123456; "Try as Aisyah" restores No. 18.
- §13: no real NFC, Wallet or SMS; screenshots and rooted phones can't be blocked; iPhones don't vibrate; an offline reader learns of changes at its next sync or within 24 hours.

- [ ] **Step 5: Run every check**

Run: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`
Expected: all pass, with no warnings in the build output.

- [ ] **Step 6: Commit**

```bash
git add "app/(auth)/actions.ts" lib/content/help.ts scripts/smoke.ts docs/SYSTEM.md
git commit -m "feat(card): restore No. 18 for each Try as Aisyah; docs and smoke checks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Ship stage 1 (stops for the user's OK)

**Files:** none (deploy and checks).

- [ ] **Step 1: Back up the branch**

This is allowed standing: the user asked for each finished task to be pushed to this branch.

Run: `git push origin feat/serumpun-mvp`

- [ ] **Step 2: STOP and ask the user** in one message:

> "Stage 1 is ready. May I add the card signing key to Vercel (production and preview), deploy to production, then reset the live demo (`npm run db:seed`) and run `npm run smoke`?"

Go on only after an explicit yes.

- [ ] **Step 3: On yes, do them in order.**
1. Add `CARD_SIGNING_KEY` to Vercel production and preview. Read the value from `.env.local` inside a script and pipe it to `vercel env add CARD_SIGNING_KEY <env>`; never print it.
2. `vercel deploy --prod --yes`.
3. `npm run db:seed`.
4. `npm run smoke`. Expected: every check passes, including the 3 new ones.

- [ ] **Step 4: Check the live site over HTTP.**

Use a throwaway script that signs in as Aisyah. It reads the demo password from env, never prints it, and is deleted afterwards. Expected:
- `/me` contains "HOUSEHOLD CARD" and "No. 18, Jalan Elmina Valley 3/2";
- `/reader` contains "Hold your iPhone near the reader";
- `GET /api/reader/sync?township=<Elmina id>` answers 200 with `publicKey.kty` = `EC`.

- [ ] **Step 5: Ask before moving GitHub `main`** to the branch. It's a separate question, and nothing happens without a yes.
