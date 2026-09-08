# Getsocs MySQL Migration Report

## Implemented

- Replaced production JSON persistence with MySQL 8+/InnoDB through `server/config/db.js`.
- Kept the existing repository/service contracts async so controllers do not depend on the database driver.
- Added connection pooling, startup connectivity/schema checks, graceful pool shutdown, and `/health` database reporting.
- Added transactional state writes and optimistic concurrency protection using `app_meta.state_version`.
- Added a relational schema with primary keys, foreign keys, unique constraints, indexes, timestamps, and JSON compatibility payloads.
- Normalized refresh-token sessions into `refresh_tokens` with user, family, hash, expiry, use, and revocation fields/indexes.
- Added MySQL tables for all existing Getsocs persisted domains, including users, products, transactions, chats, bids, escrow, notifications, idempotency, reviews, badges, memberships/add-ons, ID verification metadata, bans, ad spaces, and analytics.
- Added `server/database/schema.sql`, `seed.sql`, and `schema.mmd` ER chart.
- Added database bootstrap, JSON-to-MySQL migration, verification, and emergency JSON-export scripts.
- Converted legacy `set_admin_password.js` from direct `db.json` editing to the MySQL-backed repository and removed the hard-coded password hash.
- Added MySQL to Docker Compose with persistent storage and health-gated application startup.
- Added a MySQL integration job/container smoke test to CI configuration.
- Updated README, DATABASE, ARCHITECTURE, RUNBOOK, CONTRIBUTING, environment examples, and ignore rules.
- JSON file persistence now exists only for explicit Jest/E2E fixtures (`NODE_ENV=test` + `TEST_DB_FILE`) and as an import/export migration format.

## Database creation / migration commands

```bash
cd server
npm install
npm run db:bootstrap
npm run db:verify
npm run db:migrate:json -- --source=/absolute/path/to/db.json
```

The migration refuses to overwrite a non-empty target unless `--force` is explicitly supplied and re-reads MySQL to compare collection counts after import.

## Validation performed here

- Every backend JavaScript file passes `node --check`.
- Static scan confirms production controllers/services do not directly read/write `db.json`.
- Static scan confirms low-level persistence is isolated behind repositories (`stateRepository`) except the health check and DB administration/migration scripts.
- Schema regression test added for the required MySQL tables, InnoDB/FK use, and normalized refresh-token table.
- Documentation and Docker configuration were checked for stale production JSON references.

## Environment limitation / manual verification required

A live MySQL integration test could not be executed in this workspace because the supplied archive did not contain `mysql2`, no MySQL/Docker executable is available in the runtime, and package-registry installation did not complete. The code therefore does **not** claim a fabricated database test pass.

`server/package.json` includes `mysql2`, but `server/package-lock.json` could not be regenerated in this offline/blocked environment. On a machine with npm registry access, run:

```bash
cd server
npm install
npm run db:bootstrap
npm run db:verify
npm test
```

Then commit the regenerated `server/package-lock.json`. After that, production/CI can be switched back from `npm install` to `npm ci` for fully deterministic server dependency installs.

## Production cutover checklist

1. Back up the current production `db.json` off-server.
2. Create strong MySQL application/root credentials; never commit them.
3. Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` in production secrets.
4. Run `npm run db:bootstrap` and `npm run db:verify`.
5. Run the JSON migration against the backed-up production JSON file.
6. Review migration count output before starting traffic.
7. Start/restart the API and verify `/health` reports database driver `mysql` and HTTP 200.
8. Exercise login/refresh, listing creation, purchase/idempotency, escrow, chat, membership, badges, uploads, and admin flows.
9. Keep the original JSON backup until MySQL backups have completed and production has been stable.
10. Configure automated MySQL backups to off-server storage.

## Architecture note

The compatibility adapter intentionally preserves complete legacy objects in JSON payload columns while also populating relational/indexed columns. This minimizes migration risk and prevents unknown legacy fields from being discarded. Some repositories still perform state-oriented read/modify/write operations; MySQL transactions and state-version locking make those operations safe, but the next performance/scalability phase should replace them domain-by-domain with targeted SQL queries and updates.
