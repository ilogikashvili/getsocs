const request = require('supertest');
const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '..', 'transaction-idempotency.test.json');
process.env.TEST_DB_FILE = testDbPath;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'transaction-test-secret-that-is-at-least-32-characters';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';

const { app } = require('../server');
const { signAccessToken } = require('../services/tokenService');
const { loadTransactionState } = require('../repositories/transactionRepository');

function fixture() {
  return {
    users: [
      { id: 'admin-1', username: 'admin', role: 'admin', tokenVersion: 0 },
      { id: 'buyer-1', username: 'buyer', role: 'user', tokenVersion: 0, pointsBought: 0 },
      { id: 'seller-1', username: 'seller', role: 'user', tokenVersion: 0, pointsSold: 0 }
    ],
    products: [], comments: [], chats: [], supportChats: [], bids: [], escrow: [], notifications: [],
    memberships: [], user_memberships: [], addons: [], user_addons: [], idempotencyKeys: [], analytics: { pageViews: 0 },
    transactions: [{ id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', productPrice: 100, status: 'pending', stage: 'waiting' }]
  };
}

beforeEach(() => fs.writeFileSync(testDbPath, JSON.stringify(fixture(), null, 2)));
afterAll(() => { try { fs.unlinkSync(testDbPath); } catch (_) {} });

test('transaction confirmation is idempotent and cannot award points twice', async () => {
  const token = signAccessToken({ id: 'admin-1', role: 'admin', tokenVersion: 0 });
  const headers = { Authorization: `Bearer ${token}`, 'Idempotency-Key': 'confirm-tx-1-key' };

  const first = await request(app).post('/api/v1/transactions/tx-1/confirm').set(headers);
  expect(first.statusCode).toBe(200);
  const replay = await request(app).post('/api/v1/transactions/tx-1/confirm').set(headers);
  expect(replay.statusCode).toBe(200);
  expect(replay.body).toEqual(first.body);

  const db = await loadTransactionState();
  expect(db.users.find(u => u.id === 'buyer-1').pointsBought).toBe(100);
  expect(db.users.find(u => u.id === 'seller-1').pointsSold).toBe(100);

  const secondKey = await request(app)
    .post('/api/v1/transactions/tx-1/confirm')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', 'confirm-tx-1-other');
  expect(secondKey.statusCode).toBe(409);
});
