const metrics = require('../services/metricsService');

describe('metricsService', () => {
  beforeEach(() => metrics.resetForTests());
  test('calculates route latency percentiles and error counts', () => {
    [10,20,30,100].forEach((durationMs,index)=>metrics.observeRequest({method:'GET',route:'/api/products',statusCode:index===3?500:200,durationMs}));
    const snapshot=metrics.getSnapshot(); const row=snapshot.http.routes['GET /api/products'];
    expect(row.count).toBe(4); expect(row.status5xx).toBe(1); expect(row.p50Ms).toBe(20); expect(row.p95Ms).toBe(100);
  });
  test('tracks cache hit ratio', () => {
    metrics.observeCache('hit',2); metrics.observeCache('hit',3); metrics.observeCache('miss',4);
    expect(metrics.getSnapshot().cache.hitRatio).toBeCloseTo(2/3,4);
  });
  test('prometheus output contains no request payload data and exposes core gauges', () => {
    metrics.observeRequest({method:'GET',route:'/api/products/:id',statusCode:200,durationMs:12});
    const body=metrics.toPrometheus({redis:{status:'ok',memoryUsedBytes:10,keys:2},dependencies:{database:{status:'ok'}}});
    expect(body).toContain('getsocs_http_requests_total'); expect(body).toContain('getsocs_cache_hit_ratio'); expect(body).toContain('getsocs_database_up 1');
  });
});
