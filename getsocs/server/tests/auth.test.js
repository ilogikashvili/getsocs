const request = require('supertest');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

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
      .field('password', 'TestPass123!')
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
      .field('password', 'TestPass123!')
      .field('name', 'No')
      .field('lastname', 'Email');

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('rejects a second registration with the same email while the first is still unverified', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .field('username', 'testapi2')
      .field('password', 'TestPass123!')
      .field('name', 'Testtwo')
      .field('lastname', 'Apitwo')
      .field('dateOfBirth', '1990-01-01')
      .field('personalNo', '123457')
      .field('email', 'testapi@example.com');

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(/already exists/i);
  });

  test('login is blocked until the email is verified', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testapi', password: 'TestPass123!' });

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
      .send({ username: 'testapi', password: 'TestPass123!' });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.requires2FA).toBe(true);
    expect(response.body.userId).toBeDefined();
  });

  test('logs in an existing user by email address', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testapi@example.com', password: 'TestPass123!' });

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
    const profileImage = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
    const backgroundImage = await sharp({ create: { width: 1200, height: 600, channels: 3, background: '#eeeeee' } }).jpeg().toBuffer();
    const response = await request(app)
      .post('/api/auth/profile/photos')
      .set('Authorization', `Bearer ${token}`)
      .attach('profilePhoto', profileImage, 'profile.jpg')
      .attach('backgroundPhoto', backgroundImage, 'background.jpg');

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.profilePhoto).toBeTruthy();
    expect(response.body.user.backgroundPhoto).toBeTruthy();
  });

  test('allows a user to change their name once every 30 days', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .field('username', 'namechangeuser')
      .field('password', 'Pass123!')
      .field('name', 'First')
      .field('lastname', 'Name')
      .field('email', 'namechange@example.com');

    expect(registerRes.statusCode).toBe(200);
    const db = readDB();
    const created = db.users.find(u => u.email === 'namechange@example.com');
    const verifyRes = await request(app)
      .post('/api/auth/verify-email/code')
      .send({ email: 'namechange@example.com', code: created.verificationCode });
    expect(verifyRes.statusCode).toBe(200);

    const firstUpdate = await request(app)
      .post('/api/auth/profile/update')
      .set('Authorization', `Bearer ${verifyRes.body.token}`)
      .send({ name: 'Second', lastname: 'Name' });
    expect(firstUpdate.statusCode).toBe(200);

    const secondUpdate = await request(app)
      .post('/api/auth/profile/update')
      .set('Authorization', `Bearer ${verifyRes.body.token}`)
      .send({ name: 'Third', lastname: 'Name' });
    expect(secondUpdate.statusCode).toBe(400);
    expect(secondUpdate.body.error).toMatch(/30 days|once/i);
  });

  test('deletes a user account and blocks that email from re-registering for 30 days', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .field('username', 'deleteuseraccount')
      .field('password', 'Pass123!')
      .field('name', 'Delete')
      .field('lastname', 'Me')
      .field('email', 'deleteaccount@example.com');

    expect(registerRes.statusCode).toBe(200);
    const db = readDB();
    const created = db.users.find(u => u.email === 'deleteaccount@example.com');
    const verifyRes = await request(app)
      .post('/api/auth/verify-email/code')
      .send({ email: 'deleteaccount@example.com', code: created.verificationCode });
    expect(verifyRes.statusCode).toBe(200);

    const deleteRes = await request(app)
      .post('/api/auth/account/delete')
      .set('Authorization', `Bearer ${verifyRes.body.token}`)
      .send({ confirmation: true, confirmationText: 'DELETE Delete Me', fullName: 'Delete Me' });

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const blocked = await request(app)
      .post('/api/auth/register')
      .field('username', 'deleteuseraccount2')
      .field('password', 'Pass123!')
      .field('name', 'Delete')
      .field('lastname', 'MeAgain')
      .field('email', 'deleteaccount@example.com');

    expect(blocked.statusCode).toBe(400);
    expect(blocked.body.error).toMatch(/30 days|deleted/i);
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
