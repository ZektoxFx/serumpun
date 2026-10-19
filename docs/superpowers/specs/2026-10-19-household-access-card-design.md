# Household access card — design

A digital access card for each household: the office activates it at the counter, an Owner and a Co-owner run it with
checks and balances, and it opens the township's facilities like an Apple Wallet pass, even when the reader is offline.
Agreed in the brainstorm of 19 Oct 2026 from a groupmate's spec (Phases 1–8, pasted 19 Oct) and her revised demo plan
("demo it with the Apple Pay concept, not QR scanning"). Four mockups were approved: `tap-demo.html`,
`household.html`, `activation-guests.html` and `office.html`, all git-ignored in
`.superpowers/brainstorm/838-1792345647/content/`. "My call" marks a decision the user did not make; everything else
they chose, or it comes from the groupmate's spec. Section 12 lists every call in one place.

## 1. Why

Serumpun today: anyone signs up with an email, a password and a typed unit number, and the Management Office approves
or rejects them (Dashboard › Residents). "Household" only means "people who typed the same unit number", used for the
2-hours-a-day facility booking limit. There is no card, no Owner or Co-owner, and no reader.

What this adds, and why:

- **Activation by the office.** A resident shows their IC and house title or tenancy agreement at the counter and gets
  a one-time code, so only real residents get in. In the user's words: "more secured plus urusan movein pun memang perlu
  pergi office first". This replaces self sign-up.
- **Checks and balances.** One card per household, run by an **Owner** and a **Co-owner**. Neither can remove the
  other, and adults are added or removed only when both agree. No single person can silently lock another adult out:
  the divorce and family-conflict problem the groupmate designed for.
- **A tap, like Apple Pay.** A Wallet-style card that pops up after the 6-digit PIN, a reader that shows a big green
  tick or a red reason, and readers that keep working with the Wi-Fi off. It never shows a name.
- **Guest passes, bookings as entry tickets, an access history by unit, PDPA-minded logs** (visits deleted after 90
  days; the office reads them only for an incident, and the household is told).

The proposal (pitch deck, 5-minute demo video, prototype link) is due **23 Oct 2026, 11:59 pm**; the final submission
is 11 Nov and the pitch 14 Nov. The card speaks to *Innovation & Differentiation* (20%) and *Feasibility* (20%). The
organiser's own example idea is "one resident hub", so the card is a clear difference.

**Success** (in the video and the pitch):

1. The office gives a code at the counter. A resident registers with it (the SMS code shows on screen, then a PIN), and
   the Wallet-style card appears in Me.
2. On the demo laptop the resident opens the card with the PIN, then drags it onto the reader or presses Tap. The phone
   buzzes, and the reader shows a green tick and "Access granted · Pool".
3. The office suspends the card: the next tap is red, "Card suspended". Lifting the suspension turns it green again.
4. With the Wi-Fi off, the reader still accepts a valid card.
5. The household page shows the two-person rule (an adult waiting for the Co-owner's answer, going to the office after
   48 hours) and restricted mode.

## 2. What the user decided

1. **Everything** in the groupmate's spec, as changed by her revised demo plan ("she want everything").
2. **The office code replaces self sign-up.** "Create account" without a code goes, and "waiting for approval" and
   "rejected applicant" go with it.
3. **One card per household, up to 4 phones:** the Owner's phone first, then 3 more. A 5th phone needs another card
   from the office.
4. **Landed houses only, no lift.**
5. **Tenants:** the landlord asks the office, which suspends the tenant's card and logs the reason. No landlord
   accounts.
6. **Emergency alerts stay exactly as they are.** Neighbours within 2 km see where and what, never who; the office sees
   who.
7. **The revised demo plan:**
   - The card looks like an Apple Wallet pass, with the township design and the unit number, in Me, with an "Add to
     Apple Wallet" button. Its "no unlock, like Express Mode" was later changed by the team (item 15).
   - A Reader page on a laptop looks like a tap reader: a glowing contactless mark and "Hold your iPhone near the
     reader". The tap is simulated by dragging the card onto the reader or pressing Tap on the phone mockup. The phone
     buzzes and shows a tick.
   - The reader shows a big green "Access granted · <place>", or a red "Not allowed" with the reason. It never shows a
     name; it only checks that the card is valid and allowed at that place. **The visit log records the unit, not a
     person.**
   - Readers: **Facilities, Gym and Pool**, each with its own permission.
   - Offline: the household card's signed credential and expiry are enough, and readers store no individual phone
     keys.
   - A lost phone can be switched off from another device. Suspended or expired cards get the red result.
   - A dynamic QR stays as a small fallback; the main flow is the tap.
8. **Places are per household card**, not per person: everyone on No. 18's card gets the same places. "Child" only
   means they can't manage anyone.
9. **The Owner and Co-owner switch places on and off** for their own card, in Me. The office doesn't.
10. **The granted result is just a big green tick**, with no door icon.
11. **The four mockups are approved**, with the corrections in section 13.
12. **A suspension stops only the card:** readers, new bookings and new guest passes. The map, the emergency button,
    reports, chat and messages keep working, because the person still lives there. **When a lease ends or someone is
    removed** from the card, they have moved out: the township part of the app closes for them, leaving a screen with
    the reason, and someone who was removed also gets an Appeal button.
13. **A plastic card for children without phones** is in (part of "everything").
14. **Six stages, built in the order of section 11.** Whatever is done by 23 Oct goes in the video; the rest follows
    before 11 Nov.
