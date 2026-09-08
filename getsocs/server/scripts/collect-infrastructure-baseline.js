#!/usr/bin/env node
const os = require('os');
const fs = require('fs');
const cp = require('child_process');
const path = require('path');

function command(cmd) { try { return cp.execSync(cmd, { encoding:'utf8', stdio:['ignore','pipe','ignore'] }).trim(); } catch (_) { return null; } }
function disk() { try { const s=fs.statfsSync(process.cwd()); return { totalBytes:Number(s.blocks)*Number(s.bsize), freeBytes:Number(s.bavail)*Number(s.bsize) }; } catch (_) { return null; } }
function treeStats(root) {
  let files=0, bytes=0;
  if (!fs.existsSync(root)) return { files, bytes, path:root };
  const visit=dir=>{ for (const entry of fs.readdirSync(dir,{withFileTypes:true})) { const full=path.join(dir,entry.name); if(entry.isDirectory()) visit(full); else if(entry.isFile()) { try { const stat=fs.statSync(full); files++; bytes+=stat.size; } catch (_) {} } } };
  visit(root); return { files, bytes, path:root };
}
function pm2Snapshot() {
  const raw=command('pm2 jlist'); if(!raw) return null;
  try { return JSON.parse(raw).map(app=>({ name:app.name, pid:app.pid, status:app.pm2_env?.status, restarts:app.pm2_env?.restart_time, unstableRestarts:app.pm2_env?.unstable_restarts, memoryBytes:app.monit?.memory, cpuPercent:app.monit?.cpu })); } catch (_) { return null; }
}
async function applicationMetrics() {
  const url=process.env.PERF_METRICS_URL;
  if (!url) return { collected:false, reason:'Set PERF_METRICS_URL to the protected /internal/metrics endpoint on the target environment.' };
  try {
    const headers={}; if(process.env.METRICS_TOKEN) headers.Authorization=`Bearer ${process.env.METRICS_TOKEN}`;
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(5000)});
    if(!response.ok) return { collected:false, status:response.status };
    const body=await response.json();
    return { collected:true, http:body.http, process:body.process, database:body.database, cache:body.cache, redis:body.redis, dependencies:body.dependencies };
  } catch(error) { return { collected:false, error:error.message }; }
}

(async()=>{
  const serverRoot=path.resolve(__dirname,'..');
  const report={
    generatedAt:new Date().toISOString(),
    warning:'This describes the machine where this script was run. Run it on the production VPS for a production baseline.',
    cpu:{ model:os.cpus()[0]?.model, count:os.cpus().length, loadAverage:os.loadavg() },
    ram:{ totalBytes:os.totalmem(), freeBytes:os.freemem() }, disk:disk(),
    versions:{ node:process.version, npm:command('npm --version'), pm2:command('pm2 --version'), nginx:command('nginx -v 2>&1'), mysql:command('mysql --version'), redis:command('redis-server --version') },
    database:{ implementation:'MySQL 8/InnoDB via mysql2 repository adapter', host:process.env.DB_HOST || null, database:process.env.DB_NAME || null },
    uploads:{ public:treeStats(path.join(serverRoot,'uploads')), private:treeStats(path.join(serverRoot,'private_uploads')) },
    process:{ rssBytes:process.memoryUsage().rss }, pm2:pm2Snapshot(),
    git:{ commit:command('git rev-parse HEAD'), branch:command('git branch --show-current'), clean:command('git status --porcelain')==='' },
    application:await applicationMetrics()
  };
  const out=process.argv[2]||path.join(process.cwd(),'..','docs','performance','infrastructure.local.json');
  fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n'); console.log(out);
})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
