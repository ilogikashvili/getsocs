const crypto = require('crypto');
function normalizeValue(value) {
  if (Array.isArray(value)) return value.map(v => String(v)).sort();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
function normalizeQuery(query = {}) {
  return Object.fromEntries(Object.keys(query).sort().map(key => [key, normalizeValue(query[key])]));
}
function queryHash(query = {}) {
  return crypto.createHash('sha256').update(JSON.stringify(normalizeQuery(query))).digest('hex').slice(0, 24);
}
function safeId(value) {
  const text = String(value || '');
  return /^[A-Za-z0-9._:-]{1,128}$/.test(text) ? text : crypto.createHash('sha256').update(text).digest('hex').slice(0, 24);
}
const cacheKeys = {
  productList: query => `products:list:${queryHash(query)}`,
  productDetail: id => `products:detail:${safeId(id)}`,
  productSearch: query => `products:search:${queryHash(query)}`,
  metaPlatforms: () => 'metadata:platforms',
  metaLanguages: () => 'metadata:languages',
  badgesAll: () => 'badges:all',
  membershipTiers: () => 'membership:tiers',
  membershipAddons: () => 'membership:addons'
};
module.exports = { normalizeQuery, queryHash, cacheKeys };
