# Getsocs Runbook

## API will not start
Check `pm2 logs`, required environment variables (especially `JWT_SECRET`), dependency installation, port conflicts and the most recent deploy. Validate with `node -c server.js` and `/api/health`.

## Health endpoint is degraded/unhealthy
Inspect the `checks` object from `/api/health`. Database errors indicate MySQL connectivity/schema/credential problems; disk degradation means free space is approaching the safety threshold; `smtp:not_configured` means mail delivery is intentionally unavailable.

## Uploaded files return 404
Check the `/uploads/` Nginx route, `server/uploads` permissions, mounted volume/path and the stored filename in the product record. Reload Nginx only after `nginx -t` succeeds.

## Authentication failures spike
Use request IDs to correlate structured server logs. Confirm server clocks, `JWT_SECRET`, account `tokenVersion`, bans and refresh-cookie handling. Do not weaken token validation to restore access.

## Deployment rollback
Do not deploy when tests/build/audit fail. Revert to the last known-good commit, run `npm ci`, test/build again, reload PM2 and verify `/api/health` before reopening traffic.


## Tests fail on a fresh checkout
Run `npm ci` in both `server/` and `client/`; do not reuse `node_modules` copied from an archive or another OS. For backend tests set a test-only `JWT_SECRET` of at least 32 characters and `TEST_DB_FILE=server.test.json`; the JSON adapter is test-only. SMTP credentials should remain unset because the test suite must not call real mail infrastructure. If `npm ci` reports lockfile drift after changing dependencies, regenerate and commit the lockfile with the same Node/npm major used by CI.

## Verify the upload pipeline after deploy
Upload a normal marketplace/profile image through the browser, confirm the API stores a generated filename, then request the resulting `/uploads/...` URL through Nginx and verify `200` plus an image content type. Separately submit an identity document and verify there is no public `/uploads` URL for it; a normal user must receive `401/403` from the admin verification endpoints while an authorized admin/escrow session can retrieve it. Check `server/private_uploads` ownership/permissions on the VPS and never expose that directory with `express.static` or an Nginx `alias`.

## Production environment validation failure
If startup exits before listening, inspect the structured log entry and run `npm run env:check` from `server/` to validate `server/.env`. Do not bypass `validateEnvironment()` or weaken JWT/CORS/SMTP checks to get the API online. Correct the secret/configuration at the process-manager or deployment-secret layer and restart PM2.


## Playwright E2E fails before the first test
Run `npm ci` in `server/` and `client/`, then `npm install` and `npm run install:browsers` in `e2e/`. The suite creates an isolated `e2e/e2e.test.json` database and must not use real accounts or production secrets. If the managed web servers fail, start the backend and frontend commands from `e2e/playwright.config.js` manually to isolate dependency, port, or startup-validation errors.

## Refresh-token replay detected
Treat a refresh-token replay as a likely session compromise. The application revokes every refresh token in the affected `familyId`, clears the presented cookie and requires login again. Correlate the request ID with structured logs, review account activity, and advise a password change if compromise is suspected. Do not restore the revoked family manually.

## Container health check fails after build
Run the built image with the same required production environment variables as CI and request `/health`. Inspect container logs and the returned health `checks` before deployment. Confirm the MySQL service is healthy, the application DB credentials are valid, and both `uploads`/`private_uploads` mounts are writable by the non-root application user.


## MySQL schema is missing
Run `npm run db:bootstrap` from `server/`, then `npm run db:verify`. In production, confirm `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASS` refer to the intended database before bootstrapping. Do not point the migration script at production until a backup exists.

## JSON to MySQL migration
1. Back up the original `db.json` outside the application directory. 2. Bootstrap and verify the empty MySQL database. 3. Run `npm run db:migrate:json -- --source=/absolute/path/to/db.json`. 4. Review the collection counts printed by the script. 5. Run `npm run db:verify`. 6. Start the API and verify `/health` reports `driver:mysql`. Keep the original JSON backup until production has been stable and separately backed up.

## MySQL concurrent-modification response
The compatibility repository uses `app_meta.state_version` to prevent stale whole-state writes from silently overwriting newer data. A `DB_CONCURRENT_MODIFICATION` error means a request attempted to save a stale snapshot. Retry the user operation; do not disable the version check. As domain repositories move to targeted SQL mutations, this class of conflict will become narrower.
## Redis unavailable
Redis is an optimization. `/health` and `/internal/metrics` should show the Redis failure while public reads continue from MySQL. Check `REDIS_URL`/host/port, local/private-network reachability, memory pressure and `redis-cli PING`. Do not make Redis public to fix connectivity. If Redis remains unavailable, leave the API running on the MySQL fallback and repair Redis separately.

## Cache appears stale
Confirm the affected mutation calls product cache invalidation and inspect `getsocs_cache_*` metrics. For an emergency cache reset, use a namespaced Redis scan/delete rather than `FLUSHALL` on a shared Redis instance. Financial/escrow/auth state is deliberately not cached.

## Object-storage upload fails
With `STORAGE_DRIVER=s3`, verify region/endpoint/bucket names and the application identity's permissions. Do not fall back by making the private bucket public. Existing local staging files are cleaned only after a successful object upload; migration originals are retained unless `--delete-after-verify` is explicitly used. Run `npm run storage:verify` to validate database references.

## MySQL backup / restore drill
Run `npm run db:backup` with `BACKUP_DIR` pointing to a restricted directory, then copy the generated `.sql.gz` and `.sha256` off the VPS. Periodically restore into staging with `CONFIRM_RESTORE=<database> npm run db:restore -- <backup>` and run `npm run db:verify` plus smoke tests. A backup that has never been restored is not considered verified.

## Protected metrics unavailable
In production, `/internal/metrics` requires `METRICS_TOKEN`. Configure Prometheus with the bearer token rather than exposing the endpoint publicly. If scraping fails, verify the token and Nginx/private-network rules; never disable authentication just to restore dashboard data.



### Metrics scraper receives 429
The protected metrics endpoints are rate-limited to prevent accidental scrape storms. Use a normal Prometheus interval (15–60 seconds), verify only one intended scraper is polling the instance, and do not work around the limiter by exposing the endpoint publicly.
