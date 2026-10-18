# Feedback round 2 — design

Favourites like Touch 'n Go, mall parking, the mall directory, General chat topics, and help pages.
Agreed screen by screen in the brainstorm of 18 Oct 2026 (mockups in `.superpowers/brainstorm/`); this document is the
written design to approve before planning. "My call" marks a decision the user did not make; everything else they
chose or confirmed.

## 1. Why

The team decided to add more functions after the 17 Oct feedback round. Three pressures shape this round:

- **Room on Home.** Eight fixed tiles cannot take new services. A Touch 'n Go-style "My favourites" grid with
  **More** and **Edit** lets each resident keep the services they use on Home, and lets the app grow.
- **Sime Darby Property's own malls.** Paying for parking and finding a shop at Elmina Lakeside Mall tie the app to
  SDP's retail, which feeds the judging criterion *Commercial & Value Multiplication* (10%) and makes the demo feel
  real.
- **General chat will get noisy.** One feed for the whole township does not scale; Telegram-style topics (Support,
  chit-chat, …) keep it usable.
- **Trust.** Guidelines, rules, an FAQ and terms answer judges' questions about safety, privacy and the demo payments.

The proposal and the 5-minute demo video are due **23 Oct 2026**: everything here must be demo-ready, and nothing may
make the existing app less stable.

## 2. Goals, non-goals, anti-goals

**Goals**

1. Home favourites: 7 favourites plus **More**, an **Edit** page to add, remove and reorder, saved to the account.
2. **Pay parking** at SDP malls: plate number → amount → pick a way to pay → thank-you popup with the time left to exit.
3. **Parking areas**: the SDP malls only; tapping a mall shows its parking options.
4. **Mall directory** for Elmina Lakeside Mall: its real 99 shops, search and categories, a pin on the official layout
   plan.
5. **General chat topics** like a Telegram community: a list of topics, each a live group chat.
6. **Help & policies** on Me: Guidelines, Community rules, FAQ, Terms & Conditions, in English and Bahasa Malaysia.

**Non-goals** (not in this round)

- Real payments of any kind (no payment gateway, no QR that pays, no FPX, no Apple/Google Pay sheets), real gates or
  plate readers, parking receipts history, refunds.
- A shop directory for KL East Mall (parking only there).
- "Online now" counts, typing indicators, notifications for topic messages, replies/threads/reactions inside topics.
- The Management Office editing the help pages.

**Anti-goals** (failures even if it "works")

- Anything that could pass for charging real money: every payment screen says **"Demo: no real money is charged."**
- Made-up facts shown as real: a value we could not find is labelled **"sample"** (see §4.4).
- Losing the existing General chat posts, or breaking the General chat card, Home, the dashboard or the nav tests.
- A Home that gets longer: favourites stay two rows.

## 3. Home favourites

### 3.1 What the resident sees

- **Home** (replaces the eight fixed tiles): a "My favourites" heading with an **Edit** link, then a 4-column grid of
  up to **7 favourites** and a **More** tile (a circle with "•••") as the 8th cell. With fewer than 7 favourites, the
  grid shows those and More.
- **More** (`/more`): every service in three headed groups, 4 columns, with an **Edit** link:
  - *Township:* Report an issue, Issue Board, Notify office, Facilities, Live Map
  - *Community:* Groups, Events, Services, Share & Lend, Messages
  - *Mall & parking:* Pay parking, Parking areas, Mall directory, Rewards
- **Edit** (`/more/edit`): "My favourites · n of 7" with each favourite showing a **−** badge (remove); hold and drag
  to reorder; below, "Add to favourites" lists every other service with a **+** badge (faded while 7 are chosen, with
  "Full? Take one off first."). **Save** stores the order; **Reset to default** restores the default 7 (not saved
  until Save). Leaving without Save keeps the old favourites. *My call.*
- Reordering without dragging must also work (keyboard and screen reader): e.g. selecting a favourite shows "Move
  earlier / Move later" buttons. The exact control is the builder's.
- **NEW** badge on Pay parking, Parking areas and Mall directory (a constant list; remove later).

### 3.2 Rules

