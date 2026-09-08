const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.resolve(__dirname, 'e2e.test.json');
const IMAGE_FILE = path.resolve(__dirname, 'fixtures/test-image.png');
const PRODUCT_IMAGES = [IMAGE_FILE, path.resolve(__dirname, 'fixtures/test-image-2.png'), path.resolve(__dirname, 'fixtures/test-image-3.png')];
const API = 'http://127.0.0.1:3001/api/v1';
const PASSWORD = 'E2ePass123!';

function emptyDb() {
  return {
    users: [], products: [], comments: [], transactions: [], chats: [], supportChats: [],
    scanned_ids: [], memberships: [], user_memberships: [], addons: [], user_addons: [],
    bids: [], escrow: [], notifications: [], idempotencyKeys: [], analytics: { pageViews: 0 }
  };
}
function readDb() { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function writeDb(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function findUser(email) { return readDb().users.find(u => u.email === email); }

async function registerVerified(request, label, role = 'user') {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const email = `${label}-${stamp}@example.com`;
  const username = `${label}${stamp.replace(/\D/g, '').slice(-8)}`.slice(0, 24);
  const registration = await request.post(`${API}/auth/register`, {
    multipart: { username, name: 'Test', lastname: label, email, password: PASSWORD }
  });
  expect(registration.status()).toBe(200);
  let db = readDb();
  let user = db.users.find(u => u.email === email);
  expect(user?.verificationCode).toBeTruthy();
  if (role !== 'user') {
    user.role = role;
    writeDb(db);
  }
  const verified = await request.post(`${API}/auth/verify-email/code`, { data: { email, code: user.verificationCode } });
  expect(verified.status()).toBe(200);
  const body = await verified.json();
  expect(body.success).toBe(true);
  return { email, username, password: PASSWORD, token: body.accessToken || body.token, user: body.user };
}

async function installBrowserSession(page, session) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token: session.token, user: session.user });
}

async function apiJson(request, method, pathName, token, options = {}) {
  const headers = { Authorization: `Bearer ${token}`, ...(options.headers || {}) };
  const response = await request[method](`${API}${pathName}`, { ...options, headers });
  let body = null;
  try { body = await response.json(); } catch (_) {}
  return { response, body };
}

