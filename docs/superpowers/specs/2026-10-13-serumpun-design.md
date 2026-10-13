# Serumpun — Design

*Community app for Sime Darby Property townships · SDP University Hackathon 2026 ("Township of Tomorrow", PEOPLE theme) · written 13 Oct 2026*

Mockups everyone on the team has seen and commented on: **https://claude.ai/artifact/Bqa6n1zS9ZeR5BGtrUur73** (pages: Community tabs · Reporting channel · Book a Court · Me & Rewards). The home screen and live map mockups were reviewed in the brainstorm tab and are described in §7–§8.

Legend: **[decided]** = the team decided it. **[my call]** = the builder chose it and the team can override. Anything unmarked follows directly from a decided item.

---

## 1. Why

Residents of SDP townships run their community through Facebook groups, Threads and TikTok. Complaints about broken streetlights, potholes or stray dogs get likes and comments, **but nothing gets fixed**: posts are scattered across apps, the Management Office may never see them, and nobody can track whether anyone is working on the issue. Everything else a neighbourhood needs, like finding a tutor, borrowing a ladder, finding running buddies or booking a court, is also scattered across WhatsApp and Facebook.

**Serumpun** ("of the same root") is one SDP-branded, phone-first web app that replaces the township Facebook group. Its heart is an **official reporting channel to the Management Office with public status tracking**. Around it sit the other things residents use the FB group for. **[decided]**

**Why it can win.** The organizer's briefing itself lists "one resident hub / one reporting channel" as an example idea, so many teams will build that. Serumpun must stand out on Innovation (20%). Its three differentiators:
1. **"Waze for walkers"**: a live, neighbour-confirmed hazard map for pedestrians, with **Safe Walk** routing around confirmed hazards.
2. **Public Issue Board with "Me too"**: duplicates collapse into one report, the most-felt problems rise to the top, and a public scorecard ("48 fixed this month, average 2.4 days") keeps everyone accountable.
3. **Points from real-world participation, spent at SDP's own mall**: joining approved community events earns points, which become vouchers at Elmina Lakeside Mall. This drives foot traffic to SDP assets (Commercial & Value Multiplication, 10%).

**Judging weights** (from the briefing): Impact & Sustainability 25% · Innovation 20% · Feasibility 20% · Strategic Fit 15% · Commercial & Value 10% · Evidence & Pitch 10%.

**First audience = the judges.** The first "users" watch a 5-minute demo video (23 Oct) and a live pitch (14 Nov). Every screen needs realistic sample data so the app looks alive. **[decided]**

## 2. Goals

- A working, deployed prototype the team can demo end to end on real phones plus a laptop.
- Everything in the team's feature list works: live map, community/groups, events, services, official reporting with tracking, points, share & lend, plus court booking.
- Live behaviour across devices: a report or alert made on one phone appears on other phones and on the Management Office dashboard within seconds.
- Looks and feels like Sime Darby Property: brand colours, clean and modern, English and Bahasa Malaysia, light and dark.
- Ready to grow to every SDP township without a rewrite.
- A clear `.md` file explaining the system, code on GitHub, hosted on Vercel. **[decided]**

## 3. Non-goals (v1)

