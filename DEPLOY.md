# Deploying RuggerScore to Vercel + Neon Postgres

RuggerScore uses a single Postgres database (Neon) for both local dev and production.
There is no SQLite anymore — everything is async and pooled via `pg`.

## 1. Create a Neon project

1. Go to <https://neon.tech> → **Create project**.
2. Choose a region close to your Vercel region (default is `lhr1` in `vercel.json`).
3. Copy the **pooled** connection string. It looks like:

   ```
   postgresql://USER:PASSWORD@ep-xxx-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
   ```

   The `?sslmode=require` suffix is important — `persistence.ts` enables SSL automatically
   when the connection string matches `sslmode=require` or `neon.tech`.

## 2. Configure local dev

Add to `.env.local`:

```
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
AUTH_SECRET=... # openssl rand -base64 32
```

Then run:

```powershell
npm run dev
```

The first request bootstraps the schema (CREATE TABLE IF NOT EXISTS for `matches`,
`events`, `push_subscriptions`, `kv`, `users`, `clubs`, `club_members`).

## 3. Push to GitHub

```powershell
git add .
git commit -m "Postgres + Vercel ready"
git push
```

## 4. Import to Vercel

1. <https://vercel.com/new> → **Import** the GitHub repo.
2. Framework preset: **Next.js** (auto-detected).
3. Set the following **Environment Variables** (Production + Preview):

   | Name                | Value                                                         |
   | ------------------- | ------------------------------------------------------------- |
   | `DATABASE_URL`      | Neon pooled connection string with `?sslmode=require`         |
   | `AUTH_SECRET`       | `openssl rand -base64 32`                                     |
   | `VAPID_PUBLIC_KEY`  | (optional, generate once and reuse so subscribers stay valid) |
   | `VAPID_PRIVATE_KEY` | (optional, paired with the public key)                        |
   | `VAPID_SUBJECT`     | `mailto:you@example.com`                                      |

4. **Deploy**. Vercel will run `next build` then host the app.

## 5. Generating stable VAPID keys (optional but recommended)

If you don't set the env vars, dev auto-generates a keypair on first run and stores it
in the `kv` table. On Vercel that pair will also be persisted in Neon, but it's cleaner
to mint one and pin it as env vars so it never silently rotates:

```powershell
node -e "const w=require('web-push');const k=w.generateVAPIDKeys();console.log(k)"
```

Paste the `publicKey` / `privateKey` into Vercel env vars.

## 6. Notes / gotchas

- Auth.js v5 requires `AUTH_SECRET`. Without it the build will fail.
- The `pg` Pool is lazy — `DATABASE_URL` is only required at request time, so `next build`
  will succeed even without it (though every request would 500 in that state).
- All API routes are `dynamic = 'force-dynamic'`; nothing is statically pre-rendered.
- SSE (`/api/matches/[id]/stream`) works on Vercel's Node runtime. Avoid the Edge runtime
  for these routes — `pg` does not work on Edge.
- To wipe and start over: drop the tables in Neon's SQL editor; they'll be re-created on
  the next request.
