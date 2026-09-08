const metrics = require('../services/metricsService');
function requestMetrics(req, res, next) {
  const started = process.hrtime.bigint();
  res.once('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    const routePath = req.route?.path;
    const route = routePath ? `${req.baseUrl || ''}${routePath}` : (req.baseUrl || 'unmatched');
    metrics.observeRequest({ method: req.method, route, statusCode: res.statusCode, durationMs: elapsedMs });
  });
  next();
}
module.exports = { requestMetrics };