- In-app payments (court booking is free, and services are paid outside the app). **[decided: free booking]**
- Native app-store apps (it's an installable web app instead).
- Push notifications (in-app notifications only).
- Integration with real SDP systems, real mall partner systems or real CCTV.
- More than one live township (Elmina only; the others show as "coming soon"). **[decided]**
- Selling items between residents. **[my call]**

## 4. Anti-goals (would be a failure even if it "works")

- Becoming another noisy Facebook feed, or showing ads.
- Exposing residents: reporters' names on public reports, phone numbers or house numbers shown to strangers.
- Points that can be farmed. Points come **only** from approved events with an on-site check-in. **[decided]**
- A demo that breaks: empty screens, broken flows or a dead map during the video.

## 5. Constraints

- **Deadlines:** proposal submission **23 Oct 2026, 11:59 pm** (pitch deck ≤10 slides, 5-min video/demo link, prototype/GitHub link). The team needs the app **demo-ready by about 21 Oct** to record. Final submission 11 Nov, pitch 14 Nov (in person), finals 3 Dec.
- **Brand colours** (sampled from the organizer's deck and logo): red `#D51A21` → orange `#F05820` → amber `#F8A818` gradient; navy `#001C3C` for text and dark surfaces. Font: Plus Jakarta Sans. Full light/dark token palette as on the canvas (`.th` tokens in any artboard). **[decided: SDP colours]**
- Free tiers only (Vercel Hobby, Supabase Free, OpenStreetMap).
- Phone-first for residents (works in a phone browser and can be added to the home screen). Laptop for the Management Office dashboard.
- **Languages:** English + Bahasa Malaysia, switchable in *Me*. **[decided]**
- **Themes:** light + dark, switchable in *Me*. **[decided]** Defaults to the phone's setting. **[my call]**
- GitHub account `ZektoxFx` (logged in on the build machine). Vercel isn't connected yet (see §14).

## 6. People and roles

| Role | Who | Can do |
|---|---|---|
| **Resident (pending)** | Just signed up | Browse everything (read-only) **[my call]** |
| **Resident (verified)** | Approved by the Management Office | Post, report, vote, book, borrow, message, earn and redeem points |
| **Management Office** | SDP township staff | Laptop dashboard: handle reports, approve residents and events, post announcements and official map pins |
| **Judge / visitor** | Uses demo accounts | One tap on the landing page: "Try as resident" / "Try as Management Office" **[my call]** |

Verification: sign-up asks for **township** (City of Elmina active; Bandar Bukit Raja, Serenia City, Ara Damansara, Bukit Jelutong, Nilai Impian, Bandar Ainsdale and Putra Heights listed as "coming soon"), **house/unit number**, and **neighbourhood** (e.g. "Elmina Valley 3"). The Management Office approves before the resident can post. **[decided]** The unit number is visible only to management. Other residents see the neighbourhood. **[my call]** A **household** = same unit number (used for booking limits).

## 7. App structure

**Bottom menu: Home · Map · ＋ · Community · Me** **[decided]**
- **Messages inbox icon** (with unread badge) at the top of Home and Community. **[decided]**
- **＋** opens quick actions: Report an issue · Drop a map alert · Post in a group · Offer/Request a service · List an item · Create an event.

**Home: "A · Tiles first"** (like Grab / Touch 'n Go). **[decided]**
- Gradient header: "Selamat pagi, Aisyah", township and neighbourhood, verified badge, points chip, notifications bell.
- A big **"Report an issue → goes straight to the Management Office"** card.
- 8 tiles: Live Map · Book Court · Events · Groups · Services · Share & Lend · Rewards · Issue Board.
- "Happening now": nearest active alert, latest official announcement, next event.

**Community tabs: Groups · Events · Services · Share & Lend** **[decided]** (canvas page 1).

**Me:** points card with progress to the next reward · My vouchers · My reports · My bookings · My listings · Points history · Dark mode switch · Language · Township · Sign out (canvas page 4).

## 8. Features

### 8.1 Live Map: "Waze for walkers" **[decided, incl. groupmate's additions]**
- Map of City of Elmina (Leaflet + OpenStreetMap tiles). Centre around Elmina Valley Central Park (3.1797, 101.5156). Elmina Lakeside Mall is at 3.1814, 101.5101.
- **Drop an alert in 2 taps:** pick a type, then Post. Location comes from GPS (or a draggable pin if GPS is denied). Photo and note are optional.
- **9 alert types with default severity** (the poster can change it):
  - 🔴 **High:** accident, snake/wild animal, suspicious person
  - 🟠 **Medium:** stray dogs, flood/big puddle, fallen tree, walkway blocked
  - 🟡 **Low:** streetlight out, police/roadblock
- **Live:** new alerts and votes appear on everyone's map within seconds.
- **Still there / Gone** (one vote per resident per alert, changeable). "Still there" refreshes *last confirmed*. **3 "Gone" votes** clear the alert early. **[my call: 3]**
- **Freshness:** every alert shows **first reported** and **last confirmed** times.
- **Auto-fade:** an alert disappears **2 hours** after its last confirmation.
- **Filters:** distance (500 m / 1 km / 2 km / all of Elmina), severity, type. Remembered on the device.
- **Lasting problems** (streetlight, fallen tree, walkway blocked, flood) get a **"Send to Management Office"** button. It opens a new report pre-filled with category, location and photo.
- **Official pins** from the Management Office (road works, water cuts) stay until management removes them.
- **Safe Walk:** pick a destination (preset places like Elmina Lakeside Mall, Central Park and the courts, or tap the map). The route uses Elmina's walking network from OpenStreetMap (about 300 footpaths and 320 residential streets in the centre) and **avoids confirmed High/Medium hazards**. A hazard counts as confirmed when someone other than the poster confirmed it, or it's official. Avoid radius ≈ 40 m. **[my call]** It shows "Route changed to avoid 🐕 Stray dogs · +4 min". If there's no safe alternative, it shows the normal route with a warning. **Built last**, so it can't block the rest. **[my call]**

### 8.2 Official Reporting Channel **[decided: public board + Me too]**
- **Categories (9):** Streetlight · Road/pothole · Tree/landscape · Rubbish · Drain/flood · Park/playground · Walkway · Security · Animals. **[my call: added Animals for stray dogs]**
- **New report:** category → location (GPS/pin) → **duplicate check** (same category within ~150 m and still open shows up to 3 matches with **👍 Me too**) → optional photo and description → optional **"Keep private"** → Send.
- **Public by default:** every resident in the township sees every non-private report and its progress on the **Elmina Issue Board**, sorted by "Me too" count, filterable by status.
- **Reporter's name is hidden** from other residents ("a verified resident"). Management sees the name and unit. **[my call]**
- **Private reports** (security, neighbour disputes): only the reporter and management see them. They aren't on the board and have no Me too. **[my call]**
- **Status steps:** Submitted → Acknowledged → In progress → Resolved → **Confirmed fixed by residents**. Management moves the first four. After *Resolved*, the reporter and Me-too residents tap ✓ Fixed or ✗ Not fixed. The reporter's ✗, or 2 ✗ from others, **reopens** it. **[my call]**
- Each step can carry a **management update** ("Contractor booked for Friday") and an optional after-photo.
- **Everyone affected gets an in-app notification** at each step (reporter and every Me-too resident).
- **Public scorecard** on the board: resolved this month · average time to fix (submitted → resolved) · % residents say fixed. **[my call]**
- No points for reporting (anti-abuse). **[decided: points from events only]**

### 8.3 Management Office dashboard (laptop) — canvas page 2
- **Sidebar:** Reports · Residents to approve · Events to approve · Announcements · Official map pins · Rewards & vouchers (list of redemptions) · Reset demo data.
- **Reports:** KPI strip (Open, In progress, Resolved this month, Avg time to fix, Residents say fixed %). Kanban columns **New · Acknowledged · In progress · Resolved**, and cards with the most "Me too" are highlighted. Opening a card shows photo, mini map, reporter (name + unit), Me-too count and timeline. Actions: change status, assign team (Facilities · Roads · Landscape · Cleaning · Security), post an update (+ photo). **[my call: team = a label, not separate logins]**
- **Residents to approve:** pending sign-ups (name, unit, neighbourhood, time), with Approve / Reject.
- **Events to approve:** resident events asking for points. Approve with points (default 100) or Reject.
- **Announcements** appear on Home "Happening now" and notify everyone. **Official map pins** appear on the map.
- **Reset demo data:** re-seeds the demo so it looks fresh before each recording or pitch. **[my call]**

### 8.4 Groups — canvas page 1 (groupmate's design) **[decided]**
- **Your groups** (with "N new" since last visit) and **Discover** (other groups in the township, with Join).
- Group page tabs: **Posts · Members · Rules**. There's a welcome card for new members and a pinned upcoming event.
- Post types: **General · Question · Share & Lend**. Comments, with **Helpful** votes on comments. The most-helpful comment on a Question shows as the **Top answer**.
- A "Share & Lend" post shows **Message [owner]**.
- Any verified resident can create a group (name, category, description, rules) and becomes its admin.
- Seeded: Elmina Mommies, Elmina Morning Runners, Central Park Briskwalkers, Sunday Futsal Dads, Elmina Toddler Playdates.

### 8.5 Events and points — canvas page 1 **[decided: points only for approved events]**
- **Upcoming / My events**, plus categories Official · Sports · Family · Green.
- **Official events** are created by management: **+150 points**, approved automatically.
- **Resident events** (+100 if management approves) can be pinned in a group. **[my call: 100/150]**
- RSVP with **Going**.
- **Check-in:** the organizer (or management) opens **"Show check-in QR"** on the event page. The QR holds a link (`/checkin/<event>?c=<secret>`), and residents scan it with their **normal phone camera**, so there's no in-app scanner to build. **[my call]** Serumpun opens and checks four things: verified resident, approved event, inside the window (1 h before start → 3 h after start), not already checked in. If all pass, **+points**.

### 8.6 Services — canvas page 1 **[decided: keep the Services page exactly as approved]**
- **Offered / Requested.** Categories: Tutoring · Repairs · Home help · Pet care · Other.
- An **offer** has title, category, description, price text (e.g. "RM40 / hour") and availability. A **request** has title, description, budget text and when it's needed.
- **Message** (on offers) and **I can help** (on requests) open a private chat.
- **Payment happens outside the app** (cash / DuitNow). **[my call]**
- **⭐ Rating** (1–5 + short comment) from people who messaged the provider, shown on the card. **[my call]**

### 8.7 Share & Lend — canvas page 1
- Three kinds: **Lend** (free, borrow and return) · **Give away** (free) · **Swap** (exchange). No selling. **[my call]**
- **Borrowing (4 steps):** Request with dates → Owner OKs → Picked up → Returned (owner taps each step). There's a reminder notification on the return day. **[my call]**
- Give away and Swap work through **Message owner**.
- A listing can also be posted into a group as a "Share & Lend" post.

### 8.8 Messages
- One-to-one private chats, started from a service, request, listing, group post or open game. A context card at the top shows what the chat is about.
- Live updates and unread badges. No phone numbers are shown, but residents may share one inside a chat if they choose. **[my call]**

### 8.9 Book a Court — canvas page 3 **[decided: free]**
- Sports: badminton (Court 1 and 2), futsal, tennis, multipurpose hall at "Elmina Valley Central Park courts" (sample location; real facility names TBC).
- **Map card under the Court 1 / Court 2 selector** shows the court location, the distance from you, and **Directions** (opens Safe Walk). **[decided]**
- 1-hour slots, 7 am–11 pm, up to 7 days ahead. **Up to 2 hours a day per household.** Cancel at least 2 hours before. **[my call]**
- "3 no-shows = 1-week pause" appears as a rule, but enforcement is Later (no court check-in in v1). **[my call]**
- **Booking pass:** QR + booking number, Add to calendar (.ics), Cancel.
- **🙋 Find players** (optional): when you book, you can say how many players you need. The slot then appears under **Open games** on Book a Court and Home, and neighbours tap **Join**. **[my call]**

### 8.10 Rewards and vouchers — canvas page 4 **[decided: vouchers at SDP malls]**
- **Points ledger:** balance = sum of entries. *Points history* lists each entry.
- **Catalog** (seeded, partner names are placeholders): Free kopi 250 · RM10 off groceries (min RM50) 500 · Kids' playland 1 hour 600 · RM15 off sportswear (min RM80) 1,500, all at Elmina Lakeside Mall. **[my call]**
- **Redeem** → points deducted → voucher with QR and code (`ELM-XXXX-XX`), valid **30 days**, one-time use.
- **Using it:** "Slide to use, in front of the cashier" marks it used with a timestamp. A used voucher shows "Used at 3:42 pm" with the live clock, so a screenshot can't be reused. Shops need no system. **[my call]**

### 8.11 Language and theme **[decided]**
- Every UI string exists in **English and Bahasa Malaysia**. The switch is in *Me* (and on the landing page). Default: Bahasa Malaysia if the phone's language is Malay, otherwise English. **[my call]**
- Seed content (posts, events) is in the language a real neighbour would write: a natural EN/BM mix. **[my call]**
- **Light/dark** uses the token palette from the canvas. It defaults to the phone setting, and the switch in *Me* overrides it and is remembered.

### 8.12 Notifications (in-app)
- A bell with a list: report status changes, account approved, borrow requests and steps, event approved, announcements, a player joined your game. Messages use the inbox badge instead.
- No push notifications in v1.

### 8.13 Built for every SDP township **[decided]**
Every record belongs to a township, and every query is scoped to the resident's township. Adding a township = adding its row (name, map centre/bounds, facilities). No code changes. The sign-up picker already shows the other townships as "coming soon".

## 9. How it's built **[my call — the team handed the tech choices to the builder]**

| Part | Choice | Why |
|---|---|---|
| App | **Next.js (App Router) + TypeScript + Tailwind CSS** on **Vercel** | One codebase for the phone app and the laptop dashboard. Vercel is required anyway. |
| Backend | **Supabase** via the **Vercel Marketplace**: Postgres, Auth, Realtime, Storage | Real logins, live updates across devices, photo storage, free tier. |
| Map | **Leaflet + OpenStreetMap** tiles | Free, no API key. Attribution shown. |
| Safe Walk | Elmina walking network **saved once from OpenStreetMap** into the repo; shortest path computed **in the browser** | No routing API or key, and it works even if a routing service is down. |
| QR | Generated in the app (booking pass, voucher, event check-in) | Scanning uses the phone's own camera (links). |
| Languages | Small EN/BM dictionary + `t()` helper | No heavy library. |
| Theme | CSS variables (light/dark tokens from the canvas) | Same palette as the mockups. |
| Install | Web app manifest + icons (add to home screen) | Feels like an app. Offline support is Later. |

**Data (main tables):** townships · profiles · alerts · alert_votes · reports · report_metoo · report_updates · report_confirmations · groups · group_members · posts · comments · comment_helpful · events · event_rsvps · services · service_reviews · listings · borrow_requests · facilities · bookings · booking_players · conversations · conversation_members · messages · points_ledger · rewards · redemptions · announcements · notifications. Every township-level table has `township_id`.

**Security** (needed even for a demo):
- Supabase row-level security on every table. Only verified residents can write. Residents only see their own township.
- Public report queries never include the reporter's id. Private reports and their photos are visible only to the reporter and management.
- Unit numbers are visible only to management.
- Event check-in secrets are never listed publicly.
- Points can only be added by the check-in path (server side).

**Demo data:**
- A seed script creates a lively Elmina: about 12 alerts, 15 reports across all statuses, 5 groups with posts and comments, 8 events, 10 services, 12 listings, bookings, conversations and points history.
- Times are set **relative to "now"**, so the demo always looks fresh.
- Demo accounts: two residents (Aisyah, Daniel), one pending resident, one Management Office user.
- **Reset demo data** re-runs the seed.

## 10. The 5-minute demo story (guides priorities)

1. Landing → **Try as Aisyah** → quick flip to Bahasa Malaysia.
2. **Live Map:** a stray-dogs alert on the park track ("8 neighbours confirmed, last confirmed 2 min ago") → **Safe Walk** to Elmina Lakeside Mall reroutes around it.
3. **Report** a broken streetlight → "Already reported nearby?" → **Me too** → open the report timeline.
4. Laptop: **Management Office** moves the pothole to *In progress* with an update → Aisyah's phone updates **live** → the Issue Board scorecard.
5. **Events:** Fun Run → scan the check-in QR → **+100 points** → **Rewards** → redeem Free kopi → slide to use.
6. **Community:** Mommies Q&A top answer · message a tutor · borrow a ladder · **Book a Court** with Find players.
7. **Me:** dark mode. Close on "built for every SDP township" (township picker).

## 11. Priorities

**Must for 23 Oct (the demo spine):**
- Sign-up / verification / demo accounts
- Home
- Live Map (alerts, votes, freshness, fade, filters, official pins, send-to-management)
- Reporting channel + Issue Board + scorecard
- Management dashboard (reports, approvals, announcements, pins, reset)
- Events + QR check-in + points
- Rewards + vouchers
- Groups (posts, comments, helpful/top answer)
- Services
- Share & Lend (incl. borrow steps)
- Messages
- Book a Court (slots, limits, map card, pass)
- Me
- EN/BM
- Light/dark
- Installable
- In-app notifications for report status and approvals
- Deployed on Vercel + GitHub + system `.md`

**Should (before 23 Oct if time allows, otherwise by 11 Nov):** Safe Walk · Find players / Open games · service ratings · return-day reminders · listing → group cross-post · remaining notification types.

**Later (pilot):** push notifications · offline · moderation tools (block/report users and content) · no-show enforcement · real mall partners · more live townships · in-app payments.

## 12. The calls I made (for the team to check)

Things the team didn't explicitly confirm. Each one is easy to change.
1. Reporter's name hidden from other residents; management sees it.
2. "Keep private" option for sensitive reports.
3. Five report steps ending in "Confirmed fixed by residents"; "Not fixed" reopens.
4. Public scorecard (fixed this month, average days to fix, % confirmed fixed).
5. 3 "Gone" votes clear an alert; alerts fade 2 h after the last confirmation; Safe Walk avoids confirmed High/Medium hazards within ~40 m.
6. Points: +100 resident events, +150 official events; vouchers 250–1,500 points, valid 30 days, "slide to use".
7. Court booking rules: 1-hour slots, 7 am–11 pm, 7 days ahead, 2 h/day per household, cancel ≥2 h before; Find players.
8. Services: payment outside the app; ⭐ ratings. Share & Lend: no selling; 4-step borrowing.
9. Pending residents can browse read-only; unit numbers visible only to management.
10. Demo accounts + Reset demo data; seed content in a natural EN/BM mix.
11. All tech choices in §9; defaults to the phone's language and theme.

## 13. Left to the builder

File/folder structure, component breakdown, exact table columns and policies, seed content wording, the OpenStreetMap snapshot and path-finding details, map styling, icons, animations, test setup, and anything not listed above that a sensible builder can settle without changing what gets built.

## 14. Needs the team

- **Vercel, right after this design is approved** (the database is created through Vercel, so backend work waits for it): sign in once on the build machine (`vercel login`), and accept the Supabase terms when the Marketplace integration is added. Both happen in the browser.
- **GitHub repo:** confirm the name (`serumpun`) and whether it's **public** (easiest for judges to open) or private. Pushing is confirmed before it happens.
- **BM wording:** a quick read-through by a teammate.

## 15. Risks

- **Tight time** (~8 build days): build strictly in the priority order, Safe Walk last.
- **OpenStreetMap tile policy** allows light use only. That's fine for a demo; a pilot needs a tile provider.
- **Footpath data is incomplete** in places, so Safe Walk quality varies by street.
- **The Supabase free tier pauses after about a week of inactivity:** open the app before each demo or pitch.
- **Live features must be tested on real phones and a laptop** before recording.

## 16. References

- Organizer briefing: https://drive.google.com/file/d/1ONxlesTjG89nAjVxcWgKoUgOyqyuQijO/view
- Shared mockups (canvas): https://claude.ai/artifact/Bqa6n1zS9ZeR5BGtrUur73
- Elmina map data © OpenStreetMap contributors (ODbL).
