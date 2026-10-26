# Household access card, stage 2 (getting onto the card) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace self sign-up with the office's code:
- the office gives a code at the counter;
- a resident registers with it: the code, an SMS code shown on screen, then a PIN;
- family join with invite codes;
- residents sign in with phone number, SMS code and PIN;
- a card moves to a new phone.

**Architecture:**
- **Data.** Migration 0025 adds:
  - `card_codes`: office codes and family invites, kept as SHA-256 hashes;
  - `sms_checks`: SMS codes, kept as bcrypt hashes;
  - a `state` on `phone_keys`;
  - one account per phone number.

  Every rule is a security-definer RPC.
- **Accounts.** A resident's Supabase user has a made-up email and a random password that is never kept. Only after the database passes the SMS check and the PIN does the server start a session: `auth.admin.generateLink` makes a magic link that is never sent, and `verifyOtp` with its token hash sets the cookies.
- **Moving.** A resident's phone holds one active browser key.
  - A new browser's key waits until approved: by the old browser, which proves with a signed note that it holds the old key, or by the Owner or Co-owner.
  - The old key is then retired, and an online reader refuses a pass whose key isn't active.

**Tech Stack:** as in stage 1 (Next.js 16 App Router, Supabase Postgres and Auth with pgcrypto, WebCrypto, Vitest). There is no new dependency.

**Spec:** `docs/superpowers/specs/2026-10-19-household-access-card-design.md`, stage 2 of §11.
- Read §2, §5, §7.1, §8, §9 and §10 first.
- The approved mockups `activation-guests.html` and `office.html` are in `.superpowers/brainstorm/838-1792345647/content/` (git-ignored).

## Global Constraints

- **Next.js 16:** read the relevant guide in `node_modules/next/dist/docs/` before writing server actions or pages (AGENTS.md). Cookies can be set or deleted only in server actions and route handlers (`01-app/03-api-reference/04-functions/cookies.md`).
- **Supabase access model** (`supabase/migrations/0001_core.sql`):
  - RLS is on for every table, and every policy is `to authenticated`.
  - Column grants decide what can be written, and here also what can be read.
  - Security-definer functions pin `search_path = ''`, lose EXECUTE for public, anon and authenticated, and get it back only where the app calls them.
  - The next migration is `0025_…`.
- **Time:** all times are Malaysia time, through `lib/domain/time.ts` (`mytDate`, `clockTime`).
- **Privacy:**
  - Unit numbers and phone numbers are seen only by the office (`profile_private`, `units.record_phone`) and by the person themselves.
  - Codes are stored only as SHA-256 hashes. SMS codes and PINs are stored only as bcrypt hashes, made in the database.
  - None of them is logged, and a code never goes in a URL.
  - Signing in never shows whether a phone number has an account.
  - The reader never shows a name.
- **Copy and look:**
  - Every new string goes in English and Malay (`tests/i18n.test.ts` checks).
  - The spec leaves the copy to the builder (§14). The plan fixes only the strings that come from the spec or the mockups; write the rest in the voice of the neighbouring keys.
  - Remove each key nothing uses any more.
  - Icons go through `Glyph` and `Icon`. Never colour alone.
- **Crons:** none are added. The Co-owner reminder is worked out when Me is read.
- **The shared demo:**
  - "Reset demo" (`seedAll`) wipes codes, SMS checks and the accounts visitors registered.
  - "Try as Aisyah" also puts No. 18's invites and invited people back (decision 18).
- **The public repo:**
  - No key, password or real person's phone number goes in a commit, a plan or a test. Use made-up numbers such as `+60 10-000 0025`, or the format samples the tests already use (`012-345 6789`).
  - Never print values from `.env.local` or `vercel env`.
  - There is no new env var and no new dependency. There is no SMS provider: the SMS code shows on screen.
- **Database during the build** (decision 17):
  - Migrations only add tables, columns, indexes, functions or policies.
  - A `create or replace` is allowed only when every state the live app (ca8555a) can reach keeps its answer.
  - Nothing is dropped before the deploy; after it, only with the user's OK (Task 9).
  - Seeders only fill, never wipe.
  - `npm run db:seed` and `npm run smoke` run only with the user's OK, at ship time.
  - Don't run `npm run db:seed:cards` in stage 2. Task 8 renames three seeded phones, which stops that script on the old names; the ship reset applies the new ones.
  - A browser check deletes the accounts and cards it made on the shared database, by id, with a throwaway service-role script.
- **Git:**
  - Production deploys and moving GitHub `main` need the user's OK each time.
  - Only `feat/serumpun-mvp` is pushed.
  - Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **R1:** library code imports `t` and `MessageKey` from `@/lib/i18n/core`.

## Calls this plan makes

The spec leaves these to the builder.

1. **The session:** the server mints it with `generateLink` (magic link, never sent) plus `verifyOtp`, after the database passes the SMS check and the PIN. This is the spec's suggestion: there's no password to leak and no new secret.
2. **Accounts:** a resident's email is `resident-<uuid>@example.com`, with a random password that is never kept. `@example.com` already works for this project's users and can't receive mail.
3. **One account per number:** a unique index on `profile_private.phone`, written `+601…`. That's where the phone already lives, and only the office and the person can read it.
4. **Codes:** 8 characters, without I, O, 0 or 1 (40 bits), stored as SHA-256. That's enough randomness for a fast hash, and the Register box can find a code by its hash.
5. **SMS codes:** 6 digits, bcrypt, 10 minutes and 5 tries. PINs keep stage 1's bcrypt and lockout. This is the spec's "hashed, with an expiry and a try limit".
6. **No enumeration:** any well-formed number gets an SMS code. An unknown number and a wrong PIN end in the same "The phone number or PIN is wrong.", because a number must not reveal that someone lives in Elmina.
7. **A code only for a home with no card:** ending the old card for a new Owner needs stage 5's ended card and access-ended screen.
8. **Invites:**
   - a child: the Owner, or a checked Co-owner;
   - an adult: only while the Owner decides alone;
   - a Co-owner: the Owner, when there is none.

   An adult that needs both answers `needs_both` until stage 3's two-person approvals.
9. **Labels:** new phones are `<whole name>'s phone`, and an invite's name must not make a label the card already has. This is the stage-1 collision fix.
10. **A full card:** its phones plus its open invites reach the phone limit, so an open invite holds a slot.
11. **Moving:**
    - one active key per resident phone, while demo accounts keep sharing their seeded phone;
    - the old browser approves with a fresh signed note, checked on the server before a service-role RPC;
    - for a lost phone the Owner, or a checked Co-owner, approves, never for themselves (Task 1);
    - someone alone on the card goes to the office, whose recovery codes come in stage 5.
12. **Retired keys:** a key that moved away or was declined is retired, not deleted, so the old browser says the card is elsewhere instead of asking again. A newer waiting key retires an older one.
13. **Stopping the old phone:** "Yes stops the old phone at once" holds at online readers, which need an active key. An offline reader stops it when its pass expires, within 24 hours.
14. **No sign-out on a move:** the old browser stays signed in to the app; only its card stops. This is a known limit.
15. **Nur:** "Try registering (Nur)":
    - deletes the accounts on her home's card and on her made-up number;
    - deletes the card and resets her record;
    - issues a fresh code, and opens Register with it in a 10-minute httpOnly cookie, never the URL.

    She is no longer a seeded person or a demo account.
16. **Imran** becomes a demo account in stage 3, with the two-person approvals he exists to show (§9).
17. **Office staff** keep email and password, on `/sign-in` under "Management Office staff".
18. **"Later"** on "Add a Co-owner?" lasts 3 days in the browser. One phone per person makes the browser the person's.
19. **The pending state:**
    - sign-up, its banner and Residents go in the code that ships, and registration writes `verified`;
    - `profiles.status` keeps its values, so the live app works;
    - the "verified" gates stay, as they mirror `is_verified()`;
    - after the deploy, with the user's OK, `set_resident_status` is dropped and the default becomes `verified`.
20. **The office's Co-owner IC check** comes with stage 3's Needs you list. Until then an invited Co-owner counts as an Adult (§5).
21. **`my_township()`** is unchanged. "Township access needs a card" comes with stage 5's ended and removed cases.
22. **Bookings** still match `profile_private.unit_no`. Registration writes the card's unit label there, so a card's people count together; counting the card itself is stage 4.
23. **The record phone:** the office reads `units.record_phone` on the server, after `requireManagement`, with the service role and for its township only. Members still can't.
24. **The printed slip** is `window.print()`, with a print rule that shows only the slip.

## Stage-1 follow-ups

**Folded in:**
- unique invite labels, with no first-name collisions (Task 1);
- explicit phone labels, as a rule (Task 1) and in the seed (Task 8);
- `my_card()` gets the status rule, and `register_phone_key` goes through it (Task 1);
- the raw 23505 becomes `phone_elsewhere` (Tasks 1 and 6);
- one active key per resident phone (Task 1);
- the stored pass is dropped on a renewal refusal, and terminal refusals stop retrying (Task 7);
- the office's way to the record phone (Task 3);
- M1, a refusal answered even when its save throws, plus a nonce cap (Task 6);
- M7, the copy (Task 6).

**Left out:**
- M2: Elmina is the only live township. Compare the reader's township with `pass.township` when a second one goes live.
- M3: a Vercel firewall rule is a project setting that needs the user's OK. The new public steps are already bounded by the PIN lockout, 5-try SMS checks and 40-bit codes.

## Review Focus

1. **A phone number typed the usual ways** ("012-345 6789", "+60 12 345 6789", "60123456789") reaches one account, and a landline or a foreign number is refused in words. Tests: Task 2 *reads a Malaysian mobile number…*; Task 3 *sends the record with the number in +60 form…*.
2. **A code typed loosely** (lower case, spaces, no hyphen) works. A look-alike (O for 0, I for 1) is refused, never changed. Tests: Task 2 *reads a code typed…* and *refuses … a look-alike*.
3. **One code used twice at once** (a double tap; two family members with one slip; Try registering tapped again) makes one account. The other attempt gets "This code doesn't work…" and leaves nothing half-made. Tests: Task 1 check 5; Task 2 *deletes the new account when the database refuses*.
4. **A browser holding another account's key and pass** (a shared laptop, a demo browser): the new account's renewal works, and a refused renewal never leaves the old pass to present. Tests: Task 1 check 1; Task 7's browser check, item 5.
5. **Two new browsers ask for one card, or an old phone comes back after a move.** The newest wins, the others say the card is elsewhere, and nothing asks again by itself. Tests: Task 1 check 7; Task 7's browser check, item 3.

## Files

