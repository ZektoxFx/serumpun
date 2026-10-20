# Serumpun — how the system works

Serumpun ("of the same root") is a phone-first web app for the residents of a Sime Darby Property township, starting
with **City of Elmina**, and a laptop dashboard for its **Management Office**. Live at
**https://serumpun-six.vercel.app**.

Contents: [The problem](#1-the-problem) · [Feature tour](#2-feature-tour) · [Roles](#3-roles-and-verification) ·
[Architecture](#4-architecture) · [Data model](#5-data-model) · [Security](#6-security-model) ·
[Points](#7-points) · [Languages and themes](#8-languages-and-themes) · [Every township](#9-built-for-every-sdp-township) ·
[Demo accounts](#10-demo-accounts-and-reset) · [Run locally](#11-run-it-locally) · [Deploy](#12-deploy) ·
[Limits](#13-known-limits-and-later) · [Credits](#14-credits) · [Links](#15-links)

## 1. The problem

Today a township's life runs through a Facebook group. Reports to the Management Office get lost in the feed and
nobody knows whether anyone saw them. Warnings (stray dogs, a flood, a fallen tree) scroll away and go stale. Help,
events and things to lend are mixed with everything else, and residents' details are on show.

Serumpun puts it in one place, built around an **official reporting channel to the Management Office with public status
tracking**: every report has a reference number, a public timeline and a Me too count, and the office answers from its
dashboard. Around it: a live map of short-lived neighbourhood alerts, an emergency button that alerts the office and
neighbours within 2 km, notices to the office ahead of renovation or moving day, groups (with a General chat for
everyone, in topics like a Telegram community), events with points, services, share and lend, messages, facility
booking, vouchers, parking at SDP's malls, the mall directory and a household access card that opens the pool, the gym
and the courts with a tap. Home's favourites are the resident's to pick and order. Homes stay private: residents see names and neighbourhoods, never a unit number.

## 2. Feature tour

| Screen | Where | What it does |
|---|---|---|
| Home | `/home` | Greeting, township and points; "Report an issue" (straight to the office); **My favourites**: up to 7 services of the resident's choosing (at first Pay parking, Notify office, Facilities, Events, Groups, Services, Rewards) and **More**; **Happening now**: the nearest neighbour alert, the office's latest announcement and your next event; **Open games** that need players. |
| More · Edit favourites | `/more` · `/more/edit` | Every service in three groups (Township, Community, Mall & parking), the new ones marked NEW. **Edit** (from Home): add or remove favourites, drag them into order (or Move earlier / Move later), Reset to the default, Save. Leaving without Save keeps the old ones. |
| Pay parking | `/parking/pay` | Pick Elmina Lakeside Mall or KL East Mall, type the plate (or tap one of your last 5), **Check amount**: the time parked and the fee pop up, with DuitNow QR, online banking (FPX), Apple Pay or Google Pay. A short "processing", then "Thank you! You have 20 minutes to exit the car park." A demo: nothing is charged. |
| Parking areas | `/parking` · `/parking/<mall>` | SDP's malls as cards (hours, rates); a mall opens its car park map (Elmina's, from SDP), Pay parking, rates, free parking, valet, EV charging, directions (Waze, Google Maps) and the Mall directory. |
| Mall directory | `/malls/elmina-lakeside-mall` | Elmina Lakeside Mall's 99 shops, A–Z, by name or unit and by category; tapping one drops a red pin on SDP's layout plan (pinch to zoom); facilities (toilets, surau, ATM, nursing room, playground, information counter) pin all their spots. |
| Emergency alert | ＋ in the bottom bar | Hold ＋ for 3 seconds (or Create › Emergency alert) and it turns into a red **!**; one more tap sends an alert from where you are. The Management Office and verified neighbours whose neighbourhood is within 2 km get a popup in the app and a bell, and a lock-screen alert on phones that turned it on (Me › Emergency alerts). Everyone's map shows a red 2 km circle while it is live (2 hours). The sender says what it is (fire, medical, break-in or crime, something else) or cancels a false alarm; **Call 999** is always one tap away. |
| Live Map | `/map` | Alerts as pins (accident, snake, suspicious person, stray dogs, flood, fallen tree, walkway blocked, streetlight, police, and the office's road works and water cuts). Neighbours vote **Still there** or **Gone**; an alert fades 2 hours after its last confirmation. Search, filters, drop an alert, and "Send to Management Office" for lasting problems. **Safe Walk**: pick the mall, the park, the courts or a spot on the map, and the walking route goes around confirmed high and medium hazards (blue, with the usual way dashed red and a banner saying what it avoided and how many minutes it adds), or warns when there is no way round. |
| Report an issue · Issue Board | `/reports/new` · `/reports` | Category, photo and place; "Already reported nearby?" offers **Me too** instead of a duplicate. Timeline: submitted → acknowledged → in progress → resolved, then the reporter confirms the fix (or it reopens). Private reports (security) are seen only by the reporter and the office. |
| Notify the office | `/notices/new` · `/notices` | Tell the Management Office ahead of renovation noise, moving day with the lift, an event at home or a contractor visit: dates and details. The office marks it noted, with a reply if needed, and the resident is told. Only the office sees it, with the unit. |
| Management Office | `/dashboard` | Reports board with updates and after-photos, residents to approve, official map pins, events to approve (points), resident notices, announcements, **General chat** topics (add, rename, office only, remove, or open one to answer), rewards and vouchers, and Reset demo data. A live emergency puts a red banner over every page (what, who, unit, phone, when) with Show on map and **Resolve**. |
| Units | `/dashboard/units` | Every home in the township with its household card: **Active**, **Suspended** (with the office's reason), **Lease ended** or **Not registered**, and how many of its 4 phones are in use. **Suspend…** asks for a reason (1 to 200 characters) that everyone on the card is told and sees; **Lift** puts the card back. **Open reader screen** opens `/reader`. Residents to approve stays beside it for now. |
| General chat | `/community/general` | Pinned at the top of Groups, with every unread message as "N new". Topics as in a Telegram community: 📢 **Announcements** (office only; every announcement the office publishes appears here too), 🆘 Help & support, 💬 Borak-borak, 👋 Say hi, 🔎 Lost & found, 🚗 Traffic & roads, and any the office adds. Each topic is a live group chat (the office's messages marked "Management Office ✓"); opening it marks it read. Everyone in the township reads; verified residents and the office post. |
| Community | `/community` | **Groups** (General chat at the top; posts, questions with a top answer, Helpful), **Events** (each marked 🏢 Official · Sime Darby Property or 👥 Resident event, with its points; Going, QR check-in), **Services** (offers and requests in Tutoring, Repairs, Cleaning, Food, Childcare, Eldercare, Pets, Others; offers show their ⭐ average and jobs), **Share & Lend** (lend, give away or swap; borrowing in 4 steps; "Also post to a group" puts the item in one of your groups, where its post links to it). |
| Messages | `/messages` | One-to-one chats about a post, a service, a listing or an open game; live, with unread badges. In a chat about someone's offer, **Rate** gives it 1 to 5 stars (once per neighbour, changeable). |
| Facilities | `/book` | Badminton (2 courts), futsal, tennis, the hall, the gym, the BBQ pit and the function room. Free 1-hour slots from 7 am to 11 pm, up to 7 days ahead, 2 hours a day per household; a booking pass with QR and a calendar file; cancel up to 2 hours before. **Find players** (badminton, futsal and tennis): ask for 1 to 10 neighbours when booking; the game shows under **Open games** (here and on Home) until it is full, neighbours tap Join or message the host, and the pass shows who joined. |
| Rewards | `/rewards` | Vouchers for points at Elmina Lakeside Mall; "Slide to use" at the counter. |
| Me | `/me` | The **household card** at the top (next row); points and the next reward; my vouchers, reports, bookings, listings and notices; points history; **Help & policies**; emergency alerts on this phone; dark mode; **text size** (Small, Normal, Large, Extra large); language; township; sign out. |
| Household card | `/me` | A Wallet-style card: the Serumpun gradient, "HOUSEHOLD CARD", the unit (Aisyah's is No. 18, Jalan Elmina Valley 3/2), the places it opens (Facilities, Gym, Pool) and the phones on it ("3 of 4"), never a name. One card per household, so everyone on it gets the same places. Tap it and enter the 6-digit PIN (the demo accounts show it: 123456) and the card pops up; it locks again when you leave it or after 60 seconds without a tap. 5 wrong PINs lock it for 15 minutes and tell the card's Owner and Co-owner. On a real phone the open card says "Hold near a reader". **Add to Apple Wallet (demo)** opens a sheet saying it is a look-alike; **Show QR instead** draws a QR that changes every 30 seconds. A suspended card shows "Suspended" with the office's reason, and a tenant's card shows "Lease ended" after the lease's last day. |
| Reader | `/reader` | A tap reader for the demo laptop, open to anyone (no sign-in). Pick where it is: Facilities (then a court, the hall, the BBQ pit or the function room), Gym or Pool. The phone mockup beside it holds the card of whoever is signed in on that browser (the demo buttons when nobody is). Open the card with the PIN, then drag it onto the reader or press **Tap**: the phone buzzes, and the reader shows a big green tick and "Access granted · Pool", or a red ✕ and one reason (card suspended, lease ended, phone switched off, place switched off, no booking at this time, pass expired). It never shows a name. Facilities and the Gym open only with the household's booking for that hour; the Pool is walk-in. The **Wi-Fi** switch (or the laptop really going offline once the page has loaded) makes the reader decide by itself, and visits made offline are sent when it is back. |
| Help & policies | `/help/guidelines` · `/help/rules` · `/help/faq` · `/help/terms` | How to use each feature, the community rules, an FAQ with search, and the Terms & Conditions (a draft for the competition). Readable signed out too: sign-up links its Terms. |
| Notifications | `/notifications` | Emergencies nearby, report updates, borrow steps and a reminder at 8 am on the return day (to the borrower and the owner), comments, events approved or not for points, players joining or leaving your game (or a game you joined being cancelled), a notice noted by the office (and, for the office, a new notice), announcements and account news, with a live bell. |

**The 5-minute demo story**

1. Landing → **Try as Aisyah** → switch to Bahasa Malaysia (Me › Language).
2. Home › Happening now → the nearest alert opens the **Live Map** on it → vote Still there → **Safe Walk** to Elmina
   Lakeside Mall goes around the stray dogs on the park track.
3. **Report** a broken streetlight → "Already reported nearby?" → **Me too** → open the report's timeline.
4. On a laptop: **Try as Management Office** → move a report to *In progress* with an update → Aisyah's phone updates
   **live** → the Issue Board.
5. **Events**: check in with the event's QR → points → **Rewards** → redeem Free kopi → slide to use.
6. **Community**: General chat › Borak-borak (3 new) and Help & support, where the office answered · the Mommies
   group's top answer · message a tutor and rate her ⭐ · borrow a ladder · **Facilities** with Find players (Daniel
   joins Aisyah's Saturday game from Open games, and her bell and booking pass show it).
7. **Mall**: Home › **Pay parking** → Elmina Lakeside Mall → tap WXY 1234 → the amount → DuitNow QR → "Thank you! You
   have 20 minutes to exit" → **Parking areas** → the Mall directory → Jaya Grocer's pin on the layout plan.
8. **Emergency**: on Aisyah's phone hold ＋ for 3 seconds and tap the red **!** → Daniel's phone pops up "Emergency
   nearby" and his map shows the red 2 km circle → the office's dashboard shows who and where → Resolve.
9. **Me**: Help & policies, dark mode and text size; Home › Edit to rearrange favourites. Close on "built for every SDP
   township".

**The household card, in about two minutes** (two browsers, because one browser holds one account: Aisyah on the
laptop, the office in a second one)

1. Landing → **Try as Aisyah** → Me: the card at the top says No. 18 and "3 of 4" phones. Tap it and the PIN pad shows
   the demo PIN, 123456. Enter it and the card pops up.
2. On the laptop open `/reader` (still as Aisyah) and pick **Pool**. Open the card in the phone mockup with 123456, then
   drag it onto the reader, or press **Tap** → the phone buzzes → a green tick and "Access granted · Pool".
3. Pick **Gym** and tap again → a red ✕ and "No booking at this time" (the Gym and the courts open only with a booking
   for that hour).
4. Turn the **Wi-Fi** switch off and tap at the Pool → still green, because the reader decides from the card and its
   last sync. Turn it on and the visit it queued is sent.
5. In the second browser: **Try as Management Office** → **Units** → **Suspend…** No. 18 with a reason ("Landlord's
   request") → Aisyah's next tap is a red ✕ and "Card suspended" → **Lift** → the next tap is green again.

## 3. Roles and verification

| Who | Can |
|---|---|
| Visitor | See the landing page, sign up, or try a demo account. |
| Pending resident | Browse everything. Posting, voting, booking, borrowing, messaging, notices and emergency alerts wait for approval (a banner says so; the emergency sheet still offers Call 999). |
| Verified resident | Everything residents do. |
| Rejected | Sees why, and nothing else. |
| Management Office | Its township's dashboard. |

Sign-up asks for a name, email, password, township, neighbourhood and **unit number**. Only the Management Office ever
sees the unit. The office approves or rejects new residents in Dashboard › Residents, and the resident is notified.

## 4. Architecture

```mermaid
flowchart LR
  phone["Resident's phone<br/>installable web app"] --> app
  laptop["Management Office laptop<br/>dashboard"] --> app
  subgraph vercel["Vercel · Singapore (sin1)"]
    app["Next.js 16 App Router<br/>server components · server actions · proxy.ts"]
  end
  subgraph supabase["Supabase · Singapore"]
    auth["Auth"]
    db["Postgres<br/>row-level security · privacy views · RPCs"]
    realtime["Realtime"]
    storage["Storage<br/>photos · private-photos"]
  end
  app -->|"session cookies · queries · RPCs"| auth
  app --> db
  app --> storage
  phone -.->|"live pins, reports, messages, bell"| realtime
  phone -->|"map tiles"| osm["OpenStreetMap"]
```

- **Reads**: server components query Supabase as the signed-in user, so row-level security always applies.
- **Writes**: server actions call database functions (RPCs) that check the caller and the rules again; the page is never
  trusted. The service-role key is used only by trusted server code (sending notifications, the seed, the smoke test).
- **Live updates**: alerts, reports and emergencies broadcast an id-only "something changed" on the township's channel
  (emergencies also on their own, for the popup on every page) and pages fetch again through the privacy views; messages,
  General chat's topic messages and notifications arrive as row changes under row-level security.
- **Parking** runs on the server only (`lib/parking.ts`, service role): the page sends the plate, the server works out
  the pretend entry time and the fee, and a payment marks the session paid once.
- **Lock-screen alerts** (emergencies only) use Web Push: Me › Emergency alerts registers the service worker
  (`public/sw.js`) and subscribes the browser with the app's VAPID public key; the subscription is kept in
  `push_subscriptions`. Once the sender has their answer, the server (`after()`) sends each recipient a notification in
  their language with `web-push`, and drops subscriptions the push service says are gone.
- **Time**: every "today", slot and window is worked out in Malaysia time (Asia/Kuala_Lumpur); servers run in UTC.
- **Maps** use Leaflet with OpenStreetMap tiles (no paid keys). QR codes are made in the app.
- **Safe Walk** routes in the phone: Elmina's walking paths from OpenStreetMap (`public/data/elmina-walk.json`, built
  by `scripts/build-walk-graph.mjs`) load the first time it is used, and A* finds the shortest way, then the shortest
  way that keeps 40 m from every confirmed high or medium hazard. It is worked out again whenever the alerts change.
- **Scheduled**: Vercel Cron calls `/api/cron/reminders` every day at 00:00 UTC (8 am in Malaysia, `vercel.ts`) with the
  project's `CRON_SECRET`; it sends the return-day reminders once per day, however often it is called.

| Folder | What is in it |
|---|---|
| `app/(auth)` | Landing, sign-up, the rejected screen |
| `app/(app)` | Every resident screen |
| `app/dashboard` | The Management Office |
| `app/reader` · `app/api/reader` | The public reader screen and its API (sync, tap, visits) |
| `components/<feature>` | Screens' parts, by feature |
| `lib/domain` | The rules as plain, tested functions (time, points, booking, reports, alerts…) |
| `lib/card` | The household card: signing and checking passes, the tap decision, the PIN rules, the reader's offline queue |
| `lib/route` | Safe Walk's walking graph and route finder |
| `lib/supabase` | Clients, the session and role checks, realtime hooks |
| `lib/i18n` | English and Bahasa Malaysia (`en.ts`, `ms.ts`) |
| `lib/seed` | The demo township |
| `supabase/migrations` | Schema, row-level security and RPCs, applied in order |
| `scripts` | `migrate.ts`, `seed.ts`, `seed-cards.ts`, `smoke.ts`, `card-key.ts`, and `build-walk-graph.mjs` (refreshes the walking paths) |
| `tests` | Vitest unit tests |

## 5. Data model

Every township-level table has `township_id`. Residents read through the views and functions in the last column.

| Area | Tables | Residents read through |
|---|---|---|
| People | `townships`, `profiles` (with Home's `favourites`), `profile_private` (unit, phone) | their own profile and unit |
| Office | `announcements`, `notifications`, `resident_notices` | their township's announcements, their own notifications and notices |
| Live Map | `alerts`, `alert_votes` | `public_alerts` |
| Emergencies | `emergencies`, `push_subscriptions` | `public_emergencies` (where and what, never who); phone subscriptions not at all |
| Reports | `reports`, `report_metoo`, `report_updates`, `report_confirmations` | `public_reports`, `public_report_updates` |
| Events and points | `events`, `event_rsvps`, `points_ledger` | `public_events`, `my_points()` |
| Rewards | `rewards`, `redemptions` | the catalogue, their own vouchers |
| Groups | `groups` (one `is_general` per township, which every verified resident joins), `group_members`, `posts`, `comments`, `comment_helpful` | `public_groups`, `public_group_members`, `public_posts`, `public_comments` |
| General chat | `chat_topics` (one `announcements` per General chat), `topic_messages`, `topic_reads` | `public_topics` (with the latest message and the reader's unread count), `public_topic_messages`; new messages live under row-level security |
| Parking | `vehicles` (a resident's last 5 plates), `parking_sessions` | nothing: only the server, for the signed-in resident |
| Messages | `conversations`, `conversation_members`, `messages` | `my_conversations`, their own messages |
| Services | `services`, `service_reviews` | `public_services`, `public_service_ratings` (the stars, never who gave them) |
| Share & Lend | `listings`, `borrow_requests` | `public_listings`, `my_borrows` |
| Facilities | `facilities`, `bookings`, `booking_players` | the courts, their own bookings, `booked_slots()`, `open_games()`, `game_players()` (the host's own game) |
| Household cards | `units` (the office's record of a home, with a tenant's lease end), `cards` (one per unit: active or suspended, the places it opens, its phone limit), `card_members` (who is on a card, as Owner, Co-owner, Adult or Child), `card_phones` (a card's phones, one per person) | their own card, its unit, who is on it and its phones (never a unit's record phone); the office reads its township's |
| Taps and PINs | `phone_keys` (the public key of each browser that holds a phone's card), `card_visits` (every tap, by card), `member_pins` (a person's PIN, hashed, with wrong tries and any lockout) | their own phone's keys and their card's visits (by unit, never a person); the PINs not at all |

## 6. Security model

- **Row-level security on every table.** Policies go through `my_township()`, `is_verified()` and `is_management()`,
  so a rejected account matches nothing and nobody sees another township.
- **Privacy views.** Residents read names and neighbourhoods only: never a unit number, a phone, who posted an alert or
  a report, who raised an emergency, or who rated a service. Tables that would leak (votes, Me toos, who wrote a step, who joined a game, who
  rated) give residents nothing at all.
- **Emergencies**: only the office learns who raised one, with the unit and phone, to send help. Only the sender can
  cancel it and only the office resolves it. A pending account cannot raise one, and tapping again while one is live
  gives the same one back, so nobody is alerted twice.
- **Notices** to the office are seen by the resident who sent them and the office, nobody else.
- **Ratings need a real contact**: a service can be rated only by a neighbour who has a conversation with its provider
  about it, never by the provider.
- **Writes only through RPCs**: security-definer functions with an empty `search_path` and explicit grants. Each checks
  who is calling (verified, same township, owner) and the rule (dates, slots, steps, limits) again.
- **Photos** get random file names. A private report's photos sit in a private bucket, shown through short-lived signed
  links.
- **Only trusted code sends notifications**, so nobody can message a fake notice.
- **Double taps count once**: unique keys and locks make Me too, check-in, redeem (a request id per press), borrowing,
  booking (one per slot, 2 hours per household) and joining a game (one spot each, never past full) safe to tap twice or
  at the same time.
- **General chat**: everyone in the township reads its topics; verified residents and the office post, only the office
  posts in an office-only topic, and only the office adds, renames or removes topics. Announcements can be neither
  removed nor opened to residents.
- **Parking**: residents have no access to the plates and sessions tables at all; the server reads and writes them for
  the signed-in resident only, and a session is paid once, however often Pay is tapped.
- **Household cards**: residents read only their own card's rows (its unit, who is on it, its phones and visits, their own
  phone's keys) and the office its township's units, cards, people and phones, but no visits (incident lookups come in
  a later stage). Every write goes through a function that checks the caller again, or through the server.
  `member_pins` has no policy and no grant, so nobody signed in can read a PIN, and a unit's record phone is read by the
  server only. Only the office suspends a card (in its own township, with a reason of 1 to 200 characters that everyone
  on the card sees) or lifts the suspension.
- **Passes and phone keys**: the server signs a pass for each phone with the township's private key (`CARD_SIGNING_KEY`,
  ECDSA P-256, in the server's environment only), good for 24 hours and renewed whenever the app is open and online.
  Each browser makes its own key pair (WebCrypto, not exportable, kept in IndexedDB) and registers only the public
  half, which the pass carries. A tap is the pass plus a short note signed by that key (place, time, a random number):
  a copied pass or a screenshot of the QR is useless, a note counts for about a minute and works once (its number is
  unique in the visit log), and readers store no phone keys. An online reader asks the server, which checks the live
  card, phone, places and booking, so a suspension acts at once; an offline reader decides from the pass and its last
  sync.
- **PINs**: 6 digits, hashed with bcrypt in the database. 5 wrong tries lock a PIN for 15 minutes and tell the card's
  Owner and Co-owner. Every visitor shares a demo account, so for those the wrong tries are counted in each browser and
  one visitor can't lock the rest out.
- **No names at a reader**: it never shows one, and the visit log records the card (so the unit), the place, the time
  and the result, never the person or the phone.
- **Every page and action checks the session itself.** `proxy.ts` only sends signed-out visitors to the landing page.
- `npm run smoke` tries these rules against the live database as the demo accounts (24 checks).

## 7. Points

- **Earn** by checking in at an event with its QR, from an hour before it starts to three hours after: **150** points
  at the Management Office's events, **100** at a resident event once the office approves points for it. Once per
  person per event.
- **Spend** on vouchers at Elmina Lakeside Mall: Free kopi (250), RM10 off groceries (500), an hour at the kids'
  playland (600), RM15 off sportswear (1,500). A voucher lasts 30 days and is used by sliding it at the counter, beside a
  ticking clock so a screenshot cannot pass for it.
- The balance is the sum of the points ledger. Only check-in adds points and only redeeming spends them.

## 8. Languages and themes

Every screen is in **English** and **Bahasa Malaysia** (Me › Language; the choice is remembered). **Light**, **dark** or
the phone's setting (Me › Dark mode). **Text size** Small, Normal, Large or Extra large (Me › Text size, remembered on
the device): every screen grows with it and still fits a phone. Designed for phones 390 px wide, installable to the home
screen; the dashboard is for laptops.

## 9. Built for every SDP township

The `townships` table lists Sime Darby Property's townships: City of Elmina (live), Bandar Bukit Raja, Serenia City,
Ara Damansara, Bukit Jelutong, Nilai Impian, Bandar Ainsdale and Putra Heights. Sign-up asks for the township and says
"coming soon" for the others. Everything is scoped by township, so opening another one means switching it on, adding its
Management Office account, its places, facilities and rewards, and its General chat with its topics (as
`supabase/migrations/0017_general_chat.sql` and `0022_chat_topics.sql` did for City of Elmina; residents then join it as
they are approved).

## 10. Demo accounts and reset

- The landing page has **Try as Aisyah** (verified resident, Elmina Valley 3), **Try as Nur** (waiting for approval)
  and **Try as Management Office**.
- **Daniel Tan** (`daniel.demo@example.com`, another household) is a second resident for two-phone demos. The demo
  password is not in this document: ask the team.
- **The household card.** The demo PIN is **123456** for every seeded resident, and the PIN pad shows it on the demo
  accounts. Aisyah is the Owner of No. 18, with Imran Yusof as Co-owner and Sara Imran as a child: "3 of 4" phones. Many
  visitors can be Aisyah at once; each browser makes its own key, but all join her one seeded phone, so the card keeps
  saying "3 of 4".
- **Try as Aisyah puts No. 18's card back as it was seeded** (active, all three places on, no phone frozen) before it
  signs her in, so each judge starts with a working card. It happens only on that tap, so a suspension the office makes
  during a video take stays put until the next Try as Aisyah or a reset. A failed restore is logged and the sign-in
  goes on.
- **Never run `npm run db:seed:cards` during a video take**: it resets every card and PIN lockout, which undoes a
  suspension. (`npm run db:seed` and Reset demo data do too.)
- **Dashboard › Reset demo data** (or `npm run db:seed`) wipes everything created since, deletes visitors' sign-ups,
  restores the demo accounts and seeds a lively Elmina dated around now, with the card tables again: 25 units, 14 cards
  (Jason Lee's tenant card suspended, Kavitha Nair's lease ended), their people and phones, and the demo PIN. Seeded
  alerts fade after about two hours, so reset shortly before a demo.

## 11. Run it locally

You need Node 24, npm 11, and access to the Vercel project (or your own Supabase project with the same variables).

```bash
npm install
vercel env pull .env.local
npm run card:key   # only adds CARD_SIGNING_KEY when .env.local has none
npm run db:migrate
npm run db:seed
npm run dev
```

Variables (names only, never commit `.env*`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`),
`POSTGRES_URL_NON_POOLING` (or `POSTGRES_URL`) for migrations, `DEMO_PASSWORD`, `CARD_SIGNING_KEY` (the township's key
for household cards: it lives in `.env.local` and Vercel, is never committed or printed, and `npm run card:key` makes it;
without it nobody gets a pass, so no card opens), `CRON_SECRET` (any long random
value; Production has its own, and the reminders route refuses every call without it), and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
with `VAPID_PRIVATE_KEY` (a pair from `npx web-push generate-vapid-keys`; without them everything works except
lock-screen alerts).

| Script | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` · `npm run start` | Production build and server |
| `npm run lint` · `npm run typecheck` · `npm test` | ESLint, TypeScript, Vitest |
| `npm run db:migrate` | Applies new files in `supabase/migrations`, each in one transaction |
| `npm run db:seed` | Resets the demo data |
| `npm run db:seed:cards` | Adds and updates the card rows (units, cards, who is on them, phones, PINs) and deletes nothing, but resets every card and PIN lockout: never during a video take |
| `npm run card:key` | Adds `CARD_SIGNING_KEY` to `.env.local` when it has none. It never prints the key |
| `npm run smoke` | Privacy, pending-user, double-tap, limit and household-card checks on the live database, then a reset |

Two sessions on one computer (resident and office): `npm run build && npm run start -- -p 3001`, then use
`http://localhost:3001` and `http://127.0.0.1:3001` (the development server blocks 127.0.0.1).

## 12. Deploy

The Vercel project `serumpun` runs in Singapore (`vercel.ts`), with Supabase from the Vercel Marketplace. Its variables
are set in the project for Production, Preview and Development.

`CARD_SIGNING_KEY` goes into all three: read it from `.env.local` inside a script and pipe it to
`vercel env add CARD_SIGNING_KEY <environment>` with `process.stdout.write`, so it carries no trailing newline (a newline
makes every pass fail), and never print it. Development gets it too, so `vercel env pull` cannot wipe the local key.

```bash
npm run typecheck && npm test && npm run build
npm run db:migrate
vercel deploy --prod
npm run smoke
```

Apply new migrations before deploying code that needs them. The smoke test ends with a reset of the demo data. The card
tables are filled by the seed, so after the first deploy with the household card run `npm run db:seed` (or Dashboard ›
Reset demo data) to give the live demo its cards.

## 13. Known limits and Later

- **Open games and the booking pass** show who joined when they are opened or after your own tap; the host's bell is the
  live part. Find players is set when booking, not changed afterwards.
- **Return-day reminders** go out once a day at about 8 am (on Vercel's Hobby plan a daily job may start any time in
  that hour), and only for items the owner marked as picked up.
- **Emergency alerts** reach neighbours by the centre of their neighbourhood, not where their phone is. The sender's
  place is the phone's location when it is in the township (asked for at most 6 seconds), else their neighbourhood's
  centre. An alert fades from maps after 2 hours and stays on the office's dashboard until resolved. Lock-screen alerts
  need the browser to allow notifications, and on an iPhone the app added to the Home Screen (iOS 16.4 or later).
- **Text size** is remembered on each device, not on the account.
- **Safe Walk** knows only the paths OpenStreetMap has (refresh them with `node scripts/build-walk-graph.mjs`), sets off
  from your neighbourhood's centre when the phone gives no location in the township, and does not guide turn by turn.
- **Pay parking is a demo**: nothing is charged, the time parked is made up from the plate, and Elmina Lakeside Mall's
  hourly rate is a sample (KL East Mall's is its published rate). The thank-you gives 20 minutes to exit at both malls.
- **Mall directory** is for Elmina Lakeside Mall only. Its 99 shops and units are from SDP's site as of 18 Oct 2026 (the
  page loads more as you scroll, so a few may be missing); categories are ours, and the pins were placed by hand on
  SDP's layout plan.
- **General chat** shows a topic's latest 100 messages; messages cannot be edited or deleted yet.
- **The household card is stage 1 of 6 (the tap).** Getting onto a card with an office code, the household page (people,
  places on and off, freezing a phone, guest passes, the access history), disputes and appeals, and the plastic card come
  in later stages (see the design spec). For now the seed puts the demo township's residents on cards and sign-up works
  as before, so someone who signs up has no card. Visits are kept until a later stage adds the 90-day deletion and the
  office's incident lookups.
- **No real NFC, Bluetooth, Apple Wallet or SMS.** The tap is simulated (drag the card onto the reader, or press Tap),
  the reader is a web page, and the browser on it plays the phone. **Add to Apple Wallet (demo)** is a look-alike: a real
  pass needs a paid Apple Developer account, and passes that open doors need Apple's approval. There is no SMS provider.
- **Screenshots and rooted or jailbroken phones can't be blocked** by a web app. Instead each tap is signed by the
  phone's own key and the fallback QR changes every 30 seconds, so a screenshot or a copied card is useless.
- **iPhones don't vibrate** at a tap (iOS browsers ignore `navigator.vibrate`); the tick or cross, and the shake on a
  refusal, still show.
- **An offline reader learns of a change at its next sync, or when the phone's pass expires (within 24 hours).** That
  covers a suspension, a lift and a frozen phone. An online reader asks the server, so it knows at once.
- **A browser that can't keep the card's key** (a Safari private window, some in-app browsers) says so and can't hold
  the card.
- **Not in this version**: real payments (Pay parking is a demo, services are paid between neighbours, facilities are free), push notifications
  other than emergencies (the rest are in the app), checking in at a court (the "3 no-shows" rule is shown, not enforced), offline use (the reader screen aside), and photos for
  listings (they have an emoji).
- **Approximations**: "how far" on Share & Lend, Facilities, Home and the emergency popup is measured from the centre
  of your neighbourhood, never from a home.
- The demo shares one database between local, preview and production, and a reset wipes everything created since.

## 14. Credits

Logo, app icon and line icons by the Serumpun team (originals in `brand/`; the app's copies in `public/brand`,
`public/icons/line` and `app/icon.png`). Map data and Safe Walk's walking paths © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors,
available under the Open Database License (ODbL). Elmina Lakeside Mall's car park map and layout plan © Sime Darby
Property. Maps by Leaflet. Built with Next.js, React, Tailwind CSS, Supabase and Vercel. Font: Plus Jakarta Sans
(SIL Open Font License). Made for the SDP Hackathon 2026.

## 15. Links

- Design spec: [`docs/superpowers/specs/2026-10-13-serumpun-design.md`](superpowers/specs/2026-10-13-serumpun-design.md)
- Build plan: [`docs/superpowers/plans/2026-10-13-serumpun.md`](superpowers/plans/2026-10-13-serumpun.md)
- Household access card: [design spec](superpowers/specs/2026-10-19-household-access-card-design.md) and
  [stage 1 plan](superpowers/plans/2026-10-19-access-card-stage-1.md)
- Approved mockups (canvas): https://claude.ai/artifact/Bqa6n1zS9ZeR5BGtrUur73