- **Default favourites:** Pay parking, Notify office, Facilities, Events, Groups, Services, Rewards. Issue Board and
  Share & Lend move into More; Report an issue keeps its own big button above the grid.
- At most 7, no duplicates; 0 is allowed (Home then shows only More).
- Saved to the account (follows the resident to a new phone). A saved key the app no longer knows is skipped, never an
  error.

## 4. Mall parking

### 4.1 Malls (static data in code, not in the database)

| | Elmina Lakeside Mall | KL East Mall |
|---|---|---|
| Owner | SDP's 2nd wholly-owned mall (opened Aug 2024) | SDP's 1st wholly-owned mall |
| Address | No. 5, Persiaran Garcinia, Elmina West, 40170 Shah Alam | 823, Jalan Lingkaran Tengah 2, KL Timur, 53100 Kuala Lumpur |
| Hours | Daily 10 am – 10 pm | Daily 10 am – 10 pm |
| Car parks | Mall car parks charged on entry; valet (charges apply); **Outdoor Zones A & B free** | Charged; valet RM18 (Mon–Thu) / RM23 (Fri–Sun, PH) first 4 h, then RM2/h |
| Rate | **Sample:** RM2.00 first 2 hours (or part), then RM1.00 each hour (or part) | **Real:** RM2.00 first 2 hours (or part), then RM2.00 each hour (or part), plus 8% service tax |
| EV charging | ChargEV, 16 DC fast chargers | not shown |
| Maps | SDP car park map; official layout plan | none in the app (address and directions only) |

Sources (fetched 18 Oct 2026): SDP's Elmina Lakeside Mall page and its festival FAQ, SDP's KL East Mall page,
SoyaCincau (ChargEV). Elmina Lakeside Mall's hourly rate is not published anywhere we found, hence "sample".

### 4.2 Parking areas (`/parking`, `/parking/[mall]`)

- `/parking` lists **only the malls** as cards (name, township or area, a short rate line, distance from the resident's
  neighbourhood centre when the mall is in their township).
- `/parking/[mall]`: the mall's car park map (Elmina only), then its options:
  **Pay parking** (opens the flow with this mall chosen), **Rates**, **Free parking** (Elmina: Outdoor Zones A & B),
  **Valet**, **EV charging** (Elmina), **Directions** (Waze and Google Maps links), **Mall directory** (Elmina only).
  Options with nothing to say for a mall are left out.

### 4.3 Pay parking (`/parking/pay`, optional `?mall=`)

1. Without `?mall=`, pick the mall first (the Home **Pay parking** tile lands here).
2. **Car plate number**: one field, plus chips of the resident's saved plates (tap to fill); typing a new plate adds a
   car. A new plate is saved after a successful check (*my call*: up to 5 plates per account; a sixth replaces the one
   used longest ago). Plates are normalised to
   upper case with single spaces; valid = 2–10 letters/digits once spaces are removed, with at least one letter and one
   digit ("WXY 1234", "VBN 88", "B 1234 X"). **Check amount**.
3. **The amount pops up** (a bottom sheet): plate · mall, "Entered 10:05 am · parked 2 h 15 min", the amount in RM
   (and "incl. 8% service tax" for KL East Mall), then **Pay with**: DuitNow QR, Online banking (FPX), Apple Pay,
   Google Pay (one selected at a time, DuitNow QR first), then **Pay RM x.xx**.
4. After a short "Processing…" (about a second), a small popup: **"Thank you! You have 20 minutes to exit the parking
   lot."**, with "Exit by 12:40 pm · Paid RM 3.00 with DuitNow QR" and a reference number. **Done**.

**The pretend entry time.** There is no gate camera. The first check of a plate at a mall creates a parking session
whose entry time is *now minus a pretend duration* between 40 minutes and 4.5 hours, worked out from the account,
mall, plate and date so it does not jump between checks that day. Checking again before paying shows the same
session with the time and amount grown. After paying, checking the same plate within the exit window says
"Already paid · exit by 12:40 pm"; after the window a new session starts.

**Exit window:** 20 minutes for both malls (the user's wording; KL East Mall's own site says 15). *My call.*

**Who may pay:** any signed-in resident, pending ones too (it is not posting). *My call.*

### 4.4 Real vs sample