| File | Responsibility |
|---|---|
| `supabase/migrations/0025_getting_onto_the_card.sql` (new) | Codes, SMS checks, key states, one account per phone; every rule as an RPC |
| `lib/card/codes.ts`, `lib/domain/phone.ts` (new) | Codes, and Malaysian mobile numbers |
| `lib/card/register.ts`, `lib/supabase/phone-auth.ts` (new, server-only) | Code lookup, SMS checks, finishing a registration; phone sign-in and the session |
| `lib/card/household.ts` (new) | Who may invite whom and approve whose move; household error keys |
| `lib/card/{pin,server,summary,device,reader-server,crypto}.ts` | PIN answers, move answers, the waiting flag, dropping a pass, the reader's key check |
| `lib/domain/units.ts`, `app/dashboard/units/*`, `components/dashboard/GiveCode.tsx` (new) | Giving a code at the counter |
| `app/(auth)/*`, `components/auth/{RegisterFlow,PhoneSignIn}.tsx` (new) | Landing, Register, Sign in, Try registering |
| `app/(app)/me/household/*` (new), `components/card/*` | The household page; the invite, PIN and move sheets |
| `lib/seed/{people,cards}.ts`, `scripts/smoke.ts`, `lib/content/help.ts`, `docs/SYSTEM.md` | The demo, smoke checks, help and docs |
| Removed: `app/(auth)/signup/`, `lib/domain/signup.ts`, `tests/signup.test.ts`, `app/dashboard/residents/`, `components/dashboard/ResidentDecision.tsx` | Self sign-up and approval |

---

### Task 1: Database: codes, SMS checks, registration, invites and moves

**Files:**
- Create: `supabase/migrations/0025_getting_onto_the_card.sql`
- Scratch, never committed: a check script in the session scratchpad, like stage 1's (`postgres` with `env.databaseUrl`, one transaction, `rollback`).
  - Before the transaction it creates one throwaway auth user with the service-role client and a made-up `@example.com` email, because `complete_registration` needs a real user id.
  - It deletes that user in `finally`.
- Modify: `lib/i18n/en.ts`, `ms.ts` (`notify.card.moveAsked`, `notify.card.moved`, `notify.card.joined`)

**Interfaces:**
- Consumes:
  - 0024's tables, `my_card`, `register_phone_key` and `verify_card_pin`;
  - `notify()`, `is_management()`, `my_township()`.
- Produces (text bounds apply after `btrim`):

```
card_codes   id uuid pk, township_id → townships, unit_id → units on delete cascade, card_id uuid null → cards on delete cascade,
             kind text in ('office','invite'), code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
             name text null 1–40, role text null in ('co_owner','adult','child'),
             created_by uuid null → profiles on delete set null, created_at timestamptz default now(), expires_at timestamptz not null,
             used_at timestamptz null, used_by uuid null → profiles on delete set null, cancelled_at timestamptz null,
             check ((kind = 'invite') = (card_id is not null and name is not null and role is not null));
             index (unit_id) where used_at is null and cancelled_at is null
sms_checks   id uuid pk, phone text not null check (phone ~ '^\+601[0-9]{8,9}$'), code_hash text not null, tries int not null default 0,
             expires_at timestamptz not null, verified_at timestamptz null, used_at timestamptz null, created_at timestamptz default now()
phone_keys   + state text not null default 'active' check (state in ('active','waiting','retired'))
profile_private  + unique index profile_private_phone_idx (phone) where phone is not null
```

**Words used below:**
- An **open** code has no `used_at` and no `cancelled_at`, and its `expires_at > now()`.
- A **manager** is the card's `owner`, or its `co_owner` when `ic_checked_at` is set.
- A **PIN answer** is the jsonb `verify_card_pin` returns.
- A function that takes a PIN raises its other refusals **before** checking the PIN, so a refused change costs no try. It returns a wrong PIN rather than raising it, so the count is saved.
- Every function is `security definer set search_path = ''`, and raises `'<code>'`.

| Function | Granted to | Rule |
|---|---|---|
| `my_card()` (replaced) | as before | Also null when the caller's profile is `rejected`, like `my_township()` |
| `check_member_pin(p_user uuid, p_pin text) → jsonb` | service_role | 0024's `verify_card_pin` body for `p_user`, with the demo exemption and the lockout notice; the card to notify is found by `p_user` |
| `verify_card_pin(p_pin)` (replaced) | as before | `return public.check_member_pin((select auth.uid()), p_pin)` |
| `register_phone_key(p_x, p_y)` (replaced) | as before | The move rule, below |
| `issue_unit_code(p_unit uuid, p_code_hash text, p_by uuid) → timestamptz` | service_role | Lock the unit; `has_card` if it has one; cancel its open office codes; insert `kind 'office'`, `expires_at = now() + 3 days`; answer `expires_at` |
| `give_unit_code(p_unit, p_name text, p_tenure text, p_phone text, p_lease_end date, p_code_hash text) → timestamptz` | authenticated | `not_management`; `not_found` outside `my_township()`; `bad_name` (1–80); `bad_tenure`; `bad_phone` (`^\+601[0-9]{8,9}$`); `bad_lease` unless a tenant's end is after today in Malaysia and an owner's is null. Write the four record columns, then `issue_unit_code(p_unit, p_code_hash, auth.uid())` |
| `start_sms_check(p_phone text, p_code text) → uuid` | service_role | `bad_phone`; `bad_code` unless `^[0-9]{6}$`. Delete checks over a day old; insert bcrypt (`extensions.crypt`, `gen_salt('bf')`) with `expires_at = now() + 10 minutes`; answer the id |
| `verify_sms_check(p_check uuid, p_code text) → jsonb` | service_role | Lock the row. Missing, used, expired or 5 wrong tries: `{"ok": false, "expired": true}`. Right: set `verified_at`, answer `{"ok": true}`. Wrong: `tries + 1`, answer `{"ok": false, "tries_left": 5 - tries}` |
| `complete_registration(p_code_hash, p_check uuid, p_user uuid, p_pin text, p_lang text) → uuid` | service_role | Below |
| `create_invite(p_name text, p_role text, p_pin text, p_code_hash text) → jsonb` | authenticated | Below |
| `cancel_invite(p_invite uuid) → void` | authenticated | `not_found` unless an open invite on `my_card()`; `not_allowed` unless the caller made it or is a manager; set `cancelled_at` |
| `move_phone_key(p_user uuid, p_x text, p_y text, p_pin text) → jsonb` | service_role | `not_this_phone` unless `(p_x, p_y)` is an active key of `p_user`'s phone; `nothing_waiting`; then `p_user`'s PIN. Right: retire the active keys, make the waiting key active, notify `p_user` (`notify.card.moved`, `/me`), answer `{"ok": true}` |
| `approve_phone_move(p_member uuid, p_pin text) → jsonb` | authenticated | Below |
| `decline_phone_move() → void` | authenticated | Retire the caller's waiting keys |

**`register_phone_key`, in order:**
1. The card is `my_card()`, locked. If there's none: `no_card`.
2. The key format, as in 0024: `bad_key`.
3. The caller's phone (`card_phones where user_id = caller`) is on another card: `phone_elsewhere`.
4. The caller has no phone: `card_full` at `phone_limit`; otherwise create it, labelled `left(btrim(full_name), 52) || '''s phone'`, and add the key `active`.
5. The key is already on the phone: `active` answers the pass fields, `waiting` answers `{"waiting": true}`, `retired` answers `{"moved": true}`.
6. A new key on a phone that has an active key, from a caller who isn't a demo account (`raw_app_meta_data ? 'demo'`):
   - retire the phone's other waiting keys, and add this one `waiting`;
   - notify the caller (`'card', 'notify.card.moveAsked', <full name>, '/me'`), and the card's other managers (the same, with `/me/household`);
   - answer `{"waiting": true}`.
7. Otherwise (a demo account, or no active key yet) add the key `active`.

The pass fields are 0024's.

**`complete_registration`**, in one transaction:
1. The code (locked) must be open, else `bad_code`.
2. The check (locked) must be verified, unused and unexpired, else `bad_check`. For an office code its phone must equal the unit's `record_phone`, else `bad_check`.
3. The PIN must match `^[0-9]{6}$`, else `bad_pin`. If a `profile_private` row has the phone, `phone_taken` (a unique violation answers the same).
4. **An office code:** `has_card` if the unit has a card. Otherwise create the card with the defaults, and make the person its `owner`, named `record_name`, with `ic_checked_at` = the code's `created_at`.
5. **An invite:** `card_full` unless the card's phones plus its other open invites are fewer than `phone_limit`. The person takes the invite's role and name.
6. Insert:
   - `profiles`: the unit's township and neighbourhood, `resident`, `verified`, `lang` = `p_lang` if it is `en` or `ms`, else `en`;
   - `profile_private`: `unit_no` = the unit label, and the phone;
   - `card_members`;
   - `card_phones`: labelled `left(btrim(name), 52) || '''s phone'`;
   - `member_pins`: bcrypt.
7. Mark the code (`used_at`, `used_by`) and the check used. For an invite, notify the managers (`notify.card.joined`, `<name>`, `/me/household`).
8. Answer the card id.

**`create_invite`, in order:**
1. `no_card`; `not_allowed` unless the caller is a manager; `bad_role`.
2. For `co_owner`: `not_allowed` unless the caller is the owner; `has_co_owner` if the card has a co-owner or an open co-owner invite.
3. For `adult`: `needs_both` unless the caller is the owner and the card has no checked co-owner.
4. `bad_name` unless 1–40 characters. `name_taken` when an open invite has the name, or a phone is labelled `<name>'s phone` (case-insensitive).
5. `card_full` unless the phones plus open invites are fewer than `phone_limit`.
6. The PIN, through `check_member_pin`. A refusal returns its answer.
7. A right PIN inserts the invite (`kind 'invite'`, the card and its unit, the name and role, `created_by`, `expires_at = now() + 3 days`), and answers `{"ok": true, "expires_at": t}`.

**`approve_phone_move`:**
1. `not_found` unless `p_member` is on `my_card()`.
2. `not_allowed` unless the caller may approve for that person:
   - never for themselves;
   - an owner's move: only the checked co-owner;
   - a co-owner's move: only the owner;
   - anyone else's: any manager.
3. `nothing_waiting`.
4. The caller's PIN.
5. A right PIN moves the key as `move_phone_key` does, and notifies the member and the managers.

**Policies and grants:**
- **`card_codes`:** RLS on. The office reads its township's office codes (`kind = 'office'`, `is_management()`, township = `my_township()`); members read their card's invites (`card_id = my_card()`). Grant select on every column but `code_hash` to authenticated, and all to service_role.
- **`sms_checks`:** RLS on, no policy, service_role only.
- **The new functions:** revoke from public, anon and authenticated, then grant as the table says. The replaced functions keep their grants.
- End the file with `notify pgrst, 'reload schema';`.

**Why this is safe while the live app runs.** The replaced functions answer every state ca8555a can reach as before:
- demo accounts still join their one phone;
- every seeded member already has a phone, so no label is made;
- no live account is both rejected and on a card;
- the stage-1 reader ignores `state`, which is `active` on every existing key.

- [ ] **Step 1: Watch it be missing (RED).** On the shared database, `select to_regclass('public.card_codes')`. Expected: `null`.

