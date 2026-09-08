# Getsocs Architecture

## Runtime
The React client talks to an Express API under `/api`; `/api/v1` is an equivalent versioned route surface for new clients. Express middleware applies CORS, request IDs, JSON limits, security headers, authentication and route-specific rate/upload validation before controllers execute.

## Backend boundaries
Current flow is `route -> controller -> service -> repository -> MySQL adapter`. Controllers, services and authentication middleware do not access the low-level database adapter directly. `server/repositories/stateRepository.js` is the compatibility boundary over the MySQL adapter in `server/config/db.js`. File operations are centralized behind `server/services/storageService.js` rather than using filesystem/S3 SDK calls directly. Domain repositories isolate persistence access; some still expose state-oriented operations so the JSON-era business logic can be preserved while they are narrowed to targeted SQL methods incrementally.

## Authentication
Login and registration require verification flows. Successful verification creates a short-lived JWT access token containing `tokenVersion` plus a random refresh token. Only a SHA-256 hash of each refresh token is stored. Refresh tokens rotate on use, are transported in HTTP-only cookies, and belong to a server-side `familyId`. Used-token records are retained until expiry so replay can be detected; replay revokes the entire token family and forces re-authentication. Password changes, logout-everywhere and administrative bans revoke all sessions by incrementing `tokenVersion` and clearing refresh-token records.

## Storage
Production uses MySQL 8+ with InnoDB transactions, connection pooling, foreign keys, indexes, and an application state-version row for optimistic concurrency control. `withDbLock` uses a database row lock for serialized read-modify-write operations. JSON files are limited to test fixtures and one-time migration imports; they are not a production persistence fallback. See `DATABASE.md` and `server/database/schema.sql`.

## Files
Uploads are decoded/normalized before persistence and then pass through `server/services/storageService.js`. With `STORAGE_DRIVER=local`, public assets live under `server/uploads` and private identity documents under `server/private_uploads`; the private directory is never mounted as static content. With `STORAGE_DRIVER=s3`, product/profile assets go to the public bucket and identity documents go to a separate private bucket. The database stores object keys rather than signed URLs. Private reads remain authorization-gated and receive a short-lived signed URL only after an admin/escrow role check. The migration script verifies every uploaded object before database references change and retains local originals by default.

## Redis and observability
Redis is an optional cache-aside layer behind `cacheService`; it is never authoritative. Anonymous approved-product lists/search/detail and selected public metadata use namespaced TTLs. Product availability mutations invalidate affected cache namespaces. Redis timeout/unavailability falls back to MySQL. Request, database and cache telemetry is collected without request bodies and is exposed only through the protected internal metrics endpoints.

## External dependencies
SMTP is used for verification email and the YouTube API may be used for channel verification. Both synchronous dependency paths have timeouts/circuit-breaker protection so repeated upstream failures fail fast. Redis now exists for caching, but BullMQ/background jobs are still intentionally deferred until Redis is deployed and monitored reliably in the target environment; caching alone is not justification to move correctness-critical work into a queue.
