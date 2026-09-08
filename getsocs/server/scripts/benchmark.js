#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const { URL } = require('url');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const baseUrl = arg('base-url', process.env.PERF_BASE_URL || 'http://127.0.0.1:3001');
const requestsPerEndpoint = Math.max(1, Number(arg('requests', process.env.PERF_REQUESTS || 200)));
const concurrency = Math.max(1, Number(arg('concurrency', process.env.PERF_CONCURRENCY || 20)));
const warmup = Math.max(0, Number(arg('warmup', process.env.PERF_WARMUP || 10)));
const output = arg('output', null);
const repeats = Math.max(1, Number(arg('runs', process.env.PERF_RUNS || 3)));
const authToken = process.env.PERF_AUTH_TOKEN || '';
const endpoints = [
  { name: 'product-list', path: '/api/products?page=1&limit=20' },
  { name: 'product-search', path: '/api/products/search?search=test&page=1&limit=20' },
  { name: 'product-filter', path: '/api/products?platform=youtube&page=1&limit=20' },
  { name: 'metadata-platforms', path: '/api/meta/platforms' },
  { name: 'badges-all', path: '/api/badges/all' },
  { name: 'membership-tiers', path: '/api/membership/tiers' }
];
if (process.env.PERF_PRODUCT_ID) endpoints.push({ name: 'product-detail', path: `/api/products/${encodeURIComponent(process.env.PERF_PRODUCT_ID)}` });
if (authToken) endpoints.push({ name: 'profile-me', path: '/api/auth/me', auth: true });

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * pct / 100) - 1))];
}
async function request(endpoint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.PERF_REQUEST_TIMEOUT_MS || 10000));
  const started = process.hrtime.bigint();
  try {
    const response = await fetch(new URL(endpoint.path, baseUrl), {
      headers: endpoint.auth && authToken ? { Authorization: `Bearer ${authToken}` } : {}, signal: controller.signal
    });
    await response.arrayBuffer();
    return { ms: Number(process.hrtime.bigint() - started) / 1e6, status: response.status, ok: response.ok };
  } catch (error) {
    return { ms: Number(process.hrtime.bigint() - started) / 1e6, status: 0, ok: false, error: error.name };
  } finally { clearTimeout(timer); }
}
async function runEndpoint(endpoint) {
  for (let i=0;i<warmup;i++) await request(endpoint);
  let next=0; const results=[]; const started=Date.now();
  const workers=Array.from({length:Math.min(concurrency, requestsPerEndpoint)}, async()=>{
    while (true) {
      const i=next++; if (i>=requestsPerEndpoint) break;
      results.push(await request(endpoint));
    }
  });
  await Promise.all(workers);
  const wallMs=Date.now()-started;
  const latencies=results.map(r=>r.ms);
  const errors=results.filter(r=>!r.ok).length;
  return {
    endpoint:endpoint.name, path:endpoint.path, requests:results.length, concurrency,
    averageMs:Number((latencies.reduce((a,b)=>a+b,0)/Math.max(1,latencies.length)).toFixed(2)),
    p50Ms:Number(percentile(latencies,50).toFixed(2)), p95Ms:Number(percentile(latencies,95).toFixed(2)), p99Ms:Number(percentile(latencies,99).toFixed(2)),
    errors, errorRate:Number((errors/Math.max(1,results.length)).toFixed(4)), requestsPerSecond:Number((results.length/(wallMs/1000)).toFixed(2)), wallMs,
    statuses: results.reduce((acc,r)=>{acc[r.status]=(acc[r.status]||0)+1;return acc;},{})
  };
}
(async()=>{
  const target = new URL(baseUrl);
  if (/getsocs\.com$/i.test(target.hostname) && process.env.ALLOW_PRODUCTION_LOAD_TEST !== 'true') {
    throw new Error('Refusing to benchmark getsocs.com without ALLOW_PRODUCTION_LOAD_TEST=true. Use staging first.');
  }
  const runs=[];
  for (let run=1; run<=repeats; run++) {
    const rows=[];
    console.log(`\nRun ${run}/${repeats}`);
    for (const endpoint of endpoints) {
      process.stdout.write(`Benchmarking ${endpoint.name}... `);
      const row=await runEndpoint(endpoint); rows.push(row);
      console.log(`${row.p95Ms}ms p95, ${row.requestsPerSecond} req/s, ${row.errors} errors`);
    }
    runs.push({ run, results: rows });
  }
  const metricMedian = (values) => Number(percentile(values.filter(Number.isFinite), 50).toFixed(2));
  const aggregate=endpoints.map(endpoint=>{
    const rows=runs.map(run=>run.results.find(row=>row.endpoint===endpoint.name));
    return {
      endpoint:endpoint.name, path:endpoint.path, requestsPerRun:requestsPerEndpoint, concurrency, repeats,
      averageMs:metricMedian(rows.map(r=>r.averageMs)), p50Ms:metricMedian(rows.map(r=>r.p50Ms)),
      p95Ms:metricMedian(rows.map(r=>r.p95Ms)), p99Ms:metricMedian(rows.map(r=>r.p99Ms)),
      errors:rows.reduce((sum,r)=>sum+r.errors,0),
      errorRate:metricMedian(rows.map(r=>r.errorRate)), requestsPerSecond:metricMedian(rows.map(r=>r.requestsPerSecond))
    };
  });
  const report={
    generatedAt:new Date().toISOString(), baseUrl, node:process.version, host:{platform:process.platform,arch:process.arch,cpuCount:os.cpus().length,totalMemoryBytes:os.totalmem()},
    config:{requestsPerEndpoint,concurrency,warmup,repeats}, results:aggregate, runs
  };
  const body=JSON.stringify(report,null,2)+'\n';
  if (output) { fs.mkdirSync(require('path').dirname(output),{recursive:true}); fs.writeFileSync(output,body); console.log(`Saved ${output}`); }
  else console.log(body);
})().catch(error=>{ console.error(error.stack||error.message); process.exit(1); });
