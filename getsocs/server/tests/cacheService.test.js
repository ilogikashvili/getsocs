function fakeRedis(overrides = {}) {
  const store = new Map();
  return {
    status: 'ready',
    get: jest.fn(async key => store.has(key) ? store.get(key) : null),
    set: jest.fn(async (key, value) => { store.set(key, value); return 'OK'; }),
    del: jest.fn(async (...keys) => { let count=0; keys.forEach(k=>{ if(store.delete(k)) count++; }); return count; }),
    exists: jest.fn(async key => store.has(key) ? 1 : 0),
    scan: jest.fn(async () => ['0', []]),
    ping: jest.fn(async () => 'PONG'),
    info: jest.fn(async section => section === 'memory' ? 'used_memory:1234\n' : section === 'clients' ? 'connected_clients:2\n' : 'evicted_keys:0\n'),
    dbsize: jest.fn(async () => store.size),
    quit: jest.fn(async () => 'OK'),
    ...overrides,
    _store: store
  };
}
function loadService(client) {
  jest.resetModules();
  process.env.REDIS_ENABLED = 'true';
  process.env.REDIS_KEY_PREFIX = 'test:';
  const cache = require('../services/cacheService');
  cache._setClientForTests(client);
  return cache;
}

describe('cacheService', () => {
  afterEach(() => { delete process.env.REDIS_ENABLED; delete process.env.REDIS_KEY_PREFIX; jest.restoreAllMocks(); });
  test('serializes values and applies the requested TTL', async () => {
    const redis=fakeRedis(); const cache=loadService(redis);
    await cache.set('hello', { value: 42 }, 77);
    expect(redis.set).toHaveBeenCalledWith('test:hello', JSON.stringify({ value: 42 }), 'EX', 77);
    await expect(cache.get('hello')).resolves.toEqual({ value: 42 });
  });
  test('malformed cached data is discarded instead of failing the request', async () => {
    const redis=fakeRedis({ get: jest.fn(async () => '{broken-json') }); const cache=loadService(redis);
    await expect(cache.get('broken')).resolves.toBeNull();
    expect(redis.del).toHaveBeenCalledWith('test:broken');
  });
  test('redis failure falls back to database loader', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const redis=fakeRedis({ get: jest.fn(async () => { throw new Error('redis down'); }) }); const cache=loadService(redis);
    const loader=jest.fn(async()=>({ from:'db' }));
    await expect(cache.getOrSet('x', 30, loader)).resolves.toMatchObject({ value:{from:'db'} });
    expect(loader).toHaveBeenCalledTimes(1);
  });
  test('concurrent misses coalesce to one database load', async () => {
    const redis=fakeRedis(); const cache=loadService(redis);
    let release; const wait=new Promise(resolve=>{release=resolve;});
    const loader=jest.fn(async()=>{ await wait; return {ok:true}; });
    const a=cache.getOrSet('same',30,loader); const b=cache.getOrSet('same',30,loader);
    await Promise.resolve(); release();
    const [ra,rb]=await Promise.all([a,b]);
    expect(ra.value).toEqual({ok:true}); expect(rb.value).toEqual({ok:true}); expect(loader).toHaveBeenCalledTimes(1);
  });
  test('pattern invalidation uses SCAN and deletes matched keys', async () => {
    const redis=fakeRedis();
    redis.scan=jest.fn().mockResolvedValueOnce(['2',['test:products:list:a']]).mockResolvedValueOnce(['0',['test:products:list:b']]);
    redis.del=jest.fn(async(...keys)=>keys.length);
    const cache=loadService(redis);
    await expect(cache.deleteByPattern('products:list:*')).resolves.toBe(2);
    expect(redis.scan).toHaveBeenCalledTimes(2);
    expect(redis.del).toHaveBeenCalledTimes(2);
  });
  test('health reports key/memory/client metrics', async () => {
    const redis=fakeRedis(); const cache=loadService(redis);
    const health=await cache.health();
    expect(health).toMatchObject({ status:'ok', enabled:true, memoryUsedBytes:1234, connections:2 });
  });
});
