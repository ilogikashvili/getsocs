const fs = require('fs');
const path = require('path');
const { checkDatabaseConnection } = require('../config/db');
const cacheService = require('./cacheService');

async function checkDatabase() {
  try {
    const result = await checkDatabaseConnection();
    return { status: 'ok', ...result };
  } catch (error) { return { status: 'error', error: error.message }; }
}
function checkDisk() {
  try {
    const target = path.join(__dirname, '..');
    if (typeof fs.statfsSync !== 'function') return { status: 'unknown', reason: 'statfs unavailable' };
    const stat = fs.statfsSync(target);
    const freeBytes = Number(stat.bavail) * Number(stat.bsize);
    return { status: freeBytes > 100 * 1024 * 1024 ? 'ok' : 'degraded', freeBytes };
  } catch (error) { return { status: 'error', error: error.message }; }
}
async function getHealth() {
  const checks = {
    database: await checkDatabase(),
    disk: checkDisk(),
    smtp: { status: process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS ? 'configured' : 'not_configured' },
    redis: await cacheService.health()
  };
  const unhealthy = Object.values(checks).some(c => c.status === 'error');
  const degraded = Object.values(checks).some(c => c.status === 'degraded');
  return { status: unhealthy ? 'error' : degraded ? 'degraded' : 'ok', uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString(), checks };
}
module.exports = { getHealth };
