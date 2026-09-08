const DEFAULT_IP_BAN_MS = Number(process.env.IP_BAN_DURATION_HOURS || 24) * 60 * 60 * 1000;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || (req.connection && req.connection.remoteAddress) || '';
}

function banIp(db, ip, durationMs = DEFAULT_IP_BAN_MS) {
  if (!ip) return;
  if (!Array.isArray(db.bannedIps)) db.bannedIps = [];
  const existing = db.bannedIps.find(entry => entry.ip === ip);
  const until = Date.now() + durationMs;
  if (existing) {
    existing.until = until;
  } else {
    db.bannedIps.push({ ip, until, bannedAt: new Date().toISOString() });
  }
}

function isIpBanned(db, ip) {
  if (!ip || !Array.isArray(db.bannedIps)) return false;
  const entry = db.bannedIps.find(item => item.ip === ip);
  if (!entry) return false;
  if (entry.until && entry.until < Date.now()) return false;
  return true;
}

module.exports = { getClientIp, banIp, isIpBanned, DEFAULT_IP_BAN_MS };
