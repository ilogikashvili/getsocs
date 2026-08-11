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
    bannedIps: [],
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

function makeAdmin(userId) {
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  user.role = 'admin';
  writeDB(db);
}

describe('Banning a user no longer collaterally bans their IP / blocks unrelated logins', () => {
  beforeEach(() => {
    resetDb();
  });

  afterAll(() => {
    try { fs.unlinkSync(testDbPath); } catch (e) {}
  });

  test('banning a user does not add anything to bannedIps', async () => {
    const target = await registerAndVerify('targetuser', 'targetuser@example.com');
    const admin = await registerAndVerify('adminuser', 'adminuser@example.com');
    makeAdmin(admin.id);

    const banRes = await request(app)
      .post(`/api/admin/ban/${target.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(banRes.statusCode).toBe(200);

    const db = readDB();
    expect(db.bannedIps || []).toEqual([]);
  });

  test('a completely unrelated account can still log in after another user (sharing the same test IP) was banned', async () => {
    const target = await registerAndVerify('banme', 'banme@example.com');
    const bystander = await registerAndVerify('bystander', 'bystander@example.com');
    const admin = await registerAndVerify('adminuser2', 'adminuser2@example.com');
    makeAdmin(admin.id);

    await request(app)
      .post(`/api/admin/ban/${target.id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    // The bystander shares the same originating IP as everyone else in this
    // test (supertest requests all come from the same source), which is
    // exactly the shared-network scenario (home wifi, office, mobile
    // carrier NAT) that used to cause collateral lockouts.
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bystander', password: 'pass123' });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.requires2FA).toBe(true);
  });

  test('the banned account itself is still correctly blocked from logging in', async () => {
    const target = await registerAndVerify('banmetoo', 'banmetoo@example.com');
    const admin = await registerAndVerify('adminuser3', 'adminuser3@example.com');
    makeAdmin(admin.id);

    await request(app)
      .post(`/api/admin/ban/${target.id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'banmetoo', password: 'pass123' });

    expect(loginRes.statusCode).toBe(403);
    expect(loginRes.body.error).toMatch(/banned/i);
  });

  test('escrow still cannot ban an admin or another escrow account', async () => {
    const admin = await registerAndVerify('adminuser4', 'adminuser4@example.com');
    makeAdmin(admin.id);
    const escrowAccount = await registerAndVerify('escrowuser', 'escrowuser@example.com');
    const db = readDB();
    db.users.find(u => u.id === escrowAccount.id).role = 'escrow';
    writeDB(db);
    const otherAdmin = await registerAndVerify('adminuser5', 'adminuser5@example.com');
    makeAdmin(otherAdmin.id);

    const res = await request(app)
      .post(`/api/admin/ban/${otherAdmin.id}`)
      .set('Authorization', `Bearer ${escrowAccount.token}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/only ban users/i);
  });

  test('explicit IP ban is a separate, deliberate admin-only action', async () => {
    const admin = await registerAndVerify('adminuser6', 'adminuser6@example.com');
    makeAdmin(admin.id);
    const nonAdmin = await registerAndVerify('regularuser6', 'regularuser6@example.com');

    const forbidden = await request(app)
      .post('/api/admin/ip-bans')
      .set('Authorization', `Bearer ${nonAdmin.token}`)
      .send({ ip: '1.2.3.4' });
    expect(forbidden.statusCode).toBe(403);

    const allowed = await request(app)
      .post('/api/admin/ip-bans')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ip: '1.2.3.4', durationHours: 1 });
    expect(allowed.statusCode).toBe(200);

    const list = await request(app)
      .get('/api/admin/ip-bans')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(list.body.data.some(e => e.ip === '1.2.3.4')).toBe(true);
  });
});