Shown as real: shops, units, layout plan, hours, addresses, KL East Mall's rates and valet, Elmina's free Zones A & B,
valet and 16 EV chargers. Shown as **sample**: Elmina Lakeside Mall's hourly rate. Every payment is a demo.

## 5. Mall directory (`/malls/elmina-lakeside-mall`)

- Header: Elmina Lakeside Mall · "Open daily 10 am – 10 pm · 99 shops"; address and directions links.
- **Search** by shop name or unit; **category chips** (All plus about seven: Food & drink, Groceries, Fashion,
  Beauty & health, Home & gadgets, Kids & toys, Sports & leisure, Services; the exact set is the builder's).
- **Layout plan**: SDP's official plan (3000 × 1769 px) as a pinch-zoom, pan map (Leaflet image overlay, as SDP's own
  site does). Tapping a shop in the list drops a red pin labelled with its name at its unit and moves the map there.
  Credit under the map: "Layout plan © Sime Darby Property".
- **List**: name, category, unit badge (e.g. GF-29); A–Z.
- **Facilities** row: toilets, surau, ATM, nursing room, children's playground, information counter; tapping one pins
  it on the plan.
- Data: the 99 shops and unit codes from SDP's page (fetched 18 Oct 2026; the page had "Load more", so a few may be
  missing); categories are ours; pin positions are measured from the plan (pixel coordinates at 3000 × 1769). The
  plan and the car park map are saved in `public/` with the credit. *My call* (SDP's own images, for SDP's own
  competition).

## 6. General chat topics

### 6.1 What residents see

- The pinned **General chat** card on Groups now opens **`/community/general`**: a header (💬 General chat · township ·
  member count) and the **topics**, each row: emoji in a tinted circle, name, last sender, one-line preview, time, and
  an unread count. 🔒 "Office only" on Announcements. The card's "N new" counts unread topic messages.
- A topic (**`/community/general/[topic]`**) is a live group chat: message bubbles with the sender's name (the office's
  marked "Management Office ✓"), own messages on the right, times, the message box at the bottom (the bottom bar
  hides, as in Messages). Opening it marks it read.
- Starting topics (seeded): 📢 **Announcements** (office only), 🆘 **Help & support**, 💬 **Borak-borak**, 👋 **Say
  hi**, 🔎 **Lost & found**, 🚗 **Traffic & roads**.
- The old `/community/groups/<general chat id>` page sends people to `/community/general`.

### 6.2 Rules

- Everyone in the township can read; **verified** residents and the office post. In an **office-only** topic only the
  Management Office posts; residents read.
- Only the **Management Office** adds, renames (name and emoji), marks office-only, and removes topics, from a new
  dashboard page **Dashboard › General chat**. Removing hides the topic (messages kept). Announcements cannot be
  removed or opened to residents.
- **Announcements mirror the office's announcements:** when the office publishes on Dashboard › Announcements, the
  same title and text appear as a message in the Announcements topic. *My call.*
- Messages: 1–2000 characters; no editing or deleting in this round. Unread = messages from others after the later of
  the resident's last read of that topic and the time they joined General chat (so a newcomer does not start with
  hundreds). *My call.*
- The office reads and answers in the same topic pages as residents (`/community/general/[topic]` works for the office
  account); Dashboard › General chat lists the topics with a link to open each, next to add, rename and remove.
  *My call.*
- The topic list ends with the group's rules (the text General chat already has), since the old group page goes away.
- Every post and comment already in General chat (four seeded posts, plus anything residents have added on the live
  demo) becomes a message in Borak-borak, keeping its author and time; the posts are then removed.

## 7. Help & policies

- A **Help & policies** section on Me, after the "my stuff" list: 📘 Guidelines, 📜 Community rules, ❓ FAQ,
  📄 Terms & Conditions.
- Pages at **`/help/guidelines`, `/help/rules`, `/help/faq`, `/help/terms`**, readable when signed out too, so the
  sign-up form can link "By signing up you agree to the Terms & Conditions". *My call.*
- **Guidelines:** how to use each feature, step by step (report, alerts and Safe Walk, the emergency button and when to
  use it, notices, General chat, groups and events, services, share & lend, facilities, pay parking, rewards).
