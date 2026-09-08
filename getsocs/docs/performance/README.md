# Getsocs performance workflow

Performance claims must be based on repeatable measurements. Run the baseline against staging or a controlled production window, deploy one change set, then run the same benchmark with the same request count and concurrency.

Commands (from `server/`):

```bash
node scripts/collect-infrastructure-baseline.js
npm run perf:baseline -- --base-url=http://127.0.0.1:3001 --requests=500 --concurrency=25
# after changes
npm run perf:final -- --base-url=http://127.0.0.1:3001 --requests=500 --concurrency=25
```

Set `PERF_PRODUCT_ID` to include product detail and `PERF_AUTH_TOKEN` to include `/api/auth/me`. The benchmark refuses `getsocs.com` unless `ALLOW_PRODUCTION_LOAD_TEST=true`.
