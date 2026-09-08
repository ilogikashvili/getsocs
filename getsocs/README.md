# Getsocs

A marketplace for buying and selling social media channels/accounts (YouTube, Telegram, TikTok), with escrow-mediated transactions, seller verification, and paid membership tiers.

## Stack

- **Client**: React (Create React App), plain CSS
- **Server**: Node.js / Express
- **Data store**: MySQL 8+ / InnoDB, with relational tables, indexes, foreign keys, and transactional persistence
- **Auth**: JWT + mandatory email 2FA on every login, bcrypt password hashing
- **File storage**: pluggable local or S3-compatible object storage, with separate public/private paths and authorization-gated identity documents

## Getting started

### 1. Server

```bash
cd server
npm run env:check       # verifies the single server/.env file
npm install
npm start               # or: npm run dev (nodemon, auto-restart)
```

The server listens on `PORT` (default `3001`) and serves both the API (`/api/*`) and, once you've built it, the React app itself (see below).

### 2. Client

```bash
cd client
npm install
npm start               # dev server on :3000, proxies API calls to :3001
```

For production, build it and let the server serve the static files directly:

```bash
cd client
npm run build            # outputs to client/build
cd ../server
npm start                 # now serves client/build automatically
```

### 3. Environment variables

All backend configuration lives in `server/.env`. At minimum you need:

- `JWT_SECRET` — required, or auth won't work at all
- `SMTP_*` + `EMAIL_FROM` — required for registration codes, 2FA codes, and password resets to actually send. Without these, the app still *runs*, but no one can complete registration or log in (every login requires a 2FA email).
- `YOUTUBE_API_KEY` — optional, enables automatic YouTube channel ownership verification (see below). Telegram and TikTok verification don't need an API key.
- `ALLOWED_ORIGINS` — set this to your real frontend domain(s) in production. Left blank, CORS allows all origins, which is fine for local dev but not for a real deployment.
- `TRUST_PROXY_HOPS` — set this to match how many reverse proxies actually sit in front of the app (nginx/load balancer = `1`, the default). Getting this wrong either breaks rate limiting or makes it spoofable.

## Running tests

```bash
cd server
npm test
```

The backend contains security, integration, cache, storage, marketplace-correctness, idempotency, and API contract suites. Run `npm test` on a clean checkout; Jest/CI is the source of truth for the current test and suite count.

## Architecture notes worth knowing

### Data store (important)

Production persistence is MySQL 8+ using InnoDB. The schema lives in `server/database/schema.sql`; default membership/add-on seed data is in `server/database/seed.sql`. The application uses a connection pool, transactions, foreign keys, indexes, and `app_meta.state_version` optimistic concurrency protection. JSON is no longer a production fallback; it is used only by isolated tests and by the one-time import utility.

Bootstrap and verify a fresh database with `npm run db:bootstrap` and `npm run db:verify`. Migrate an existing JSON database with `npm run db:migrate:json -- --source=/absolute/path/to/db.json`. See `DATABASE.md` for the schema chart, table list, migration, backup, and rollback procedure.


### Redis and performance

Redis is an optimization, not a source of truth. `server/services/cacheService.js` owns Redis access, cache keys are documented in `docs/performance/cache-classification.md`, and product mutations invalidate list/search/detail namespaces. Metrics are available through the protected `/internal/metrics` and `/internal/metrics/prometheus` endpoints. Benchmark and load-test tooling lives under `server/scripts/benchmark.js` and `performance/k6/`.

### Object storage

Set `STORAGE_DRIVER=local` for local/VPS filesystem storage or `STORAGE_DRIVER=s3` for S3-compatible object storage. Public product/profile assets and private ID documents use separate visibility classes/buckets. Private documents never become public `/uploads` objects. See `docs/storage.md` and `infra/storage/README.md`.

### Auth flow

Registration → email verification code → login (username/password) → **mandatory** 2FA code sent by email → JWT issued. There's no way to skip the 2FA step. If SMTP is down or misconfigured, logins will fail — the frontend has a "retry sending the code" fallback (`/auth/login/resend-2fa`) for transient failures, but there's no way around 2FA entirely by design.

### Channel ownership verification

When creating a listing, sellers can prove they own the channel by putting a generated code in the channel's bio, then triggering a lookup. The server fetches the channel and, if the code is found, locks the listing's title/follower count/avg views to what it actually reads from the platform — the seller cannot edit those fields afterward.

- **YouTube**: uses the official YouTube Data API (`YOUTUBE_API_KEY` required).
- **Telegram**: scrapes the public `t.me/s/<channel>` preview page — no API key needed, but the channel must be public.
- **TikTok**: scrapes the public profile page's embedded JSON — no API key needed, but TikTok aggressively rate-limits/blocks datacenter IPs, so this is the least reliable of the three in practice. If it consistently fails from your server, that's a network/IP-reputation issue, not a code bug — a paid third-party TikTok data API may be the practical fix.

See `server/services/channelVerificationService.js`.

### ID verification (the "verified" badge)

Separate from email verification. A user uploads a government ID through `/auth/verify-user`; it goes into a pending queue (`GET /api/admin/id-verifications`) for an admin or escrow agent to approve or reject. Only approval sets `idVerified: true`. This is intentionally *not* self-service — the endpoint requires an actual file upload and does nothing to grant the badge on its own.

### Membership tiers

Real tiers (VIP / VIP+) live in the MySQL `memberships` table and are seeded by `server/database/seed.sql`. Subscribing actually reduces the platform fee charged on purchases (`MembershipService.getPlatformFee()`, wired into `transactionController.buyProduct`) — it's not just a cosmetic badge.

## Known limitations / things to keep an eye on

- **No admin UI for editing membership tiers** — defaults are seeded from `server/database/seed.sql`; they are not manageable through the admin panel yet.
- **`npm audit` on the client** still reports some findings inherited from Create React App's own toolchain (webpack/babel-loader chain) — these are build-time only, not shipped to users, but worth revisiting if CRA gets replaced with something more actively maintained (e.g. Vite) down the line.
- **Object storage is optional rather than mandatory** — `STORAGE_DRIVER=local` preserves the single-VPS workflow, while `STORAGE_DRIVER=s3` sends validated assets to separate public/private buckets. The migration tool verifies object existence before updating database references and keeps local originals unless deletion is explicitly requested.
- **Redis is optional cache infrastructure** — `REDIS_ENABLED=true` enables cache-aside caching for approved public product reads and selected public metadata. Cache failures fall back to MySQL.
- **CRA remains in place intentionally** until the full frontend test/build baseline can be run cleanly; Vite migration should be performed only after that gate is green.

## Security audit history

The `SECURITY_AUDIT_PHASE1_TASK*.md` files at the repo root document specific hardening work done in earlier passes (rate limiting, IDOR fixes, input validation, etc). They're historical records of *why* certain things are built the way they are, not living documentation — if something in this README conflicts with one of those files, trust this file and the actual code.

## Frontend themes

Getsocs ships with the original dark theme plus an optional light theme.

- Dark mode remains the default.
- The header theme switch changes the theme without reloading the page.
- Login/register/reset-password and standalone messaging screens expose the same switch in the top-right corner.
- The preference is stored in `localStorage` under `gs_theme` and is applied in `public/index.html` before React boots to avoid a theme flash.
- Theme state is managed by `client/src/context/ThemeContext.jsx`; light-mode design overrides live in `client/src/css/theme.css`.
