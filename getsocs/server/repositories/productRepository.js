const { loadState, saveState, withLockedState } = require('./stateRepository');
const { USE_TEST_FILE_DB, getMysqlPool } = require('../config/db');
const metrics = require('../services/metricsService');

function parsePayload(value) {
  if (value === null || value === undefined) return {};
  if (typeof value === 'object' && !Buffer.isBuffer(value)) return value;
  try { return JSON.parse(Buffer.isBuffer(value) ? value.toString('utf8') : String(value)); }
  catch (_) { return {}; }
}
async function timedQuery(operation, sql, params = []) {
  const started = Date.now();
  try {
    const [rows] = await getMysqlPool().query(sql, params);
    metrics.observeDatabase(operation, Date.now() - started, true);
    return rows;
  } catch (error) {
    metrics.observeDatabase(operation, Date.now() - started, false);
    throw error;
  }
}
async function loadProductState() { return loadState(); }
async function saveProductState(state) { return saveState(state); }
async function withProductState(mutator) { return withLockedState(mutator); }

// Read-only projection for public catalog requests. Unlike loadState(), this
// does not hydrate transactions, chats, badges, memberships, auth sessions,
// or other unrelated domains on a product-list cache miss.
async function loadPublicProductCatalogState() {
  if (USE_TEST_FILE_DB) return loadState();
  const [productRows, userRows, commentRows] = await Promise.all([
    timedQuery('products.publicCatalog', "SELECT payload FROM products WHERE status='approved'"),
    timedQuery('products.publicSellerNames', 'SELECT id, username FROM users'),
    timedQuery('products.publicComments', "SELECT c.payload FROM comments c INNER JOIN products p ON p.id=c.product_id WHERE p.status='approved'")
  ]);
  return {
    products: productRows.map(row => parsePayload(row.payload)),
    users: userRows.map(row => ({ id: String(row.id), username: row.username })),
    comments: commentRows.map(row => parsePayload(row.payload))
  };
}
async function loadPublicProductByIdState(productId) {
  if (USE_TEST_FILE_DB) return loadState();
  const [productRows, commentRows] = await Promise.all([
    timedQuery('products.publicDetail', 'SELECT payload FROM products WHERE id=? LIMIT 1', [String(productId)]),
    timedQuery('products.publicDetailComments', 'SELECT payload FROM comments WHERE product_id=? ORDER BY created_at ASC', [String(productId)])
  ]);
  return { products: productRows.map(row => parsePayload(row.payload)), users: [], comments: commentRows.map(row => parsePayload(row.payload)) };
}
async function incrementProductPageView() {
  if (USE_TEST_FILE_DB) {
    const state = await loadState();
    state.analytics = state.analytics || { pageViews: 0 };
    state.analytics.pageViews = Math.max(0, Number(state.analytics.pageViews) || 0) + 1;
    return saveState(state);
  }
  const started = Date.now();
  try {
    await getMysqlPool().query("UPDATE analytics SET payload=JSON_SET(payload, '$.pageViews', page_views + 1), page_views=page_views+1 WHERE id=1");
    metrics.observeDatabase('analytics.incrementPageView', Date.now() - started, true);
  } catch (error) {
    metrics.observeDatabase('analytics.incrementPageView', Date.now() - started, false);
    // Analytics must never make a user-facing read fail.
  }
}
module.exports = { loadProductState, saveProductState, withProductState, loadPublicProductCatalogState, loadPublicProductByIdState, incrementProductPageView };
