const request = require('supertest');
const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '..', 'marketplace-availability.test.json');
process.env.TEST_DB_FILE = testDbPath;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'marketplace-availability-secret-at-least-32-chars';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.REDIS_ENABLED = 'false';

const { app } = require('../server');
const { signAccessToken } = require('../services/tokenService');
const { readDB } = require('../config/db');
const EscrowService = require('../services/escrowService');

function baseFixture() {
  return {
    users: [
      { id: 'admin-1', username: 'admin', role: 'admin', tokenVersion: 0 },
      { id: 'seller-1', username: 'seller', email: 'seller@example.com', role: 'user', tokenVersion: 0, pointsSold: 0 },
      { id: 'buyer-1', username: 'buyer1', email: 'buyer1@example.com', role: 'user', tokenVersion: 0, pointsBought: 0 },
      { id: 'buyer-2', username: 'buyer2', email: 'buyer2@example.com', role: 'user', tokenVersion: 0, pointsBought: 0 }
    ],
    products: [{ id: 'product-1', title: 'Available product', price: 100, sellerId: 'seller-1', status: 'approved', hidden: false, images: [] }],
    comments: [], transactions: [], chats: [], supportChats: [], bids: [], escrow: [], notifications: [],
    memberships: [], user_memberships: [], addons: [], user_addons: [], badges: [], userBadges: [],
    idempotencyKeys: [], emailDeleteBlocks: [], reviews: [], analytics: { pageViews: 0 }
  };
}
function token(id, role = 'user') { return signAccessToken({ id, role, tokenVersion: 0 }); }

beforeEach(() => fs.writeFileSync(testDbPath, JSON.stringify(baseFixture(), null, 2)));
afterAll(() => { try { fs.unlinkSync(testDbPath); } catch (_) {} });

test('first purchase atomically reserves a single-inventory product and a second buyer is rejected', async () => {
  const first = await request(app)
    .post('/api/v1/transactions/products/product-1/buy')
    .set('Authorization', `Bearer ${token('buyer-1')}`)
    .set('Idempotency-Key', 'buy-product-1-buyer-1')
    .send({ paymentMethod: 'card' });

  expect(first.statusCode).toBe(200);
  let db = readDB();
  expect(db.products.find(p => p.id === 'product-1').status).toBe('reserved');
  expect(db.products.find(p => p.id === 'product-1').reservedBy).toBe('buyer-1');
  const chat = db.chats.find(c => c.txId === first.body.tx.id);
  expect(chat.messages).toHaveLength(1);
  expect(chat.messages[0].userId).toBe('buyer-1');
  expect(chat.messages[0].type).toBe('purchase_request');
  expect(chat.messages[0].text).toContain('Request to purchase "[Available product]');
  expect(chat.messages[0].text).toContain(`**Transaction ID:** ${first.body.tx.id}`);
  expect(chat.messages[0].text).toContain('**Transaction amount:** $100');
  expect(chat.messages[0].text).toContain('**Transfer to:** seller@example.com');

  const second = await request(app)
    .post('/api/v1/transactions/products/product-1/buy')
    .set('Authorization', `Bearer ${token('buyer-2')}`)
    .set('Idempotency-Key', 'buy-product-1-buyer-2')
    .send({ paymentMethod: 'card' });

  expect(second.statusCode).toBe(409);
  db = readDB();
  expect(db.transactions).toHaveLength(1);
});

test('transaction completion marks the product sold and awards points once', async () => {
  const buy = await request(app)
    .post('/api/v1/transactions/products/product-1/buy')
    .set('Authorization', `Bearer ${token('buyer-1')}`)
    .set('Idempotency-Key', 'buy-before-confirm')
    .send({ paymentMethod: 'card' });
  expect(buy.statusCode).toBe(200);

  const txId = buy.body.tx.id;
  const confirmed = await request(app)
    .post(`/api/v1/transactions/${txId}/confirm`)
    .set('Authorization', `Bearer ${token('admin-1', 'admin')}`)
    .set('Idempotency-Key', 'confirm-sold-once');
  expect(confirmed.statusCode).toBe(200);

  const db = readDB();
  const product = db.products.find(p => p.id === 'product-1');
  expect(product.status).toBe('sold');
  expect(product.soldTo).toBe('buyer-1');
  expect(db.users.find(u => u.id === 'buyer-1').pointsBought).toBe(100);
  expect(db.users.find(u => u.id === 'seller-1').pointsSold).toBe(100);
});

test('escrow completion is idempotent and refund restores only the matching reservation', async () => {
  const fixture = baseFixture();
  fixture.products[0].status = 'reserved';
  fixture.products[0].reservedBy = 'buyer-1';
  fixture.products[0].reservedTransactionId = 'tx-escrow';
  fixture.transactions.push({ id: 'tx-escrow', productId: 'product-1', buyerId: 'buyer-1', sellerId: 'seller-1', productPrice: 100, status: 'escrow_active' });
  fixture.escrow.push({ id: 'esc-1', transactionId: 'tx-escrow', status: 'active', endsAt: new Date(Date.now() + 60_000).toISOString() });
  fs.writeFileSync(testDbPath, JSON.stringify(fixture, null, 2));

  const first = await EscrowService.completeEscrow('tx-escrow');
  expect(first.alreadyCompleted).toBe(false);
  const replay = await EscrowService.completeEscrow('tx-escrow');
  expect(replay.alreadyCompleted).toBe(true);
  let db = readDB();
  expect(db.users.find(u => u.id === 'buyer-1').pointsBought).toBe(100);
  expect(db.users.find(u => u.id === 'seller-1').pointsSold).toBe(100);
  expect(db.products[0].status).toBe('sold');

  // Reset to a distinct active reservation and verify refund re-opens it.
  fixture.products[0].status = 'reserved';
  fixture.products[0].reservedTransactionId = 'tx-refund';
  fixture.transactions = [{ id: 'tx-refund', productId: 'product-1', buyerId: 'buyer-1', sellerId: 'seller-1', productPrice: 100, status: 'escrow_active' }];
  fixture.escrow = [{ id: 'esc-refund', transactionId: 'tx-refund', status: 'active', endsAt: new Date(Date.now() + 60_000).toISOString() }];
  fs.writeFileSync(testDbPath, JSON.stringify(fixture, null, 2));
  await EscrowService.refundEscrow('tx-refund', 'test refund');
  db = readDB();
  expect(db.products[0].status).toBe('approved');
  expect(db.products[0].reservedTransactionId).toBeUndefined();
});
