# Feedback round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home favourites with More and Edit, pay parking and parking areas for SDP's malls, the Elmina Lakeside Mall
directory, General chat topics, and Help & policies on Me.

**Architecture:** Static catalogues in `lib/domain` (services, malls, shops, help copy) drive server-rendered pages; small
client components do the interactive parts (favourites editor, payment flow, mall plan, FAQ search, topic chat). New
data: `profiles.favourites`, parking tables reached only by trusted server code, and chat-topic tables behind RLS,
privacy views and security-definer RPCs like the rest of the app.

**Tech Stack:** Next.js 16 App Router (server actions, `refresh()`), Supabase (Postgres, RLS, Realtime), Leaflet (image
overlay with `CRS.Simple`), Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-18-feedback-round-2-design.md`

## Global Constraints

- No new dependencies (spec §8).
- Every user-visible string in English and Bahasa Malaysia: UI strings as keys in `lib/i18n/en.ts` and `ms.ts` (ms is
  typed from en, so a missing key fails `tsc`); the long help copy in `lib/content/help.ts`, typed the same for both.
- Font sizes in rem (Tailwind `text-*`, never `text-[..px]`), phone-first at 390 px, light and dark, keyboard and screen
  reader friendly.
- Migrations start at `0020`; additive; the demo database is shared and in use: no reseed or `npm run smoke` without
  the user's OK; checks delete only their own rows.
- RLS on every new table; resident writes through security-definer RPCs with `set search_path = ''`, `revoke` then
  explicit `grant`. Exception (decided here, spec §9 leaves names and mechanism to the builder): parking sessions and
  saved plates are written and read only by trusted server code with the service role, because the amount must come
  from the tested fee rules; the tables get no API grants at all.
- Every payment screen says "Demo: no real money is charged"; Elmina Lakeside Mall's rate is labelled "Sample".
- Every commit: Conventional Commit ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before the first write of a new file the Fact-Forcing Gate asks for facts; give them in the same message as the retry.

## Review Focus

1. **Long Bahasa Malaysia labels in 4-column grids at Extra large text** must not overflow a tile → Task 2 tests that no
   word of a service label is longer than 12 characters in either language.
2. **Messy plate input** ("  wxy-1234 ", "wxy1234", "vbn 88") must normalise, not fail → Task 4 tests `normalisePlate`.
3. **Pay tapped twice** must not pay twice or show two receipts → Task 4: the pay update is conditional on
   `paid_at is null` and the button is disabled while processing; the API check pays twice and expects the second to
   be refused.
4. **A crafted favourites list** (unknown keys, duplicates, 9 keys) must neither break Home nor be stored → Task 2 tests
   `resolveFavourites`; the RPC rejects duplicates and more than 7.
5. **Searches with no match** (shops "zzz", FAQ "zzz") must show a clear empty message, not a blank → Task 1 and Task 5
   test the empty result and render an empty-state line.

---

### Task 1: Help & policies

**Files:**
- Create: `lib/content/help.ts`, `app/help/layout.tsx`, `app/help/guidelines/page.tsx`, `app/help/rules/page.tsx`,
  `app/help/faq/page.tsx`, `app/help/terms/page.tsx`, `components/help/FaqList.tsx`, `tests/help.test.ts`
- Modify: `lib/domain/nav.ts` (add `HELP_LINKS`), `app/(app)/me/page.tsx` (Help & policies section after the
  `ME_LINKS` list), `app/(auth)/forms.tsx` (terms line above the sign-up button), `lib/i18n/en.ts`, `lib/i18n/ms.ts`,
  `tests/nav.test.ts`

**Interfaces:**
- Produces:
  - `type HelpSection = { title: string; steps: string[] }`
  - `type HelpRule = { title: string; body: string }`
  - `type FaqItem = { q: string; a: string }`
  - `type HelpContent = { guidelines: HelpSection[]; rules: HelpRule[]; rulesAfter: string; faq: FaqItem[]; terms: { updated: string; draftNote: string; sections: HelpSection[] } }`
  - `const HELP: Record<Lang, HelpContent>`
  - `function faqMatches(item: FaqItem, query: string): boolean`
  - `HELP_LINKS: readonly { href: string; label: MessageKey; hint: MessageKey; icon: string }[]` in `lib/domain/nav.ts`

- [ ] **Step 1: Write the failing tests** in `tests/help.test.ts` and `tests/nav.test.ts`

```ts
it('has the same shape in both languages', () => {
  for (const part of ['guidelines', 'rules', 'faq'] as const) expect(HELP.ms[part]).toHaveLength(HELP.en[part].length);
  expect(HELP.ms.terms.sections).toHaveLength(HELP.en.terms.sections.length);
  expect(HELP.en.faq.length).toBeGreaterThanOrEqual(10);
});
it('finds a question by words in the question or the answer, any case', () => {
  const item = { q: 'Who can see my unit number?', a: 'Only the Management Office.' };
  expect(faqMatches(item, 'UNIT')).toBe(true);
  expect(faqMatches(item, 'management')).toBe(true);
  expect(faqMatches(item, '  ')).toBe(true);
  expect(faqMatches(item, 'zzz')).toBe(false);
});
// tests/nav.test.ts
it('the help pages', () => {
  expect(HELP_LINKS.map((l) => l.href)).toEqual(['/help/guidelines', '/help/rules', '/help/faq', '/help/terms']);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/help.test.ts tests/nav.test.ts` — expect FAIL (module not found).

- [ ] **Step 3: Write `lib/content/help.ts`** with the copy of spec §7 in both languages. Guidelines: one section per
  feature (report, map alerts and Safe Walk, emergency button, notify the office, General chat, groups and events,
  services, share & lend, facilities, pay parking, rewards). Rules: the six in the mockup plus "Respect the office's
  decisions", `rulesAfter` says what happens when rules are broken (a reminder, then posting paused, then the office
  may remove the account). FAQ: at least 10, including the eight spec §7 lists. Terms: `updated: '18 October 2026'`,
  a `draftNote` saying it is a prototype draft and not legal advice, and the sections spec §7 lists (PDPA 2010 by name;
  "not an emergency service — call 999"; demo payments). `faqMatches`: trimmed query, case-insensitive substring of
  `q` or `a`; an empty query matches.

- [ ] **Step 4: Pages.** `app/help/layout.tsx`: no sign-in required; the phone-width column (`mx-auto max-w-md`);
  `getSessionProfile()` decides the back link (`/me` signed in, `/signup` signed out) via `AppHeader back=`. Each page
  renders `HELP[await getLang()]`: guidelines as headed sections with numbered steps; rules as numbered cards then
  `rulesAfter`; terms with `draftNote` in a tinted box and "Last updated {date}". `FaqList` (client): a search field
  and `<details><summary>` per item filtered by `faqMatches`; no match shows `t('help.faq.empty')`.
  Me: a "Help & policies" heading and a rounded list of `HELP_LINKS` rows (icon, label, hint, ›) styled like `ME_LINKS`.
  Sign-up: "By signing up you agree to the Terms & Conditions" with the link opening `/help/terms` in a new tab.

- [ ] **Step 5: Run** `npx vitest run tests/help.test.ts tests/nav.test.ts` — PASS; `npm run typecheck` — clean.

- [ ] **Step 6: Commit** `feat: add guidelines, rules, FAQ and terms to Me`

### Task 2: Home favourites, More and Edit

**Files:**
- Create: `supabase/migrations/0020_favourites.sql`, `app/(app)/more/page.tsx`, `app/(app)/more/edit/page.tsx`,
  `app/(app)/more/actions.ts`, `components/home/FavouritesEditor.tsx`
- Modify: `lib/domain/nav.ts` (replace `HOME_TILES` with the catalogue below), `components/app/Tile.tsx` (optional
  `badge?: string` shown top-right, and `more?: boolean` for the "•••" circle), `app/(app)/home/page.tsx`,
  `lib/supabase/auth.ts` (`SessionProfile.favourites: string[] | null`, added to the select), `proxy.ts` and
  `tests/proxy.test.ts` (`/more`, `/parking`, `/malls`), `lib/seed/people.ts` (seeded profiles get `favourites: null`),
  `lib/i18n/en.ts`, `lib/i18n/ms.ts`, `tests/nav.test.ts`

**Interfaces:**
- Produces (in `lib/domain/nav.ts`):
  - `type ServiceKey = 'report' | 'issues' | 'notify' | 'facilities' | 'map' | 'groups' | 'events' | 'services' | 'share' | 'messages' | 'pay-parking' | 'parking' | 'mall' | 'rewards'`
  - `type ServiceGroup = 'township' | 'community' | 'mall'`
  - `type Service = { key: ServiceKey; href: string; label: MessageKey; icon: string; group: ServiceGroup }`
  - `const SERVICES: readonly Service[]` (in More's order), `const SERVICE_GROUPS: readonly ServiceGroup[]`
  - `const DEFAULT_FAVOURITES: readonly ServiceKey[]`, `const MAX_FAVOURITES = 7`, `const NEW_SERVICES: readonly ServiceKey[]`
  - `function resolveFavourites(saved: readonly string[] | null): Service[]`
  - `function moveItem<T>(list: readonly T[], from: number, to: number): T[]`
- Produces (actions): `saveFavourites(keys: string[]): Promise<{ ok: true } | { ok: false; error: MessageKey }>`
- Produces (SQL): `public.set_favourites(p_keys text[]) returns void`, errors `not_allowed`, `bad_favourites`

- [ ] **Step 1: Write the failing tests** in `tests/nav.test.ts` (replace "the eight Home tiles")

```ts
it('every service and where it goes', () => {
  expect(Object.fromEntries(SERVICES.map((s) => [s.key, s.href]))).toEqual({
    report: '/reports/new', issues: '/reports', notify: '/notices/new', facilities: '/book', map: '/map',
    groups: '/community?tab=groups', events: '/community?tab=events', services: '/community?tab=services',
    share: '/community?tab=share', messages: '/messages',
    'pay-parking': '/parking/pay', parking: '/parking', mall: '/malls/elmina-lakeside-mall', rewards: '/rewards',
  });
});
it('the default favourites', () => {
  expect(resolveFavourites(null).map((s) => s.key)).toEqual(['pay-parking', 'notify', 'facilities', 'events', 'groups', 'services', 'rewards']);
});
it('skips unknown and repeated keys and keeps at most 7', () => {
  expect(resolveFavourites(['map', 'gone', 'map', 'rewards']).map((s) => s.key)).toEqual(['map', 'rewards']);
  expect(resolveFavourites(SERVICES.map((s) => s.key))).toHaveLength(7);
  expect(resolveFavourites([])).toEqual([]);
});
it('moves an item', () => {
  expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  expect(moveItem(['a', 'b'], 1, 5)).toEqual(['a', 'b']); // out of range: unchanged
});
it('no word of a service label is longer than 12 characters in either language', () => {
  for (const s of SERVICES) for (const lang of ['en', 'ms'] as const)
    for (const word of t(lang, s.label).split(/\s+/)) expect(word.length, `${s.key}: ${word}`).toBeLessThanOrEqual(12);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/nav.test.ts` — FAIL.

- [ ] **Step 3: Implement the catalogue.** Groups and order: township = report, issues, notify, facilities, map;
  community = groups, events, services, share, messages; mall = pay-parking, parking, mall, rewards. Icons: keep the
  existing tiles' emoji; new: report ❗, map 🗺️, messages 💬, pay-parking 🅿️, parking 🚗, mall 🏬. Labels reuse
  existing keys where they exist (`create.report`, `home.tile.issues`, `home.tile.notify`, `home.tile.book`,
  `community.tab.*`, `home.tile.rewards`, `nav.map`); add `service.messages`, `service.payParking`, `service.parking`,
  `service.mall` (BM e.g. "Bayar parkir", "Kawasan parkir", "Direktori mal"). `NEW_SERVICES = ['pay-parking', 'parking', 'mall']`.

- [ ] **Step 4: Migration `0020_favourites.sql`:** `alter table public.profiles add column favourites text[]`;
  `set_favourites(p_keys text[])`: `not_allowed` without a profile (`my_township()` null); `bad_favourites` unless
  `p_keys` is not null, `coalesce(cardinality(p_keys), 0) <= 7`, no duplicates, every key `~ '^[a-z][a-z-]{1,30}$'`;
  then `update public.profiles set favourites = p_keys where id = (select auth.uid())`. Revoke from public/anon, grant
  execute to authenticated. Run `npm run db:migrate`.

- [ ] **Step 5: Pages.** Home: "My favourites" heading with an Edit link to `/more/edit`, then the 4-column grid of
  `resolveFavourites(profile.favourites)` tiles (`badge` "NEW" for `NEW_SERVICES`) and a `more` tile to `/more`.
  `/more`: `SERVICE_GROUPS` as headed 4-column grids, an Edit link. `/more/edit` renders `FavouritesEditor` with the
  resolved keys: chosen list with − (remove) and drag to reorder (pointer events: press 250 ms on touch or press on
  mouse, then the tile under the pointer is the drop index, `moveItem`), a tap selects a favourite and shows
  "Move earlier" / "Move later" buttons (the keyboard and screen-reader way), "n of 7", the Add list with + (disabled
  at 7, with the "Full? Take one off first." line), Reset to default (local only), Save → `saveFavourites` → back to
  `/home` on success, the error message otherwise. The action requires `requireMember()`, calls `set_favourites`,
  maps `not_allowed`/`bad_favourites` to `common.error`, and calls `refresh()`. Proxy: add `/more`, `/parking`,
  `/malls` to `SIGNED_IN_ONLY` and to the test's list.

- [ ] **Step 6: Run** `npx vitest run` and `npm run typecheck` and `npx eslint` — all clean.

- [ ] **Step 7: Commit** `feat: let residents pick and arrange their Home favourites`

### Task 3: SDP malls and Parking areas

**Files:**
- Create: `lib/domain/malls.ts`, `app/(app)/parking/page.tsx`, `app/(app)/parking/[mall]/page.tsx`,
  `public/malls/elmina-lakeside-mall-car-parks.webp`, `tests/malls.test.ts`
- Modify: `lib/i18n/en.ts`, `lib/i18n/ms.ts`

**Interfaces:**
- Produces:
  - `type MallSlug = 'elmina-lakeside-mall' | 'kl-east-mall'`
  - `type ParkingRate = { firstHours: number; firstSen: number; nextHourSen: number; taxRate: number; sample: boolean }`
  - `type Mall = { slug: MallSlug; name: string; township: string | null; area: string; address: string; lat: number; lng: number; rate: ParkingRate; graceMinutes: number; valet: MessageKey; freeParking: MessageKey | null; ev: MessageKey | null; carParkMap: { src: string; width: number; height: number } | null; directory: boolean; waze: string; googleMaps: string }`
  - `const MALLS: readonly Mall[]`, `function findMall(slug: string | undefined): Mall | null`

- [ ] **Step 1: Write the failing test** `tests/malls.test.ts`

```ts
it('lists the two SDP malls', () => expect(MALLS.map((m) => m.slug)).toEqual(['elmina-lakeside-mall', 'kl-east-mall']));
it('marks the Elmina rate as a sample and KL East as real with service tax', () => {
  expect(findMall('elmina-lakeside-mall')!.rate).toEqual({ firstHours: 2, firstSen: 200, nextHourSen: 100, taxRate: 0, sample: true });
  expect(findMall('kl-east-mall')!.rate).toEqual({ firstHours: 2, firstSen: 200, nextHourSen: 200, taxRate: 0.08, sample: false });
});
it('gives 20 minutes to exit everywhere, and only Elmina has a directory', () => {
  expect(MALLS.every((m) => m.graceMinutes === 20)).toBe(true);
  expect(MALLS.filter((m) => m.directory).map((m) => m.slug)).toEqual(['elmina-lakeside-mall']);
  expect(findMall('nope')).toBeNull();
  expect(findMall(undefined)).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run tests/malls.test.ts` — FAIL.

- [ ] **Step 3: Implement `lib/domain/malls.ts`** with spec §4.1's facts. Elmina: township "City of Elmina", address
  "No. 5, Persiaran Garcinia, Elmina West, 40170 Shah Alam", lat/lng of `place.mall` in `lib/domain/places.ts`,
  Waze `https://www.waze.com/en/live-map/directions/my/selangor/shah-alam/elmina-lakeside-mall?place=ChIJWzWvBgBRzDERFJIngI5lFa0`,
  Google `https://maps.app.goo.gl/9wJUDTYCKXSSGoow6`, car park map 1568 × 902. KL East: township null, area
  "KL East, Kuala Lumpur", address "823, Jalan Lingkaran Tengah 2, KL Timur, 53100 Kuala Lumpur", coordinates looked up
  on OpenStreetMap, Waze `https://waze.com/ul?q=KL%20East%20Mall`, Google
  `https://www.google.com/maps/search/?api=1&query=KL%20East%20Mall`, valet copy with its real rates. Save SDP's car
  park map (`https://imagedelivery.net/TdjZsXzzZt_je48pBzV3SA/fd8b9351-c627-42df-ae69-50f0599c8f00/1920`) as WebP in
  `public/malls/`.

- [ ] **Step 4: Pages.** `/parking`: a card per mall (gradient tile with emoji, name, township or area, rate line with
  "Sample" tag, distance via `distanceMeters(neighbourhoodCentre(profile.neighbourhood), mall)` when
  `mall.township === profile.township.name`). `/parking/[mall]`: `notFound()` for an unknown slug; car park map image
  with "Car park map © Sime Darby Property"; the option rows of spec §4.2 (Pay parking → `/parking/pay?mall=<slug>`,
  Rates, Free parking, Valet, EV charging, Directions with both links, Mall directory → `/malls/<slug>` when
  `directory`), leaving out rows whose value is null; hours and address.

- [ ] **Step 5: Run** `npx vitest run tests/malls.test.ts`, `npm run typecheck` — PASS/clean.

- [ ] **Step 6: Commit** `feat: add parking areas for Sime Darby Property's malls`

### Task 4: Pay parking

**Files:**
- Create: `supabase/migrations/0021_parking.sql`, `lib/domain/parking.ts`, `lib/parking.ts`,
  `app/(app)/parking/actions.ts`, `app/(app)/parking/pay/page.tsx`, `components/parking/PayParking.tsx`,
  `tests/parking.test.ts`
- Modify: `lib/i18n/en.ts`, `lib/i18n/ms.ts`, `lib/seed/people.ts` (a saved plate "WXY 1234" for Aisyah via the new
  `vehicles` table, inserted with the admin client)

**Interfaces:**
- Consumes: `Mall`, `ParkingRate`, `findMall` (Task 3); `mytDate` from `lib/domain/time`.
- Produces (`lib/domain/parking.ts`, pure):
  - `const PAY_METHODS = ['duitnow_qr', 'fpx', 'apple_pay', 'google_pay'] as const`, `type PayMethod`, `const MAX_PLATES = 5`
  - `function normalisePlate(raw: string): string`, `function isValidPlate(plate: string): boolean`
  - `function pretendMinutes(seed: string): number` (40–270)
  - `function parkingFee(rate: ParkingRate, minutes: number): { feeSen: number; taxSen: number; totalSen: number }`
  - `function formatRM(sen: number): string`, `function parkingRef(id: string): string`
- Produces (`lib/parking.ts`, `server-only`, service-role client):
  - `type ParkingQuote = { kind: 'due'; sessionId: string; plate: string; enteredAt: string; minutes: number; feeSen: number; taxSen: number; totalSen: number } | { kind: 'paid'; plate: string; exitBy: string }`
  - `checkParking(userId: string, mall: Mall, plate: string, now: Date): Promise<ParkingQuote>`
  - `payParking(userId: string, mall: Mall, sessionId: string, method: PayMethod, now: Date): Promise<{ ref: string; exitBy: string; totalSen: number } | null>`
  - `savedPlates(userId: string): Promise<string[]>`
- Produces (actions): `checkParkingAction(mall: string, plate: string): Promise<{ ok: true; quote: ParkingQuote } | { ok: false; error: MessageKey }>` and `payParkingAction(mall: string, sessionId: string, method: string): Promise<{ ok: true; ref: string; exitBy: string; totalSen: number } | { ok: false; error: MessageKey }>`

- [ ] **Step 1: Write the failing tests** `tests/parking.test.ts`

```ts
const elmina = findMall('elmina-lakeside-mall')!.rate, klEast = findMall('kl-east-mall')!.rate;
it('normalises plates', () => {
  expect(normalisePlate('  wxy-1234 ')).toBe('WXY 1234');
  expect(normalisePlate('vbn   88')).toBe('VBN 88');
});
it('checks plates', () => {
  for (const ok of ['WXY 1234', 'VBN 88', 'B 1234 X', 'WXY1234']) expect(isValidPlate(ok)).toBe(true);
  for (const bad of ['', 'A', '1234', 'ABCD', 'WXY 12345678', 'WXY_1']) expect(isValidPlate(bad)).toBe(false);
});
it('pretends a stable stay between 40 minutes and 4.5 hours', () => {
  expect(pretendMinutes('u|elmina-lakeside-mall|WXY 1234|2026-10-18')).toBe(pretendMinutes('u|elmina-lakeside-mall|WXY 1234|2026-10-18'));
  for (let i = 0; i < 200; i++) { const m = pretendMinutes(`seed-${i}`); expect(m).toBeGreaterThanOrEqual(40); expect(m).toBeLessThanOrEqual(270); }
});
it('charges by the started hour', () => {
  expect(parkingFee(elmina, 1).totalSen).toBe(200);
  expect(parkingFee(elmina, 120).totalSen).toBe(200);
  expect(parkingFee(elmina, 121).totalSen).toBe(300);
  expect(parkingFee(elmina, 181).totalSen).toBe(400);
  expect(parkingFee(klEast, 60)).toEqual({ feeSen: 200, taxSen: 16, totalSen: 216 });
  expect(parkingFee(klEast, 135)).toEqual({ feeSen: 400, taxSen: 32, totalSen: 432 });
});
it('formats ringgit and references', () => {
  expect(formatRM(300)).toBe('RM 3.00');
  expect(formatRM(216)).toBe('RM 2.16');
  expect(parkingRef('3f0c9a52-1b7e-4c1d-9a3e-2b8f6d4e1a90')).toMatch(/^SRP-\d{5}$/);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/parking.test.ts` — FAIL.

- [ ] **Step 3: Implement `lib/domain/parking.ts`.** `normalisePlate`: upper case, every character other than A–Z/0–9
  becomes a space, runs of spaces collapse, trimmed. `isValidPlate`: the plate without spaces is 2–10 of `[A-Z0-9]`
  with at least one letter and one digit. `pretendMinutes`: FNV-1a 32-bit of the seed, `40 + hash % 231`.
  `parkingFee`: `hours = max(1, ceil(minutes / 60))`; `fee = firstSen + max(0, hours - firstHours) * nextHourSen`;
  `tax = round(fee * taxRate)`. `parkingRef`: "SRP-" and five digits from the id's hex.

- [ ] **Step 4: Migration `0021_parking.sql`:** `vehicles (user_id uuid references profiles on delete cascade, plate
  text check (plate ~ '^[A-Z0-9]+( [A-Z0-9]+)*$'), last_used_at timestamptz not null default now(), primary key
  (user_id, plate))`; `parking_sessions (id uuid pk default gen_random_uuid(), user_id uuid not null references
  profiles on delete cascade, mall text not null check (mall in ('elmina-lakeside-mall','kl-east-mall')), plate text
  not null, entered_at timestamptz not null, created_at timestamptz not null default now(), method text check (method
  in ('duitnow_qr','fpx','apple_pay','google_pay')), total_sen int, paid_at timestamptz, exit_by timestamptz, ref text
  unique)` with an index on `(user_id, mall, plate, created_at desc)`. RLS enabled, no policies; `revoke all ... from
  anon, authenticated`; grant all to service_role. Run `npm run db:migrate`.

- [ ] **Step 5: Implement `lib/parking.ts`.** `checkParking`: a session for (user, mall, plate) with `exit_by > now` →
  `{ kind: 'paid' }`; else the newest unpaid session created on the same MYT day → reuse; else insert with
  `entered_at = now − pretendMinutes(`${userId}|${mall.slug}|${plate}|${mytDate(now)}`)` minutes. Upsert the vehicle
  (`last_used_at = now`) and delete all but the 5 newest. Minutes = `ceil((now − entered_at) / 60 000)`; amounts from
  `parkingFee(mall.rate, minutes)`. `payParking`: recompute the total, then `update ... set paid_at, method, total_sen,
  exit_by = now + graceMinutes, ref where id = $1 and user_id = $2 and mall = $3 and paid_at is null returning`;
  nothing updated → null. `savedPlates`: plates by `last_used_at desc`, at most 5.

- [ ] **Step 6: Actions and page.** Actions: `requireMember()`; `findMall` else `common.error`; `normalisePlate` +
  `isValidPlate` else `parking.error.plate`; method in `PAY_METHODS` else `common.error`; `payParking` null →
  `parking.error.alreadyPaid`. Page `/parking/pay?mall=`: unknown or missing mall → the mall picker (both malls as
  buttons); else `PayParking` with the mall and `savedPlates`. `PayParking` (client): plate field (large, upper case)
  with saved-plate chips, "Check amount", the "Demo: no real money is charged" line; the amount in a bottom `Sheet`
  (plate · mall, "Entered {time} · parked {h} h {m} min", `formatRM(totalSen)`, "incl. 8% service tax" when
  `taxSen > 0`, the four methods as a radio group with DuitNow QR checked, "Pay {amount}"); while paying "Processing…"
  for about a second and the button disabled; then a centred popup: "Thank you!", "You have {n} minutes to exit the
  parking lot.", "Exit by {time} · Paid {amount} with {method}", "Ref {ref}", Done (back to the plate step). A
  `kind: 'paid'` quote shows "Already paid · exit by {time}".

- [ ] **Step 7: Run** `npx vitest run`, `npm run typecheck`, `npx eslint` — clean.

- [ ] **Step 8: Commit** `feat: add demo parking payment for SDP malls`

### Task 5: Elmina Lakeside Mall directory

**Files:**
- Create: `lib/domain/mallDirectory.ts`, `components/malls/MallPlan.tsx`, `components/malls/MallDirectory.tsx`,
  `app/(app)/malls/[mall]/page.tsx`, `public/malls/elmina-lakeside-mall-plan.webp`, `tests/mall-directory.test.ts`
- Modify: `lib/i18n/en.ts`, `lib/i18n/ms.ts`

**Interfaces:**
- Consumes: `findMall` (Task 3).
- Produces:
  - `type ShopCategory = 'food' | 'groceries' | 'fashion' | 'beauty' | 'home' | 'kids' | 'sports' | 'services'`, `const SHOP_CATEGORIES`
  - `type Shop = { name: string; units: string[]; category: ShopCategory }`, `type Point = readonly [x: number, y: number]`
  - `const PLAN = { src: '/malls/elmina-lakeside-mall-plan.webp', width: 3000, height: 1769 }`
  - `const ELMINA_SHOPS: readonly Shop[]`, `const UNIT_PINS: Readonly<Record<string, Point>>`
  - `type FacilityKind = 'toilet' | 'surau' | 'atm' | 'nursing' | 'playground' | 'info'`, `const FACILITIES: readonly { kind: FacilityKind; icon: string; points: Point[] }[]`
  - `function searchShops(shops: readonly Shop[], query: string, category: ShopCategory | 'all'): Shop[]`
  - `function shopPin(shop: Shop): Point | null`
  - `MallPlan` props: `{ pins: { point: Point; label: string }[]; focus: Point | null }`

- [ ] **Step 1: Write the failing test** `tests/mall-directory.test.ts`

```ts
it('has the 99 shops of the official directory, each with a unit and a unique name', () => {
  expect(ELMINA_SHOPS).toHaveLength(99);
  expect(new Set(ELMINA_SHOPS.map((s) => s.name)).size).toBe(99);
  expect(ELMINA_SHOPS.every((s) => s.units.length > 0)).toBe(true);
});
it('pins every shop on the plan', () => {
  for (const s of ELMINA_SHOPS) {
    const p = shopPin(s);
    expect(p, s.name).not.toBeNull();
    expect(p![0]).toBeGreaterThan(0); expect(p![0]).toBeLessThan(PLAN.width);
    expect(p![1]).toBeGreaterThan(0); expect(p![1]).toBeLessThan(PLAN.height);
  }
});
it('searches by name or unit, filters by category, A to Z', () => {
  expect(searchShops(ELMINA_SHOPS, 'jaya', 'all').map((s) => s.name)).toEqual(['Jaya Grocer']);
  expect(searchShops(ELMINA_SHOPS, 'gf-29', 'all').map((s) => s.name)).toEqual(['Jaya Grocer']);
  expect(searchShops(ELMINA_SHOPS, '', 'groceries').map((s) => s.name)).toContain('Jaya Grocer');
  expect(searchShops(ELMINA_SHOPS, 'zzz', 'all')).toEqual([]);
  const all = searchShops(ELMINA_SHOPS, '', 'all').map((s) => s.name);
  expect(all).toEqual([...all].sort((a, b) => a.localeCompare(b)));
});
```

- [ ] **Step 2: Run** `npx vitest run tests/mall-directory.test.ts` — FAIL.

- [ ] **Step 3: Data.** The 99 shops and units from SDP's Elmina Lakeside Mall page (as fetched 18 Oct 2026; "18 Lab by
  KLGCC (Sales Gallery)" has unit `SALES` pinned on the plan's Sales Gallery); our categories. Pins: unit centres in
  plan pixels, measured from the official plan
  (`https://imagedelivery.net/TdjZsXzzZt_je48pBzV3SA/db19f1eb-356a-47c9-b7e7-ef8f602aa600/public`, saved as WebP in
  `public/malls/`); `shopPin` = the first of a shop's units that has a pin. Facilities from the plan's legend
  positions. `searchShops`: trimmed, case-insensitive, matches name or any unit, filtered by category, sorted with
  `localeCompare`.

- [ ] **Step 4: UI.** `MallPlan` (client, loaded with `next/dynamic` and `ssr: false`, like `LiveMap`): Leaflet with
  `CRS.Simple`, an `imageOverlay` of `PLAN` (bounds `[[-height, 0], [0, width]]`, points as `[-y, x]`), fit to bounds,
  pinch and button zoom, red label markers for `pins`, `flyTo(focus)` when it changes, the credit "Layout plan © Sime
  Darby Property". `MallDirectory` (client): search field, category chips (All + `SHOP_CATEGORIES`), the plan, facility
  chips (pin all points of that kind), the A–Z list (name, category, unit badges); tapping a shop sets its pin and focus
  and scrolls the plan into view; no match shows `t('mall.empty')`. Page `/malls/[mall]`: `findMall`, `notFound()`
  unless `directory`; header with hours and "99 shops", address, directions.

- [ ] **Step 5: Run** `npx vitest run tests/mall-directory.test.ts`, `npm run typecheck`, `npx eslint` — clean.

- [ ] **Step 6: Commit** `feat: add the Elmina Lakeside Mall directory on its layout plan`

### Task 6: Chat topics in the database

**Files:**
- Create: `supabase/migrations/0022_chat_topics.sql`, `lib/domain/topics.ts`, `tests/topics.test.ts`

**Interfaces:**
- Produces (SQL): tables `chat_topics`, `topic_messages`, `topic_reads`; views `public_topics`, `public_topic_messages`;
  RPCs `send_topic_message(p_topic uuid, p_body text) returns uuid`, `mark_topic_read(p_topic uuid) returns void`,
  `create_topic(p_emoji text, p_title text, p_office_only boolean) returns uuid`, `update_topic(p_topic uuid, p_emoji
  text, p_title text, p_office_only boolean) returns void`, `remove_topic(p_topic uuid) returns void`; error codes
  `not_verified`, `not_management`, `not_found`, `office_only`, `bad_body`, `bad_topic`, `system_topic`.
- Produces (TS):
  - `type PublicTopic = { id: string; emoji: string; title: string; office_only: boolean; system_key: 'announcements' | null; sort_order: number; last_body: string | null; last_at: string | null; last_sender: string | null; unread_count: number }`, `const PUBLIC_TOPIC_COLUMNS`
  - `type TopicMessage = { id: string; topic_id: string; body: string; created_at: string; sender_name: string | null; from_office: boolean; is_mine: boolean }`, `const TOPIC_MESSAGE_COLUMNS`
  - `const STARTING_TOPICS: readonly { emoji: string; title: string; office_only: boolean; system_key: 'announcements' | null; sort_order: number }[]`
  - `function topicErrorKey(code: string | undefined): MessageKey`, `function totalUnread(topics: readonly PublicTopic[]): number`

- [ ] **Step 1: Write the failing test** `tests/topics.test.ts`

```ts
it('starts with six topics, Announcements first and office only', () => {
  expect(STARTING_TOPICS.map((t) => t.title)).toEqual(['Announcements', 'Help & support', 'Borak-borak', 'Say hi', 'Lost & found', 'Traffic & roads']);
  expect(STARTING_TOPICS[0]).toMatchObject({ office_only: true, system_key: 'announcements' });
  expect(STARTING_TOPICS.slice(1).every((t) => !t.office_only && t.system_key === null)).toBe(true);
});
it('maps errors and adds up unread', () => {
  expect(topicErrorKey('office_only')).toBe('general.error.officeOnly');
  expect(topicErrorKey('not_verified')).toBe('common.pendingCantAct');
  expect(topicErrorKey('whatever')).toBe('common.error');
  expect(totalUnread([{ unread_count: 2 }, { unread_count: 3 }] as PublicTopic[])).toBe(5);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/topics.test.ts` — FAIL; then implement `lib/domain/topics.ts` (emoji 📢 🆘 💬
  👋 🔎 🚗; sort 0, 10, …, 50) and the i18n error keys; run again — PASS.

- [ ] **Step 3: Migration `0022_chat_topics.sql`** (spec §6.2):
  - `chat_topics (id, group_id references groups on delete cascade, emoji text check (char_length(btrim(emoji)) between 1 and 8), title text check (char_length(btrim(title)) between 1 and 40), office_only boolean not null default false, system_key text check (system_key in ('announcements')), sort_order int not null default 100, removed_at timestamptz, created_at timestamptz not null default now(), unique (group_id, system_key))`
  - `topic_messages (id, topic_id references chat_topics on delete cascade, sender_id references profiles on delete set null, body text check (char_length(body) between 1 and 2000), created_at timestamptz not null default now())`, index `(topic_id, created_at)`
  - `topic_reads (topic_id, user_id, last_read_at, primary key (topic_id, user_id))`
  - `topic_township(p_topic uuid) returns uuid` (definer): the topic's group's township.
  - RLS: `topic_messages` select to authenticated using `topic_township(topic_id) = (select my_township())` (live
    updates); no other table policies.
  - `public_topics` (definer view, `security_barrier`): topics of the caller's township's General chat not removed,
    with the latest message's body, time and sender's full name, and `unread_count` = others' messages after
    `greatest(coalesce(read.last_read_at, '-infinity'), coalesce(member.joined_at, me.created_at))`.
  - `public_topic_messages` (definer view): messages of those topics with `sender_name` (full name),
    `from_office` (`role = 'management'`), `is_mine`.
  - RPCs per the Interfaces block: `send_topic_message` (verified; `not_found` unless the topic is the caller's
    township's and not removed; `office_only` unless management in an office-only topic; `bad_body` on blank; trims to
    2000; marks the topic read); `mark_topic_read` (upsert own read, own township only); `create_topic` /
    `update_topic` / `remove_topic` (management only; `bad_topic` on bad emoji/title; Announcements cannot be removed
    or made open → `system_topic`; remove sets `removed_at`; new topics sort last).
  - Trigger `after insert on announcements`: a message in that township's Announcements topic, body `title || E'\n' ||
    body`, sender `created_by`, time `created_at`; nothing when there is no such topic.
  - Data: the six `STARTING_TOPICS` for every General chat group; every post of a General chat group and every
    comment on those posts copied into its Borak-borak topic (author, body, created_at), then those posts deleted.
  - `alter publication supabase_realtime add table public.topic_messages`; revoke all on the three tables from anon,
    authenticated; grant select on `topic_messages` to authenticated; grant select on both views to authenticated;
    functions: revoke from public, anon; grant execute on the five RPCs to authenticated; trigger and helper to nobody.
  - Run `npm run db:migrate`.

- [ ] **Step 4: API check** (scratch script, deleted after, own rows cleaned up): Daniel posts in Help & support (ok),
  in Announcements (`office_only`); the office posts in Announcements (ok); Daniel's `public_topics` unread for
  Borak-borak drops to 0 after `mark_topic_read`; a resident `create_topic` → `not_management`; the office creates,
  renames and removes a test topic, then posting there → `not_found`; removing Announcements → `system_topic`; an
  announcement inserted by the office appears in Announcements.

- [ ] **Step 5: Commit** `feat: add General chat topics to the database`

### Task 7: General chat topics on screen, in the seed and on the dashboard

**Files:**
- Create: `app/(app)/community/general/page.tsx`, `app/(app)/community/general/[topic]/page.tsx`,
  `app/(app)/community/general/actions.ts`, `components/topics/LiveTopic.tsx`, `components/topics/TopicComposer.tsx`,
  `app/dashboard/general/page.tsx`, `components/dashboard/TopicManager.tsx`, `lib/seed/topics.ts`
- Modify: `components/groups/GroupsTab.tsx` (card → `/community/general`, "N new" = `totalUnread`),
  `app/(app)/community/groups/[id]/page.tsx` (`redirect('/community/general')` for `is_general`),
  `components/app/BottomNav.tsx` (hide on `/community/general/<topic>`), `app/dashboard/layout.tsx` (nav item 💬
  General chat), dashboard actions file (`createTopic`, `updateTopic`, `removeTopic`), `lib/seed/community.ts` (General
  chat keeps no posts), `lib/seed/index.ts` (`seedTopics` after `seedCommunity`), `lib/i18n/en.ts`, `lib/i18n/ms.ts`

**Interfaces:**
- Consumes: Task 6's views, RPCs and `lib/domain/topics.ts`.
- Produces: `sendTopicMessage(formData: FormData): Promise<{ ok: true } | { ok: false; error: MessageKey } | null>`
  (fields `topic`, `body`), `markTopicRead(topicId: string): Promise<void>`; dashboard `createTopic(formData)`,
  `updateTopic(formData)`, `removeTopic(topicId)` returning `{ ok: true } | { ok: false; error: MessageKey }`.

- [ ] **Step 1: Topic list page** `/community/general`: `AppHeader` (💬 General chat, township · member count from
  `public_groups`), `public_topics` ordered by `sort_order` then title, rows as in the mockup (emoji circle, title,
  last sender, one-line preview, `timeAgo`, unread badge, 🔒 "Office only"), then the group's rules. Live: the page
  refreshes on `topic_messages` changes via `useRealtimeTable('topic_messages', null, …)`.

- [ ] **Step 2: Topic page** `/community/general/[topic]`: `notFound()` unless in `public_topics`; the latest 100
  messages from `public_topic_messages` as bubbles (others left with name, office name "Management Office ✓", own
  right), times with `clockTime`; `LiveTopic` (realtime on `topic_id=eq.<id>`, scroll to the newest, `markTopicRead`
  when unread > 0); `TopicComposer` like `MessageComposer`, disabled with a note when pending or when office-only and
  the reader is not management. BottomNav hides on this route.

- [ ] **Step 3: Groups and redirect.** GroupsTab's General chat card links to `/community/general` and shows
  `totalUnread(public_topics)`; the general group's page redirects there.

- [ ] **Step 4: Dashboard › General chat.** List the topics (emoji, title, office-only, Open → the topic page),
  an add form (emoji, title, office only), inline edit and Remove (not for Announcements); actions call the RPCs and
  map errors with `topicErrorKey`. Nav item with 💬.

- [ ] **Step 5: Seed.** `lib/seed/community.ts`: General chat gets no posts. `lib/seed/topics.ts`
  `seedTopics(admin, now, people)`: the six `STARTING_TOPICS` in the seeded General chat; Borak-borak gets the four
  former General chat posts and Kavitha's reply (same authors and ages); Help & support: Daniel's BBQ pit question, the
  office's answer, Mei Ling's tip; Say hi: Nur's hello and two welcomes; Lost & found: Ahmad's water bottle; Traffic &
  roads: Priya's jam warning; Announcements: one message per seeded announcement (title and body); `topic_reads` so
  Aisyah has 3 unread in Borak-borak and none elsewhere. Add to `seeders` after `seedCommunity`.

- [ ] **Step 6: Run** `npx vitest run`, `npm run typecheck`, `npx eslint` — clean; `npm run build` — succeeds.

- [ ] **Step 7: Commit** `feat: turn General chat into topics like a Telegram community`

### Task 8: Smoke checks, docs and the final check

**Files:**
- Modify: `scripts/smoke.ts`, `docs/SYSTEM.md`, `README.md`

- [ ] **Step 1: Smoke** (+2 → 21 checks): "Daniel cannot read anyone's parking sessions or saved plates" (both selects
  refused) and "Daniel cannot post in an office-only topic" (`send_topic_message` on Announcements → `office_only`).
  Typecheck only; running it needs the user's OK (it reseeds).

- [ ] **Step 2: Docs.** SYSTEM.md: feature tour rows (Home favourites/More/Edit, Pay parking, Parking areas, Mall
  directory, General chat topics, Help & policies), demo story step for parking, data model rows (favourites,
  `vehicles`/`parking_sessions` server-only, chat topics), security bullets, smoke 21, known limits (demo payments,
  sample Elmina rate, Elmina-only directory, SDP images credited, shop list as of 18 Oct 2026). README: screens to see.

- [ ] **Step 3: Browser check** on the production build (`serumpun-prod`, Aisyah on localhost, Daniel on 127.0.0.1,
  the office on [::1]): favourites edit, save, reset, drag and the move buttons; More; parking areas; pay at both
  malls (amount, methods, processing, thank-you, already paid); the mall directory (search, chips, pin, facilities,
  zoom); General chat topics (unread, post, office-only note, live message from Daniel, office answer, dashboard add/
  rename/remove, announcement mirror); Help pages signed in and out, FAQ search, sign-up terms link; 390 px, dark mode,
  Bahasa Malaysia, Extra large text. Clean up test rows (topics, messages, sessions) afterwards.

- [ ] **Step 4: Commit** `docs: describe favourites, mall parking, the directory, topics and help`; push
  `feat/serumpun-mvp`; production deploy only with the user's explicit OK.
