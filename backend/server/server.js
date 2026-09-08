try {
  require('dotenv').config();
} catch (error) {
  console.warn('dotenv is not available, continuing without it:', error.message);
}

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { readDB, writeDB } = require('./config/db');

const app = express();
const trustProxy = process.env.TRUST_PROXY === 'true';
app.set('trust proxy', trustProxy);
app.disable('x-powered-by');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3001);

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests from this IP, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts from this IP, please try again later.' },
  skipFailedRequests: process.env.NODE_ENV === 'test',
});

app.use(helmet());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(apiLimiter);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve client build when present, otherwise serve ./public
const clientBuildPath = path.join(__dirname, '..', '..', 'client', 'build');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/api-docs')) return next();
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  app.use(express.static('public'));
}

// Create a default admin account if none exists

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Swagger UI documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mount modular routes
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/meta', require('./routes/metaRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/escrow', require('./routes/escrowRoutes'));
app.use('/api/badges', require('./routes/badgeRoutes'));
app.use('/api/membership', require('./routes/membershipRoutes'));
app.use('/api/bids', require('./routes/bidRoutes'));

// Catch-all error handler: Multer (file upload) errors and any other
// unhandled errors should return clean JSON, not a raw stack-trace page.
app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    let message = 'File upload failed.';
    if (err.code === 'LIMIT_UNEXPECTED_FILE') message = 'Too many files - please check the maximum allowed and try again.';
    if (err.code === 'LIMIT_FILE_SIZE') message = 'One of your files is too large.';
    if (err.code === 'LIMIT_FILE_COUNT') message = 'Too many files - please check the maximum allowed and try again.';
    return res.status(400).json({ success: false, error: message });
  }
  console.error(err);
  res.status(err?.status || 500).json({ success: false, error: err?.message || 'Something went wrong.' });
});

function startServer(port = PORT, host = HOST) {
  const server = app.listen(port, host, () => {
    console.log(`Backend server running on http://${host}:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Stop the existing process or set PORT to a different value.`);
      process.exit(1);
    } else {
      console.error(err);
      process.exit(1);
    }
  });
}

if (require.main === module) {
  startServer(PORT, HOST);
}

module.exports = { app, startServer, HOST, PORT };
