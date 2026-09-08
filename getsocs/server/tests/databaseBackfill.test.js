const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '..', 'backfill.test.json');
process.env.TEST_DB_FILE = testDbPath;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'backfill-test-secret-that-is-at-least-32-characters';

const { readDB } = require('../config/db');

afterAll(() => { try { fs.unlinkSync(testDbPath); } catch (_) {} });

test('legacy databases are backfilled with every collection current code expects', () => {
  fs.writeFileSync(testDbPath, JSON.stringify({ users: [], products: [] }));
  const db = readDB();
  for (const name of ['bids', 'escrow', 'notifications', 'idempotencyKeys', 'reviews', 'badges', 'user_badges', 'adSpaces', 'bannedIps', 'emailDeleteBlocks']) {
    expect(Array.isArray(db[name])).toBe(true);
  }
  expect(db.analytics).toEqual(expect.objectContaining({ pageViews: expect.any(Number) }));
});
