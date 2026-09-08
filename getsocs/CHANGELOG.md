# Changelog

## 2026-08-19 — Production quality upgrade
- Removed the bundled server `.env` from the upgraded project and added a comprehensive `.gitignore`.
- Added rotating, revocable refresh sessions and JWT token-version invalidation.
- Added request IDs, structured logging, richer health checks and graceful process shutdown.
- Hardened image uploads through random server filenames and decode/re-encode validation.
- Added `/api/v1` compatibility routes, product pagination metadata and purchase idempotency keys.
- Removed production admin/profile fake-data fallbacks.
- Added CI, reproducible deployment script, container configuration and version-controlled Nginx config.
- Added architecture, operations, security and contribution documentation.

## Production hardening pass — 2026-08-19
- Added refresh-token rotation/token-version revocation and secure session controls.
- Added request IDs, structured logging, health checks, graceful shutdown and production env validation.
- Hardened uploads and moved ID-verification documents to private authenticated storage.
- Added API v1 compatibility aliases, pagination and transaction idempotency support.
- Added CI/deployment/container/nginx/PM2 assets and production documentation.
- Hardened JSON persistence with atomic writes and fail-loud corruption behavior.
- Added frontend/backend regression tests for security-critical flows.

## Round 2 hardening
- Added refresh-token family tracking and family-wide revocation on replay detection.
- Added initial backend/frontend coverage floors to prevent silent coverage regression.
- Added Playwright critical-flow E2E scaffold for browser/auth/upload/private-ID authorization checks.
- Added explicit TypeScript migration configuration and shared API domain types.
- Added Dependabot configuration for backend, frontend, and GitHub Actions.
- Synced architecture/runbook/contributing documentation with private ID storage and real test/deploy troubleshooting.

## Performance, observability, storage and scalability pass — 2026-08-19
- Added optional Redis cache-aside infrastructure with deterministic keys, TTLs, invalidation, fallback, single-flight misses, health and cache telemetry.
- Added targeted MySQL product/catalog reads and targeted page-view analytics updates to reduce full-state reads/writes on hot public endpoints.
- Added protected Prometheus/JSON metrics, Grafana dashboard assets, infrastructure metrics and practical Prometheus alert rules.
- Added reproducible baseline/final benchmark tooling and progressive k6 load-test scenarios with production safety guards.
- Added pluggable local/S3-compatible object storage, public/private bucket separation, short-lived private access and migration/verification tooling.
- Hardened marketplace correctness: atomic reservation, competing-purchase rejection, idempotent completion, safe refunds, bid numeric validation and cache invalidation across availability changes.
- Prevented verification-status endpoints from exposing private ID-document metadata.
- Expanded strict TypeScript API/service contracts and added normal + strict service-layer typecheck gates to CI.
- Added MySQL backup/restore tooling, PM2 hardening and expanded Redis/MySQL/container health verification.
- Fixed membership summaries so asynchronous benefit checks resolve to booleans before serialization.
