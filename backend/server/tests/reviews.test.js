const request = require('supertest');
const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '..', 'server.test.json');
process.env.TEST_DB_FILE = testDbPath;
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';

const { app } = require('../server');
const { readDB, writeDB } = require('../config/db');

jest.setTimeout(20000);

function resetDb() {
  fs.writeFileSync(testDbPath, JSON.stringify({
    users: [],
    products: [],
    comments: [],
    transactions: [],
    reviews: [],
    chats: [],
    supportChats: [],
    scanned_ids: [],
    analytics: { pageViews: 0 }
  }, null, 2));
}

async function registerAndVerify(username, email) {
  const registerRes = await request(app)
    .post('/api/auth/register')
    .field('username', username)
    .field('password', 'pass123')
    .field('name', 'Test')
    .field('lastname', 'User')
    .field('email', email);

  expect(registerRes.body.requiresEmailVerification).toBe(true);

  const db = readDB();
  const user = db.users.find(u => u.email === email);
  const verifyRes = await request(app)
    .post('/api/auth/verify-email/code')
    .send({ email, code: user.verificationCode });

  expect(verifyRes.body.success).toBe(true);
  return { token: verifyRes.body.token, id: verifyRes.body.user.id };
}

// Directly inserts a transaction at a given status, bypassing the full
// buy/confirm HTTP flow, since these tests are about review authorization
// logic specifically, not the transaction lifecycle (covered elsewhere).
function createTransaction({ buyerId, sellerId, escrowId = null, status }) {
  const db = readDB();
  const tx = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    productId: 'prod_test',
    productTitle: 'Test Product',
    productPrice: 100,
    buyerId,
    sellerId,
    escrowId,
    status,
    createdAt: new Date().toISOString()
  };
  db.transactions = db.transactions || [];
  db.transactions.push(tx);
  writeDB(db);
  return tx.id;
}

describe('Review restrictions - only after a completed transaction', () => {
  beforeEach(() => {
    resetDb();
  });

  afterAll(() => {
    try { fs.unlinkSync(testDbPath); } catch (e) {}
  });

  test('rejects a review with no transaction at all', async () => {
    const buyer = await registerAndVerify('buyer1', 'buyer1@example.com');
    const seller = await registerAndVerify('seller1', 'seller1@example.com');

    const res = await request(app)
      .post('/api/auth/reviews')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetId: seller.id, rating: 5, text: 'no transaction happened', type: 'seller' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/completed transaction/i);
  });

  test('rejects a review while the transaction is still pending', async () => {
    const buyer = await registerAndVerify('buyer2', 'buyer2@example.com');
    const seller = await registerAndVerify('seller2', 'seller2@example.com');
    const txId = createTransaction({ buyerId: buyer.id, sellerId: seller.id, status: 'pending' });

    const res = await request(app)
      .post('/api/auth/reviews')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetId: seller.id, rating: 5, text: 'too early', type: 'seller', transactionId: txId });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/only leave a review after the transaction is completed/i);
  });

  test('allows a review once the transaction is completed', async () => {
    const buyer = await registerAndVerify('buyer3', 'buyer3@example.com');
    const seller = await registerAndVerify('seller3', 'seller3@example.com');
    const txId = createTransaction({ buyerId: buyer.id, sellerId: seller.id, status: 'completed' });

    const res = await request(app)
      .post('/api/auth/reviews')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetId: seller.id, rating: 5, text: 'great deal', type: 'seller', transactionId: txId });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.review.transactionId).toBe(txId);
  });

  test('rejects a review from someone who was not part of that transaction', async () => {
    const buyer = await registerAndVerify('buyer4', 'buyer4@example.com');
    const seller = await registerAndVerify('seller4', 'seller4@example.com');
    const outsider = await registerAndVerify('outsider4', 'outsider4@example.com');
    const txId = createTransaction({ buyerId: buyer.id, sellerId: seller.id, status: 'completed' });

    const res = await request(app)
      .post('/api/auth/reviews')
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ targetId: seller.id, rating: 1, text: 'fake review by unrelated party', type: 'seller', transactionId: txId });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/not part of this transaction/i);
  });

  test('rejects a review where the target was not the actual counterparty', async () => {
    const buyer = await registerAndVerify('buyer5', 'buyer5@example.com');
    const seller = await registerAndVerify('seller5', 'seller5@example.com');
    const someoneElse = await registerAndVerify('someoneelse5', 'someoneelse5@example.com');
    const txId = createTransaction({ buyerId: buyer.id, sellerId: seller.id, status: 'completed' });

    const res = await request(app)
      .post('/api/auth/reviews')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetId: someoneElse.id, rating: 5, text: 'wrong target', type: 'seller', transactionId: txId });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/not the counterparty/i);
  });

  test('rejects a review using a transaction ID that does not belong to that person at all', async () => {
    const buyer = await registerAndVerify('buyer6', 'buyer6@example.com');
    const seller = await registerAndVerify('seller6', 'seller6@example.com');
    const otherBuyer = await registerAndVerify('otherbuyer6', 'otherbuyer6@example.com');
    const otherSeller = await registerAndVerify('otherseller6', 'otherseller6@example.com');
    const unrelatedTxId = createTransaction({ buyerId: otherBuyer.id, sellerId: otherSeller.id, status: 'completed' });

    const res = await request(app)
      .post('/api/auth/reviews')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetId: seller.id, rating: 5, text: 'reusing someone else\'s transaction', type: 'seller', transactionId: unrelatedTxId });

    expect(res.statusCode).toBe(403);
  });

  test('updates in place on a second submission for the same transaction, rather than creating a duplicate', async () => {
    const buyer = await registerAndVerify('buyer7', 'buyer7@example.com');
    const seller = await registerAndVerify('seller7', 'seller7@example.com');
    const txId = createTransaction({ buyerId: buyer.id, sellerId: seller.id, status: 'completed' });

    const first = await request(app)
      .post('/api/auth/reviews')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetId: seller.id, rating: 5, text: 'first pass', type: 'seller', transactionId: txId });
    expect(first.statusCode).toBe(200);

    const second = await request(app)
      .post('/api/auth/reviews')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetId: seller.id, rating: 2, text: 'changed my mind', type: 'seller', transactionId: txId });
    expect(second.statusCode).toBe(200);
    expect(second.body.updated).toBe(true);
    expect(second.body.review.id).toBe(first.body.review.id);
    expect(second.body.review.rating).toBe(2);
  });

  test('platform and generic escrow-service ratings remain open without any transaction', async () => {
    const buyer = await registerAndVerify('buyer8', 'buyer8@example.com');

    const platformRes = await request(app)
      .post('/api/auth/reviews')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetId: 'platform', rating: 5, text: 'love it', type: 'platform' });
    expect(platformRes.statusCode).toBe(200);

    const escrowRes = await request(app)
      .post('/api/auth/reviews')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetId: 'escrow-service', rating: 4, text: 'worked fine', type: 'escrow' });
    expect(escrowRes.statusCode).toBe(200);
  });

  test('still rejects reviewing yourself', async () => {
    const buyer = await registerAndVerify('buyer9', 'buyer9@example.com');

    const res = await request(app)
      .post('/api/auth/reviews')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetId: buyer.id, rating: 5, text: 'self review', type: 'seller' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/cannot review yourself/i);
  });
});
