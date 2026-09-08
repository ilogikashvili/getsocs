const request = require('supertest');
const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '..', 'openapi.test.json');
process.env.TEST_DB_FILE = testDbPath;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'openapi-test-secret-that-is-at-least-32-characters';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';

const { app } = require('../server');
const spec = require('../config/swagger');

beforeEach(() => {
  fs.writeFileSync(testDbPath, JSON.stringify({ users: [], products: [], transactions: [], chats: [], comments: [], analytics: { pageViews: 0 } }));
});
afterAll(() => { try { fs.unlinkSync(testDbPath); } catch (_) {} });

function expectSuccessEnvelope(body) {
  const schema = spec.components.schemas.Success;
  expect(schema.required).toContain('success');
  expect(typeof body.success).toBe('boolean');
}

describe('OpenAPI contract', () => {
  test('documents all major route groups instead of auth only', () => {
    const paths = Object.keys(spec.paths || {});
    for (const prefix of ['/products', '/transactions', '/escrow', '/chats', '/bids', '/membership', '/badges', '/admin', '/notifications', '/meta']) {
      expect(paths.some(p => p === prefix || p.startsWith(`${prefix}/`))).toBe(true);
    }
    expect(paths.length).toBeGreaterThan(40);
  });

  test('v1 public meta response satisfies the documented success envelope', async () => {
    const response = await request(app).get('/api/v1/meta/platforms');
    expect(response.statusCode).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(Array.isArray(response.body.data.platforms)).toBe(true);
  });

  test('v1 product list response satisfies the documented success envelope and pagination metadata', async () => {
    const response = await request(app).get('/api/v1/products?page=1&limit=20');
    expect(response.statusCode).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 20 });
    expect(typeof response.body.meta.total).toBe('number');
  });
});
