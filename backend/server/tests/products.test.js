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

// Real, valid JPEG bytes at the given size - the dimension-validation
// middleware actually decodes uploaded files, so fake text buffers (the old
// fixture here) no longer pass.
async function makeTestImage(width = 800, height = 600) {
  return sharp({ create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } } })
    .jpeg()
    .toBuffer();
}

// Registers a user and completes the email-verification step, returning a
// usable auth token - registration alone no longer issues one.
async function registerAndVerify(request, app, { username, email, name = 'Seller', lastname = 'One' }) {
  const registerRes = await request(app)
    .post('/api/auth/register')
    .field('username', username)
    .field('password', 'pass123')
    .field('name', name)
    .field('lastname', lastname)
    .field('dateOfBirth', '1990-01-01')
    .field('personalNo', '222222')
    .field('email', email);

  expect(registerRes.body.requiresEmailVerification).toBe(true);

  const db = readDB();
  const user = db.users.find(u => u.email === email);
  const verifyRes = await request(app)
    .post('/api/auth/verify-email/code')
    .send({ email, code: user.verificationCode });

  expect(verifyRes.body.success).toBe(true);
  return verifyRes.body.token;
}

describe('My listings and transactions', () => {
  beforeEach(() => {
    resetDb();
  });

  afterAll(() => {
    try { fs.unlinkSync(testDbPath); } catch (e) {}
  });

  test('returns the current user\'s uploaded products from /api/products/mine', async () => {
    const token = await registerAndVerify(request, app, { username: 'sellerone', email: 'sellerone@example.com' });

    const img = await makeTestImage(800, 600);
    const uploadRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'My listing')
      .field('description', 'demo listing')
      .field('price', '100')
      .field('platform', 'YouTube')
      .field('followers', '1000')
      .field('avgViews', '10000')
      .field('topic', 'Gaming')
      .field('monetized', '0')
      .attach('images', img, '1.jpg')
      .attach('images', img, '2.jpg')
      .attach('images', img, '3.jpg');

    expect(uploadRes.statusCode).toBe(200);
    expect(uploadRes.body.success).toBe(true);

    const mineRes = await request(app)
      .get('/api/products/mine')
      .set('Authorization', `Bearer ${token}`);

    expect(mineRes.statusCode).toBe(200);
    expect(mineRes.body.success).toBe(true);
    expect(mineRes.body.data.some(product => product.id === uploadRes.body.data.id)).toBe(true);
  });

  test('rejects a listing image smaller than the minimum dimensions', async () => {
    const token = await registerAndVerify(request, app, { username: 'sellertiny', email: 'sellertiny@example.com' });

    const tinyImg = await makeTestImage(100, 100);
    const goodImg = await makeTestImage(800, 600);

    const uploadRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Tiny image listing')
      .field('price', '50')
      .field('platform', 'Other')
      .field('topic', 'Other')
      .attach('images', tinyImg, 'tiny.jpg')
      .attach('images', goodImg, '2.jpg')
      .attach('images', goodImg, '3.jpg');

    expect(uploadRes.statusCode).toBe(400);
    expect(uploadRes.body.success).toBe(false);
    expect(uploadRes.body.error).toMatch(/too small/i);
  });

  test('rejects a corrupt/non-image file even with a .jpg extension', async () => {
    const token = await registerAndVerify(request, app, { username: 'sellercorrupt', email: 'sellercorrupt@example.com' });

    const goodImg = await makeTestImage(800, 600);
    const corrupt = Buffer.from('this is definitely not a real jpeg');

    const uploadRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Corrupt image listing')
      .field('price', '50')
      .field('platform', 'Other')
      .field('topic', 'Other')
      .attach('images', corrupt, 'corrupt.jpg')
      .attach('images', goodImg, '2.jpg')
      .attach('images', goodImg, '3.jpg');

    expect(uploadRes.statusCode).toBe(400);
    expect(uploadRes.body.error).toMatch(/could not be read/i);
  });

  test('rejects non-image file types outright (multer format filter)', async () => {
    const token = await registerAndVerify(request, app, { username: 'sellerpdf', email: 'sellerpdf@example.com' });
    const goodImg = await makeTestImage(800, 600);

    const uploadRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'PDF listing')
      .field('price', '50')
      .field('platform', 'Other')
      .field('topic', 'Other')
      .attach('images', Buffer.from('%PDF-1.4 fake pdf content'), { filename: 'doc.pdf', contentType: 'application/pdf' })
      .attach('images', goodImg, '2.jpg')
      .attach('images', goodImg, '3.jpg');

    expect(uploadRes.statusCode).toBe(400);
  });

  test('auto-resizes an oversized listing image down to fit within bounds instead of rejecting it', async () => {
    const token = await registerAndVerify(request, app, { username: 'sellerhuge', email: 'sellerhuge@example.com' });

    const hugeImg = await makeTestImage(4000, 3000);
    const goodImg = await makeTestImage(800, 600);

    const uploadRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Huge image listing')
      .field('price', '50')
      .field('platform', 'Other')
      .field('topic', 'Other')
      .attach('images', hugeImg, 'huge.jpg')
      .attach('images', goodImg, '2.jpg')
      .attach('images', goodImg, '3.jpg');

    expect(uploadRes.statusCode).toBe(200);
    expect(uploadRes.body.success).toBe(true);

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const storedFilename = uploadRes.body.data.images[0];
    const metadata = await sharp(path.join(uploadsDir, storedFilename)).metadata();
    expect(metadata.width).toBeLessThanOrEqual(1920);
    expect(metadata.height).toBeLessThanOrEqual(1920);

    fs.unlinkSync(path.join(uploadsDir, storedFilename));
    uploadRes.body.data.images.slice(1).forEach(f => { try { fs.unlinkSync(path.join(uploadsDir, f)); } catch (e) {} });
  });
});
