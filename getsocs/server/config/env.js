function parsePositiveNumber(name, value, errors) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) errors.push(`${name} must be a positive number`);
}

function validateEnvironment(env = process.env) {
  const errors = [];
  const production = env.NODE_ENV === 'production';
  const dbDriver = (env.DB_DRIVER || 'mysql').toLowerCase();
  const fileDbEnabled = dbDriver === 'file' || dbDriver === 'json' || (env.NODE_ENV === 'test' && env.TEST_DB_FILE);

  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be set and at least 32 characters long');
  }

  if (production && !env.ALLOWED_ORIGINS) {
    errors.push('ALLOWED_ORIGINS is required in production');
  }

  const smtpValues = [env.SMTP_HOST, env.SMTP_USER, env.SMTP_PASS];
  const anySmtp = smtpValues.some(Boolean);
  const allSmtp = smtpValues.every(Boolean);
  if (anySmtp && !allSmtp) errors.push('SMTP_HOST, SMTP_USER and SMTP_PASS must be configured together');
  if (allSmtp && !env.EMAIL_FROM) errors.push('EMAIL_FROM is required when SMTP is configured');

  if (!['mysql', 'file', 'json'].includes(dbDriver)) {
    errors.push('DB_DRIVER must be mysql, file, or json');
  }
  if (production && fileDbEnabled) {
    errors.push('DB_DRIVER=file/json is not allowed in production');
  }
  if (!fileDbEnabled) {
    if (!env.DB_USER) errors.push('DB_USER is required for MySQL');
    if (!env.DB_PASS) errors.push('DB_PASS is required for MySQL');
    if (!env.DB_NAME) errors.push('DB_NAME is required for MySQL');
    if (env.DB_PORT) parsePositiveNumber('DB_PORT', env.DB_PORT, errors);
    if (env.DB_CONNECTION_LIMIT) parsePositiveNumber('DB_CONNECTION_LIMIT', env.DB_CONNECTION_LIMIT, errors);
  }

  if (env.REFRESH_TOKEN_TTL_DAYS) parsePositiveNumber('REFRESH_TOKEN_TTL_DAYS', env.REFRESH_TOKEN_TTL_DAYS, errors);
  if (env.SMTP_CONNECTION_TIMEOUT_MS) parsePositiveNumber('SMTP_CONNECTION_TIMEOUT_MS', env.SMTP_CONNECTION_TIMEOUT_MS, errors);

  const redisEnabled = String(env.REDIS_ENABLED || (env.REDIS_URL ? 'true' : 'false')).toLowerCase() === 'true';
  if (redisEnabled && !env.REDIS_URL && !env.REDIS_HOST) errors.push('REDIS_URL or REDIS_HOST is required when Redis is enabled');
  if (env.REDIS_PORT) parsePositiveNumber('REDIS_PORT', env.REDIS_PORT, errors);
  if (env.REDIS_CONNECT_TIMEOUT_MS) parsePositiveNumber('REDIS_CONNECT_TIMEOUT_MS', env.REDIS_CONNECT_TIMEOUT_MS, errors);
  if (production && String(env.METRICS_ENABLED || 'true').toLowerCase() === 'true' && (!env.METRICS_TOKEN || env.METRICS_TOKEN.length < 24)) {
    errors.push('METRICS_TOKEN must be set and at least 24 characters long when metrics are enabled in production');
  }
  const storageDriver = (env.STORAGE_DRIVER || 'local').toLowerCase();
  if (!['local', 's3'].includes(storageDriver)) errors.push('STORAGE_DRIVER must be local or s3');
  if (storageDriver === 's3') {
    for (const key of ['S3_REGION', 'S3_PUBLIC_BUCKET', 'S3_PRIVATE_BUCKET']) if (!env[key]) errors.push(`${key} is required when STORAGE_DRIVER=s3`);
  }

  if (errors.length) {
    const error = new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
    error.code = 'INVALID_ENVIRONMENT';
    throw error;
  }
}

module.exports = { validateEnvironment };
