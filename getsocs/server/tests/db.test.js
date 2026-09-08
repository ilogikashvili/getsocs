const fs = require('fs');
const path = require('path');

describe('database configuration', () => {
  test('uses JSON as an explicit NODE_ENV=test fixture adapter', () => {
    const testDb = path.join(__dirname, 'db.adapter.test.json');
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB_FILE = testDb;
    jest.resetModules();
    const { USE_TEST_FILE_DB, USE_FILE_DB, writeDB, readDB } = require('../config/db');
    expect(USE_TEST_FILE_DB).toBe(true);
    expect(USE_FILE_DB).toBe(true);
    writeDB({ users: [{ id: 'fixture-user' }], analytics: { pageViews: 0 } });
    expect(readDB().users[0].id).toBe('fixture-user');
    try { fs.unlinkSync(testDb); } catch (_) {}
  });

  test('production config does not expose a file-database fallback', () => {
    delete process.env.TEST_DB_FILE;
    process.env.DB_DRIVER = 'file';
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const db = require('../config/db');
    expect(db.USE_TEST_FILE_DB).toBe(false);
    expect(db.USE_FILE_DB).toBe(false);
    expect(() => db.readDB()).toThrow(/file database adapter/i);
    delete process.env.DB_DRIVER;
  });

  test('local development can explicitly use a file database adapter', () => {
    const devDb = path.join(__dirname, 'db.dev-adapter.test.json');
    process.env.NODE_ENV = 'development';
    process.env.DB_DRIVER = 'file';
    process.env.DB_FILE = devDb;
    jest.resetModules();
    const { USE_TEST_FILE_DB, USE_FILE_DB, writeDB, readDB } = require('../config/db');
    expect(USE_TEST_FILE_DB).toBe(false);
    expect(USE_FILE_DB).toBe(true);
    writeDB({ users: [{ id: 'dev-user' }], analytics: { pageViews: 0 } });
    expect(readDB().users[0].id).toBe('dev-user');
    try { fs.unlinkSync(devDb); } catch (_) {}
    delete process.env.DB_DRIVER;
    delete process.env.DB_FILE;
  });
});
