const crypto = require('crypto');

function getIdempotencyKey(req) {
  const key = req.get('Idempotency-Key');
  if (!key) return null;
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return false;
  return key;
}
function fingerprint(req) {
  return crypto.createHash('sha256').update(JSON.stringify({ method: req.method, path: req.originalUrl, userId: req.user?.id, body: req.body || {} })).digest('hex');
}
function findExisting(db, key, req) {
  db.idempotencyKeys = Array.isArray(db.idempotencyKeys) ? db.idempotencyKeys.filter(x => Date.parse(x.expiresAt) > Date.now()) : [];
  const hit = db.idempotencyKeys.find(x => x.key === key && x.userId === req.user?.id);
  if (!hit) return null;
  if (hit.fingerprint !== fingerprint(req)) return { conflict: true };
  return hit;
}
function saveResult(db, key, req, statusCode, body) {
  db.idempotencyKeys = Array.isArray(db.idempotencyKeys) ? db.idempotencyKeys : [];
  db.idempotencyKeys.push({ key, userId: req.user?.id, fingerprint: fingerprint(req), statusCode, body, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
}
module.exports = { getIdempotencyKey, findExisting, saveResult };
