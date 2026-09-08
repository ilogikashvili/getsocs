# Getsocs monitoring

Getsocs exposes two protected internal endpoints when `METRICS_ENABLED=true`:

- `/internal/metrics` — JSON snapshot for diagnostics.
- `/internal/metrics/prometheus` — Prometheus text exposition.

In production set a long random `METRICS_TOKEN`. Both endpoints require `Authorization: Bearer <METRICS_TOKEN>` (or `X-Metrics-Token`). Do not expose them anonymously. Ideally restrict `/internal/` to localhost/private monitoring networks in Nginx as an additional control.

The application records request count/status/latency, p50/p95/p99 by normalized route, database operation latency/errors, cache hits/misses/errors, process memory/CPU/uptime, host memory/disk, and Redis health/memory/key/connection information. The metrics intentionally never include request bodies, cookies, authorization headers, JWTs, ID-document contents, email addresses or other PII.

## Prometheus

Copy `prometheus.yml.example`, place the metrics token in a root-readable file, and adjust the target. Prometheus supports `authorization.credentials_file`, keeping the token out of the config file.

## Grafana

Import `grafana-dashboard.json`. The dashboard covers request rate, p95/p99 latency, 4xx/5xx, process memory, cache hit ratio, Redis health and DB health.

## Alerts

`prometheus-alerts.yml` supplies conservative starting alerts. Tune them from actual production baselines; do not page on every small anomaly. CPU/RAM/host-level alerting should also be provided by the VPS/node exporter or hosting provider because an application process cannot reliably observe every host resource. PM2 restart-loop alerting belongs in PM2/host monitoring.