15. **The card opens with the PIN** (the team's change after the walkthrough, 19 Oct). Choosing the card in Me asks for
    the 6-digit PIN; then the card pops up, ready to hold near a reader.
16. **A guest pass QR stays the same until the end time the host set** (the team's change after the walkthrough, 19
    Oct). It no longer changes every 30 seconds.

## 3. Goals, non-goals, anti-goals

**Goals**

1. A judge on the live demo gets a green tick without any setup, and can reach each red reason.
2. Every rule in section 5 is enforced in the database (row-level security and RPCs), not only hidden in the UI.
3. The household sees every change, who made it and why. The office deals only with activation, escalations, disputes,
   appeals, IC checks, recovery, transfers, extra and plastic cards, and suspensions.

**Non-goals**

- Real NFC, Bluetooth or Apple Wallet. "Add to Apple Wallet" is a look-alike: a real pass needs a paid Apple Developer
  account, and passes that open doors need Apple's approval, which only big partners get. The button opens a short
  sheet saying so (my call).
- Lifts, the main gate, the clubhouse door (my call, shown in the mockups without objection).
- Real SMS. The SMS code is shown on screen in the demo; there is no SMS provider.
- Blocking screenshots, or rooted and jailbroken phones: a web app can't. Instead, every tap is signed by the phone's
  own key and the resident's fallback QR changes every 30 seconds, so a screenshot or a copied card is useless. A guest
  pass QR is the exception: it stays the same until its end time (section 7.4).
- Landlord accounts, per-person places, and IC photo uploads in the app: the IC is always checked at the counter (my
  call; the spec allowed "ID check or app-based verification").
- Any change to the emergency alert.

**Anti-goals** (a failure even if it works)

- A reader, the visit log, or any office view of taps shows a person's name.
- One person removes or locks out another adult, or the Owner or Co-owner removes or restricts the other. This
  includes one person approving their own request from a second phone: an approval must come from the other person's
  account.
- The office reads a household's access history without a written incident reason that the household then sees.
- A reader that is online opens for a suspended card, an ended card or a frozen phone.
- One demo visitor breaks the demo for the next in a way that "Reset demo" can't put back.

## 4. Constraints

- **Stack.** Next.js 16 App Router: read the relevant guide in `node_modules/next/dist/docs/` before writing code
  (AGENTS.md). Supabase with the access model of `supabase/migrations/0001_core.sql`:
  - RLS is on for every table, and every policy is `to authenticated`.
  - Column grants decide which columns can be written.
  - Security-definer functions pin `search_path = ''`, lose EXECUTE for public, anon and authenticated, and get it back
    only where the app calls them.

  New migrations follow `0023_…`. All times are Malaysia time (the helpers in `lib/domain/time.ts`).
- **Privacy rules that exist today:** unit numbers and phone numbers are seen only by the office (`profile_private`);
  neighbours see name and neighbourhood.
- **Languages and look.** Every new string in English and Malay (`lib/i18n/en.ts`, `ms.ts`). Icons through `Glyph` and
  `Icon` (the team's line icons). Never colour alone: red and green results also carry ✕ or ✓ and words.
- **Vercel Hobby: one daily cron** (`/api/cron/reminders`, 00:00 UTC, which is 8 am in Malaysia). New daily jobs (lease
  reminders, deleting old visits) join that route. Anything "after 48 hours" is worked out when it is read, not by a
  timer (my call).
- **The live demo is shared:** anyone can use the demo buttons, including the office's. "Reset demo" must restore every
  card state and wipe what visitors made (codes, cards, accounts), as it already wipes visitor sign-ups.
- **Secrets.** The card signing key lives in env (`.env.local` and Vercel), and is never committed or printed.
- **Dependencies.** QR codes are drawn with the installed `qrcode`. Webcam QR scanning and passkeys (stage 6) may each
  need one library; the builder picks it.
- **Process.** Production deploys and moving GitHub `main` need the user's OK each time; only `feat/serumpun-mvp` is
  pushed. Shipping a stage means reseeding the shared live demo (`npm run db:seed`, then `npm run smoke`), which also
  needs the user's OK first.

## 5. Roles and rules

| Role | Who | Notes |
|---|---|---|
| Owner | The verified owner or tenant on the office's record | Becomes Owner by registering with the office code |
| Co-owner | The spouse, or another adult the Owner invites | Accepts by registering. Counts as an Adult until the office checks their IC once. At most one per card (my call) |
| Adult | Other adults in the household | Their own phone |
| Child | Children and dependents | Can't manage anyone |

"Both" below means the Owner and the Co-owner. While there is no Co-owner, or the Co-owner's IC isn't checked yet, the
Owner alone decides everything "both" would. **Every change in this table needs the PIN** (or Face ID, from stage 6).

| Change | Who | Rule |
|---|---|---|
| Add a child | Owner or Co-owner, alone | The invite code appears at once |
| Add an adult | Both | The other agrees first; only then does the code appear (my call). No answer in 48 h → the office decides |
| Invite a Co-owner (none yet) | Owner | They register with the code; then the office checks their IC once |
| Remove a child | Owner or Co-owner, alone | |
| Remove an adult | Both | No answer in 48 h → the office decides. The removed person can appeal |
| Remove or restrict the Owner or Co-owner | Only the office, after a review | |
| Switch a place on | Owner or Co-owner, alone | |
| Switch a place off | Both | No answer in 48 h → the office decides |
| Freeze a lost phone or a plastic card | Owner or Co-owner, alone, from any phone. Anyone can freeze their own phone | Instant, even in restricted mode |
| Unfreeze | Owner or Co-owner, alone (my call) | |
| Make a guest pass | Owner, Co-owner or an Adult (my call) | At most 3 active per card |
| Cancel a guest pass | Whoever made it, the Owner or the Co-owner (my call) | |
| Report a dispute | Owner or Co-owner | Restricted mode starts at once |
| Appeal | Someone removed, or anyone on the card about a change to their access | The office decides |

- **Waiting requests** show on both phones ("Waiting for Hakim · goes to the office in 31 h"). After 48 hours without
  an answer they move to the office's Needs you list. The office approves or declines with a reason, and everyone
  involved is told. They never pass on their own. The 48-hour rule comes from the spec for removing adults; using it
  for adding adults and switching places off too is my call.
- **Everyone on the card** sees the card, its access history (by unit, no names) and the changes log (with names,
  because it records who did what) (my call).
- **One of each** (my calls):
  - one phone per person, one card per person, and one account per phone number;
  - a child with a plastic card is listed on the card without an account;
  - all three places are on when a card starts.
- **Records.** The changes log is kept as long as the card exists; only visits are deleted after 90 days (my call).
- **Notifications.** Every change notifies the Owner, the Co-owner and the person affected, through the existing in-app
  bell and push. It also goes into the changes log, which nobody can edit or delete (append-only, enforced in the
  database).
- **PIN.** 6 digits. It opens the card (section 7.2) and confirms every change. 5 wrong tries lock it for 15 minutes
  and tell the Owner and the Co-owner (my call on the numbers).
- **Restricted mode** (a dispute is open):
  - Access that already exists keeps working.
  - Nobody can add or remove people or phones, change roles, switch places, or make new guest passes. Passes made
    earlier run until they end.
  - Freeze still works.
  - The office replies within 5 working days.

  The guest-pass rule and the 5 days are my calls.
- **Who sees a dispute or an appeal** (my call, for safety in a separation):
  - Only the person who opened it and the office see its text, its photos and who sent it.
  - The others on the card see only that the office is reviewing a dispute.
  - The notification and the changes-log entry don't name the sender.
  - The office's decision is told to the Owner and the Co-owner.
  - Appeals work the same way: only the person appealing and the office see the details.

## 6. Places, readers and the pass

**Places**, switched on and off per card:

- **Facilities**: the courts, the hall, the BBQ pit and the function room. They open only with the household's booking
  for that place at that hour.
- **Gym**: the Clubhouse Gym, which is already bookable, also needs a booking at that hour. The spec says "book a gym or
  court slot, and the card becomes the entry ticket for that slot".
- **Pool**: a new walk-in place, with no booking. It is a place, not a bookable facility.
- People who joined a game on someone else's court booking (Find players) also get in at that court and hour (my
  call).

**Reader results.**

- **Green:** a big tick drawing itself and "Access granted · <place>", for example "Badminton Court 2". A guest's tap
  adds "Guest pass".
- **Red:** ✕, "Not allowed" and one reason: card suspended · lease ended · phone switched off · <place> is switched off
  for this card · no booking at this time · pass expired · guest pass not for this place or time.
- Never a name.
- The phone mockup buzzes, using `navigator.vibrate` where it exists (iPhones ignore it) plus a shake animation, and
  shows ✓ or ✕.

**The visit log** keeps the unit, the place, the time, the result and the reason. It never records the person or the
phone. Visits are deleted after 90 days, by the daily cron.

**How it stays safe offline.** The user fixed only "a signed credential and an expiry, no individual phone keys
stored"; the design below is my call.

- **Township signing key.** The server holds it (env). Readers download its public key and keep it.
- **Phone keys.** At registration each phone makes its own key pair in the browser (WebCrypto, with a private key that
  can't be exported, kept in IndexedDB) and sends the public key. This is what "bound to this phone" means.
- **The pass.** Each phone holds one: card, unit label, slot, the phone's public key, places, card state and expiry,
  signed with the township key. A pass is valid for 24 hours and is renewed whenever the app is open and online.
- **A tap, or the QR,** is the pass plus a short note signed by the phone's key: place, time and a random number. The
  reader:
  - checks the township's signature, then the phone's signature with the key inside the pass;
  - checks the note is fresh (about 30 seconds) and hasn't been used before.

  So readers store no phone keys, and a copied pass or a screenshot of the QR doesn't work.
- **Online, the server decides.** The reader sends the tap to the server, which checks the signatures and then the
  live state: the card, the phone, the places, the booking and any guest pass. So a suspension, a freeze or a place
  switched off takes effect at once.
- **Offline, the reader decides** from the pass alone. It checks:
  - the signatures, the freshness of the note and the pass's expiry;
  - the places inside the pass;
  - the last copies it kept of the stop list (frozen phones, suspended and ended cards) and of the bookings.

  A change made after the reader went offline reaches it at the next sync, or when that pass expires (within 24
  hours). The dashboard says so next to an offline reader.
- **Offline visits** are queued on the reader and sent when it's back online. The server checks the signatures again
  before saving them.
- **Bookings at an offline reader.** The builder chooses how: sync the place's bookings to the reader, or put the
  card's next 24 hours of bookings in the pass. Either way, a booking made before the reader went offline must work.
- **The plastic card** has no key of its own. Its pass lasts until the lease end, or a year, and is stopped through the
  stop list (my call).
- **The reader screen** has a Wi-Fi switch for the demo that makes it act offline. It also keeps working when the
  laptop's Wi-Fi is really turned off after the page has loaded.

## 7. The resident's screens

### 7.1 Landing, Register and Sign in (stage 2)

- **The landing page** shows **Register with a code** and **Sign in**. The demo buttons stay (section 9). The sign-up
  form and `/signup` go.
- **One Register box** takes both an office code and a family invite code (my call). A code is 8 characters, such as
  K7Q4-M29X. It works once and lasts 3 days, and a new code cancels the old one (my call).
- **With an office code:**
  1. "Is this your home?": the unit, the name on the record, Owner or Tenant, and when the office checked them. Tenants
     also see their lease end date.
  2. The phone number from the record, and a 6-digit SMS code. The demo shows "Demo: no SMS is sent. Your code is 482
     913".
  3. Choose a 6-digit PIN, with "Use Face ID too" from stage 6.
  4. "Your card is ready": bound to this phone, 1 of 4 phones.
  5. "Add a Co-owner?" Choosing Later brings a reminder after 3 days (my call).

  The profile's name and neighbourhood come from the office's record.
- **With a family code:** the same steps, but the person types their own phone number. They join with the name and role
  the invite set.
- **Sign in** (on a new phone, or after signing out): phone number, SMS code, PIN.
  - The old phone asks "Move the card to your new phone?". Yes stops the old phone at once.
  - If the old phone is lost, the other of the Owner and Co-owner approves the move. Someone alone on the card goes to
    the office for a recovery code.
  - Office staff keep signing in with email and password (my call).
- **Accounts.** Residents no longer have an email or password. Suggested, for the builder to confirm: create the
  Supabase user with an internal made-up email and a password nobody knows. After the SMS code and PIN check, start the
  session on the server, for example with `auth.admin.generateLink` and `verifyOtp` with the token hash. SMS codes and
  PINs are stored only hashed, with an expiry and a try limit.

### 7.2 Me › the card (stage 1)

- **Opening the card** (the team's change). Choosing the card in Me asks for the 6-digit PIN; then the card pops up,
  ready to hold near a reader.
  - It locks again when the person leaves it, or after 60 seconds without a tap. That's my call; the groupmate's
    Phase 4 also had it "auto-lock after a short idle time".
  - Face ID can stand in for the PIN from stage 6.
  - Wrong PINs count toward the lockout in section 5.
- **The card** sits at the top of Me, Wallet-style:
  - the Serumpun gradient, "HOUSEHOLD CARD", "No. 18" and the street and township;
  - PLACES and PHONES fields and a contactless mark;
  - no names.
- **Under the open card:** **Add to Apple Wallet (demo)** (the look-alike sheet), **Show QR instead** (the 30-second QR) and
  **Household ›**. The **Tap** button lives on the phone mockup on the reader screen (section 9). A real phone has no
  reader to tap, so its Me shows "Hold near a reader" instead (my call).
- **A frozen phone, a suspended card or an ended card** shows that state on the card itself (my call).

### 7.3 Me › Household (stage 3)

As in `household.html`:

- **People on the card:** roles, "3 of 4 phones", "+ Invite someone" and the rules in one line.
- **Waiting for approval**, with the 48-hour countdown.
- **Places**, with switches and who switched them.
- **Phones**, each with Freeze.
- **Guest passes**, for example "1 of 3 active".
- **Access history** for this card: no names, refused taps included.
- **The changes log**, which nobody can edit.
- "Report a dispute to the office ›".

In restricted mode the page shows the banner, everything except Freeze is locked, and the report's state is visible.
Adults and children see the same page without the controls they can't use (my call).

### 7.4 Guest passes (stage 4)

- **New guest pass:**
  - the guest's first name, which only the household sees;
  - the place: either the Pool with a time window (today or a chosen day, up to the end of that day; my call), or
    **from a booking**, which is that Facilities place or the Gym at that booking's time only;
  - the PIN.

  Only places switched on for the card can be chosen, and at most 3 passes are active at once.
- **Sending it:** a link (share to WhatsApp) and a QR. The guest needs no app. The link page shows "Guest pass · <place>
  · <time> · Guest of No. 18" and a QR that stays the same until the end time the host set (the team's change). The
  server signs it, so the reader checks it offline too, and the guest's phone needs no internet once the page has
  loaded. Because it doesn't change, a screenshot of it also works until the end time.
- **When it's used**, the host is told ("Mei Ling's pass was used · Pool · 6:12 pm"). The pass ends by itself, and the
  host can cancel it. Switching the place off stops its passes (my call). A pass works for any number of taps within its
  time, and the host is told on the first one. When the host's card is suspended or ended, its passes stop too (my
  calls).
- **On the demo laptop** the phone mockup can open a guest pass, so it's dragged onto the reader like the card.

### 7.5 Suspended, ended or removed

- **Suspended:** the card shows "Suspended · <the office's reason>". Everything else in the app works. New bookings and
  new guest passes are refused.
- **Lease ended, or removed:** the township part of the app closes. Reuse the fail-closed `my_township()` rule that
  locks out rejected applicants today. One screen says why, such as "Your lease ended on 26 Oct" or "Kumar and Devi
  removed you on 16 Oct". Someone who was removed also gets **Appeal**. Their old posts stay (my call).
- **Lease reminders** go out 30 and 7 days before the end date, to everyone on the card (my call). The card stops at
  the end of the last day.

## 8. The office's screens: Dashboard › Units (replaces Residents)

As in `office.html`:

- **Needs you**, counted on the nav badge:
  - **No answer in 48 hours:** approve or decline, with a reason.
  - **Disputes in restricted mode,** with the date the reply is due. The outcomes are: end restricted mode with no
    change; give the Owner or Co-owner role to the unit's verified owner; or change the Co-owner.
  - **Appeals:** keep or reverse.
  - **Co-owner IC checks:** "IC checked" makes them Co-owner; "Doesn't match" doesn't.
  - **Coming up:** leases ending within 30 days, extended when the office sees a new tenancy.
- **All units:** every unit in the office's records, searchable by unit or name, each with its state: not registered ·
  code given (and until when) · active (phones used) · restricted · suspended (and why) · ended.
- **Give a code at the counter:**
  1. Pick the unit and show its record: name, Owner or Tenant, and phone, all editable.
  2. Tick "IC matches the record" and "House title or SPA / tenancy agreement seen".
  3. Enter the lease end date (tenants only).
  4. Show the code and a printed slip.

  If the unit already has an active card (someone new is moving in), giving a code warns that the current card ends
  when the new Owner registers (my call).
- **One unit's page:**
  - the card's state, its places, the people with their roles and IC-check dates, and the phones;
  - the changes log, read only.

  Office-only buttons:
  - **Suspend card…** (a reason is required, and the household sees it) and **Lift**.
  - **Extra card (+4 phones):** the same household, Owner, Co-owner and places (my call).
  - **Plastic card:** for a child without a phone. It takes one of the 4 slots (my call).
  - **Recovery code:** after an IC check, it puts an Owner or Co-owner who lost every phone back in their role on a new
    phone.
  - **Change Owner or Co-owner:** only after a review (moving out, a death or a dispute).

  **The access history is hidden.** "Open for an incident…" needs a written reason, such as a report number. It then
  shows the card's visits, the household is told who looked, when and why, and every lookup is logged (my call on
  telling the household).
- **Readers:** each place's reader, online or offline, with its last sync, and "Open reader screen".
- **The unit list is seeded.** There's no import screen, and a record can be edited when giving a code (my call).

## 9. The demo

- **The reader screen** is a public page; no sign-in needed. It opens from Dashboard › Units › Readers or directly, and
  has:
  - the place picker: Facilities (then which court, the hall, the BBQ pit or the room), Gym or Pool;
  - the glowing contactless mark and "Hold your iPhone near the reader";
  - the Wi-Fi switch;
  - a **phone mockup** beside it, holding the card of the resident signed in on that browser. That browser is "the
    phone" (my call).

  Enter the PIN on the phone mockup to open the card, then drag it onto the reader or press Tap. With nobody signed in,
  the mockup offers the demo sign-in.
- **The QR fallback:** "Show QR instead" works on a real phone. Scanning it with the laptop's webcam comes in stage 6.
- **Demo accounts** (my calls):
  - **Aisyah** stays: Owner of No. 18, with a Co-owner and a child on her card.
  - **No. 18's Co-owner becomes a demo account**, so the two-person approvals can be shown with a second phone or
    browser. The mockups call him Hakim, but "Ahmad Hakim" already lives at No. 31, so the seed needs a name that
    doesn't clash.
  - **Nur** changes from "waiting for approval" to **"Try registering (Nur)"**. It gives her unit a fresh demo code and
    opens Register with the code filled in. Each tap starts her registration over.
  - **The office** stays.
- **Shared demo accounts** (my calls): many visitors sign in as Aisyah at once. Each browser still makes its own key,
  but for a demo account it joins that person's seeded phone slot instead of taking a new one, so the card keeps
  showing 3 of 4 phones and visitors don't lock each other out. The PIN prompt shows the demo PIN, and a PIN lockout
  only affects that browser. As today, "Reset demo" undoes what visitors changed.
- **The seed, restored by Reset demo:**
  - units for every seeded person, plus some that aren't registered;
  - Aisyah's card with the Co-owner and a child, the Pool on, and an adult waiting for approval;
  - the dashboard cases from `office.html`: a 48-hour request, a dispute in restricted mode, an appeal, a Co-owner IC
    check, a lease ending within 30 days, a suspended tenant card (a background resident), a code given, and units not
    registered;
  - a few visits and changes-log entries.

  Today's seeded people stay, and every seeded resident is on a card (most as the Owner of their own), so nobody
  loses township access. Names in the mockups are only illustrations.
- **Two browsers in the video:** one browser holds one account. Suspending a card while the laptop shows Aisyah's card
  at the reader needs the office signed in on a second browser, or on the phone.
- **Green without setup:** a judge must get a green tick without any setup, for example Aisyah's card at the Pool. They
  must also be able to reach each red reason: a suspended card, a place switched off, no booking, a frozen phone.

## 10. What changes in today's app

- **Landing and sign-in** (section 7.1): `/signup` goes, and so do the pending state and its banners and checks.
  `/rejected` becomes the "access ended" screen.
- **`profiles.status` and `my_township()`:** the builder decides how to map the new states. A likely way is to keep the
  fail-closed rule, so that township access needs an active or suspended card, or office staff.
- **Booking:** the 2-hours-a-day limit counts the household card (today it matches the typed unit text). A booking
  confirmation says the card opens that place at that time. Places that show a unit today keep working, such as the
  office's emergency banner.
- **Me:** the card and Household ›.
- **Dashboard:** Residents becomes Units, and the badge counts Needs you.
- **Help & policies:** "Your privacy" says what the card collects and why. That covers visits by unit, kept 90 days;
  the phones on the card; guests' first names; the changes log; and incident lookups, which the household is told
  about. This is the spec's "users are told clearly what data is collected and why".
- **`npm run smoke`:**
  - The "Nur (pending) cannot …" checks become checks for someone whose access ended.
  - New card checks:
    - an online reader refuses a suspended card and a frozen phone;
    - one person can't approve their own adult request;
    - the office can't read visits without an incident reason;
    - someone not on the card can't read its visits or log.
- **Docs, `docs/SYSTEM.md`:**
  - §2 the demo script;
  - §3 roles and verification;
  - §5 the data model;
  - §6 security;
  - §10 demo accounts;
  - §13 known limits: no real NFC, Wallet or SMS; screenshots and rooted phones can't be blocked; iPhones don't
    vibrate.

## 11. Build order (the user's choice)

Each stage works on its own and can be shown. Whatever is done by 23 Oct goes in the video; the rest follows before
11 Nov.

1. **The tap.**
   - Units, cards, slots and passes, seeded; signing and renewal.
   - The card in Me, opened with the PIN, with the lockout after 5 wrong tries.
   - The reader screen: the place picker, the booking check, green or red, the buzz and tick, the Wi-Fi-off check and
     the offline queue.
   - The visit log and the stop list.
   - Dashboard › Units with Suspend and Lift.
2. **Getting onto the card.**
   - Codes at the counter.
   - Register: code, SMS code on screen, PIN.
   - Family invites, and sign-in with phone and PIN.
   - Moving to a new phone.
   - Self sign-up removed.
3. **Running the household.**
   - The household page.
   - Two-person approvals, handed to the office after 48 hours.
   - Places on and off; Freeze and unfreeze.
   - The changes log and the access history.
   - Notifications.
4. **Guests and bookings.**
   - Guest passes: the link page, the QR that works until the end time, the cap, the host told, passes from a booking.
   - Players who joined a game get in.
5. **When things go wrong.**
   - Disputes and restricted mode; appeals.
   - Recovery codes; changing the Owner or Co-owner; extra cards.
   - Lease reminders and the lease end; the access-ended screen.
   - Incident lookups; deleting visits after 90 days.
6. **Extras.**
   - Face ID through passkeys, optional on top of the PIN.
   - The plastic card.
   - Scanning a real phone's QR with the laptop's webcam.

## 12. My calls (for the user to check)

1. **Readers:** the main gate and the clubhouse door are dropped.
2. **Codes:** 8 characters; they work once and last 3 days; a new code cancels the old one. One Register box takes both
   office and family codes.
3. **PIN:** 6 digits. 5 wrong tries lock it for 15 minutes, and the Owner and Co-owner are told.
4. **Co-owner:**
   - a reminder 3 days after the Owner skips adding one;
   - at most one per card;
   - counts as an Adult until the IC check, which is done at the counter only.
5. **48 hours:** the rule also covers adding an adult and switching a place off, and it's worked out when read, not by
   a timer.
6. **Adult invites:** the code only appears after the other approver agrees.
7. **Freezing:** the Owner or Co-owner alone can unfreeze, and anyone can freeze their own phone.
8. **Guest passes:**
   - the Owner, the Co-owner or an Adult can make one;
   - at most 3 active;
   - the Pool by time window, up to the end of the day; bookable places only from a booking;
   - switching a place off stops its passes;
   - in restricted mode no new ones can be made.
9. **Disputes:** the office replies within 5 working days.
10. **What everyone on the card sees:** the card, the access history (no names) and the changes log (with names).
11. **Leases and removal:** lease reminders 30 and 7 days before the end, to everyone on the card. Removed people's old
    posts stay.
12. **The offline design** in section 6: phone keys in the browser, renewing the pass, the stop list, the offline queue,
    and the longer pass for the plastic card.
13. **Office cards:** an extra card adds 4 phones to the same household; a plastic card takes one slot; the unit list
    is seeded.
14. **Incident lookups:** the household is told when the office opens its access history.
15. **Signing in:** office staff keep email and password; residents use phone, SMS code and PIN.
16. **Demo setup:**
    - the public reader page, with the signed-in browser as "the phone";
    - a Co-owner demo account;
    - Nur becomes "Try registering";
    - demo browsers share their seeded phone slot, and the demo PIN is shown;
    - a background resident is the suspended tenant.
17. **Find players:** people who joined a game on a court booking get in.
18. **The card in Me:**
    - after the PIN it stays open until the person leaves it, or for 60 seconds without a tap;
    - a frozen, suspended or ended card shows that state;
    - "Add to Apple Wallet" opens a sheet saying it's a look-alike;
    - the Tap button is only on the reader's phone mockup.
19. **Readers:** online readers ask the server, so every change takes effect at once; only offline readers decide from
    the pass.
20. **One of each:** one phone per person, one card per person, one account per phone number. A plastic-card child is
    listed without an account. All places are on when a card starts.
21. **Keeping records:** the changes log is kept as long as the card exists.
22. **Guest pass use:** a pass works for any number of taps within its time, and the host is told on the first. A
    suspended or ended card's passes stop too.
23. **Disputes and appeals:** only the person who opened it and the office see the details. The rest of the card
    sees only that the office is reviewing a dispute.

## 13. Corrections to the mockups

- `household.html` shows a guest pass for the pool while the pool is switched off. A guest pass is only for a place the
  card opens.
- `household.html` and `activation-guests.html` show the Gym without "needs a booking". The Gym needs a booking at that
  hour (section 6), so a Gym guest pass comes from a gym booking.
- `tap-demo.html`'s granted result loses the door icon: just the tick.
- `tap-demo.html` shows Tap on the Me card. On a real phone, Me shows "Hold near a reader"; Tap is on the reader
  screen's phone mockup.
- `tap-demo.html` and `activation-guests.html` show "Express: no unlock needed". The card now asks for the PIN first
  (section 7.2).
- `activation-guests.html` says the guest's QR changes every 30 seconds. It now stays the same until the pass ends.

## 14. Left to the builder

- Table, column and RPC names.
- How the pass and the tap note are encoded (for example JWS with ES256, or compact JSON in base64url), and how much
  clock difference to allow.
- How readers fetch the public key.
- How SMS codes and PINs are hashed.
- How a phone sign-in starts a Supabase session.
- Realtime or polling, for the stop list and reader status.
- How the booking check works at an offline reader.
- The exact English and Malay copy, and the animations.
- How "Reset demo" rebuilds card states.
- The libraries for webcam QR and passkeys (stage 6).

## 15. Checked against the groupmate's spec

On 19 Oct every item in the groupmate's Phases 1–8 (Appendix A) and her revised demo plan (Appendix B) was checked
against this document. Each one is either covered, changed by a decision in section 2, or a non-goal in section 3.

- **Changed by decisions:**
  - the lift goes;
  - the tap replaces the QR as the main flow;
  - the card opens with the PIN, close to Phase 4's unlock;
  - places are per card;
  - Owner and Co-owner replace "Head of Household";
  - the access log is per unit, so it becomes "everyone on the card sees the card's history";
  - safety alerts stay as they are.
- **Non-goals:** blocking screenshots and rooted phones.

## Appendix A. The groupmate's spec, as pasted on 19 Oct

Verbatim, with its headings moved down one level. Section 2 overrides it where they differ.

### Phase 1: Card activation (management, one-time)
1. Management pre-loads the unit list and owner/tenant details into the system.
2. Resident visits the office with ID and proof of ownership or tenancy.
3. Management verifies and issues a **one-time activation code** (expires in a few days). For tenants, the lease end date is entered here.
4. A unit can have several cards, but only the ones needed now are activated. Activating an extra card later requires a new office visit.

### Phase 2: Account creation
1. Resident downloads the app and taps Register.
2. Enters the activation code, verifies by OTP, and sets a PIN.
3. The app generates a private key stored in the phone's secure hardware, so the card is **bound to this device**.
4. This person becomes the **Head of Household**, the verified owner or tenant, not just whoever registered first.
5. The digital card appears in the **Me** tab.

### Good call. With a single Head, one person holds all the power, which is exactly how the divorce or family-conflict problem starts. Here is the updated version with **Owner** and **Co-owner** and checks and balances. These replace Phase 3, the security rules, and the dispute handling in v2.

### Roles

| Role | Who | Notes |
|---|---|---|
| **Owner** | The verified owner or tenant (confirmed by management at activation) | Created automatically at registration |
| **Co-owner** | Spouse or another adult the Owner nominates | Must accept, and management verifies them once (ID check or app-based verification) |
| **Member (adult)** | Other adults in the household | Own phone, own profile |
| **Member (child)** | Children or dependents | Limited facility permissions, cannot manage anyone |

### Phase 3 (updated): Household members and devices
1. Owner goes to Me > Household > Invite Member and sets the name, role, and facility permissions.
2. The invited person joins using an invite code on their own phone (limit: 1 primary plus up to 3 linked devices per card).
3. **Adding a child member:** Owner or Co-owner can do it alone.
4. **Adding an adult member or a Co-owner:** needs approval from both Owner and Co-owner (once a Co-owner exists).
5. The Owner is encouraged to set up a Co-owner during onboarding, with a reminder if skipped.

### Removal and permission rules (the key change)
- **Neither Owner nor Co-owner can remove or restrict the other.** Only management can change these two roles, after review.
- **Removing a child member:** Owner or Co-owner can do it alone.
- **Removing an adult member:** needs approval from both the Owner and the Co-owner. If the Co-owner does not respond in 48 hours, the request goes to management instead of passing automatically.
- **Removing a member's access to a specific facility** (e.g. gym) follows the same rule as removing that member.
- **Every removal or permission change creates a notification** to Owner, Co-owner, and the affected member, plus an entry in an audit log that cannot be edited.
- **Members can see why access changed** and can appeal to management if they believe it was unfair.
- **Emergency exception:** either Owner or Co-owner can instantly freeze a *lost device* (not a person), since this protects security and doesn't remove anyone's rights.

### Security rules (updated)
- Sensitive actions (add or remove member, disable card, generate guest pass) need biometric or PIN, and for adult or Co-owner changes, the second approver's confirmation as well.
- Wrong PIN attempts trigger a temporary lockout and notify both Owner and Co-owner.
- Every device has its own key, so a lost phone is revoked individually.

### Edge cases (updated)
- **Dispute (e.g. divorce):** either party submits a report with evidence. The unit goes into **restricted mode** while management reviews: existing access continues, but no one can add or remove members or change roles. This prevents one side from locking the other out during the dispute. After review, management can reassign Owner or Co-owner to the verified owner of the unit.
- **Owner or Co-owner account lost:** recovery through management ID verification.
- **No Co-owner set (single resident):** the Owner has full control until a Co-owner is added. Adding one later needs management verification.
- **Owner dies or moves out:** management transfers the Owner role to the Co-owner or the new verified owner or tenant.
- **Tenant vs. property owner:** the property owner can suspend a tenant's card for lease violations, with the reason logged, so this power also has accountability.

### Why this is better
- No single person can silently remove another adult.
- Management is only involved in real disputes, not routine changes.
- Every change is visible and auditable, which also helps with PDPA accountability.

One trade-off to mention to your friends: requiring two approvals for adult changes adds a small step. That is intentional, and it keeps the routine case (adding or removing children) fast.

### Phase 4: Daily use
1. Open the app and go to **Me**.
2. Unlock the card with Face ID or fingerprint. The card auto-locks after a short idle time.
3. The app shows a **dynamic QR** (refreshes every 30 to 60 seconds, signed by the device key, single-use) or connects via BLE when near the reader.
4. **Lift:** the reader verifies the signature, then unlocks the resident's floor and common floors.
5. **Gym, pool, clubhouse:** the reader checks the profile's permission, opens the door, and logs the visit.
6. Readers verify signatures offline, so access still works without internet.
7. Screenshots are disabled on the card screen, and rooted or jailbroken devices are blocked.

### Phase 5: Extra features
- **Guest pass:** generate a temporary QR with limited facilities and duration. Capped number of active passes, the host is notified when it is used, and it expires automatically.
- **Booking link:** book a gym or court slot, and the card becomes the entry ticket for that slot.
- **Access log:** each member sees their own history, and the Head sees household history.

### Phase 6: Security rules
- Sensitive actions (add/remove member, disable card, create guest pass) always require biometric or PIN, even if the app is already unlocked.
- Wrong PIN attempts trigger a temporary lockout and notify the Head.
- Every device has its own key, so a lost phone can be revoked individually.

### Phase 7: Edge cases (self-service first)
- **Lost or stolen phone:** Head disables that device from another device or the web, instantly. Management is not needed.
- **New phone:** verify with OTP + PIN + confirmation from the old device if available. The old device is deactivated automatically.
- **Lease ends or tenant moves out:** access expires automatically, with reminders beforehand. The owner can also suspend or reassign a tenant's card.
- **Head account lost or unreachable:** recovery through management verification (ID check).
- **Dispute (e.g. divorce):** the other party submits a report with evidence. The card is **temporarily frozen or restricted** while management reviews it, following a defined timeline. Management can then reassign the Head role to the verified owner.
- **Children without phones:** a physical card remains available as a fallback.

### Phase 8: Privacy (PDPA)
- Members see their own logs, the Head sees household logs, and management sees logs only during an incident or investigation.
- Logs are kept for a fixed period (e.g. 90 days), then deleted.
- Users are told clearly what data is collected and why.
- Safety alerts show location only to the people the user has chosen, not to all neighbours.

### Management workload summary
| Management handles | Handled in the app |
|---|---|
| Initial card activation | Adding or removing members |
| Activating extra cards | Device changes |
| Disputes and ownership changes | Lost-phone disable |
| Head account recovery | Guest passes and bookings |

### Suggested prototype scope
Dynamic QR, Me tab, household invites with separate devices, biometric unlock, and the lift and gym flows. NFC wallet integration is a future enhancement.

## Appendix B. The revised demo plan, as pasted on 19 Oct

> We want to demo it with the Apple Pay concept, not QR scanning. Please change the plan like this:
>
> **Card:** The household access card looks like an Apple Wallet pass, with the township design and the unit number. It sits in the Me tab with an "Add to Apple Wallet" button. There is no need to unlock the app first. Treat it like Express Mode.
>
> **Reader:** The Reader page is a second screen (a laptop is fine) that looks like a tap reader, with a glowing contactless symbol and "Hold your iPhone near the reader". Since we have no real NFC, simulate the tap: the user drags the card onto the reader, or presses a "Tap" button on the phone mockup. A phone vibration and a checkmark animation play on the phone side.
>
> **Result:** The reader shows a big green "Access granted · Gym" (or Badminton Court, Lift) with a door-opening animation, or a red "Not allowed" with the reason (card suspended, lease expired, not permitted here). Do not show a person's name. It is a basic access card, so the reader only checks whether the card is valid and allowed at this facility. The visit log records the unit, not a person.
>
> **Readers to include:** facilities, gym, and pool, each with its own permission setting.
>
> **Offline:** keep this simple. We only need to show that the reader still works with Wi-Fi off, using the household card's signed credential and expiry. We don't need to store individual phone keys.
>
> **Admin side:** a lost phone can be disabled from another device, and suspended or expired cards should show the red result on the reader.
>
> Use the second phone or a laptop as the reader, whichever is easier. Dynamic QR can stay as a small fallback option for non-NFC phones, but the main flow is the tap.
