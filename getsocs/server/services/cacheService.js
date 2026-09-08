const logger = require('../utils/logger');
const metrics = require('./metricsService');

const enabled = String(process.env.REDIS_ENABLED || (process.env.REDIS_URL ? 'true' : 'false')).toLowerCase() === 'true';
const keyPrefix = process.env.REDIS_KEY_PREFIX || 'getsocs:';
const connectTimeout = Math.max(500, Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 2000));
const commandTimeout = Math.max(100, Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 1000));
let client = null;
let connecting = null;
const singleFlight = new Map();

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(`${label} timed out`), { code: 'CACHE_TIMEOUT' })), ms); timer.unref?.(); })
  ]).finally(() => clearTimeout(timer));
}
function prefixed(key) { return `${keyPrefix}${key}`; }
async function getClient() {
  if (!enabled) return null;
  if (client?.status === 'ready') return client;
  if (connecting) return connecting;
  connecting = (async () => {
    let Redis;
    try { Redis = require('ioredis'); }
    catch (error) { throw Object.assign(new Error('ioredis is required when REDIS_ENABLED=true. Run npm install in server/.'), { cause: error }); }
    const options = {
      lazyConnect: true,
      connectTimeout,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) { return Math.min(2000, 100 * Math.max(1, times)); }
    };
    const instance = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, options) : new Redis({
      ...options,
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB || 0)
    });
    instance.on('error', error => logger.warn('Redis connection error', { error }));
    await withTimeout(instance.connect(), connectTimeout, 'Redis connect');
    client = instance;
    return client;
  })();
  try { return await connecting; }
  finally { connecting = null; }
}
async function safeOperation(name, fn, fallback) {
  if (!enabled) return fallback;
  const started = Date.now();
  try {
    const redis = await getClient();
    return await withTimeout(fn(redis), commandTimeout, `Redis ${name}`);
  } catch (error) {
    metrics.observeCache('error', Date.now() - started);
    logger.warn('Cache operation failed; continuing without Redis', { operation: name, error });
    return fallback;
  }
}
async function get(key) {
  if (!enabled) return null;
  const started = Date.now();
  const raw = await safeOperation('get', redis => redis.get(prefixed(key)), null);
  if (raw === null || raw === undefined) { metrics.observeCache('miss', Date.now() - started); return null; }
  try {
    const value = JSON.parse(raw);
    metrics.observeCache('hit', Date.now() - started);
    return value;
  } catch (error) {
    metrics.observeCache('error', Date.now() - started);
    logger.warn('Malformed cache entry removed', { key, error });
    await deleteKey(key);
    return null;
  }
}
async function set(key, value, ttlSeconds) {
  const ttl = Math.max(1, Number(ttlSeconds) || 60);
  const payload = JSON.stringify(value);
  const result = await safeOperation('set', redis => redis.set(prefixed(key), payload, 'EX', ttl), null);
  if (result !== null) metrics.observeCache('set');
  return result !== null;
}
async function deleteKey(key) {
  const result = await safeOperation('delete', redis => redis.del(prefixed(key)), 0);
  if (result) metrics.observeCache('delete');
  return Number(result) || 0;
}
async function deleteByPattern(pattern) {
  return safeOperation('deleteByPattern', async redis => {
    let cursor = '0', deleted = 0;
    const match = prefixed(pattern);
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 200);
      cursor = nextCursor;
      if (keys.length) { deleted += await redis.del(...keys); }
    } while (cursor !== '0');
    if (deleted) metrics.observeCache('delete');
    return deleted;
  }, 0);
}
async function exists(key) {
  return Boolean(await safeOperation('exists', redis => redis.exists(prefixed(key)), 0));
}
async function getOrSet(key, ttlSeconds, loader) {
  const cached = await get(key);
  if (cached !== null) return { value: cached, cache: 'hit' };
  if (singleFlight.has(key)) return { value: await singleFlight.get(key), cache: 'coalesced' };
  const pending = (async () => {
    const value = await loader();
    await set(key, value, ttlSeconds);
    return value;
  })();
  singleFlight.set(key, pending);
  try { return { value: await pending, cache: enabled ? 'miss' : 'disabled' }; }
  finally { singleFlight.delete(key); }
}
async function health() {
  if (!enabled) return { status: 'disabled', enabled: false };
  const started = Date.now();
  try {
    const redis = await getClient();
    const pong = await withTimeout(redis.ping(), commandTimeout, 'Redis ping');
    const [infoMemory, infoStats, infoClients, keys] = await Promise.all([
      redis.info('memory'), redis.info('stats'), redis.info('clients'), redis.dbsize()
    ]);
    const value = name => {
      const joined = `${infoMemory}\n${infoStats}\n${infoClients}`;
      const match = joined.match(new RegExp(`^${name}:(.+)$`, 'm'));
      return match ? match[1].trim() : undefined;
    };
    return {
      status: pong === 'PONG' ? 'ok' : 'degraded', enabled: true, latencyMs: Date.now() - started,
      memoryUsedBytes: Number(value('used_memory')) || 0,
      connections: Number(value('connected_clients')) || 0,
      evictedKeys: Number(value('evicted_keys')) || 0,
      keys: Number(keys) || 0
    };
  } catch (error) { return { status: 'degraded', enabled: true, error: error.message, latencyMs: Date.now() - started }; }
}
async function close() {
  const current = client; client = null;
  if (!current) return;
  try { await current.quit(); } catch (_) { try { current.disconnect(); } catch (_) {} }
}
function isEnabled() { return enabled; }
function _setClientForTests(testClient) { client = testClient; }
module.exports = { get, set, delete: deleteKey, deleteByPattern, exists, getOrSet, health, close, isEnabled, _setClientForTests };
