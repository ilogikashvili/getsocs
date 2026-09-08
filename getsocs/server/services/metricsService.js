const os = require('os');
const fs = require('fs');

const MAX_SAMPLES_PER_ROUTE = Math.max(100, Number(process.env.METRICS_MAX_SAMPLES_PER_ROUTE || 2000));
const startedAt = Date.now();
const requests = new Map();
const database = new Map();
const cache = { hits: 0, misses: 0, errors: 0, sets: 0, deletes: 0, latencyMs: [] };

function boundedPush(target, value, max = MAX_SAMPLES_PER_ROUTE) {
  if (!Number.isFinite(value)) return;
  target.push(value);
  if (target.length > max) target.splice(0, target.length - max);
}
function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return Number(sorted[index].toFixed(2));
}
function normalizeRouteLabel(method, route) {
  const safeMethod = String(method || 'GET').toUpperCase();
  const safeRoute = String(route || 'unmatched').replace(/\?.*$/, '').slice(0, 180);
  return `${safeMethod} ${safeRoute}`;
}
function observeRequest({ method, route, statusCode, durationMs }) {
  const key = normalizeRouteLabel(method, route);
  const row = requests.get(key) || { count: 0, status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0, latencyMs: [] };
  row.count += 1;
  const code = Number(statusCode) || 0;
  if (code >= 500) row.status5xx += 1;
  else if (code >= 400) row.status4xx += 1;
  else if (code >= 300) row.status3xx += 1;
  else if (code >= 200) row.status2xx += 1;
  boundedPush(row.latencyMs, Number(durationMs));
  requests.set(key, row);
}
function observeDatabase(operation, durationMs, ok = true) {
  const key = String(operation || 'unknown').slice(0, 80);
  const row = database.get(key) || { count: 0, errors: 0, latencyMs: [] };
  row.count += 1;
  if (!ok) row.errors += 1;
  boundedPush(row.latencyMs, Number(durationMs));
  database.set(key, row);
}
function observeCache(event, durationMs = 0) {
  if (event === 'hit') cache.hits += 1;
  else if (event === 'miss') cache.misses += 1;
  else if (event === 'error') cache.errors += 1;
  else if (event === 'set') cache.sets += 1;
  else if (event === 'delete') cache.deletes += 1;
  boundedPush(cache.latencyMs, Number(durationMs), 5000);
}
function summarizeLatency(values) {
  if (!values.length) return { averageMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0 };
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    averageMs: Number((total / values.length).toFixed(2)),
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
    p99Ms: percentile(values, 99)
  };
}
function getDiskSnapshot() {
  try {
    if (typeof fs.statfsSync !== 'function') return {};
    const stat = fs.statfsSync(process.cwd());
    return { diskTotalBytes: Number(stat.blocks) * Number(stat.bsize), diskFreeBytes: Number(stat.bavail) * Number(stat.bsize) };
  } catch (_) { return {}; }
}
function getAvailableMemoryBytes() {
  try {
    if (process.platform === 'linux') {
      const match = fs.readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+)\s+kB$/m);
      if (match) return Number(match[1]) * 1024;
    }
  } catch (_) {}
  return os.freemem();
}
function getNetworkSnapshot() {
  try {
    if (process.platform !== 'linux') return {};
    const body = fs.readFileSync('/proc/net/dev', 'utf8');
    let receiveBytes = 0, transmitBytes = 0;
    for (const line of body.split('\n').slice(2)) {
      const match = line.match(/^\s*([^:]+):\s*(.+)$/);
      if (!match) continue;
      const iface = match[1].trim();
      if (iface === 'lo') continue;
      const fields = match[2].trim().split(/\s+/).map(Number);
      if (Number.isFinite(fields[0])) receiveBytes += fields[0];
      if (Number.isFinite(fields[8])) transmitBytes += fields[8];
    }
    return { networkReceiveBytes: receiveBytes, networkTransmitBytes: transmitBytes };
  } catch (_) { return {}; }
}
function getSnapshot(extra = {}) {
  const requestRows = {};
  let totalRequests = 0, total4xx = 0, total5xx = 0;
  for (const [key, row] of requests.entries()) {
    totalRequests += row.count; total4xx += row.status4xx; total5xx += row.status5xx;
    requestRows[key] = { ...row, latencyMs: undefined, ...summarizeLatency(row.latencyMs) };
  }
  const databaseRows = {};
  for (const [key, row] of database.entries()) databaseRows[key] = { count: row.count, errors: row.errors, ...summarizeLatency(row.latencyMs) };
  const hitDenominator = cache.hits + cache.misses;
  const memory = process.memoryUsage();
  return {
    generatedAt: new Date().toISOString(),
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      externalBytes: memory.external,
      cpuUsageMicros: process.cpuUsage(),
      pid: process.pid,
      nodeVersion: process.version
    },
    host: {
      loadAverage: os.loadavg(),
      totalMemoryBytes: os.totalmem(),
      freeMemoryBytes: os.freemem(),
      availableMemoryBytes: getAvailableMemoryBytes(),
      cpuCount: os.cpus().length,
      ...getDiskSnapshot(),
      ...getNetworkSnapshot()
    },
    http: {
      totalRequests,
      fourXx: total4xx,
      fiveXx: total5xx,
      errorRate: totalRequests ? Number(((total5xx / totalRequests) * 100).toFixed(3)) : 0,
      routes: requestRows
    },
    database: databaseRows,
    cache: {
      hits: cache.hits, misses: cache.misses, errors: cache.errors, sets: cache.sets, deletes: cache.deletes,
      hitRatio: hitDenominator ? Number((cache.hits / hitDenominator).toFixed(4)) : 0,
      ...summarizeLatency(cache.latencyMs)
    },
    ...extra
  };
}
function prometheusEscape(value) { return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n'); }
function toPrometheus(extra = {}) {
  const snapshot = getSnapshot(extra);
  const lines = [
    '# HELP getsocs_http_requests_total Total HTTP requests observed by route and status class.',
    '# TYPE getsocs_http_requests_total counter'
  ];
  for (const [route, row] of Object.entries(snapshot.http.routes)) {
    for (const [statusClass, field] of [['2xx','status2xx'],['3xx','status3xx'],['4xx','status4xx'],['5xx','status5xx']]) {
      const count = row[field] || 0;
      lines.push(`getsocs_http_requests_total{route="${prometheusEscape(route)}",status_class="${statusClass}"} ${count}`);
    }
    lines.push(`getsocs_http_latency_p50_ms{route="${prometheusEscape(route)}"} ${row.p50Ms}`);
    lines.push(`getsocs_http_latency_p95_ms{route="${prometheusEscape(route)}"} ${row.p95Ms}`);
    lines.push(`getsocs_http_latency_p99_ms{route="${prometheusEscape(route)}"} ${row.p99Ms}`);
  }
  for (const [operation, row] of Object.entries(snapshot.database)) {
    lines.push(`getsocs_database_operation_total{operation="${prometheusEscape(operation)}"} ${row.count}`);
    lines.push(`getsocs_database_operation_errors_total{operation="${prometheusEscape(operation)}"} ${row.errors}`);
    lines.push(`getsocs_database_latency_p95_ms{operation="${prometheusEscape(operation)}"} ${row.p95Ms}`);
  }
  lines.push(`# TYPE getsocs_cache_hits_total counter\ngetsocs_cache_hits_total ${snapshot.cache.hits}`);
  lines.push(`# TYPE getsocs_cache_misses_total counter\ngetsocs_cache_misses_total ${snapshot.cache.misses}`);
  lines.push(`# TYPE getsocs_cache_errors_total counter\ngetsocs_cache_errors_total ${snapshot.cache.errors}`);
  lines.push(`# TYPE getsocs_cache_hit_ratio gauge\ngetsocs_cache_hit_ratio ${snapshot.cache.hitRatio}`);
  lines.push(`# TYPE process_resident_memory_bytes gauge\nprocess_resident_memory_bytes ${snapshot.process.rssBytes}`);
  lines.push(`# TYPE nodejs_heap_size_used_bytes gauge\nnodejs_heap_size_used_bytes ${snapshot.process.heapUsedBytes}`);
  lines.push(`# TYPE getsocs_process_uptime_seconds gauge\ngetsocs_process_uptime_seconds ${snapshot.process.uptimeSeconds}`);
  lines.push(`# TYPE process_cpu_seconds_total counter\nprocess_cpu_seconds_total ${(snapshot.process.cpuUsageMicros.user + snapshot.process.cpuUsageMicros.system) / 1e6}`);
  if (Number.isFinite(snapshot.host.totalMemoryBytes)) lines.push(`# TYPE getsocs_host_memory_total_bytes gauge\ngetsocs_host_memory_total_bytes ${snapshot.host.totalMemoryBytes}`);
  if (Number.isFinite(snapshot.host.freeMemoryBytes)) lines.push(`# TYPE getsocs_host_memory_free_bytes gauge\ngetsocs_host_memory_free_bytes ${snapshot.host.freeMemoryBytes}`);
  if (Number.isFinite(snapshot.host.availableMemoryBytes)) lines.push(`# TYPE getsocs_host_memory_available_bytes gauge\ngetsocs_host_memory_available_bytes ${snapshot.host.availableMemoryBytes}`);
  if (Number.isFinite(snapshot.host.diskFreeBytes)) lines.push(`# TYPE getsocs_disk_free_bytes gauge\ngetsocs_disk_free_bytes ${snapshot.host.diskFreeBytes}`);
  if (Number.isFinite(snapshot.host.diskTotalBytes)) lines.push(`# TYPE getsocs_disk_total_bytes gauge\ngetsocs_disk_total_bytes ${snapshot.host.diskTotalBytes}`);
  if (Array.isArray(snapshot.host.loadAverage) && Number.isFinite(snapshot.host.loadAverage[0])) lines.push(`# TYPE getsocs_host_load1 gauge\ngetsocs_host_load1 ${snapshot.host.loadAverage[0]}`);
  if (Number.isFinite(snapshot.host.cpuCount)) lines.push(`# TYPE getsocs_host_cpu_count gauge\ngetsocs_host_cpu_count ${snapshot.host.cpuCount}`);
  if (Number.isFinite(snapshot.host.networkReceiveBytes)) lines.push(`# TYPE getsocs_network_receive_bytes_total counter\ngetsocs_network_receive_bytes_total ${snapshot.host.networkReceiveBytes}`);
  if (Number.isFinite(snapshot.host.networkTransmitBytes)) lines.push(`# TYPE getsocs_network_transmit_bytes_total counter\ngetsocs_network_transmit_bytes_total ${snapshot.host.networkTransmitBytes}`);
  if (snapshot.dependencies?.database) lines.push(`# TYPE getsocs_database_up gauge\ngetsocs_database_up ${snapshot.dependencies.database.status === 'ok' ? 1 : 0}`);
  if (snapshot.redis) lines.push(`# TYPE getsocs_redis_up gauge\ngetsocs_redis_up ${snapshot.redis.status === 'ok' || snapshot.redis.status === 'disabled' ? 1 : 0}`);
  if (snapshot.redis && Number.isFinite(snapshot.redis.memoryUsedBytes)) lines.push(`# TYPE getsocs_redis_memory_used_bytes gauge\ngetsocs_redis_memory_used_bytes ${snapshot.redis.memoryUsedBytes}`);
  if (snapshot.redis && Number.isFinite(snapshot.redis.keys)) lines.push(`# TYPE getsocs_redis_keys gauge\ngetsocs_redis_keys ${snapshot.redis.keys}`);
  if (snapshot.redis && Number.isFinite(snapshot.redis.connections)) lines.push(`# TYPE getsocs_redis_connections gauge\ngetsocs_redis_connections ${snapshot.redis.connections}`);
  if (snapshot.redis && Number.isFinite(snapshot.redis.evictedKeys)) lines.push(`# TYPE getsocs_redis_evicted_keys_total counter\ngetsocs_redis_evicted_keys_total ${snapshot.redis.evictedKeys}`);
  return lines.join('\n') + '\n';
}
function resetForTests() { requests.clear(); database.clear(); cache.hits=0; cache.misses=0; cache.errors=0; cache.sets=0; cache.deletes=0; cache.latencyMs=[]; }
module.exports = { observeRequest, observeDatabase, observeCache, getSnapshot, toPrometheus, resetForTests, percentile, normalizeRouteLabel, startedAt };