- [ ] **Step 2: Write the migration**, and add the three notification strings.

- [ ] **Step 3: Apply it.** It's additive, which decision 17 allows.

Run: `npm run db:migrate`
Expected: `applied 0025_getting_onto_the_card.sql`.

- [ ] **Step 4: Run the rolled-back checks (GREEN).**

Users act through `set local role authenticated` with `request.jwt.claims`, or `set local role service_role`. Expected: every line prints `PASS`.
1. **Live-safety:** as Daniel (a demo account), two key pairs both answer his one phone, `active`, and he keeps 1 phone. A key already on Aisyah's phone also registers on Daniel's (Review Focus 4). As Aisyah, `verify_card_pin('123456')` answers ok.
2. **The office:** as Puan Rozita, `give_unit_code` for No. 61 (`+60100000061`) answers about 3 days ahead, and a second call cancels the first. As Daniel it's `not_management`; for No. 18 it's `has_card`.
3. **Secrets:** as Daniel, `select code_hash from card_codes` and `select count(*) from sms_checks` are both refused.
4. **SMS checks:** `start_sms_check(…, '482913')`, then `000000` answers `tries_left` 4 and `482913` answers ok. On a fresh check, five wrong tries make the sixth `expired`.
5. **Registering:** `complete_registration` with No. 61's code and the throwaway user makes No. 61's card:
   - the user is `owner`, with `ic_checked_at` = the code's `created_at`;
   - the phone is "Zulkifli Hassan's phone";
   - the profile is `verified`, with `unit_no` and the phone;
   - `check_member_pin` with the PIN answers ok;
   - the same call again is `bad_code` (Review Focus 3).
6. **Invites, as Aisyah:**
   - `('Adam', 'child', '000000', …)` gives her PIN answer and adds no invite;
   - with `123456` it answers ok;
   - `adult` is `needs_both`, and `co_owner` is `has_co_owner`;
   - `Adam` again is `name_taken`, and `Ben` is `card_full`;
   - as Sara, it's `not_allowed`.
7. **Moves, as the throwaway owner** (Review Focus 5):
   - key A gives the pass fields;
   - key B is `{"waiting": true}`, with a `moveAsked` notification;
   - key C waits, and B is `retired`;
   - `move_phone_key(<user>, A, <PIN>)` answers ok;
   - then A is `{"moved": true}`, and C gives the pass fields.
8. **Declining:** a new waiting key D, then `decline_phone_move()`, retires D.
9. **Approving, on Sara** (a seeded child, not a demo account): S1 is active and S2 waits. Sara approving herself is `not_allowed`. As Aisyah, `approve_phone_move(<Sara>, '123456')` answers ok, and S2 becomes active.
10. **Rejected:** after `update profiles set status = 'rejected'` on Daniel, his `my_card()` is null.
11. **Afterwards:** the `card_codes` and `sms_checks` counts are unchanged, and the throwaway user is deleted.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0025_getting_onto_the_card.sql lib/i18n/en.ts lib/i18n/ms.ts
git commit -m "feat(card): codes, SMS checks, registration, invites and moves in the database" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Codes, phone numbers, and the server side of registering and signing in

**Files:**
- Create:
  - `lib/card/codes.ts` and `lib/domain/phone.ts`, both pure;
  - `lib/card/register.ts` and `lib/supabase/phone-auth.ts`, both starting with `import 'server-only'`.
- Modify:
  - `lib/card/pin.ts`: `PinAnswer` moves here from the actions file, and `pinAnswer` is added;
  - `app/(app)/me/card/actions.ts`: `checkCardPin` uses `pinAnswer`.
- Test: `tests/card-codes.test.ts`, `tests/phone.test.ts`, `tests/card-register.test.ts`, `tests/phone-auth.test.ts`

**Interfaces:**
- Consumes: Task 1's RPCs; `isPinFormat`; `clockTime`.
- Produces:

```ts
// lib/card/codes.ts
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode(): string; // 8 chars: crypto.getRandomValues, byte % 32 (no bias: 256 is a multiple of 32)
export function normalizeCode(input: unknown): string | null; // upper-cased, spaces and hyphens dropped; null unless 8 alphabet chars
export function formatCode(code: string): string; // 'K7Q4M29X' → 'K7Q4-M29X'
export function hashCode(code: string): Promise<string>; // SHA-256 (crypto.subtle), lower-case hex: card_codes.code_hash
// lib/domain/phone.ts
export function normalizePhone(input: unknown): string | null; // digits and a leading +; 0… → +60…, 60… → +60…; valid when ^\+601[0-9]{8,9}$
export function formatPhone(e164: string): string; // '+60123456789' → '+60 12-345 6789'; '+601123456789' → '+60 11-2345 6789'
// lib/card/pin.ts (added)
export type PinAnswer = { ok: true } | { ok: false; error: MessageKey; triesLeft?: number; lockedUntil?: string; time?: string };
export function pinAnswer(data: { ok: boolean; tries_left?: number; locked_until?: string }, now: Date, lang: Lang): PinAnswer;
// lib/card/register.ts
export const REGISTER_CODE_COOKIE = 'serumpun-register-code';
export type Home =
  | { kind: 'office'; unit: string; township: string; name: string; tenure: 'owner' | 'tenant'; checkedAt: string; leaseEnd: string | null; phone: string | null }
  | { kind: 'invite'; unit: string; township: string; name: string; role: 'co_owner' | 'adult' | 'child'; invitedBy: string | null };
export function peekCode(admin: SupabaseClient, code: string, now: Date): Promise<Home | null>;
export function startSmsCheck(admin: SupabaseClient, phone: string): Promise<{ check: string; sms: string }>;
export type SmsAnswer = { ok: true } | { ok: false; triesLeft: number } | { ok: false; expired: true };
export function checkSmsCode(admin: SupabaseClient, check: string, sms: string): Promise<SmsAnswer>;
export const REGISTER_REFUSALS = ['bad_code', 'bad_check', 'phone_taken', 'has_card', 'card_full', 'bad_pin'] as const;
export type RegisterResult = { userId: string } | { error: (typeof REGISTER_REFUSALS)[number] | 'failed' };
export function finishRegistration(admin: SupabaseClient, i: { code: string; check: string; pin: string; lang: Lang; now: Date }): Promise<RegisterResult>;
// lib/supabase/phone-auth.ts
export type PhoneSignInResult = { userId: string } | { error: 'wrong' | 'expired' | 'failed' };
export function phoneSignIn(admin: SupabaseClient, i: { check: string; pin: string; now: Date }): Promise<PhoneSignInResult>;
export function startSession(admin: SupabaseClient, supabase: SupabaseClient, userId: string): Promise<void>; // throws if Auth refuses
```

**Behaviour:**
- **`peekCode`:**
  - Text that isn't a code answers null without a query.
  - Otherwise it makes one select on `card_codes`, by `code_hash` and open at `now`, taking:
    - `kind, name, role, created_at`;
    - the unit's `label, neighbourhood, record_name, record_tenure, record_phone, lease_end`, and its township's `name`;
    - the inviter's `full_name`, through the named `created_by` constraint (two foreign keys point at `profiles`).
- **`startSmsCheck`:** `crypto.randomInt(0, 1_000_000)`, padded to 6 digits.
- **`checkSmsCode`:** a check id that isn't a uuid (22P02) is `expired`.
- **`finishRegistration`:**
  1. A malformed code or PIN is refused with no call at all.
  2. `peekCode` null: `bad_code`, and no account is made.
  3. `auth.admin.createUser({ email: 'resident-' + randomUUID() + '@example.com', password: randomUUID() + randomUUID(), email_confirm: true })`.
  4. `complete_registration`. If it fails, `deleteUser` the new account, then answer the refusal. Anything else is `failed`, and is logged.
- **`phoneSignIn`:**
  1. A check that isn't verified, is used, has expired or is missing: `expired`, before looking for anyone.
  2. No account by `profile_private.phone`: `wrong`, exactly as for a wrong PIN.
  3. `check_member_pin`: a lock, tries left or `no_pin` all answer `wrong` (Task 2 ruling: a lock must not reveal an account).
  4. Right: mark the check used with `.is('used_at', null)`. It must return 1 row, else `expired`.
- **`startSession`:** `getUserById`, then `generateLink({ type: 'magiclink', email })`, then `supabase.auth.verifyOtp({ token_hash: properties.hashed_token, type: 'magiclink' })`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/card-codes.test.ts
it('makes 8-character codes from 32 characters with no I, O, 0 or 1', () => {
  expect(CODE_ALPHABET).toHaveLength(32);
  expect(CODE_ALPHABET).not.toMatch(/[IO01]/);
  const codes = Array.from({ length: 200 }, newCode);
  for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  expect(new Set(codes).size).toBe(200);
});
it('reads a code typed in lower case, with spaces, or without the hyphen', () => {
  for (const typed of ['K7Q4-M29X', 'k7q4m29x', ' k7q4 - m29x ']) expect(normalizeCode(typed), typed).toBe('K7Q4M29X');
});
it('refuses a wrong length, a look-alike character, or anything that is not text', () => {
  for (const bad of ['K7Q4-M29', 'K7Q4-M29XY', 'K7Q4-M2OX', 'K7Q4-M21X', '', 12345678, null]) expect(normalizeCode(bad), String(bad)).toBeNull();
});
it('shows and hashes a code as the database keeps it', async () => {
  expect(formatCode('K7Q4M29X')).toBe('K7Q4-M29X');
  expect(await hashCode('K7Q4M29X')).toBe(createHash('sha256').update('K7Q4M29X').digest('hex')); // node:crypto
});
// tests/phone.test.ts
it('reads a Malaysian mobile number typed the usual ways', () => {
  for (const typed of ['012-345 6789', '0123456789', '+60 12-345 6789', '60123456789', ' +6012 345 6789 ']) expect(normalizePhone(typed), typed).toBe('+60123456789');
  expect(normalizePhone('011-2345 6789')).toBe('+601123456789');
});
it('refuses a landline, a short number, a foreign number, or anything that is not text', () => {
  for (const bad of ['03-1234 5678', '012-345 678', '+65 9123 4567', '', null, 60123456789]) expect(normalizePhone(bad), String(bad)).toBeNull();
});
it('shows a number the Malaysian way', () => {
  expect([formatPhone('+60123456789'), formatPhone('+601123456789')]).toEqual(['+60 12-345 6789', '+60 11-2345 6789']);
});
```

`tests/card-register.test.ts` and `tests/phone-auth.test.ts` mock `server-only`. Their `fakeAdmin(answers)` copies the Proxy stand-in of `tests/card-reader-db.test.ts:15-34`. It answers:
- a table's query from `answers[table]`, and an `update` from `answers[table + '_update']`;
- `rpc(name, args)` from `answers.rpc`, recording `rpc <name>` in `calls` and the args in `rpcArgs`;
- `auth.admin.createUser` with user `u-new`, recording `createUser`;
- `auth.admin.deleteUser(id)`, recording `deleteUser <id>`.

```ts
// tests/card-register.test.ts
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
});
// tests/phone-auth.test.ts
const verified = { phone: '+60100000025', verified_at: '2026-10-25T03:59:00Z', used_at: null, expires_at: '2026-10-25T04:09:00Z' };
const signIn = (db: ReturnType<typeof fakeAdmin>) => phoneSignIn(db.client, { check: 'chk', pin: '123456', now });

