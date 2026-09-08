# Monitoring decision and production wiring

## Chosen baseline

Getsocs now exposes first-party Prometheus-compatible application metrics and ships a Grafana dashboard/Prometheus alert rules under `infra/monitoring/`. This was chosen for the codebase baseline because it covers request latency/rate/errors, MySQL timings/health, Redis health/hit ratio/memory/evictions, Node memory/CPU counters, host RAM/load/disk/network, and does not require embedding a vendor credential in application code.

Structured JSON logging and request IDs remain the correlation source for individual failures.

## Why a hosted APM SDK is not hard-wired yet

Sentry/Datadog remain valid production options for exception tracing and hosted infrastructure collection. They require an account/DSN/API key, retention/privacy decisions, and a clean dependency install/audit. The supplied development archive has no installed dependencies and registry access is unavailable in the current implementation environment, so adding an unverified SDK and claiming it works would violate the project's verification rule.

A production operator can deploy Prometheus/Grafana as-is or replace the scraper/dashboard with a hosted platform. Do not install two overlapping APM stacks merely to increase the number of dashboards.

## Application metrics

Protected endpoints:

- `/internal/metrics` — JSON snapshot
- `/internal/metrics/prometheus` — Prometheus exposition format

In production set a strong `METRICS_TOKEN` and scrape with bearer-token authentication. Do not expose the token in frontend code or query strings.

Metrics include:

- requests by normalized route and status class
- p50/p95/p99 latency by route
- MySQL operation count/error/latency
- Redis hit/miss/error/hit ratio, latency, memory, keys, connections and evictions
- process RSS/heap/CPU/uptime
- host RAM, load, disk free, and Linux network counters
- database/Redis health gauges

No request bodies, passwords, JWT/refresh tokens, SMTP secrets, ID-document contents or other sensitive payloads are emitted.

## Infrastructure metrics not observable reliably from inside one Node process

PM2 restart history, full host disk-I/O breakdown, hypervisor/network-interface health and provider-level CPU steal are better collected by PM2/provider/node-exporter integrations. The app metrics must not pretend to know how many times a previous process crashed.

## Alerts

`infra/monitoring/prometheus-alerts.yml` includes starting alerts for high 5xx rate, latency, MySQL/Redis unavailability, low disk/RAM, host load pressure, auth-error spikes, Redis evictions and low cache hit ratio. Tune thresholds from production baselines; avoid paging on harmless short spikes.


The internal metrics endpoints are bearer-token protected and independently rate-limited so a misconfigured scraper cannot repeatedly force dependency-health work at an unsafe rate.
