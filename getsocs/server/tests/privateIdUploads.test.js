const request = require('supertest');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const testDbPath = path.join(__dirname, '..', 'server.test.json');
process.env.TEST_DB_FILE = testDbPath;
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-that-is-at-least-32-characters';

const { app } = require('../server');
const { readDB, writeDB } = require('../config/db');
const { PRIVATE_UPLOADS, UPLOADS } = require('../middleware/uploadMiddleware');
const { signAccessToken } = require('../services/tokenService');

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

function seedUsers() {
  const db = readDB();
  const user = { id: 'u1', username: 'person', email: 'person@example.com', role: 'user', verified: true, tokenVersion: 0 };
  const admin = { id: 'a1', username: 'admin', email: 'admin@example.com', role: 'admin', verified: true, tokenVersion: 0 };
  db.users.push(user, admin);
  writeDB(db);
  return { userToken: signAccessToken(user), adminToken: signAccessToken(admin) };
}

describe('Private ID document storage', () => {
  test('stores identity documents outside the public upload directory and serves them only through authenticated admin API', async () => {
    const { userToken, adminToken } = seedUsers();
    const image = await sharp({ create: { width: 600, height: 400, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();

    const submitted = await request(app)
      .post('/api/auth/verify-user')
      .set('Authorization', `Bearer ${userToken}`)
      .field('documentType', 'passport')
      .field('documentId', 'P-TEST-123')
      .attach('idImage', image, { filename: 'passport.jpg', contentType: 'image/jpeg' });
    expect(submitted.statusCode).toBe(200);

    const stored = readDB().users.find(u => u.id === 'u1').verificationDocument.imageFile;
    expect(fs.existsSync(path.join(PRIVATE_UPLOADS, stored))).toBe(true);
    expect(fs.existsSync(path.join(UPLOADS, stored))).toBe(false);

    const publicAttempt = await request(app).get(`/uploads/${stored}`);
    expect(publicAttempt.statusCode).toBe(404);

    const unauthenticated = await request(app).get('/api/admin/id-verifications/u1/image');
    expect(unauthenticated.statusCode).toBe(401);

    const authorized = await request(app)
      .get('/api/admin/id-verifications/u1/image')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(authorized.statusCode).toBe(200);
    expect(authorized.headers['cache-control']).toBe('no-store');

    try { fs.unlinkSync(path.join(PRIVATE_UPLOADS, stored)); } catch (_) {}
  });
});