it('signs in with a verified check and the right PIN, and uses the check up', async () => {
  const db = fakeAdmin({ sms_checks: ok(verified), sms_checks_update: ok([{ id: 'chk' }]), profile_private: ok({ id: 'u-nur' }), rpc: ok({ ok: true }) });
  expect(await signIn(db)).toEqual({ userId: 'u-nur' });
  expect(db.rpcArgs).toEqual({ p_user: 'u-nur', p_pin: '123456' });
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
  const admin = { auth: { admin: { getUserById: async () => ({ data: { user: { email: 'resident-1@example.com' } }, error: null }), generateLink } } };
  await startSession(admin as never, { auth: { verifyOtp } } as never, 'u-nur');
  expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'resident-1@example.com' });
  expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'th', type: 'magiclink' });
});
```

- [ ] **Step 2: Run them to watch them fail.**

Run: `npx vitest run tests/card-codes.test.ts tests/phone.test.ts tests/card-register.test.ts tests/phone-auth.test.ts`
Expected: FAIL: the modules don't exist yet.

- [ ] **Step 3: Implement** the four modules, `pinAnswer`, and `checkCardPin`'s use of it.

- [ ] **Step 4: Run them**, with `tests/card-actions.test.ts` too.

Expected: PASS. `checkCardPin`'s tests pass unchanged.

- [ ] **Step 5: Commit**

```bash
git add lib/card/codes.ts lib/domain/phone.ts lib/card/register.ts lib/supabase/phone-auth.ts lib/card/pin.ts "app/(app)/me/card/actions.ts" tests/card-codes.test.ts tests/phone.test.ts tests/card-register.test.ts tests/phone-auth.test.ts
git commit -m "feat(card): codes, phone numbers, and the server side of registering and signing in" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: The office gives a code; Residents goes

**Files:**
- Modify: `lib/domain/units.ts`, `app/dashboard/units/actions.ts`, `app/dashboard/units/page.tsx`, `app/globals.css`
- Create: `components/dashboard/GiveCode.tsx`
- Delete: `app/dashboard/residents/page.tsx`, `components/dashboard/ResidentDecision.tsx`
- Modify for the deletion:
  - `app/dashboard/actions.ts`: remove `decideResident` and `RESIDENT_ERRORS`;
  - `app/dashboard/layout.tsx`: remove the Residents item and its count;
  - `components/dashboard/ResetDemo.tsx`: its comment names `ResidentDecision`.
- i18n:
  - remove `dashboard.residents.*` and `dashboard.nav.residents`;
  - add `units.state.code_given`, `units.codeUntil`, `units.give.*` and the new `units.error.*`;
  - add `phone.error.format`: "Enter a Malaysian mobile number, like 012-345 6789."
- Test: `tests/units.test.ts`, `tests/units-actions.test.ts`

**Interfaces:**
- Consumes: `give_unit_code`; `newCode`, `hashCode`, `formatCode`, `normalizePhone`, `formatPhone`; `clockTime`.
- Produces:

```ts
// lib/domain/units.ts
export const UNIT_STATES = ['not_registered', 'code_given', 'active', 'suspended', 'lease_ended'] as const;
export function unitState(unit: { lease_end: string | null; card: { status: 'active' | 'suspended' } | null; codeUntil: string | null }, now: Date): UnitState;
// unitErrorKey also maps bad_name, bad_tenure, bad_lease, has_card, not_checked → units.error.*, and bad_phone → phone.error.format
// app/dashboard/units/actions.ts
export type UnitRecord = { name: string; tenure: 'owner' | 'tenant'; phone: string; leaseEnd: string | null; icSeen: boolean; papersSeen: boolean };
export async function giveCode(unit: string, record: UnitRecord): Promise<{ code: string; expiresAt: string } | { error: MessageKey }>;
```

**Behaviour:**
- **`unitState`:** with no card, `code_given` when `codeUntil` is set, else `not_registered`.
- **`giveCode`:**
  1. `requireManagement`.
  2. Both ticks, else `units.error.not_checked`. `normalizePhone`, else `phone.error.format`.
  3. A `newCode()`, then `give_unit_code` with the trimmed name, the `+60` phone, the lease end (null for an owner) and `hashCode(code)`.
  4. Map errors with `unitErrorKey`, logging only `common.error`.
  5. `refresh()`, then answer `formatCode(code)`. The code exists only in this answer.
- **The page:**
  - Open office codes (`unit_id, expires_at`) come through RLS.
  - `record_phone` comes from `createAdminClient()`, for the office's township only, after `requireManagement`, with a one-line comment saying why.
  - The Card column shows "Code given · Until {time}".
  - Units with no card get **Give code**.
- **`GiveCode`** (§8, `office.html`): a `Sheet`, "Give a code · {unit}".
  - The record: the name; Owner or Tenant (`Segmented`); the phone, prefilled with `formatPhone`; and the lease end, for tenants only.
  - Two checkboxes: "IC matches the record", and "House title or SPA seen (for a tenant: the tenancy agreement)". **Give code** stays disabled until both are ticked.
  - The answer:
    - the code, in large monospace;
    - "Works once, until {time}. A new code cancels the old one.";
    - **Print slip** (`window.print()`).
  - The slip, marked `data-print-slip`, holds Serumpun, the unit, the code, "Open Serumpun and tap Register with a code", and the time.
- **`app/globals.css`:**

```css
@media print {
  body * { visibility: hidden; }
  [data-print-slip], [data-print-slip] * { visibility: visible; }
  [data-print-slip] { position: fixed; inset: 0; padding: 2rem; }
}
```

- [ ] **Step 1: Write the failing tests**

In `tests/units.test.ts`:
- the existing calls gain `codeUntil: null`;
- the error loop gains the five new codes;
- add `expect(unitErrorKey('bad_phone')).toBe('phone.error.format')`, and:

```ts
it('calls a home with an open code and no card "code given"', () => {
  expect(unitState({ lease_end: null, card: null, codeUntil: '2026-10-27T09:00:00Z' }, now)).toBe('code_given');
  expect(unitState({ lease_end: null, card: { status: 'active' }, codeUntil: '2026-10-27T09:00:00Z' }, now)).toBe('active');
});
```

```ts
// tests/units-actions.test.ts
describe('giveCode', () => {
  const record = { name: ' Zulkifli Hassan ', tenure: 'owner' as const, phone: '010-000 0061', leaseEnd: null, icSeen: true, papersSeen: true };
  it('asks the database nothing until both checks are ticked and the number is a Malaysian mobile', async () => {
    expect(await giveCode('u61', { ...record, papersSeen: false })).toEqual({ error: 'units.error.not_checked' });
    expect(await giveCode('u61', { ...record, phone: '03-1234 5678' })).toEqual({ error: 'phone.error.format' });
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it('sends the record with the number in +60 form and only the hash of a fresh code, and shows the code once', async () => {
    h.rpc.mockResolvedValueOnce({ data: '2026-10-28T04:00:00+00:00', error: null });
    const answer = (await giveCode('u61', record)) as { code: string; expiresAt: string };
    const [name, args] = h.rpc.mock.calls[0];
    expect(name).toBe('give_unit_code');
    expect(args).toMatchObject({ p_unit: 'u61', p_name: 'Zulkifli Hassan', p_tenure: 'owner', p_phone: '+60100000061', p_lease_end: null });
    expect(answer.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(args.p_code_hash).toBe(await hashCode(normalizeCode(answer.code)!));
  });
  it("names the database's refusal", async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'has_card' } });
    expect(await giveCode('u18', record)).toEqual({ error: 'units.error.has_card' });
  });
});
```

- [ ] **Step 2: Run them to watch them fail.**

Run: `npx vitest run tests/units.test.ts tests/units-actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**, and remove Residents.

- [ ] **Step 4: Run** `npm test`, `npm run typecheck` and `npm run lint`.

Expected: PASS.

- [ ] **Step 5: Check it in the browser** (as the office)
1. The nav has no Residents.
2. On No. 61, Give code:
   - stays disabled until both boxes are ticked;
   - `03-1234 5678` shows the phone message;
   - `010-000 0061` gives a code, and the row reads "Code given · Until …".
3. Give code again. Expected: a new code. Task 4 shows the first one refused.
4. Print slip. Expected: the preview shows only the slip. If the pane can't print, find the rule in the built CSS instead.
5. Malay, 375 px, light and dark, and no console errors.

- [ ] **Step 6: Commit**

```bash
git rm -q app/dashboard/residents/page.tsx components/dashboard/ResidentDecision.tsx
git add lib/domain/units.ts app/dashboard/units components/dashboard/GiveCode.tsx app/globals.css app/dashboard/actions.ts app/dashboard/layout.tsx components/dashboard/ResetDemo.tsx lib/i18n/en.ts lib/i18n/ms.ts tests/units.test.ts tests/units-actions.test.ts
git commit -m "feat(card): the office gives a code at the counter; Residents goes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Register and Sign in; self sign-up goes

**Files:**
- Create:
  - `app/(auth)/register/page.tsx`, `app/(auth)/register/actions.ts`, `components/auth/RegisterFlow.tsx`;
  - `app/(auth)/sign-in/page.tsx`, `components/auth/PhoneSignIn.tsx`.
- Modify:
  - `app/(auth)/actions.ts`: remove `signUp`; add `checkSms`, `sendSignInSms` and `signInWithPin`. `signIn` (email) stays for office staff.
  - `app/(auth)/forms.tsx`: remove `SignUpForm`.
  - `app/(auth)/page.tsx` and `components/card/PinPad.tsx`.
  - `app/(app)/layout.tsx`: the pending banner goes.
  - `app/(app)/me/page.tsx`.
  - `components/help/HelpHeader.tsx`: signed out, back goes to `/`.
- Delete: `app/(auth)/signup/page.tsx`, `lib/domain/signup.ts`, `tests/signup.test.ts`.
- i18n: remove the `signup.*` keys except `signup.error.required` (the announcement form uses it), plus `landing.newHere`, `landing.createAccount` and `pending.banner`.
- Test: `tests/register-actions.test.ts`; `tests/proxy.test.ts`.

**Interfaces:**
- Consumes: Task 2's register and phone-auth modules, codes and phone helpers, `PinAnswer` and `pinAnswer`; `returnPath`; `getLang`.
- Produces:

