# Backend API adversarial audit — 2026-09-06

## Scope and results

Exercised **2,527 HTTP requests** with Supertest against the actual Express app: all **140 declared router operations**, mounted under both `/api` and `/api/v1` (**280 method/path combinations**). The matrix covers anonymous, invalid-token, expired-token, banned-user, ordinary-user, and admin requests. Three seeded input mutations per mounted route add malformed field types, boundary numbers, injection strings, and invalid query parameters. Seed: `20260906`. Each request resets disposable fixture data for reproducibility.

HTTP totals: 737 × 200, 341 × 400, 922 × 401, 399 × 403, 128 × 404. No 500 responses or timeouts occurred in this sweep. Six targeted assertions failed; these represent the findings below, not six distinct vulnerabilities. The ordinary outsider transaction-access probe correctly returned 403. Requests returning 200 in the broad sweep are observations, not automatically proof of correct behavior.

## Confirmed findings

### High: one participant can assert both parties' escrow consent

As the buyer of a pending transaction, send:

```http
POST /api/escrow/initiate
Authorization: Bearer <buyer-token>
Content-Type: application/json

{"transactionId":"transaction","buyerConfirmed":true,"sellerConfirmed":true}
```

Observed: 200; an active escrow is created with both confirmations set to true, although the seller has made no confirmation request. `controllers/escrowController.js` passes the caller's flags to `services/escrowService.js`, which changes the transaction status to `escrow_active`. Store each participant's consent independently and derive readiness from server state. This reproduces a workflow bypass; no actual money movement was tested.

### Medium: string `"false"` counts as consent

The same request with `"buyerConfirmed":"false","sellerConfirmed":"false"` also returns 200 and records both confirmations as true. Truthiness checks accept non-boolean values. Strict type validation is needed in addition to independent consent recording.

### High, conditional on an existing stale privileged token: token role overrides current database role

A valid signed token with role `admin` belonging to a fixture user whose current database role is `user` received 200 from all three:

- `GET /api/membership/admin/subscriptions`
- `GET /api/escrow/admin/all`
- `GET /api/membership/membership/seller`

`middleware/authMiddleware.js` loads the current user but assigns decoded token claims to `req.user`. These controllers authorize using `req.user.role`. Resolve authorization roles from the current database record and revoke/version tokens when privileges change.

**Precondition:** the test simulates a previously issued privileged token, using the local test signing key. It does not demonstrate token forgery. The normal role-change API explicitly blocks admin demotion, so the reproduced state requires an out-of-band role change or another path that leaves stale claims. This limitation matters when assessing exploitability.

### Low: unknown API GET routes return the frontend with HTTP 200

`GET /api/not-a-real-endpoint` returns 200 instead of 404 because the frontend fallback in `server.js` catches unmatched API GETs. Return a JSON API 404 before the SPA fallback to avoid misleading clients and monitors.

## Conditional deployment finding: forwarded IP can evade throttling

A separate ten-request probe uses the actual login limiter outside test mode, a ceiling of three requests, and the app's default `trust proxy = 1`. Same-IP requests returned `401,401,401,429,429`; five requests with changing `X-Forwarded-For` values all returned 401 and avoided the exhausted bucket.

This is exploitable if callers can reach the backend directly or a proxy preserves an attacker-controlled rightmost forwarded address. A correctly configured trusted reverse proxy can prevent that. Deployment topology was not inspected. Restrict backend ingress and trust only the actual proxy topology. Evidence: `rate-limit-probe.json`.

## Existing test suite quality

The initial full run reported 541 passed and two timeouts out of 543 tests. Both timed-out cases belong to `rateLimiting.test.js`; its isolated rerun with SMTP explicitly disabled passed all 33 tests. PowerShell empty environment assignments had allowed dotenv to repopulate SMTP settings in the first run. The full isolated rerun then passed **543/543 tests across all 29 suites**, recorded separately in `existing-tests-isolated.json`.

`tests/idor.test.js` has an access-denial test that calls `done()` without the assertion error after an unexpected response; it can falsely pass. The independent outsider-transaction probe here does enforce 403 and passed. Several rate-limiting tests use `expect(true).toBe(true)` or inspect source text instead of exercising enforcement. Do not treat those as evidence of resistance to brute force.

## Reproduce

From `getsocs/server`:

```powershell
node scripts/api-adversarial-audit.js
node scripts/api-rate-limit-audit.js
```

The first script uses its own temporary file database and local signing key, disables Redis, SMTP, and payments, and deletes only its temporary fixture directory. It writes requests, actor labels, responses for failures, route inventory, and summary to `adversarial-results.json`. Tokens are not written into the report. The second script exercises the real limiter in a minimal local Express app without loading deployment configuration. Scripts report observations; finding a vulnerability does not make their process exit nonzero.

## Limits

This is a broad reproducible sample, not exhaustive testing of every possible value or workflow sequence. The randomized matrix resets state per request and uses only three mutations per route; it does not cover every combination of fields, roles, resource ownership, or lifecycle state. Existing tests supply additional successful workflows, file upload checks, IDOR, idempotency, and validation coverage.

The main sweep disables rate limiting to reach controllers; the separate probe covers login throttling. MySQL/Redis integration, production concurrency and race conditions, real payments, external provider behavior, infrastructure exposure, and sustained load were not verified. Health, metrics, static files, and documentation routes outside the 11 API router groups are not part of the 280-route matrix. No backend implementation changes were made; this delivery consists of audit scripts and evidence.
