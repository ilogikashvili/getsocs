/* Local-only, repeatable HTTP audit. Run: node scripts/api-adversarial-audit.js */
const fs = require('fs');
const path = require('path');
const os = require('os');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'getsocs-api-audit-'));
Object.assign(process.env, { NODE_ENV: 'test', TEST_DB_FILE: path.join(temp, 'db.json'), DB_DRIVER: 'file',
  JWT_SECRET: 'local-audit-only-secret-not-for-deployment', REDIS_ENABLED: 'false', STORAGE_DRIVER: 'local',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', PAYMENTS_ENABLED: 'false', YOUTUBE_API_KEY: '' });
const { app } = require('../server');
const { readDB, writeDB } = require('../config/db');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const output = path.resolve(__dirname, '../../docs/api-audit');
fs.mkdirSync(output, { recursive: true });
const results = [];
let seed = 20260906;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
const users = ['buyer', 'seller', 'stranger', 'admin', 'escrow', 'banned', 'unverified', 'demoted'].map(id => ({
  id, username: id, email: `${id}@example.invalid`, password: 'not-a-login-hash',
  role: ['admin', 'escrow'].includes(id) ? id : 'user', verified: id !== 'unverified', banned: id === 'banned', tokenVersion: 0
}));
const tokens = Object.fromEntries(users.map(u => [u.id, jwt.sign({ id: u.id, username: u.username,
  role: u.id === 'demoted' ? 'admin' : u.role, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })]));
tokens.invalid = 'invalid.signature.token';
tokens.expired = jwt.sign({ id: 'buyer', role: 'user' }, process.env.JWT_SECRET, { expiresIn: -1 });
function reset() {
  writeDB({ users: structuredClone(users), products: [{ id: 'product', sellerId: 'seller', title: 'Audit listing',
    price: 100, status: 'approved', hidden: false, platform: 'youtube', createdAt: new Date().toISOString() }],
    transactions: [{ id: 'transaction', buyerId: 'buyer', sellerId: 'seller', productId: 'product',
      productPrice: 100, totalPrice: 106, status: 'pending', stage: 'waiting', createdAt: new Date().toISOString() }],
    chats: [], comments: [], supportChats: [], bids: [], escrow: [], notifications: [], reviews: [],
    analytics: { pageViews: 0 } });
}
const groups = { auth: 'auth', product: 'products', transaction: 'transactions', chat: 'chats', admin: 'admin',
  meta: 'meta', notification: 'notifications', escrow: 'escrow', badge: 'badges', membership: 'membership', bid: 'bids' };
const routes = [];
for (const [file, segment] of Object.entries(groups)) {
  const router = require(`../routes/${file}Routes`);
  let inheritedAuth = false;
  for (const layer of router.stack) {
    if (!layer.route) { if (layer.name === 'auth') inheritedAuth = true; continue; }
    for (const method of Object.keys(layer.route.methods)) routes.push({ method, segment, path: layer.route.path,
      protected: inheritedAuth || layer.route.stack.some(s => s.name === 'auth') });
  }
}
function concrete(route) {
  return route.path.replace(/:([A-Za-z]+)/g, (_, name) => ({ userId: 'seller', transactionId: 'transaction',
    txId: 'transaction', listingId: 'product', bidId: 'missing', chatId: 'missing', reviewId: 'missing',
    commentId: 'missing', id: route.segment === 'products' ? 'product' : route.segment === 'transactions' ? 'transaction' : 'seller' }[name] || 'missing'));
}
async function call(label, method, url, actor, body, expected) {
  reset();
  let req = request(app)[method](url).timeout({ response: 2500, deadline: 4000 });
  if (tokens[actor]) req = req.set('Authorization', `Bearer ${tokens[actor]}`);
  if (body !== undefined) req = req.set('Content-Type', 'application/json').send(JSON.stringify(body));
  try {
    const res = await req;
    const failure = res.status >= 500 || (expected && !expected.includes(res.status));
    const row = { label, method, url, actor, body, status: res.status, expected, failure: Boolean(failure) };
    if (failure || label.startsWith('target:')) row.response = res.body;
    results.push(row);
    return res;
  } catch (e) { results.push({ label, method, url, actor, body, failure: true, error: e.message }); }
}
async function main() {
  for (const route of routes) {
    for (const prefix of ['/api', '/api/v1']) {
      const url = `${prefix}/${route.segment}${concrete(route)}`;
      for (const actor of ['anonymous', 'invalid', 'expired', 'banned', 'buyer', 'admin']) {
        const denied = route.protected && ['anonymous', 'invalid', 'expired', 'banned'].includes(actor);
        await call('route-matrix', route.method, url, actor, route.method === 'get' ? undefined : {}, denied ? [401, 403] : undefined);
      }
      const values = [null, [], {}, true, -1, 0, 1e100, "' OR 1=1 --", '<script>alert(1)</script>', 'x'.repeat(2048)];
      for (let i = 0; i < 3; i++) {
        const value = values[Math.floor(random() * values.length)];
        const body = Object.fromEntries(['username', 'email', 'password', 'code', 'title', 'price', 'bidAmount', 'hours',
          'message', 'role', 'status', 'stage', 'userId', 'tierId', 'transactionId'].map(k => [k, value]));
        await call('seeded-input', route.method, url + '?limit=-1&page=NaN&sort[$ne]=1', 'buyer', route.method === 'get' ? undefined : body);
      }
    }
  }
  await call('target: demoted-admin-access', 'get', '/api/membership/admin/subscriptions', 'demoted', undefined, [403]);
  await call('target: demoted-admin-escrow', 'get', '/api/escrow/admin/all', 'demoted', undefined, [403]);
  await call('target: demoted-admin-idor', 'get', '/api/membership/membership/seller', 'demoted', undefined, [403]);
  await call('target: stranger-transaction', 'get', '/api/transactions/transaction', 'stranger', undefined, [403]);
  await call('target: buyer-claims-both-consents', 'post', '/api/escrow/initiate', 'buyer', { transactionId: 'transaction', buyerConfirmed: true, sellerConfirmed: true }, [400, 403, 409]);
  await call('target: false-strings-as-consent', 'post', '/api/escrow/initiate', 'buyer', { transactionId: 'transaction', buyerConfirmed: 'false', sellerConfirmed: 'false' }, [400]);
  await call('target: unknown-api-route', 'get', '/api/not-a-real-endpoint', 'anonymous', undefined, [404]);
  const summary = { seed: 20260906, routes: routes.length, mountedRoutes: routes.length * 2, requests: results.length,
    failures: results.filter(r => r.failure).length, statuses: results.reduce((a, r) => { a[r.status || 'error'] = (a[r.status || 'error'] || 0) + 1; return a; }, {}) };
  fs.writeFileSync(path.join(output, 'adversarial-results.json'), JSON.stringify({ summary, routes, results }, null, 2));
  console.log(JSON.stringify(summary));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => {
  // Only this process's newly created temporary fixture directory is removed.
  fs.rmSync(temp, { recursive: true, force: true });
});
