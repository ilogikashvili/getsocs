# k6 load tests

Start on staging. Example:

```bash
k6 run -e BASE_URL=https://staging.example.com -e MAX_VUS=100 -e PRODUCT_ID=<approved-id> performance/k6/getsocs.js
```

Increase `MAX_VUS` through 50, 100, 200, 300, 500, 750 and 1000 only while p95, error rate, CPU/RAM, MySQL and Redis remain safe. The script aborts on a sustained >2% request failure rate. Authentication is optional via `AUTH_TOKEN` and is intentionally a small fraction of traffic.
