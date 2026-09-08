const REDACT_KEYS = /pass(word)?|secret|token|authorization|cookie|api[_-]?key|email/i;

function sanitize(value, depth = 0) {
  if (depth > 4) return '[truncated]';
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.slice(0, 20).map(v => sanitize(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, REDACT_KEYS.test(k) ? '[redacted]' : sanitize(v, depth + 1)]));
  }
  return value;
}

function write(level, message, context = {}) {
  const record = { timestamp: new Date().toISOString(), level, message, ...sanitize(context) };
  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

module.exports = {
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
};
