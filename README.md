# RuggerScore

Live rugby match scoring with shareable codes, real-time updates via SSE, web push
notifications, and per-club ownership. Built with Next.js (App Router) + Postgres.

## Features

- **Live scoring** — referees/scorers tap to record tries, conversions, penalties,
  drop goals, and cards. Spectators see the score and clock update in real time over
  Server-Sent Events.
- **Share codes** — every match has a 6-character code (`ABCD12`) for spectators to
  join from `/` without an account.
- **Match minute clock** — server-authoritative, survives reloads. Halves track
  `elapsedBeforeHalf` so half-time pauses don't lose minutes.
- **Auth + clubs** — Auth.js v5 with email/password (bcrypt). New users get an
  auto-created personal club; only club members can score for that club's matches.
- **Web Push** — VAPID-based notifications to subscribers per match, with automatic
  cleanup of expired endpoints.
- **PWA** — installable, with a service worker for push delivery.

## Stack

- Next.js 16 (Turbopack, App Router, React 19)
- TypeScript (strict)
- Auth.js v5 (`next-auth@beta`) with edge-safe split config
- Postgres via `pg` (Neon recommended for hosted deploys)
- Tailwind CSS 3
- `web-push` for VAPID notifications
- `nanoid` for ids and share codes

## Project layout

```
src/
  app/
    api/              # Route handlers (matches, events, stream, push, auth)
    score/            # Scorer UI (new + per-match)
    m/[id]/           # Spectator view
    club-admin/       # Club management
    signin / signup / page.tsx
  lib/
    persistence.ts    # Postgres pool + schema + async data access
    matchStore.ts     # In-memory match state with lazy hydrate from Postgres
    pushService.ts    # VAPID keys + send-to-match
    auth.ts           # Auth.js server config (Credentials provider)
    auth.config.ts    # Edge-safe slice (used by middleware)
    use*.ts           # Client hooks (live minute, stream, push)
  components/         # Header, providers, register-SW, etc.
  middleware.ts       # Route protection
```

## Local development

### 1. Prereqs

- Node 20+
- A Postgres database. Easiest path: a free [Neon](https://neon.tech) project. SQLite
  is no longer used; everything is Postgres.

### 2. Environment

Copy [.env.example](.env.example) to `.env.local` and fill in:

```
DATABASE_URL=postgresql://USER:PASS@HOST/db?sslmode=require
AUTH_SECRET=...                # openssl rand -base64 32
VAPID_PUBLIC_KEY=...           # optional but recommended
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

VAPID keys can be generated with:

```powershell
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

If you leave them blank, dev auto-generates a pair and persists it in the `kv` table
(fine for local; pin explicit values for production so existing subscriptions don't
get invalidated).

### 3. Install and run

```powershell
npm install
npm run dev
```

The schema (`matches`, `events`, `push_subscriptions`, `kv`, `users`, `clubs`,
`club_members`) is created on the first request via `CREATE TABLE IF NOT EXISTS`.

### 4. Build

```powershell
npx next build
```

## Deploy

See [DEPLOY.md](DEPLOY.md) for the Neon + Vercel walkthrough.

## License

MIT
