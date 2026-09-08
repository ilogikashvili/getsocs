const request = require('supertest');
const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '..', 'verification-status-privacy.test.json');
process.env.TEST_DB_FILE = testDbPath;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'verification-status-test-secret-at-least-32-chars';
process.env.REDIS_ENABLED = 'false';
const { app } = require('../server');
const { signAccessToken } = require('../services/tokenService');

function token(id, role = 'user') { return signAccessToken({ id, role, tokenVersion: 0 }); }
function fixture() {
  return {
    users: [
      { id: 'user-1', username: 'one', role: 'user', tokenVersion: 0 },
      { id: 'user-2', username: 'two', role: 'user', tokenVersion: 0, verified: true, idVerified: false, idVerificationStatus: 'pending', verificationDocument: { documentType: 'passport', documentId: 'SECRET-ID', imageFile: 'identity/user-2/secret.jpg' } }
    ],
    products: [], comments: [], transactions: [], chats: [], supportChats: [], bids: [], escrow: [], notifications: [], memberships: [], user_memberships: [], addons: [], user_addons: [], badges: [], userBadges: [], idempotencyKeys: [], analytics: { pageViews: 0 }
  };
}
beforeEach(() => fs.writeFileSync(testDbPath, JSON.stringify(fixture(), null, 2)));
afterAll(() => { try { fs.unlinkSync(testDbPath); } catch (_) {} });

test('verification status never exposes document metadata or storage keys', async () => {
  const response = await request(app)
    .get('/api/v1/auth/verification-status/user-2')
    .set('Authorization', `Bearer ${token('user-1')}`);
  expect(response.statusCode).toBe(200);
  expect(response.body.data.verified).toBe(true);
  expect(response.body.data).not.toHaveProperty('verificationDocument');
  expect(JSON.stringify(response.body)).not.toContain('SECRET-ID');
  expect(JSON.stringify(response.body)).not.toContain('secret.jpg');
  expect(response.body.data).not.toHaveProperty('idVerificationStatus');
});

test('owner may see workflow status but still never receives private document fields', async () => {
  const response = await request(app)
    .get('/api/v1/auth/verification-status/user-2')
    .set('Authorization', `Bearer ${token('user-2')}`);
  expect(response.statusCode).toBe(200);
  expect(response.body.data.idVerificationStatus).toBe('pending');
  expect(response.body.data).not.toHaveProperty('verificationDocument');
});
