const fs = require('fs');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (error) {
  console.warn('dotenv is not available, continuing without it:', error.message);
}

const { validateEnvironment } = require('../config/env');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');

const secretPattern = /(SECRET|PASS|PASSWORD|TOKEN|KEY|CREDENTIAL|ACCESS_KEY|ENCRYPTION)/i;

function keysFromFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1])
    .filter(Boolean);
}

const knownKeys = [
  'NODE_ENV',
  'JWT_SECRET',
  'DATA_ENCRYPTION_KEY',
  'PORT',
  'HOST',
  'FRONTEND_URL',
  'ALLOWED_ORIGINS',
  'TRUST_PROXY_HOPS',
  'DB_DRIVER',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASS',
  'DB_FILE',
  'DB_CONNECTION_LIMIT',
  'DB_CONNECT_TIMEOUT_MS',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
  'SMTP_CONNECTION_TIMEOUT_MS',
  'YOUTUBE_API_KEY',
  'YOUTUBE_TIMEOUT_MS',
  'ACCESS_TOKEN_TTL',
  'REFRESH_TOKEN_TTL_DAYS',
  'VERIFICATION_CODE_TTL',
  'PASSWORD_RESET_TTL',
  'TWO_FACTOR_CODE_TTL',
  'IP_BAN_DURATION_HOURS',
  'LOGIN_RATE_LIMIT_MAX',
  'PASSWORD_RESET_RATE_LIMIT_MAX',
  'REGISTRATION_RATE_LIMIT_MAX',
  'GENERAL_RATE_LIMIT_MAX',
  'REDIS_ENABLED',
  'REDIS_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'REDIS_DB',
  'REDIS_KEY_PREFIX',
  'REDIS_CONNECT_TIMEOUT_MS',
  'REDIS_COMMAND_TIMEOUT_MS',
  'CACHE_PRODUCT_LIST_TTL_SECONDS',
  'CACHE_PRODUCT_DETAIL_TTL_SECONDS',
  'CACHE_METADATA_TTL_SECONDS',
  'CACHE_BADGES_TTL_SECONDS',
  'CACHE_MEMBERSHIP_TTL_SECONDS',
  'STORAGE_DRIVER',
  'S3_REGION',
  'S3_ENDPOINT',
  'S3_FORCE_PATH_STYLE',
  'S3_PUBLIC_BUCKET',
  'S3_PRIVATE_BUCKET',
  'S3_PUBLIC_BASE_URL',
  'S3_SIGNED_URL_TTL_SECONDS',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'METRICS_ENABLED',
  'METRICS_TOKEN',
  'METRICS_MAX_SAMPLES_PER_ROUTE',
  'RECAPTCHA_SECRET_KEY',
  'RECAPTCHA_SITE_KEY',
  'RECAPTCHA_SCORE_THRESHOLD',
  'PM2_MAX_MEMORY_RESTART',
  'PM2_OUT_LOG',
  'PM2_ERROR_LOG',
  'PERF_BASE_URL',
  'PERF_REQUESTS',
  'PERF_CONCURRENCY',
  'PERF_WARMUP',
  'PERF_RUNS',
  'PERF_AUTH_TOKEN',
  'PERF_PRODUCT_ID',
  'PERF_REQUEST_TIMEOUT_MS',
  'PERF_METRICS_URL',
  'ALLOW_PRODUCTION_LOAD_TEST',
  'MYSQL_ROOT_PASSWORD'
];

const envFileKeys = [...new Set(keysFromFile(envPath))].sort();
const allKeys = [...new Set(knownKeys)].sort();

let validation = { valid: true, errors: [] };
try {
  validateEnvironment(process.env);
} catch (error) {
  validation = {
    valid: false,
    errors: String(error.message).split(/\r?\n/).filter((line) => line && line !== 'Invalid environment configuration:')
  };
}

function statusFor(key) {
  if (!Object.prototype.hasOwnProperty.call(process.env, key)) return 'missing';
  if (String(process.env[key] ?? '').trim() === '') return 'empty';
  return 'set';
}

const report = {
  envFile: fs.existsSync(envPath) ? envPath : 'missing',
  nodeEnv: process.env.NODE_ENV || 'undefined',
  validation,
  database: {
    driver: process.env.DB_DRIVER || 'mysql',
    productionFileDbBlocked: process.env.NODE_ENV === 'production' && ['file', 'json'].includes(String(process.env.DB_DRIVER || '').toLowerCase())
  },
  integrations: {
    youtubeApiKey: statusFor('YOUTUBE_API_KEY'),
    smtp: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'].every((key) => statusFor(key) === 'set') ? 'configured' : 'not_configured',
    redisEnabled: String(process.env.REDIS_ENABLED || (process.env.REDIS_URL ? 'true' : 'false')).toLowerCase(),
    storageDriver: process.env.STORAGE_DRIVER || 'local'
  },
  envKeys: allKeys.map((key) => ({
    key,
    status: statusFor(key),
    secret: secretPattern.test(key)
  })),
  extraKeysInEnvFile: envFileKeys.filter((key) => !allKeys.includes(key))
};

console.log(JSON.stringify(report, null, 2));
