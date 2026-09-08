const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (error) {
  console.warn('dotenv is not available, continuing without it:', error.message);
}

const { validateEnvironment } = require('./config/env');
validateEnvironment();

const express = require('express');
const fs = require('fs');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { addSecurityHeaders } = require('./middleware/securityHeaders');
const { requestContext } = require('./middleware/requestContext');
const { requestMetrics } = require('./middleware/requestMetrics');
const { metricsAuth } = require('./middleware/metricsAuth');
const metricsService = require('./services/metricsService');
const cacheService = require('./services/cacheService');
const storageService = require('./services/storageService');
const { generalLimiter, metricsLimiter } = require('./middleware/rateLimitMiddleware');
const { getHealth } = require('./services/healthService');
const logger = require('./utils/logger');
const { initializeDatabase, closeDatabase } = require('./config/db');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3001);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins, credentials: true } : { credentials: true }));
app.use(requestContext);
app.use(requestMetrics);
app.use('/api', generalLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(addSecurityHeaders());

async function healthHandler(_req, res) {
  const health = await getHealth();
  res.status(health.status === 'error' ? 503 : 200).json(health);
}
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/api/v1/health', healthHandler);

app.get('/internal/metrics', metricsLimiter, metricsAuth, async (_req, res) => {
  if (String(process.env.METRICS_ENABLED || 'true').toLowerCase() !== 'true') return res.status(404).end();
  const health = await getHealth();
  const redis = health.checks.redis;
  res.setHeader('Cache-Control', 'no-store');
  res.json(metricsService.getSnapshot({ redis, dependencies: health.checks }));
});
app.get('/internal/metrics/prometheus', metricsLimiter, metricsAuth, async (_req, res) => {
  if (String(process.env.METRICS_ENABLED || 'true').toLowerCase() !== 'true') return res.status(404).end();
  const health = await getHealth();
  const redis = health.checks.redis;
  res.setHeader('Cache-Control', 'no-store');
  res.type('text/plain; version=0.0.4').send(metricsService.toPrometheus({ redis, dependencies: health.checks }));
});

if (storageService.getDriver() === 'local') app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', async (req, res, next) => {
  try { return await storageService.sendPublicObject(res, req.path.replace(/^\/+/, '')); }
  catch (error) { next(error); }
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const routeModules = [
  ['auth', './routes/authRoutes'], ['products', './routes/productRoutes'],
  ['transactions', './routes/transactionRoutes'], ['chats', './routes/chatRoutes'],
  ['admin', './routes/adminRoutes'], ['meta', './routes/metaRoutes'],
  ['notifications', './routes/notificationRoutes'], ['escrow', './routes/escrowRoutes'],
  ['badges', './routes/badgeRoutes'], ['membership', './routes/membershipRoutes'], ['bids', './routes/bidRoutes']
];
for (const [segment, modulePath] of routeModules) {
  const router = require(modulePath);
  app.use(`/api/${segment}`, router);
  app.use(`/api/v1/${segment}`, router);
}

const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  console.warn(`No frontend build found at ${clientBuildPath} - only the API will be served. Run "npm run build" in client/ first.`);
  app.use(express.static('public'));
}

app.use((err, req, res, _next) => {
  if (err && err.name === 'MulterError') {
    let message = 'File upload failed.';
    if (err.code === 'LIMIT_UNEXPECTED_FILE') message = 'Too many files - please check the maximum allowed and try again.';
    if (err.code === 'LIMIT_FILE_SIZE') message = 'One of your files is too large.';
    if (err.code === 'LIMIT_FILE_COUNT') message = 'Too many files - please check the maximum allowed and try again.';
    return res.status(400).json({ success: false, error: message });
  }
  logger.error('Unhandled request error', { requestId: req.requestId, method: req.method, path: req.originalUrl, error: err });
  const status = err?.status || 500;
  const message = status >= 500 ? 'Something went wrong.' : (err?.message || 'Request failed.');
  res.status(status).json({ success: false, error: message, requestId: req.requestId });
});

async function startServer(port = PORT, host = HOST) {
  await initializeDatabase();
  const server = app.listen(port, host, () => {
    logger.info('Backend server started', { host, port });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error('Port already in use', { port });
      process.exit(1);
    }
    logger.error('Server error', { error: err });
    process.exit(1);
  });
  return server;
}

if (require.main === module) {
  (async () => {
    const server = await startServer(PORT, HOST);
    let shuttingDown = false;
    const shutdown = (signal, exitCode = 0) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info('Graceful shutdown started', { signal });
      const forceTimer = setTimeout(() => process.exit(1), 10000);
      forceTimer.unref();
      server.close(async () => {
        clearTimeout(forceTimer);
        try { await cacheService.close(); } catch (error) { logger.error('Redis close failed', { error }); }
        try { await storageService.close(); } catch (error) { logger.error('Storage close failed', { error }); }
        try { await closeDatabase(); } catch (error) { logger.error('Database close failed', { error }); }
        process.exit(exitCode);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (error) => { logger.error('Unhandled rejection', { error }); shutdown('unhandledRejection', 1); });
    process.on('uncaughtException', (error) => { logger.error('Uncaught exception', { error }); shutdown('uncaughtException', 1); });
  })().catch(error => { logger.error('Server startup failed', { error }); process.exit(1); });
}

module.exports = { app, startServer, HOST, PORT };
