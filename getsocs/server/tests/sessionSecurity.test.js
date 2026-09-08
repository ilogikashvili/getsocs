const request = require('supertest');
const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '..', 'server.test.json');
process.env.TEST_DB_FILE = testDbPath;
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-that-is-at-least-32-characters';

const { app } = require('../server');
const { readDB } = require('../config/db');

const fixture = {
  users: [], products: [], comments: [], transactions: [], chats: [], supportChats: [],
  scanned_ids: [], memberships: [], user_memberships: [], addons: [], user_addons: [],
  analytics: { pageViews: 0 }
};

beforeEach(() => {
  fs.writeFileSync(testDbPath, JSON.stringify(fixture, null, 2));
});

afterAll(() => {
  try { fs.unlinkSync(testDbPath); } catch (_) {}
});

async function createVerifiedSession(username = 'sessionuser', email = 'session@example.com') {
  const registration = await request(app)
    .post('/api/auth/register')
    .field('username', username)
    .field('password', 'TestPass123!')
    .field('name', 'Session')
    .field('lastname', 'User')
    .field('email', email);
  expect(registration.statusCode).toBe(200);

  const user = readDB().users.find(u => u.email === email);
  const verification = await request(app)
    .post('/api/auth/verify-email/code')
    .send({ email, code: user.verificationCode });
  expect(verification.statusCode).toBe(200);
  return verification;
}

describe('Session security', () => {
  test('rotates refresh tokens and rejects replay of an already-used refresh token', async () => {
    const verification = await createVerifiedSession();
    const firstCookie = verification.headers['set-cookie']?.[0];
    expect(firstCookie).toMatch(/getsocs_refresh=/);
    expect(firstCookie).toMatch(/HttpOnly/i);

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.body.accessToken).toBeDefined();
    const rotatedCookie = refreshed.headers['set-cookie']?.[0];
    expect(rotatedCookie).toMatch(/getsocs_refresh=/);

    const replay = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    expect(replay.statusCode).toBe(401);
    expect(replay.body.error).toMatch(/replay detected/i);

    // Replaying an ancestor token revokes the entire login family, including
    // the legitimate rotated token returned by the first refresh.
    const rotatedAfterReplay = await request(app).post('/api/auth/refresh').set('Cookie', rotatedCookie);
    expect(rotatedAfterReplay.statusCode).toBe(401);
  });

  test('logout everywhere invalidates already-issued access tokens', async () => {
    const verification = await createVerifiedSession('alllogout', 'alllogout@example.com');
    const token = verification.body.accessToken || verification.body.token;

    const logout = await request(app)
      .post('/api/auth/logout-everywhere')
      .set('Authorization', `Bearer ${token}`);
    expect(logout.statusCode).toBe(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.statusCode).toBe(401);
    expect(me.body.error).toMatch(/revoked/i);
  });

  test('health endpoint exposes a request id and dependency checks', async () => {
    const response = await request(app).get('/api/v1/health');
    expect([200, 503]).toContain(response.statusCode);
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(response.body.checks).toBeDefined();
    expect(response.body.checks.database).toBeDefined();
    expect(response.body.checks.disk).toBeDefined();
  });
});