```ts
// app/(auth)/register/actions.ts (public: nobody is signed in yet)
export async function readCode(code: string): Promise<{ home: Home } | { error: MessageKey }>;
export async function sendSms(code: string, phone: string | null): Promise<{ check: string; sms: string; phone: string } | { error: MessageKey }>;
export async function register(code: string, check: string, pin: string): Promise<{ error: MessageKey }>; // success redirects
// app/(auth)/actions.ts
export async function checkSms(check: string, sms: string): Promise<{ ok: true } | { ok: false; error: MessageKey; triesLeft?: number }>;
export async function sendSignInSms(phone: string): Promise<{ check: string; sms: string; phone: string } | { error: MessageKey }>;
export async function signInWithPin(check: string, pin: string, next?: string): Promise<PinAnswer>; // success redirects
// components/card/PinPad.tsx: gains `check?: (pin: string) => Promise<PinAnswer>` (default checkCardPin), called on the sixth
// digit; { ok: true } calls onUnlock. The demo lock still applies only when demoPin is set.
export function RegisterFlow(props: { initialCode: string | null }): React.JSX.Element;
export function PhoneSignIn(props: { next?: string }): React.JSX.Element;
```

**Behaviour:**
- **`sendSms`:**
  - An office code texts the record's phone, never one typed in. If there's no phone on record: `register.error.noPhone`.
  - An invite texts `normalizePhone(phone)`, else `phone.error.format`.
  - A code that isn't open: `register.error.code`.
  - The answer's `phone` is in `+60` form.
- **`register`:**
  - Calls `finishRegistration` with `getLang()`.
  - On success: delete the cookie (`{ name: REGISTER_CODE_COOKIE, path: '/register' }`), `startSession`, then `redirect('/me?ready=1')`.
  - If `startSession` throws: log it, and answer `register.error.session`.
  - The refusals map to messages:

    | Refusal | Message key |
    |---|---|
    | `bad_code` | `register.error.code` |
    | `bad_check` | `sms.error.expired` |
    | `phone_taken` | `register.error.phoneTaken` |
    | `has_card` | `register.error.hasCard` |
    | `card_full` | `card.error.card_full` |
    | `bad_pin` | `card.pin.error.format` |
    | `failed` | `common.error` |
- **`checkSms`:** not six digits: `card.pin.error.format`. Tries left: `sms.error.wrong` (`{n}`). Expired: `sms.error.expired`.
- **`sendSignInSms`:** starts a check for any well-formed number, and never looks for an account.
- **`signInWithPin`:**
  - `wrong`: `signIn.error.wrong`, with no tries count. A locked PIN also answers `wrong` (Task 2 ruling, plan call 6), so phone sign-in has no locked state and never shows a locked time.
  - `expired`: `sms.error.expired`.
  - Success: `startSession`, then `redirect(returnPath(next) ?? '/home')`.
- **The pages:**
  - `/register` and `/sign-in` send a signed-in visitor to `homePath`.
  - `/register` passes the `REGISTER_CODE_COOKIE` value (Task 8 sets it) as `initialCode`.
  - `/sign-in` takes `?next=`. Under `<PhoneSignIn>` it has a `<details>`, "Management Office staff: sign in with email", around the existing `<SignInForm next>`.
- **The landing** (`activation-guests.html`):
  - **Register with a code** (primary, to `/register`) and **Sign in** (outline, to `/sign-in`, carrying `next`);
  - the hint line;
  - then the demo section and the language switch.

  The email form and "Create an account" go.
- **`RegisterFlow`**, one screen at a time:
  1. **The code:**
     - prefilled with `formatCode(initialCode)`;
     - the hint;
     - "By registering you agree to the", with Terms opening in a new tab;
     - **Next** calls `readCode`.
  2. **The home:**
     - An office code shows "Is this your home?": the unit and township; "{name} · Owner" or "Tenant"; "IC and title checked at the office: {time}" (`clockTime`); and for a tenant, the lease end (`Intl.DateTimeFormat`, with day, short month and year, in Malaysia time).
     - An invite shows "Join the household card of {unit}", "{name} · {role}" and "Invited by {name}".
     - Then **Yes, this is me**, and for an office code "Not you? Call the office."
  3. **The SMS code:**
     - An office code calls `sendSms(code, null)` at once. An invite asks for the phone number first.
     - "We sent a 6-digit code to {phone}" (an office code adds "the number the office has"), then the amber demo note.
     - The SMS code field (`inputMode="numeric"`, `autoComplete="one-time-code"`), **Send a new code**, and `checkSms`.
  4. **The PIN:**
     - "Choose a 6-digit PIN", with the explainer from `activation-guests.html`, on a `PinPad` whose `check` remembers the PIN;
     - then "Enter the same PIN again", whose `check` compares (else `register.pin.mismatch`) and calls `register`.
- **`PhoneSignIn`:**
  - the phone and **Send code**;
  - the SMS step;
  - "Enter your 6-digit PIN" on a `PinPad` whose `check` is `signInWithPin`;
  - "New here? Register with a code".