- **Community rules:** be kind; keep homes private (no units, plates or children's photos without asking); no selling
  in chats (use Services or Share & Lend); the emergency button is for real danger only (false alarms can pause an
  account); one report per problem (use Me too); fair bookings; what happens when rules are broken.
- **FAQ:** a search box and questions opened in place (native disclosure), about a dozen, including: who can see my
  unit; why can't I post yet; is the parking payment real money; when to use the emergency button; lock-screen alerts
  (iPhone: add to Home Screen first); points and vouchers; booking a facility; what happens to my report.
- **Terms & Conditions:** a clearly marked prototype draft, not legal advice, with a "last updated" date: who may use
  it, accounts and verification, acceptable use, content, privacy under Malaysia's Personal Data Protection Act 2010,
  not an emergency service (call 999), demo payments, points and vouchers, liability, changes, contact.
- The same pages for every township. All copy in English and Bahasa Malaysia.

## 8. Constraints

- Same stack and rules as the app: Next.js 16 App Router, Supabase with row-level security on every table, writes only
  through security-definer RPCs with an empty `search_path` and explicit grants, Leaflet with OpenStreetMap; **no new
  dependencies**.
- Every string in English and Bahasa Malaysia; text sizes in rem (the text-size setting); phone-first at 390 px; light
  and dark; keyboard and screen reader friendly.
- Migrations start at **0020**. The demo database is shared and in use: migrations are additive; no reseed or smoke
  run without the user's OK; checks clean up only their own rows.
- The seed (Reset demo data) creates everything new: topics and their messages, a saved plate for Aisyah, no paid
  sessions.
- New signed-in routes join `proxy.ts`'s list: `/more`, `/parking`, `/malls`. `/help/*` stays public.

## 9. Data (outline; names are the builder's)

- `profiles.favourites text[]` (null = default) and an RPC to save it (≤ 7, unique, known-looking keys).
- `vehicles` (the account's saved plates) and `parking_sessions` (account, mall slug, plate, entered at, amount,
  method, paid at, exit by, reference); RPCs to check a plate (find or create today's session, return the amount) and
  to pay a session. A resident sees only their own; residents never read others' plates.
- `chat_topics` (general chat group, emoji, name, office only, sort order, removed at, a fixed key for Announcements),
  `topic_messages`, `topic_reads`; a privacy view for the topic list (last message, sender name, unread count) and for
  messages (sender name, office flag, is mine); RPCs to send, mark read, and for the office to add, change and remove
  topics; live updates like Messages; a trigger copying new announcements into Announcements.

## 10. Testing

- Unit tests: the fee rules (part hours, tax, rounding), plate normalising and checking, favourites (defaults, unknown
  keys, limit), the pretend duration (stable for a day, within range), FAQ search, the mall data (every shop has a
  unit; every pinned unit is on the plan).
- API checks with a scratch script (own rows cleaned up): office-only topic refuses residents, removed topic refuses
  messages, unread counts, a second check reuses the session, paying twice refused, others' sessions unreadable.
- Browser checks of every screen at 390 px, light and dark, English and Bahasa Malaysia, Extra large text.
- `npm run smoke` gains two privacy checks (another resident's parking sessions; posting to an office-only topic); it
  reseeds, so it runs only with the user's OK.

## 11. Left to the builder

Visual detail within the mockups; the drag and the no-drag reorder control; the category set; pin coordinates; the
help copy wording within §7; the dashboard topic page layout; how the topic list shows member count; route and file
names not fixed above.

## 12. My calls (please check)

1. Leaving Edit without Save keeps the old favourites.
2. Up to 5 saved plates per account; a plate is saved after a successful check.
3. 20 minutes to exit at both malls (KL East Mall's own rule is 15).
4. Pending residents may pay parking.
5. Elmina Lakeside Mall's rate is a labelled sample: RM2 first 2 hours, then RM1 an hour.
6. SDP's layout plan and car park map are saved in the app with "© Sime Darby Property".
7. Office announcements also appear in the Announcements topic.
8. Help pages are public, and sign-up links the Terms.
9. Topic unread counts start from when the resident joined General chat, not from the first message ever.
10. The office answers in the same topic pages as residents; the dashboard page lists and manages the topics.