test.describe.serial('Getsocs critical end-to-end journeys', () => {
  test.beforeAll(() => writeDb(emptyDb()));
  test.afterAll(() => { try { fs.unlinkSync(DB_FILE); } catch (_) {} });

  test('register -> email verification -> login -> 2FA -> dashboard', async ({ page }) => {
    const stamp = `${Date.now()}`;
    const email = `browser-${stamp}@example.com`;
    const username = `browser${stamp.slice(-8)}`;

    await page.goto('/register');
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('First name').fill('Browser');
    await page.getByLabel('Last name').fill('User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByRole('heading', { name: /verify your email/i })).toBeVisible();

    const verificationCode = findUser(email).verificationCode;
    await page.getByLabel('Verification code').fill(verificationCode);
    await page.getByRole('button', { name: /verify.*create account/i }).click();
    await expect(page).not.toHaveURL(/register/);

    await page.evaluate(() => { localStorage.clear(); });
    await page.goto('/login');
    await page.getByLabel(/username or email/i).fill(username);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByRole('heading', { name: /verify your identity/i })).toBeVisible();

    const twoFactorCode = findUser(email).twoFactorCode;
    expect(twoFactorCode).toBeTruthy();
    await page.getByLabel('Verification code').fill(twoFactorCode);
    await page.getByRole('button', { name: /verify.*sign in/i }).click();
    await expect(page).not.toHaveURL(/login/);
  });

  test('list product -> buyer purchase -> escrow -> completion', async ({ page, request }) => {
    const seller = await registerVerified(request, 'seller');
    const buyer = await registerVerified(request, 'buyer');
    const admin = await registerVerified(request, 'admin', 'admin');

    await installBrowserSession(page, seller);
    await page.goto('/upload');
    await page.locator('input[name="title"]').fill('E2E Marketplace Listing');
    await page.getByPlaceholder('Description').fill('End-to-end marketplace transaction fixture');
    await page.getByPlaceholder('Price').fill('125');
    const fileInput = page.locator('input[type="file"][multiple]');
    await fileInput.setInputFiles(PRODUCT_IMAGES);
    await expect(page.getByText(/selected images: 3/i)).toBeVisible();
    await page.getByRole('button', { name: /^upload$/i }).click();
    await expect(page.getByText(/pending escrow approval/i)).toBeVisible();

    const dbAfterUpload = readDb();
    const product = dbAfterUpload.products.find(p => p.sellerId === seller.user.id);
    expect(product).toBeTruthy();
    const approval = await apiJson(request, 'post', `/products/${product.id}/approve`, admin.token, { data: { code: product.code } });
    expect(approval.response.status()).toBe(200);

    const purchase = await apiJson(request, 'post', `/transactions/products/${product.id}/buy`, buyer.token, {
      headers: { 'Idempotency-Key': `purchase-${Date.now()}` }, data: { paymentMethod: 'card' }
    });
    expect(purchase.response.status()).toBe(200);
    const tx = purchase.body.tx;

    const initiated = await apiJson(request, 'post', '/escrow/initiate', buyer.token, {
      headers: { 'Idempotency-Key': `escrow-start-${tx.id}` }, data: { transactionId: tx.id, buyerConfirmed: true, sellerConfirmed: true }
    });
    expect(initiated.response.status()).toBe(200);

    const buyerRelease = await apiJson(request, 'post', `/escrow/buyer-release/${tx.id}`, buyer.token, {
      headers: { 'Idempotency-Key': `buyer-release-${tx.id}` }
    });
    expect(buyerRelease.response.status()).toBe(200);
    const sellerRelease = await apiJson(request, 'post', `/escrow/seller-release/${tx.id}`, seller.token, {
      headers: { 'Idempotency-Key': `seller-release-${tx.id}` }
    });
    expect(sellerRelease.response.status()).toBe(200);
    expect(sellerRelease.body.escrow?.status || sellerRelease.body.escrow?.escrow?.status).toBe('completed');
  });

  test('profile photo traverses browser multipart -> backend -> public upload route', async ({ page, request }) => {
    const member = await registerVerified(request, 'photo');
    await installBrowserSession(page, member);
    await page.goto('/profile');
    const profileInput = page.locator('.profile-media-panel input[type="file"]').first();
    await profileInput.setInputFiles(IMAGE_FILE);
    await page.getByRole('button', { name: /save photos/i }).click();
    await expect(page.getByText(/profile photos updated/i)).toBeVisible();
    const updated = findUser(member.email);
    expect(updated.profilePhoto).toBeTruthy();
    const imageResponse = await request.get(`http://127.0.0.1:3001/uploads/${updated.profilePhoto}`);
    expect(imageResponse.status()).toBe(200);
    expect(imageResponse.headers()['content-type']).toMatch(/^image\//);
  });

  test('identity document is private: user submits, non-admin denied, admin allowed', async ({ request }) => {
    const subject = await registerVerified(request, 'identity');
    const stranger = await registerVerified(request, 'stranger');
    const admin = await registerVerified(request, 'idadmin', 'admin');
    const image = fs.readFileSync(IMAGE_FILE);

    const submitted = await request.post(`${API}/auth/verify-user`, {
      headers: { Authorization: `Bearer ${subject.token}` },
      multipart: {
        documentType: 'passport',
        documentId: `E2E-${Date.now()}`,
        idImage: { name: 'identity.png', mimeType: 'image/png', buffer: image }
      }
    });
    expect(submitted.status()).toBe(200);

    const denied = await apiJson(request, 'get', `/admin/id-verifications/${subject.user.id}/image`, stranger.token);
    expect([401, 403]).toContain(denied.response.status());
    const allowed = await apiJson(request, 'get', `/admin/id-verifications/${subject.user.id}/image`, admin.token);
    expect(allowed.response.status()).toBe(200);
    expect(allowed.response.headers()['content-type']).toMatch(/^image\//);
  });
});