- **Me with `?ready=1`:** a green line with ✓, "Your card is ready · bound to this phone", above the card.
- **Copy from the spec or the mockups** (the Malay is the implementer's):

  | Key | English |
  |---|---|
  | `landing.register` | Register with a code |
  | `landing.codeHint` | Your code comes from the Management Office, or from your family if they invited you. |
  | `register.code.hint` | A code works once and lasts 3 days. Lost it? The office gives you a new one. |
  | `register.home.title` | Is this your home? |
  | `register.home.yes` | Yes, this is me |
  | `register.home.notYou` | Not you? Call the office. |
  | `register.sms.office` | We sent a 6-digit code to {phone}, the number the office has. |
  | `register.sms.demo` | Demo: no SMS is sent. Your code is {code}. |
  | `register.pin.choose` | Choose a 6-digit PIN |
  | `register.error.code` | This code doesn't work. It may be used, out of date or replaced by a newer one. Ask the office, or whoever invited you. |
  | `signIn.error.wrong` | The phone number or PIN is wrong. |
  | `me.ready` | Your card is ready · bound to this phone |

  Also `household.role.{owner,co_owner,adult,child}`: Owner, Co-owner, Adult, Child.

- [ ] **Step 1: Write the failing tests**

In `tests/proxy.test.ts`, replace `'/signup'` with `'/register', '/sign-in'` in *guards whole path segments only…*.

`tests/register-actions.test.ts` mocks these, as `tests/auth-actions.test.ts` does:
- `server-only`;
- `next/navigation`, whose `redirect` throws `NEXT_REDIRECT <to>`;
- `next/headers`, with `delete` and `get` spies;
- the admin and server clients;
- `getLang` (`'en'`) and `getSessionProfile` (null);
- `@/lib/card/register` and `@/lib/supabase/phone-auth`, spread over the real modules so their constants stay.

```ts
const OFFICE_HOME = { kind: 'office', unit: 'No. 61, Jalan Elmina Green 5', township: 'City of Elmina', name: 'Zulkifli Hassan', tenure: 'owner', checkedAt: '2026-10-24T02:00:00Z', leaseEnd: null, phone: '+60100000061' };
const INVITE_HOME = { kind: 'invite', unit: 'No. 18, Jalan Elmina Valley 3/2', township: 'City of Elmina', name: 'Adam', role: 'child', invitedBy: 'Aisyah Rahman' };

it("texts an office code's own number, never one typed in", async () => {
  h.peek.mockResolvedValue(OFFICE_HOME);
  h.start.mockResolvedValue({ check: 'chk', sms: '482913' });
  expect(await sendSms('k7q4-m29x', '0129999999')).toEqual({ check: 'chk', sms: '482913', phone: '+60100000061' });
  expect(h.start).toHaveBeenCalledWith(h.admin, '+60100000061');
});
it('texts the number an invited person types, read the Malaysian way', async () => {
  h.peek.mockResolvedValue(INVITE_HOME);
  h.start.mockResolvedValue({ check: 'chk', sms: '482913' });
  await sendSms('K7Q4M29X', '012-345 6789');
  expect(h.start).toHaveBeenCalledWith(h.admin, '+60123456789');
});
it('signs the new resident in, forgets the demo code and opens Me', async () => {
  h.finish.mockResolvedValue({ userId: 'u-new' });
  await expect(register('K7Q4M29X', 'chk', '123456')).rejects.toThrow('NEXT_REDIRECT /me?ready=1');
  expect(h.startSession).toHaveBeenCalledWith(h.admin, h.client, 'u-new');
  expect(h.cookieDelete).toHaveBeenCalledWith({ name: REGISTER_CODE_COOKIE, path: '/register' });
});
it('says the same for an unknown number and a wrong PIN, and goes back only inside the app', async () => {
  h.signIn.mockResolvedValueOnce({ error: 'wrong' });
  expect(await signInWithPin('chk', '123456')).toEqual({ ok: false, error: 'signIn.error.wrong' });
  h.signIn.mockResolvedValue({ userId: 'u-nur' });
  await expect(signInWithPin('chk', '123456', '/checkin/abc')).rejects.toThrow('NEXT_REDIRECT /checkin/abc');
  await expect(signInWithPin('chk', '123456', '//evil.example')).rejects.toThrow('NEXT_REDIRECT /home');
});
```

- [ ] **Step 2: Run them.**

Run: `npx vitest run tests/register-actions.test.ts tests/proxy.test.ts`
Expected: the actions test FAILs. The proxy test passes already: the new pages are public by construction, and it pins that.

- [ ] **Step 3: Implement**, and remove sign-up and the pending banner.

- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`.

Expected: all pass, with no build warnings.

- [ ] **Step 5: Check it in the browser** (the office in a second browser)
1. The landing has Register with a code, Sign in, the hint and the demos. `/signup` is not found.
2. The office gives No. 62 a code (`010-000 0062`). Register with it typed in lower case, without the hyphen. Expected:
   - "Is this your home?";
   - the SMS line and the demo code;
   - the PIN twice;
   - Me shows No. 62 at "1 of 4" with "Your card is ready", and the card opens with the PIN.
3. Task 3's replaced No. 61 code answers "This code doesn't work…".
4. Sign out, then sign in with `0100000062`:
   - a wrong PIN answers "The phone number or PIN is wrong.";
   - the right PIN opens Home;
   - a made-up unknown number ends at the same message.
5. "Management Office staff" signs the office in.
6. Malay, 375 px, and no console errors. Delete No. 62's account and card, by id.

- [ ] **Step 6: Commit**

```bash
git rm -q "app/(auth)/signup/page.tsx" lib/domain/signup.ts tests/signup.test.ts
git add "app/(auth)" components/auth components/card/PinPad.tsx "app/(app)/layout.tsx" "app/(app)/me/page.tsx" components/help/HelpHeader.tsx lib/i18n/en.ts lib/i18n/ms.ts tests/register-actions.test.ts tests/proxy.test.ts
git commit -m "feat(card): register with a code and sign in with phone and PIN; self sign-up goes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Family invites and the household page

**Files:**
- Create:
  - `lib/card/household.ts`;
  - `app/(app)/me/household/page.tsx` and `actions.ts`;
  - `components/card/InviteSheet.tsx` and `CoOwnerPrompt.tsx`.
- Modify:
  - `components/card/HouseholdCard.tsx`: "Household ›" under the open card, but not in reader mode;
  - `app/(app)/me/page.tsx`;
  - the i18n files.
- Test: `tests/card-household.test.ts`, `tests/household-actions.test.ts`

**Interfaces:**
- Consumes: `create_invite` and `cancel_invite`; `newCode`, `hashCode`, `formatCode`, `pinAnswer`; `PinPad` with `check`; `loadMyCard`; RLS reads of `card_members`, `profiles` and `card_codes`.
- Produces:

```ts
// lib/card/household.ts
export type MemberRole = 'owner' | 'co_owner' | 'adult' | 'child';
export type Member = { userId: string; role: MemberRole; icChecked: boolean };
export type InviteRole = 'child' | 'adult' | 'co_owner';
export type InviteChoice = true | 'not_allowed' | 'needs_both' | 'has_co_owner';
export function isManager(m: Pick<Member, 'role' | 'icChecked'>): boolean;
export function inviteChoices(me: Member, card: { members: Member[]; openInviteRoles: InviteRole[] }): Record<InviteRole, InviteChoice>; // mirrors create_invite
export function householdErrorKey(code: string | undefined): MessageKey;
// no_card, card_full → card.error.*; has_co_owner, needs_both → invite.why.*; not_allowed, bad_role, bad_name, name_taken,
// not_found → household.error.*; anything else → common.error
// app/(app)/me/household/actions.ts
export async function createInvite(name: string, role: InviteRole, pin: string): Promise<PinAnswer | { ok: true; code: string; expiresAt: string }>;
export async function cancelInvite(invite: string): Promise<{ error?: MessageKey }>;
// components
export function InviteSheet(props: { cardId: string; demoPin: string | null; choices: Record<InviteRole, InviteChoice>; initialRole?: InviteRole }): React.JSX.Element;
export function CoOwnerPrompt(): React.JSX.Element | null;
```

**Behaviour:**
- **`createInvite`:**
  1. `requireMember`. A malformed PIN is refused with no call.
  2. A `newCode()`, then `create_invite` with the trimmed name, the role, the PIN and `hashCode(code)`.
  3. An answer of ok gives `formatCode(code)`. Otherwise the answer goes through `pinAnswer`, or `householdErrorKey`.
  4. `refresh()`.
- **The page:** `requireMember`, then `loadMyCard`; with no card it shows `card.error.no_card`.
  - "Household · {unit}", and "People on the card · {n} of {max} phones".
  - Each person: their name, a role tag in words, "You", and "IC not checked at the office yet" for an unchecked Co-owner.
  - Managers see **Invite someone**, which opens `InviteSheet`, with `initialRole` from `?invite=`.
  - Open invites: "{name} · {role} · works until {time}", with **Cancel** for the person who made it or a manager.
  - The rules line from `household.html`.
  - `demoPin` is worked out as on the Me page.
- **`InviteSheet`:**
  - The name, and the role as `Segmented`. A role that isn't `true` is disabled, with its reason (`invite.why.*`).
  - **Confirm with PIN** opens the `PinPad`, whose `check` is `createInvite`.
  - The answer: "{name}'s invite", the code in large monospace, "Works once, until {time}…", and **Send by WhatsApp** (`https://wa.me/?text=` plus the encoded message, with `{url}` = the site's origin).
- **`CoOwnerPrompt`:** the Me page renders it for an owner whose card has no co-owner and no open co-owner invite.
  - It renders nothing until it has read `localStorage['serumpun.coOwnerLater']` (in try/catch), and stays hidden while that date is in the future.
  - **Add a Co-owner** links to `/me/household?invite=co_owner`. **Later** stores now + 3 days.
- **Copy from the mockups** (the Malay is the implementer's):

  | Key | English |
  |---|---|
  | `household.invite` | Invite someone |
  | `household.rules` | A child: the Owner or Co-owner, alone. An adult: both of you, once the office has checked the Co-owner's IC. Neither of you can remove the other; only the office can. |
  | `invite.code.works` | Works once, until {time}. {name} types it under Register on their own phone. |
  | `invite.whatsapp` | Send by WhatsApp |
  | `coOwner.title` | Add a Co-owner? |
  | `coOwner.body` | Your spouse or another adult, so no one person holds all the power over the card. |
  | `coOwner.later` | Later · we'll remind you in 3 days |

- [ ] **Step 1: Write the failing tests**

```ts
// tests/card-household.test.ts
const aisyah: Member = { userId: 'a', role: 'owner', icChecked: true };
const imran: Member = { userId: 'i', role: 'co_owner', icChecked: true };
const sara: Member = { userId: 's', role: 'child', icChecked: false };
const nur: Member = { userId: 'n', role: 'owner', icChecked: true };
const rizal: Member = { userId: 'r', role: 'co_owner', icChecked: false };
const card = (members: Member[], openInviteRoles: InviteRole[] = []) => ({ members, openInviteRoles });

it('lets an Owner with a checked Co-owner add a child alone; an adult waits for two-person approvals', () => {
  expect(inviteChoices(aisyah, card([aisyah, imran, sara]))).toEqual({ child: true, adult: 'needs_both', co_owner: 'has_co_owner' });
  expect(inviteChoices(imran, card([aisyah, imran, sara]))).toEqual({ child: true, adult: 'needs_both', co_owner: 'not_allowed' });
  expect(inviteChoices(sara, card([aisyah, imran, sara]))).toEqual({ child: 'not_allowed', adult: 'not_allowed', co_owner: 'not_allowed' });
});
it('lets an Owner alone on the card invite anyone, and holds the Co-owner place for an open invite', () => {
  expect(inviteChoices(nur, card([nur]))).toEqual({ child: true, adult: true, co_owner: true });
  expect(inviteChoices(nur, card([nur], ['co_owner'])).co_owner).toBe('has_co_owner');
});
it('counts a Co-owner whose IC is not checked as an adult', () => {
  expect(inviteChoices(nur, card([nur, rizal]))).toEqual({ child: true, adult: true, co_owner: 'has_co_owner' });
  expect(inviteChoices(rizal, card([nur, rizal]))).toEqual({ child: 'not_allowed', adult: 'not_allowed', co_owner: 'not_allowed' });
});
it('names every household refusal in both languages', () => {
  for (const code of ['no_card', 'not_allowed', 'bad_role', 'has_co_owner', 'needs_both', 'bad_name', 'name_taken', 'card_full', 'not_found']) {
    expect(householdErrorKey(code), code).not.toBe('common.error');
    expect(t('ms', householdErrorKey(code))).not.toBe(t('en', householdErrorKey(code)));
  }
  expect(householdErrorKey('__proto__')).toBe('common.error');
});
// tests/household-actions.test.ts (requireMember gives { id: 'u-aisyah', lang: 'en' }; the server client's rpc is h.rpc)
it('sends only the hash of a fresh code with the name, role and PIN, and shows the code once it is made', async () => {
  h.rpc.mockResolvedValueOnce({ data: { ok: true, expires_at: '2026-10-28T04:00:00+00:00' }, error: null });
  const answer = (await createInvite(' Adam ', 'child', '123456')) as { ok: true; code: string; expiresAt: string };
  const [name, args] = h.rpc.mock.calls[0];
  expect([name, args.p_name, args.p_role, args.p_pin]).toEqual(['create_invite', 'Adam', 'child', '123456']);
  expect(args.p_code_hash).toBe(await hashCode(normalizeCode(answer.code)!));
});
it('hands back a wrong PIN as the pad expects, and names a refusal', async () => {
  h.rpc.mockResolvedValueOnce({ data: { ok: false, tries_left: 4 }, error: null });
  expect(await createInvite('Adam', 'child', '000000')).toEqual({ ok: false, error: 'card.pin.error.wrong', triesLeft: 4 });
  h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'needs_both' } });
  expect(await createInvite('Farid', 'adult', '123456')).toEqual({ ok: false, error: 'invite.why.needs_both' });
});
```

- [ ] **Step 2: Run them to watch them fail.**

Run: `npx vitest run tests/card-household.test.ts tests/household-actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** `npm test`, `npm run typecheck` and `npm run lint`.

Expected: PASS.

- [ ] **Step 5: Check it in the browser**
1. Try as Aisyah, open the card, then Household ›. Expected: Aisyah · Owner · You, Imran · Co-owner, and Sara · Child, at "3 of 4 phones".
2. Invite someone:
   - Adult and Co-owner are disabled, each with its reason;
   - "Adam", Child: the pad shows the demo PIN;
   - 123456 gives the code and a WhatsApp link holding it;
   - Invites lists Adam.
   A second invite is refused, because the card is full.
3. In a second browser, register with Adam's code and `010-000 0018`. Expected:
   - "Join the household card of No. 18…", "Adam · Child", "Invited by Aisyah Rahman";
   - Me shows No. 18 at "4 of 4";
   - Aisyah's Household lists Adam, and her bell has the joined notification.
4. Register a fresh Owner on No. 63. Expected: "Add a Co-owner?". Later hides it, and it stays hidden after a reload.
5. Delete Adam's account and No. 63's account and card, by id.

- [ ] **Step 6: Commit**

```bash
git add lib/card/household.ts "app/(app)/me/household" components/card/InviteSheet.tsx components/card/CoOwnerPrompt.tsx components/card/HouseholdCard.tsx "app/(app)/me/page.tsx" lib/i18n/en.ts lib/i18n/ms.ts tests/card-household.test.ts tests/household-actions.test.ts
git commit -m "feat(card): family invites and the household page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Moving to a new phone: the server and the reader

**Files:**
- Modify: `lib/card/{server,pin,household,reader-server,crypto}.ts`, `app/(app)/me/card/actions.ts`, `app/(app)/me/household/actions.ts`, and the i18n files
- Test: `tests/card-server.test.ts`, `tests/card-actions.test.ts`, `tests/household-actions.test.ts`, `tests/card-household.test.ts`, `tests/card-reader.test.ts`, `tests/card-reader-db.test.ts`, `tests/card-crypto.test.ts`

**Interfaces:**
- Consumes: Task 1's move answers and RPCs; `readPresentation`, `publicJwkFromSigningKey`, `NOTE_FRESH_MS`; `pinAnswer`, `householdErrorKey`.
- Produces:

```ts
// lib/card/server.ts
export type IssueResult = { pass: string } | { error: 'no_card' | 'card_full' | 'bad_key' | 'phone_elsewhere' | 'move_waiting' | 'moved' | 'failed' };
// { waiting: true } → move_waiting; { moved: true } → moved. cardErrorKey: move_waiting → card.move.waiting,
// moved → card.move.moved, phone_elsewhere → card.error.phone_elsewhere
// lib/card/household.ts
export function canApproveMove(approver: Member, member: Member): boolean; // mirrors approve_phone_move
// householdErrorKey also maps not_this_phone, nothing_waiting → household.error.*
// app/(app)/me/card/actions.ts
export async function moveCard(presentation: string, pin: string): Promise<PinAnswer>;
export async function declineMove(): Promise<{ error?: MessageKey }>;
// app/(app)/me/household/actions.ts
export async function approveMove(member: string, pin: string): Promise<PinAnswer>;
```

**Behaviour:**
- **`moveCard`:**
  1. `requireMember`, then `isPinFormat`.
  2. `readPresentation` with the township key. The note must be within `NOTE_FRESH_MS` of now, else `card.move.error.proof`.
  3. `createAdminClient().rpc('move_phone_key', { p_user: profile.id, p_x: pass.key.x, p_y: pass.key.y, p_pin: pin })`.
  4. `pinAnswer`, or `householdErrorKey`.

  A comment says why it's the service role: the database can't check an ECDSA signature, and a person can read their own phone's public keys, so only this action, after checking the signature, may move a key.
- **`declineMove` and `approveMove`:** each calls its RPC as the user, then `refresh()`. `approveMove` checks `isPinFormat` first.
- **`loadState`:** a fourth parallel query reads `phone_keys.state` by `phone_id = pass.phone` and the key's `x` and `y`. `phoneFrozen` is also true when that state isn't `active`.
- **M1:**
  - `handleTap` answers a refusal even when its `saveVisit` throws. A grant whose save throws still throws, so the reader decides offline, as stage 1 ruled.
  - `parseNote` takes only a nonce matching `^[A-Za-z0-9_-]{16,64}$`.
- **Copy:**
  - M7: `card.error.card_full` becomes "This card has no free phone. Ask the office for an extra card." and `card.qr.hint` becomes "It changes every 30 seconds, so a screenshot won't work."
  - `card.move.waiting` tells three people what to do: someone with the old phone (open Me there and choose Move), someone whose old phone is lost (the Owner or Co-owner approves in Household), and someone alone on the card (take your IC to the office).
  - Add `card.move.moved` ("Your card is on another phone now."), `card.move.error.proof` and `card.error.phone_elsewhere`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/card-server.test.ts
it('says when the key waits for the old phone, has moved away, or sits on another card', async () => {
  const key = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } as PublicJwk;
  const issue = async (result: { data: unknown; error: { message: string } | null }) => issuePass(fakeDb(result).client, key, now, await generateSigningKey());
  expect(await issue({ data: { waiting: true }, error: null })).toEqual({ error: 'move_waiting' });
  expect(await issue({ data: { moved: true }, error: null })).toEqual({ error: 'moved' });
  expect(await issue({ data: null, error: { message: 'phone_elsewhere' } })).toEqual({ error: 'phone_elsewhere' });
});
// tests/card-actions.test.ts: requireMember gives { id: 'u1', lang }; the admin client's rpc is h.adminRpc; CARD_SIGNING_KEY
// is stubbed with a generated key; presentation(at) signs a pass for phoneKey and a note at `at`, as card-reader.test.ts's setup does.
describe('moveCard', () => {
  it('moves nothing for a presentation the township did not sign, or one older than a minute', async () => {
    expect(await moveCard('a.b.c.d', '123456')).toEqual({ ok: false, error: 'card.move.error.proof' });
    expect(await moveCard(await presentation(Date.now() - 120_000), '123456')).toEqual({ ok: false, error: 'card.move.error.proof' });
    expect(h.adminRpc).not.toHaveBeenCalled();
  });
  it('moves the key the presentation proves, for the signed-in person, through the service role', async () => {
    h.adminRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    expect(await moveCard(await presentation(Date.now()), '123456')).toEqual({ ok: true });
    expect(h.adminRpc).toHaveBeenCalledWith('move_phone_key', { p_user: 'u1', p_x: phoneKey.x, p_y: phoneKey.y, p_pin: '123456' });
  });
});
// tests/household-actions.test.ts
it("hands back an approver's wrong PIN, and names a refusal", async () => {
  h.rpc.mockResolvedValueOnce({ data: { ok: false, tries_left: 2 }, error: null });
  expect(await approveMove('u-sara', '000000')).toEqual({ ok: false, error: 'card.pin.error.wrong', triesLeft: 2 });
  h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'nothing_waiting' } });
  expect(await approveMove('u-sara', '123456')).toEqual({ ok: false, error: 'household.error.nothing_waiting' });
});
// tests/card-household.test.ts (Task 5's members)
it('lets the other of the Owner and Co-owner approve a lost phone, and a manager approve anyone else', () => {
  expect([canApproveMove(imran, aisyah), canApproveMove(aisyah, imran), canApproveMove(imran, sara)]).toEqual([true, true, true]);
  expect([canApproveMove(aisyah, aisyah), canApproveMove(sara, aisyah), canApproveMove(rizal, nur)]).toEqual([false, false, false]);
});
// tests/card-reader.test.ts (M1). The existing tests' nonces, such as 'n1', grow to 16 or more characters for the new cap.
it('answers a refusal even when its visit cannot be saved', async () => {
  const { deps, present } = await setup({ ...active, suspended: true });
  deps.saveVisit = async () => { throw new Error('connection lost'); };
  expect(await handleTap({ presentation: await present('pool', 'nonce-refused-0001'), place: 'pool', facility: null }, deps)).toEqual({ granted: false, reason: 'card_suspended' });
});
it('still fails a grant whose visit cannot be saved, so the reader decides it again offline', async () => {
  const { deps, present } = await setup();
  deps.saveVisit = async () => { throw new Error('connection lost'); };
  await expect(handleTap({ presentation: await present('pool', 'nonce-granted-0001'), place: 'pool', facility: null }, deps)).rejects.toThrow('connection lost');
});
// tests/card-reader-db.test.ts: the default rows gain phone_keys: ok({ state: 'active' })
it('treats a pass whose key moved away, or still waits, as a switched-off phone', async () => {
  for (const key of [ok({ state: 'retired' }), ok({ state: 'waiting' }), ok(null)]) {
    expect((await adminReaderDeps(fakeAdmin(rows({ phone_keys: key })).client, publicKey).loadState(pass, null, now)).phoneFrozen).toBe(true);
  }
  const db = fakeAdmin(rows());
  expect((await adminReaderDeps(db.client, publicKey).loadState(pass, null, now)).phoneFrozen).toBe(false);
  expect(eqs(db.on('phone_keys')[0].steps)).toEqual({ phone_id: 'phone-1', x: 'x', y: 'y' });
});
// tests/card-crypto.test.ts
it('refuses a note whose nonce is not 16 to 64 base64url characters', async () => {
  const encoded = await generateSigningKey();
  const device = await phone();
  const pass = await signPass(payload(device.jwk), await importSigningKey(encoded));
  for (const nonce of ['short', 'x'.repeat(65), 'has.a.dot.in.it.0000']) {
    expect(await readPresentation(await signNote(pass, { ...NOTE, nonce }, device.privateKey), publicJwkFromSigningKey(encoded)), nonce).toBeNull();
  }
});
```

- [ ] **Step 2: Run them to watch them fail.** Run the seven files with `npx vitest run`. Expected: FAIL, in the new tests only.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** `npm test`, `npm run typecheck` and `npm run lint`.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/card "app/(app)/me/card/actions.ts" "app/(app)/me/household/actions.ts" lib/i18n/en.ts lib/i18n/ms.ts tests/card-server.test.ts tests/card-actions.test.ts tests/household-actions.test.ts tests/card-household.test.ts tests/card-reader.test.ts tests/card-reader-db.test.ts tests/card-crypto.test.ts
git commit -m "feat(card): move a card to a new phone; readers refuse a moved key" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Moving to a new phone: the screens

**Files:**
- Modify: `lib/card/device.ts`, `lib/card/summary.ts`, `components/card/HouseholdCard.tsx`, `app/(app)/me/household/page.tsx`, and the i18n files
- Create: `components/card/PinSheet.tsx`, `components/card/MoveQuestion.tsx`
- Test: `tests/card-face.test.tsx`

**Interfaces:**
- Consumes: `moveCard`, `declineMove`, `approveMove`, `canApproveMove`, the move keys; `presentTap`, `openDevice`, `PinPad`.
- Produces:

```ts
// lib/card/device.ts
export function clearPass(idb: IDBFactory): Promise<void>; // keeps the keys, drops the pass
export function forgetDevice(idb: IDBFactory): Promise<void>; // deletes the record: the next openDevice makes a new key
// lib/card/summary.ts: CardSummary gains moveWaiting: boolean (the caller's own phone has a waiting key; RLS shows them their own keys)
export function PinSheet(props: { open: boolean; onClose: () => void; title: string; cardId: string; demoPin: string | null; check: (pin: string) => Promise<PinAnswer>; onDone: () => void }): React.JSX.Element;
export function MoveQuestion(props: { cardId: string; device: Pick<Device, 'keys' | 'pass'>; onMoved: () => void }): React.JSX.Element;
```

**Behaviour:**
- **`HouseholdCard`'s renewal**, by its answer:

  | Answer | What happens |
  |---|---|
  | `card.move.waiting` | The waiting note, and a retry every 5 seconds. Nothing else polls |
  | `card.move.moved` | `clearPass`. "Your card is on another phone now." and **Use the card on this phone**, which runs `forgetDevice` then `openDevice` and renews; the new key then waits |
  | Any other `card.error.*` | `clearPass`, show the error, and stop retrying until the page loads again. This is stage 1's privacy edge and its retry minor |
  | `common.error`, or a throw | Keep the pass, and retry on stage 1's schedule |
- **The question on the old phone.** When `summary.moveWaiting`, this browser's own renewal succeeded, and it isn't reader mode, `MoveQuestion` sits above the card:
  - **Yes, move it** opens a `PinSheet` whose `check` is `moveCard(await presentTap(device, { place: null, facility: null }, Date.now()), pin)`. Once that's done, `onMoved` drops the pass and shows the moved state.
  - **No, that wasn't me** calls `declineMove`.
- **The household page:**
  - It finds this card's waiting keys with `createAdminClient()`, for this card's phones only. A comment says members can't read each other's keys.
  - Each such person shows "New phone waiting".
  - When `canApproveMove(viewer, them)` is true, there's **Approve** with "Only if their old phone is lost: approving stops it at once.", which opens a `PinSheet` whose `check` is `approveMove`.
- **Copy from the spec and the mockup:** `card.move.question` is "Move the card to your new phone?", `card.move.yes` is "Yes, move it", and `card.move.no` is "No, that wasn't me".

- [ ] **Step 1: Write the failing test.** In `tests/card-face.test.tsx`, the fixture gains `moveWaiting: false`, the actions mock gains `moveCard` and `declineMove`, and:

```tsx
it('asks the old phone whether to move the card, with Yes and No', () => {
  const html = renderToStaticMarkup(<MoveQuestion cardId="c18" device={{ keys: {} as CryptoKeyPair, pass: 'p' }} onMoved={() => {}} />);
  for (const text of ['Move the card to your new phone?', 'Yes, move it', 'No, that wasn&#x27;t me']) expect(html).toContain(text);
});
```

- [ ] **Step 2: Run it.**

Run: `npx vitest run tests/card-face.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`.

Expected: all pass, with no build warnings.

- [ ] **Step 5: Check it in the browser** (browsers A and B)
1. **The old phone approves:**
   - In A, register a fresh Owner on No. 64 and open the card. In B, sign in with that number: B shows the waiting note.
   - A's bell has the moveAsked notification, and A's Me asks the question.
   - Yes, then the PIN. Expected: A shows "Your card is on another phone now.", and within about 5 seconds B's card opens.
2. **B taps:** a Pool tap at `/reader` is green.
3. **A asks back:** in A, Use the card on this phone. Expected: A waits, and B is asked. No. Expected: A says the card is elsewhere, and doesn't ask again after a reload (Review Focus 5).
4. **A lost phone:**
   - The No. 64 Owner (in B) invites a child "Mia", who registers in A.
   - Sign Mia in on a private window C: C waits.
   - The Owner's Household shows "Mia · New phone waiting" with Approve. After the PIN, C's card opens.
5. **A browser that held Aisyah's card** (Try as Aisyah, open it): sign out, then register a fresh Owner. Expected: the new card renews and opens (Review Focus 4).
6. No console errors. Delete No. 64's people and card, by id.

- [ ] **Step 6: Commit**

```bash
git add lib/card/device.ts lib/card/summary.ts components/card "app/(app)/me/household/page.tsx" lib/i18n/en.ts lib/i18n/ms.ts tests/card-face.test.tsx
git commit -m "feat(card): the old phone moves the card, or the Owner approves a lost one" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: The demo, help, smoke checks and docs

