# Contributing

Use Node.js 22 LTS. Install dependencies separately in `server/` and `client/`. After dependency changes, run `npm install` once in `server/` to regenerate `package-lock.json` (current runtime additions include MySQL, Redis and S3-compatible storage clients), commit the refreshed lockfile, then return to `npm ci` for reproducible installs. Copy `server/.env` to `server/.env` locally and supply non-production development credentials.

Backend: `npm test` then `npm start`. Frontend: `npm run typecheck`, `npm run typecheck:services`, `npm test -- --watchAll=false`, `npm run build`, then `npm start` for local interactive work.

Use focused branches and pull requests. PRs should explain behavior changes, security implications, tests added and any migration/manual deployment steps. Never disable tests or delete working functionality to make CI green.


## Test environment
Backend unit tests use an explicit JSON fixture adapter only when `NODE_ENV=test` and `TEST_DB_FILE` are set. Production never falls back to JSON. The standard test script supplies the test database path; CI sets:

```bash
NODE_ENV=test
TEST_DB_FILE=server.test.json
JWT_SECRET=ci-only-secret-that-is-at-least-32-characters-long
```

SMTP credentials are intentionally not required for tests; mail is mocked/disabled. Never copy production secrets into a local test environment.

Browser E2E tests are isolated and create their own users in `e2e/e2e.test.json`; they do **not** require production credentials or pre-seeded accounts. Run them with:

```bash
cd e2e
npm install
npm run install:browsers
npm test
```

The Playwright config starts the backend in test mode with an isolated file database and starts the CRA development server automatically. Delete generated `e2e.test.json`, `test-results/` and `playwright-report/` artifacts after local runs; they are ignored by Git.
