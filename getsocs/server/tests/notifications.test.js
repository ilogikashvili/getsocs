const request = require('supertest');
const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '..', 'server.test.json');
process.env.TEST_DB_FILE = testDbPath;
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';

const { app } = require('../server');
const { readDB } = require('../config/db');

jest.setTimeout(20000);

function resetDb() {
  fs.writeFileSync(testDbPath, JSON.stringify({
    users: [],
    products: [],
    comments: [],
    transactions: [],
    chats: [],
    supportChats: [],
    scanned_ids: [],
    analytics: { pageViews: 0 }
  }, null, 2));
}

describe('Notifications API', () => {
  beforeEach(() => {
    resetDb();
  });

  afterAll(() => {
    try { fs.unlinkSync(testDbPath); } catch (e) {}
  });

  test('returns notifications for the current user from backend data', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .field('username', 'notifuser')
      .field('password', 'TestPass123!')
      .field('name', 'Notif')
      .field('lastname', 'User')
      .field('dateOfBirth', '1990-01-01')
      .field('personalNo', '333333')
      .field('email', 'notifuser@example.com');

    expect(registerRes.body.requiresEmailVerification).toBe(true);

    const db = readDB();
    const user = db.users.find(u => u.email === 'notifuser@example.com');
    const verifyRes = await request(app)
      .post('/api/auth/verify-email/code')
      .send({ email: 'notifuser@example.com', code: user.verificationCode });

    expect(verifyRes.body.success).toBe(true);
    const token = verifyRes.body.token;

    const response = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