**Files:**
- Modify:
  - `lib/seed/people.ts` and `lib/seed/cards.ts`;
  - `app/(auth)/actions.ts` and `app/(auth)/forms.tsx`;
  - `lib/content/help.ts`, `scripts/smoke.ts` and `docs/SYSTEM.md`;
  - the i18n files: `landing.demo.nur` is "Try registering (Nur)".
- Test: `tests/card-seed.test.ts`, `tests/auth-actions.test.ts`, `tests/help.test.ts`

**Interfaces:**
- Consumes: `issue_unit_code`; `newCode`, `hashCode`, `REGISTER_CODE_COOKIE`.
- Produces:

```ts
// lib/seed/cards.ts
export const DEMO_REGISTER = { label: 'No. 25, Jalan Elmina Green 1/3', neighbourhood: 'Elmina Green', name: 'Nur Iman', phone: '+60100000025' } as const; // made up
export function restartDemoRegistration(admin: SupabaseClient): Promise<string>; // the fresh code
// app/(auth)/actions.ts
export async function tryRegistering(): Promise<AuthResult>; // success redirects to /register
```

**Behaviour:**
- **`people.ts`:** remove `nur` from `PEOPLE` and `DEMO_EMAIL`.
- **`cardRows`:**
  - Nur's home becomes an unregistered unit, with `record_phone: DEMO_REGISTER.phone`.
  - `PHONES` gains `weiMing: "Wei Ming's phone"`, `farah: "Farah's phone"` and `meiLing: "Mei Ling's phone"`.
  - The counts stay 25, 14, 16 and 16.
