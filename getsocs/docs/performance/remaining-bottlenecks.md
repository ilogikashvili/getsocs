# Known performance boundaries after the current upgrade

Redis removes repeated public-read work, but it does not make every write scalable.

## MySQL compatibility state writes

Some domain write operations still use the compatibility repository's state-oriented `withDbLock` / `saveState` flow. That flow deliberately serializes correctness-critical read/modify/write operations and can rewrite multiple table collections. It is safe against stale overwrite, but it will become a write-throughput bottleneck before MySQL itself reaches its normal capacity.

Do not hide this by increasing Redis TTLs. Measure transaction/bid/escrow write latency separately under realistic staging load. The next database-performance refactor should replace state-wide financial mutations with targeted SQL repository methods inside MySQL transactions, preserving idempotency and row-level locking.

## Single Node process

The PM2 configuration remains one process by default. Do not increase instances simply because MySQL now exists: confirm that filesystem storage has moved to S3 (or shared storage), background jobs are safe, Redis is shared, and all remaining state-wide mutations behave correctly across processes.

## CRA frontend build chain

Create React App remains a dependency-health/build-time limitation. Vite migration is intentionally gated on a green frontend test/build baseline and further TypeScript progress.
