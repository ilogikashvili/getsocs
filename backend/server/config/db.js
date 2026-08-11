const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_USER = process.env.DB_USER || 'getsocs_user';
const DB_PASS = process.env.DB_PASS || 'StrongPass123!';
const DB_NAME = process.env.DB_NAME || 'getsocs_db';
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_CMD = process.env.DB_CMD || 'mysql';
const DB_FILE = process.env.TEST_DB_FILE ? path.resolve(process.env.TEST_DB_FILE) : path.join(__dirname, '../db.json');

function shouldUseFileDb() {
  if (process.env.USE_FILE_DB === 'true') return true;
  if (process.env.USE_FILE_DB === 'false') return false;
  if (!isCommandAvailable(DB_CMD)) return true;

  try {
    mysqlQuery('SELECT 1');
    return false;
  } catch (error) {
    console.warn('MySQL is unavailable, falling back to file DB:', error.message || error);
    return true;
  }
}

const USE_FILE_DB = shouldUseFileDb();

function isCommandAvailable(cmd) {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${cmd}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function mysqlQuery(sql) {
  const env = { ...process.env, MYSQL_PWD: DB_PASS };
  return execFileSync(DB_CMD, ['-u', DB_USER, '-h', DB_HOST, '-D', DB_NAME, '-se', sql], {
    encoding: 'utf8',
    env,
  }).trim();
}

function readDB() {
  if (USE_FILE_DB) {
    try {
      ensureDb();
      const content = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.warn('Could not read db.json, using defaults:', e.message);
      return { users: [], products: [], comments: [], transactions: [], chats: [], supportChats: [], scanned_ids: [], analytics: { pageViews: 0 } };
    }
  }
  try {
    ensureDb();
    const result = mysqlQuery("SELECT JSON_UNQUOTE(data) FROM app_data WHERE id = 1");
    return JSON.parse(result);
  } catch (e) {
    console.warn('Could not read from MySQL, using defaults:', e.message);
    return { users: [], products: [], comments: [], transactions: [], chats: [], supportChats: [], scanned_ids: [], analytics: { pageViews: 0 } };
  }
}

function writeDB(db) {
  if (USE_FILE_DB) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
      console.error('Could not write db.json:', e.message);
      throw e;
    }
    return;
  }
  try {
    const json = JSON.stringify(db);
    const escapedJson = escapeSqlLiteral(json);
    mysqlQuery(`UPDATE app_data SET data = CAST('${escapedJson}' AS JSON) WHERE id = 1`);
  } catch (e) {
    console.error('Could not write to MySQL:', e.message);
    throw e;
  }
}

function ensureDb() {
  if (USE_FILE_DB) {
    if (!fs.existsSync(DB_FILE)) {
      const defaultDb = {
        users: [],
        products: [],
        comments: [],
        transactions: [],
        chats: [],
        supportChats: [],
        scanned_ids: [],
        analytics: { pageViews: 0 }
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf8');
    }
    return;
  }
  try {
    mysqlQuery(`CREATE TABLE IF NOT EXISTS app_data (id INT PRIMARY KEY, data JSON NOT NULL)`);
    mysqlQuery(`INSERT INTO app_data (id, data)
      SELECT 1, JSON_OBJECT(
        'users', JSON_ARRAY(),
        'products', JSON_ARRAY(),
        'comments', JSON_ARRAY(),
        'transactions', JSON_ARRAY(),
        'chats', JSON_ARRAY(),
        'supportChats', JSON_ARRAY(),
        'scanned_ids', JSON_ARRAY(),
        'analytics', JSON_OBJECT('pageViews', 0)
      )
      WHERE NOT EXISTS (SELECT 1 FROM app_data WHERE id = 1)`);
  } catch (e) {
    console.error('Could not initialize MySQL DB:', e.message || e);
  }
}

ensureDb();

module.exports = { readDB, writeDB, DB_USER, DB_NAME, DB_HOST, DB_PASS, DB_CMD, USE_FILE_DB, shouldUseFileDb };
