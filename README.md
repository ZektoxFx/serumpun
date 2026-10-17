# Serumpun

**Your township, together.** Serumpun is a phone-first web app that replaces a Sime Darby Property township's
Facebook group. Its heart is an official reporting channel to the Management Office with public status tracking:
report a broken streetlight, see who else did (Me too), and follow it from *submitted* to *fixed*. Around it sit an
emergency button that alerts the office and neighbours within 2 km, notices to the office ahead of renovation or moving
day, a live map of short-lived neighbourhood alerts, groups with a General chat for everyone, events with points,
services, share and lend, messages, free facility booking (courts, hall, gym, BBQ pit) and vouchers at SDP malls, in
English and Bahasa Malaysia, with adjustable text size. Homes stay private: neighbours see names and neighbourhoods,
never a unit number.

**Live:** https://serumpun-six.vercel.app — tap **Try as Aisyah** on a phone, and **Try as Management Office** on a
laptop for the dashboard.

## Screens to see

1. Home: Happening now (nearest alert, the office's announcement, your next event)
2. Live Map: an alert with Still there / Gone, and Safe Walk going around it
3. Report an issue → "Already reported nearby?" → Me too → the report's timeline
4. Management Office dashboard: the reports board, moving a report on (the resident's phone updates live), resident
   notices
5. Emergency: hold ＋ for 3 seconds on one phone, tap the red **!**, and a neighbour's phone pops up with the red 2 km
   circle on the map; the office's dashboard shows who and where
6. Notify the office: renovation or moving day, noted by the office with a reply
7. Community: General chat, Groups, Events (official or resident, QR check-in for points), Services with ⭐ ratings,
   Share & Lend
8. Facilities: courts, hall, gym and BBQ pit; Find players, Open games and the booking pass
9. Rewards: a voucher with Slide to use
10. Me: text size, dark mode and Bahasa Malaysia

## Quick start

```bash
npm install
vercel env pull .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

| Script | Does |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` · `npm run start` | Production build and server |
| `npm run lint` · `npm run typecheck` · `npm test` | ESLint, TypeScript, Vitest |
| `npm run db:migrate` | Applies new database migrations |
| `npm run db:seed` | Resets the demo data |
| `npm run smoke` | Privacy and double-tap checks on the live database |

Built with Next.js 16, Supabase (Postgres, Auth, Realtime, Storage) and Vercel, with Leaflet and OpenStreetMap.

**How it all works:** [docs/SYSTEM.md](docs/SYSTEM.md) (features, architecture, data model, security, points, demo
accounts, running and deploying).
