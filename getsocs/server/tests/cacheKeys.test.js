const { normalizeQuery, queryHash, cacheKeys } = require('../utils/cacheKeys');

describe('cache key strategy', () => {
  test('equivalent query parameter order produces the same key', () => {
    expect(queryHash({ page: 1, platform: 'youtube', search: 'abc' }))
      .toBe(queryHash({ search: 'abc', platform: 'youtube', page: 1 }));
  });
  test('array values are normalized deterministically', () => {
    expect(normalizeQuery({ tag: ['b', 'a'] })).toEqual({ tag: ['a', 'b'] });
  });
  test('product detail ids cannot inject arbitrary redis namespaces', () => {
    expect(cacheKeys.productDetail('abc:123')).toBe('products:detail:abc:123');
    expect(cacheKeys.productDetail('bad key *')).toMatch(/^products:detail:[a-f0-9]{24}$/);
  });
});
