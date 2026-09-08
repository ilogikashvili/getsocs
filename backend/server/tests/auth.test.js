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

const fixture = {
  users: [],
  products: [],
  comments: [],
  transactions: [],
  chats: [],
  supportChats: [],
  scanned_ids: [],
  analytics: { pageViews: 0 }
};

beforeAll(() => {
  process.env.TEST_DB_FILE = testDbPath;
  fs.writeFileSync(testDbPath, JSON.stringify(fixture, null, 2));
});

afterAll(() => {
  try { fs.unlinkSync(testDbPath); } catch (e) {}
});

describe('Auth and profile photo upload', () => {
  let token;

  test('registers a new user - now requires email verification, no token yet', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .field('username', 'testapi')
      .field('password', 'pass123')
      .field('name', 'Test')
      .field('lastname', 'Api')
      .field('dateOfBirth', '1990-01-01')
      .field('personalNo', '123456')
      .field('email', 'testapi@example.com');

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.requiresEmailVerification).toBe(true);
    expect(response.body.token).toBeUndefined();

    const db = readDB();
    const user = db.users.find(u => u.email === 'testapi@example.com');
    expect(user.verified).toBe(false);
    expect(user.verificationCode).toMatch(/^\d{6}$/);
  });

  test('registration requires an email (1 email = 1 account enforcement depends on it)', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .field('username', 'noemailuser')
      .field('password', 'pass123')
      .field('name', 'No')
      .field('lastname', 'Email');

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('rejects a second registration with the same email while the first is still unverified', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .field('username', 'testapi2')
      .field('password', 'pass123')
      .field('name', 'Test2')
      .field('lastname', 'Api2')
      .field('email', 'testapi@example.com');

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(/already exists/i);
  });

  test('login is blocked until the email is verified', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testapi', password: 'pass123' });

    expect(response.statusCode).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.requiresEmailVerification).toBe(true);
  });

  test('rejects an invalid verification code', async () => {
    const response = await request(app)
      .post('/api/auth/verify-email/code')
      .send({ email: 'testapi@example.com', code: '000000' });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('verifying with the correct code completes registration and returns a token', async () => {
    const db = readDB();
    const user = db.users.find(u => u.email === 'testapi@example.com');

    const response = await request(app)
      .post('/api/auth/verify-email/code')
      .send({ email: 'testapi@example.com', code: user.verificationCode });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBeDefined();
    token = response.body.token;
  });

  test('logs in an existing (now verified) user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testapi', password: 'pass123' });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.requires2FA).toBe(true);
    expect(response.body.userId).toBeDefined();
  });

  test('logs in an existing user by email address', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testapi@example.com', password: 'pass123' });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.requires2FA).toBe(true);
    expect(response.body.userId).toBeDefined();
  });

  test('returns current user via /auth/me', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.username).toBe('testapi');
  });

  test('uploads profile and background photos', async () => {
    const response = await request(app)
      .post('/api/auth/profile/photos')
      .set('Authorization', `Bearer ${token}`)
      .attach('profilePhoto', Buffer.from('test'), 'profile.jpg')
      .attach('backgroundPhoto', Buffer.from('testbg'), 'background.jpg');

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.profilePhoto).toBeTruthy();
    expect(response.body.user.backgroundPhoto).toBeTruthy();
  });

  test('issues a 6-digit password reset token', async () => {
    const response = await request(app)
      .post('/api/auth/password/request')
      .send({ email: 'testapi@example.com' });

    expect(response.statusCode).toBe(200);
    const db = readDB();
    const user = db.users.find(u => u.email === 'testapi@example.com');
    expect(user.resetPasswordToken).toMatch(/^\d{6}$/);
  });

  test('rejects password reset tokens that are not 6 digits', async () => {
    const response = await request(app)
      .post('/api/auth/password/reset')
      .send({ token: '1234567', password: 'NewPass123!' });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(/6-digit/i);
  });
});
