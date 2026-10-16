# Serumpun

**Your township, together.** Serumpun is a phone-first web app that replaces a Sime Darby Property township's
Facebook group. Its heart is an official reporting channel to the Management Office with public status tracking:
report a broken streetlight, see who else did (Me too), and follow it from *submitted* to *fixed*. Around it sit a live
map of short-lived neighbourhood alerts, groups, events with points, services, share and lend, messages, free court
booking and vouchers at SDP malls, in English and Bahasa Malaysia. Homes stay private: neighbours see names and
neighbourhoods, never a unit number.

**Live:** https://serumpun-six.vercel.app — tap **Try as Aisyah** on a phone, and **Try as Management Office** on a
laptop for the dashboard.

## Screens to see

1. Home: Happening now (nearest alert, the office's announcement, your next event)
2. Live Map: an alert with Still there / Gone
3. Report an issue → "Already reported nearby?" → Me too → the report's timeline
4. Management Office dashboard: the reports board, moving a report on (the resident's phone updates live)
5. Community: Groups, Events (QR check-in for points), Services, Share & Lend
6. Book a Court: the slot picker and the booking pass
7. Rewards: a voucher with Slide to use
8. Me: dark mode and Bahasa Malaysia

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
