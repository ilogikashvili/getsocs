#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const [input, output, title = 'Getsocs performance benchmark'] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/performance-report-markdown.js input.json output.md [title]');
  process.exit(2);
}
const report = JSON.parse(fs.readFileSync(input, 'utf8'));
const rows = Array.isArray(report.results) ? report.results : [];
const lines = [
  `# ${title}`,
  '',
  `Generated: ${report.generatedAt || 'unknown'}`,
  '',
  `Target: \`${report.baseUrl || 'unknown'}\``,
  '',
  `Configuration: ${report.config?.requestsPerEndpoint || '?'} requests/endpoint/run, concurrency ${report.config?.concurrency || '?'}, ${report.config?.repeats || 1} repeated run(s), warmup ${report.config?.warmup || 0}.`,
  '',
  '| Endpoint | Requests/run | Concurrency | Avg ms | p50 ms | p95 ms | p99 ms | Errors | RPS |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|'
];
for (const row of rows) lines.push(`| ${row.endpoint} | ${row.requestsPerRun ?? row.requests ?? ''} | ${row.concurrency ?? ''} | ${row.averageMs ?? ''} | ${row.p50Ms ?? ''} | ${row.p95Ms ?? ''} | ${row.p99Ms ?? ''} | ${row.errors ?? ''} | ${row.requestsPerSecond ?? ''} |`);
lines.push('', '> Measurements describe only the target and hardware used for this run. Do not extrapolate production capacity from a development-machine benchmark.', '');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, lines.join('\n'));
console.log(`Saved ${output}`);
