const crypto = require('crypto');
function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}
function metricsAuth(req, res, next) {
  if (process.env.NODE_ENV !== 'production' && !process.env.METRICS_TOKEN) return next();
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.get('x-metrics-token');
  if (!safeEqual(token, process.env.METRICS_TOKEN)) return res.status(401).json({ success: false, error: 'Metrics authentication required' });
  next();
}
module.exports = { metricsAuth, safeEqual };
