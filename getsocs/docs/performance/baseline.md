# Production performance baseline

> Status: **requires live VPS/staging measurement.** The source archive does not contain Git metadata, VPS telemetry, production credentials, or a running production deployment, so values are intentionally not fabricated.

Record: VPS CPU/RAM/disk, Node/npm/PM2/Nginx/MySQL/Redis versions, upload count/size, PM2 restarts, process memory, request rate/error rate, and the benchmark table below.

| Endpoint | Requests | Concurrency | Average | p50 | p95 | p99 | Errors | Requests/sec |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `/api/products` | | | | | | | | |
| product search | | | | | | | | |
| product filtering | | | | | | | | |
| product detail | | | | | | | | |
| profile | | | | | | | | |
| badges | | | | | | | | |
| membership | | | | | | | | |

Use `server/scripts/benchmark.js` to create machine-readable JSON and paste the production/staging results here.