- **`seedCards`:** also gives No. 61 an office code through `issue_unit_code` (a random code nobody keeps, `p_by` = the office), and prints `…, 1 code given, PINs set`.
- **`restartDemoRegistration`:**
  1. Delete the accounts of everyone on Nur's home's card, and of whoever has `DEMO_REGISTER.phone`.
  2. Delete the card.
  3. Reset the record from `DEMO_REGISTER`.
  4. Answer a fresh code from `issue_unit_code`.
- **`restoreDemoCard`** also:
  - cancels No. 18's open invites;
  - deletes the accounts of No. 18's members who have a phone on record. Those came in through an invite; seeded people have none. Mark it with `shortcut: seeded members have no phone; mark them if a later stage seeds phones`.
- **`tryRegistering`:**
  - If the restart fails: `console.error`, and `landing.demo.error`.
  - Otherwise set the cookie (`httpOnly`, `sameSite: 'lax'`, `secure` in production, `path: '/register'`, `maxAge: 600`), then `redirect('/register')`.
  - `DemoButtons`' Nur button posts here.
- **Help, in both languages:**
  - The FAQ "Why can't I post yet?" becomes "How do I join Serumpun?": take your IC and your house title or tenancy agreement to the office; get a code; tap Register with a code, confirm your phone and choose a PIN.
  - The terms' account section describes the counter check and the code.
  - "Keep your password" becomes "keep your PIN".
- **Smoke:**
  - sign in only Aisyah and Daniel;
  - drop "— pending users" (stage 5 adds checks for someone whose access ended);
  - add "— getting onto a card", with three checks:
    - `Nobody reads the codes`: Daniel's `code_hash` select is refused;
    - `A resident cannot give an office code`: `not_management`;
    - `Only the server registers people`: Daniel's `complete_registration` is refused.
- **`docs/SYSTEM.md`:**
  - **§2:** the Register, Sign in and Household rows, and Give code in Units; the dashboard row drops "residents to approve".
  - **§3:** the roles without pending.
  - **§4:** the `app/(auth)` row.
  - **§5:** `card_codes`, `sms_checks` and key states.
  - **§6:** phone sign-in and the move proof.
  - **§10:**
    - Try registering (Nur) and her number;
    - each new private window is a new phone;
    - two visitors registering Nur at once cancel each other's code;
    - Try as Aisyah removes invites and the people they brought in.
  - **§13:**
    - the SMS code shows on screen, so the PIN is sign-in's secret;
    - a move doesn't sign the old phone out;
    - offline readers stop a moved phone within 24 hours;
    - someone alone on a card who loses their phone waits for stage 5;
    - "stage 2 of 6".

- [ ] **Step 1: Write the failing tests.**

In `tests/card-seed.test.ts`, *leaves Nur's unit and ten more without a card* uses `DEMO_REGISTER.label`. Add:

```ts
it("keeps Nur's home on record with her made-up number, and labels phones by the name people go by", () => {
  expect(units.find((u) => u.label === DEMO_REGISTER.label)).toMatchObject({ record_name: 'Nur Iman', record_tenure: 'owner', record_phone: '+60100000025', lease_end: null });
  const label = (who: string) => phones.find((p) => p.user_id === who)!.label;
  expect([label('weiMing'), label('farah'), label('meiLing')]).toEqual(["Wei Ming's phone", "Farah's phone", "Mei Ling's phone"]);
});
```

`tests/auth-actions.test.ts` mocks `next/headers` (a `set` spy) and `restartDemoRegistration`. The other-accounts loop becomes `['daniel', 'office']`. Add:

```ts
it("starts Nur's registration over and opens Register with the code in a cookie, never in the URL", async () => {
  h.restart.mockResolvedValue('K7Q4M29X');
  await expect(tryRegistering()).rejects.toThrow('NEXT_REDIRECT /register');
  expect(h.cookieSet).toHaveBeenCalledWith(REGISTER_CODE_COOKIE, 'K7Q4M29X', expect.objectContaining({ httpOnly: true, path: '/register', maxAge: 600 }));
});
it('says the demo did not work, and logs why, when the restart fails', async () => {
  h.restart.mockRejectedValueOnce(new Error('units: boom'));
  expect(await tryRegistering()).toEqual({ error: 'landing.demo.error' });
  expect(console.error).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run them to watch them fail.**

Run: `npx vitest run tests/card-seed.test.ts tests/auth-actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** Don't run smoke: it resets the live demo (Task 9).

- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`.

Expected: all pass, with no build warnings.

- [ ] **Step 5: Check it in the browser**
1. Try registering (Nur). Expected: the code is filled in, and finishing shows No. 25 at "1 of 4".
2. Tap it again in a second browser. Expected: the first Nur's sign-in answers "The phone number or PIN is wrong.", and the new registration works.
3. As Aisyah, invite and register Adam, then press Try as Aisyah again. Expected: No. 18 is at "3 of 4" with no invites, and Adam no longer signs in.
4. Help › FAQ has the new question in both languages.
5. Delete the registered Nur and her home's card, by id.

- [ ] **Step 6: Commit**

```bash
git add lib/seed/people.ts lib/seed/cards.ts "app/(auth)/actions.ts" "app/(auth)/forms.tsx" lib/content/help.ts scripts/smoke.ts docs/SYSTEM.md lib/i18n/en.ts lib/i18n/ms.ts tests/card-seed.test.ts tests/auth-actions.test.ts
git commit -m "feat(card): Try registering (Nur), No. 18's restore, help, smoke checks and docs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Ship stage 2 (stops for the user's OK)

**Files:** none until step 5, which adds `supabase/migrations/0025a_after_stage_2.sql`.

- [ ] **Step 1: Back up the branch.** The repo is public, so first grep `git diff 6c2f7ef..HEAD` for:
- `eyJ` and `sk_`;
- service-role key values;
- passwords;
- phone numbers other than the made-up `+60100000…`/`010-000 …` ones and the tests' format samples.

Expected: no hits. Then run `git push origin feat/serumpun-mvp`.

- [ ] **Step 2: STOP and ask the user** in one message:

> "Stage 2 is ready. May I deploy it to production, then reset the live demo (`npm run db:seed`) and run `npm run smoke`? No new env var is needed."

Go on only after an explicit yes.

- [ ] **Step 3: On yes, in order:**
1. `vercel deploy --prod --yes`.
2. `npm run db:seed`. Expected:
   - `people: 0 created, 17 already there, N visitor accounts deleted`, where N ≥ 1 (the old Nur);
   - `cards: 25 units, 14 cards, 16 people on cards, 16 phones, 1 code given, PINs set`.
3. `npm run smoke`. Expected: all pass, including the 3 new checks.

- [ ] **Step 4: Check the live site over HTTP**, public pages only. Expected:
- `/` has "Register with a code" and no "Create an account";
- `/register` and `/sign-in` answer 200;
- `/signup` answers 404;
- `/reader` has "Hold your iPhone near the reader".

Leave Try registering (Nur), and one green Pool tap, to the user in a browser.

- [ ] **Step 5: Ask, as a separate question:**

> "The live app no longer approves or rejects sign-ups. May I drop `set_resident_status` and make `verified` the default status?"

On yes:
1. Write `0025a_after_stage_2.sql`: `drop function public.set_resident_status(uuid, text);`, then `alter table public.profiles alter column status set default 'verified';`, then `notify pgrst, 'reload schema';`.
2. Apply it with `npm run db:migrate`, and commit it.

It's written only now, so no earlier migrate can apply it while the old app still calls the function.

- [ ] **Step 6: Ask before moving GitHub `main`** to the branch. It's a separate question, and nothing happens without a yes.
