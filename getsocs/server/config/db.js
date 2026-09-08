const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const metrics = require('../services/metricsService');

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;
const DB_NAME = process.env.DB_NAME || 'getsocs_db';
const DB_CONNECTION_LIMIT = Number(process.env.DB_CONNECTION_LIMIT || 10);
const DB_CONNECT_TIMEOUT_MS = Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000);
const DB_DRIVER = (process.env.DB_DRIVER || 'mysql').toLowerCase();

// JSON is retained only as a test-fixture adapter and as an explicit migration
// source. Local development can opt in with DB_DRIVER=file; production remains MySQL.
const TEST_DB_FILE = process.env.TEST_DB_FILE ? path.resolve(process.env.TEST_DB_FILE) : null;
const USE_TEST_FILE_DB = process.env.NODE_ENV === 'test' && Boolean(TEST_DB_FILE);
const USE_FILE_DB = process.env.NODE_ENV !== 'production' && (USE_TEST_FILE_DB || DB_DRIVER === 'file' || DB_DRIVER === 'json');
const DB_FILE = TEST_DB_FILE || (process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(__dirname, '..', 'db.json'));

const ARRAY_COLLECTIONS = [
  'users', 'products', 'comments', 'transactions', 'chats', 'supportChats',
  'scanned_ids', 'bids', 'escrow', 'notifications', 'idempotencyKeys',
  'reviews', 'badges', 'user_badges', 'adSpaces', 'bannedIps', 'emailDeleteBlocks',
  'memberships', 'user_memberships', 'addons', 'user_addons'
];

const TABLES = {
  users: 'users', products: 'products', comments: 'comments', transactions: 'transactions',
  chats: 'chats', supportChats: 'support_chats', scanned_ids: 'scanned_ids', bids: 'bids',
  escrow: 'escrow', notifications: 'notifications', idempotencyKeys: 'idempotency_keys',
  reviews: 'reviews', badges: 'badges', user_badges: 'user_badges', adSpaces: 'ad_spaces',
  bannedIps: 'banned_ips', emailDeleteBlocks: 'email_delete_blocks', memberships: 'memberships',
  user_memberships: 'user_memberships', addons: 'addons', user_addons: 'user_addons'
};

const DELETE_ORDER = [
  'refresh_tokens', 'user_addons', 'user_memberships', 'user_badges', 'reviews', 'idempotency_keys',
  'notifications', 'escrow', 'bids', 'support_chats', 'chats', 'transactions',
  'comments', 'ad_spaces', 'scanned_ids', 'products', 'email_delete_blocks',
  'banned_ips', 'addons', 'memberships', 'badges', 'users'
];

let mysqlPool = null;

function requireMysqlConfig() {
  if (USE_FILE_DB) return;
  const missing = [];
  if (!DB_USER) missing.push('DB_USER');
  if (!DB_PASS) missing.push('DB_PASS');
  if (!DB_NAME) missing.push('DB_NAME');
  if (missing.length) throw new Error(`Missing MySQL configuration: ${missing.join(', ')}`);
}

function getMysqlModule() {
  try { return require('mysql2/promise'); }
  catch (error) {
    const wrapped = new Error('mysql2 is required for MySQL persistence. Run npm install in server/.');
    wrapped.cause = error;
    throw wrapped;
  }
}

function getMysqlPool() {
  if (USE_FILE_DB) throw new Error('MySQL pool is unavailable while file database adapter is active');
  if (mysqlPool) return mysqlPool;
  requireMysqlConfig();
  const mysql = getMysqlModule();
  mysqlPool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: DB_CONNECTION_LIMIT,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: DB_CONNECT_TIMEOUT_MS,
    charset: 'utf8mb4'
  });
  return mysqlPool;
}

function getDefaultMembershipTiers() {
  return [
    { id: 'vip', name: 'VIP', price: 9.99, platformFeeReduction: 0.04, dailyBoost: true, glowBorder: false,
      benefits: ['Reduced platform fee (4% instead of 5%)', '1 daily listing boost', 'VIP badge on your profile and listings'] },
    { id: 'vip_plus', name: 'VIP+', price: 24.99, platformFeeReduction: 0.02, dailyBoost: true, glowBorder: true,
      benefits: ['Lowest platform fee (2% instead of 5%)', '3 daily listing boosts', 'Glowing VIP+ badge on your profile and listings', 'Priority support'] }
  ];
}

function getDefaultAddOns() {
  return [{ id: 'addon_username_color', name: 'Custom username color', price: 4.99, duration: 'permanent' }];
}

function getDefaultDatabase() {
  return {
    users: [], products: [], comments: [], transactions: [], chats: [], supportChats: [], scanned_ids: [], bids: [],
    escrow: [], notifications: [], idempotencyKeys: [], reviews: [], badges: [], user_badges: [], adSpaces: [],
    bannedIps: [], emailDeleteBlocks: [], memberships: getDefaultMembershipTiers(), user_memberships: [],
    addons: getDefaultAddOns(), user_addons: [], analytics: { pageViews: 0 }
  };
}

function backfillMissingCollections(db) {
  const out = db && typeof db === 'object' && !Array.isArray(db) ? db : {};
  for (const name of ARRAY_COLLECTIONS) if (!Array.isArray(out[name])) out[name] = [];
  if (!out.memberships.length) out.memberships = getDefaultMembershipTiers();
  if (!out.addons.length) out.addons = getDefaultAddOns();
  if (!out.analytics || typeof out.analytics !== 'object' || Array.isArray(out.analytics)) out.analytics = { pageViews: 0 };
  return out;
}

function ensureTestDb() {
  if (!USE_FILE_DB) return;
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(getDefaultDatabase(), null, 2), 'utf8');
  }
}

// Synchronous helpers are intentionally file-adapter-only so existing Jest
// fixtures and local development can seed/assert state without a MySQL daemon.
function readDB() {
  if (!USE_FILE_DB) throw new Error('readDB() is only available with the file database adapter');
  ensureTestDb();
  return backfillMissingCollections(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
}
function writeDB(db) {
  if (!USE_FILE_DB) throw new Error('writeDB() is only available with the file database adapter');
  ensureTestDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(backfillMissingCollections(db), null, 2), 'utf8');
}

function payloadValue(row) {
  if (!row) return {};
  if (typeof row.payload === 'string') return JSON.parse(row.payload);
  return row.payload || {};
}

async function loadUserById(userId) {
  if (USE_FILE_DB) {
    return readDB().users.find(user => user.id === userId) || null;
  }
  const [rows] = await getMysqlPool().query(
    'SELECT payload, banned, token_version FROM users WHERE id=? LIMIT 1',
    [userId]
  );
  if (!rows.length) return null;
  return {
    ...payloadValue(rows[0]),
    id: userId,
    banned: Boolean(rows[0].banned),
    tokenVersion: Number(rows[0].token_version || 0)
  };
}

async function updateUserLastActive(userId, timestamp) {
  if (USE_FILE_DB) {
    const db = readDB();
    const user = db.users.find(candidate => candidate.id === userId);
    if (!user) return;
    user.lastActiveAt = timestamp;
    writeDB(db);
    return;
  }
  await getMysqlPool().query(
    "UPDATE users SET updated_at=?, payload=JSON_SET(payload, '$.lastActiveAt', ?) WHERE id=?",
    [toSqlDate(timestamp), timestamp, userId]
  );
}
function toSqlDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function bool(value) { return value ? 1 : 0; }
function stableId(collection, row, index) {
  if (row && row.id !== undefined && row.id !== null && String(row.id)) return String(row.id);
  const digest = crypto.createHash('sha256').update(JSON.stringify(row || {})).digest('hex').slice(0, 24);
  return `${collection}_${digest}_${index}`.slice(0, 128);
}
function normalizeFk(value, validIds) {
  if (value === undefined || value === null || value === '') return null;
  const v = String(value);
  return validIds && !validIds.has(v) ? null : v;
}

async function assertSchema(connection) {
  const [rows] = await connection.query("SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema=? AND table_name='app_meta'", [DB_NAME]);
  if (!rows[0] || Number(rows[0].c) !== 1) {
    const err = new Error('Getsocs MySQL schema is not initialized. Run server/database/schema.sql and seed.sql first.');
    err.code = 'DB_SCHEMA_MISSING';
    throw err;
  }
}

async function initializeDatabase() {
  if (USE_FILE_DB) { ensureTestDb(); return; }
  const pool = getMysqlPool();
  const connection = await pool.getConnection();
  try {
    await assertSchema(connection);
    await connection.query('SELECT 1');
  } finally { connection.release(); }
}

async function readStateFromConnection(connection, { lockMeta = false } = {}) {
  const metaSql = `SELECT state_version FROM app_meta WHERE id=1${lockMeta ? ' FOR UPDATE' : ''}`;
  const [metaRows] = await connection.query(metaSql);
  if (!metaRows.length) throw new Error('app_meta row is missing');
  const state = getDefaultDatabase();
  for (const key of ARRAY_COLLECTIONS) {
    const [rows] = await connection.query(`SELECT payload FROM \`${TABLES[key]}\``);
    state[key] = rows.map(payloadValue);
  }
  const [refreshRows] = await connection.query(
    'SELECT id,user_id,family_id,parent_id,token_hash,created_at,expires_at,used_at,revoked_at FROM refresh_tokens'
  );
  const usersById = new Map(state.users.map(user => { user.refreshTokens = []; return [String(user.id), user]; }));
  for (const row of refreshRows) {
    const user = usersById.get(String(row.user_id));
    if (!user) continue;
    if (!Array.isArray(user.refreshTokens)) user.refreshTokens = [];
    user.refreshTokens.push({
      id: row.id, familyId: row.family_id, parentId: row.parent_id, hash: row.token_hash,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      usedAt: row.used_at ? new Date(row.used_at).toISOString() : null,
      revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null
    });
  }
  const [analyticsRows] = await connection.query('SELECT payload FROM analytics WHERE id=1');
  state.analytics = analyticsRows.length ? payloadValue(analyticsRows[0]) : { pageViews: 0 };
  Object.defineProperty(state, '__stateVersion', { value: Number(metaRows[0].state_version), writable: true, enumerable: false, configurable: true });
  return backfillMissingCollections(state);
}

async function loadState() {
  const started = Date.now();
  if (USE_FILE_DB) {
    try { const value = readDB(); metrics.observeDatabase('state.load.test', Date.now() - started, true); return value; }
    catch (error) { metrics.observeDatabase('state.load.test', Date.now() - started, false); throw error; }
  }
  const connection = await getMysqlPool().getConnection();
  try { const value = await readStateFromConnection(connection); metrics.observeDatabase('state.load', Date.now() - started, true); return value; }
  catch (error) { metrics.observeDatabase('state.load', Date.now() - started, false); throw error; }
  finally { connection.release(); }
}

async function insertRows(connection, state) {
  const userIds = new Set(state.users.map((x, i) => stableId('users', x, i)));
  const productIds = new Set(state.products.map((x, i) => stableId('products', x, i)));
  const transactionIds = new Set(state.transactions.map((x, i) => stableId('transactions', x, i)));
  const badgeIds = new Set(state.badges.map((x, i) => stableId('badges', x, i)));
  const membershipIds = new Set(state.memberships.map((x, i) => stableId('memberships', x, i)));
  const addonIds = new Set(state.addons.map((x, i) => stableId('addons', x, i)));

  for (let i=0;i<state.users.length;i++) {
    const r=state.users[i];
    const userPayload = { ...r };
    delete userPayload.refreshTokens;
    await connection.query(
      'INSERT INTO users (id,username,email,role,banned,verified,buyer_verified,token_version,created_at,updated_at,payload) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [stableId('users',r,i), r.username||null, r.email?String(r.email).toLowerCase():null, r.role||null, bool(r.banned), bool(r.verified), bool(r.buyerVerified), Number(r.tokenVersion||0), toSqlDate(r.createdAt), toSqlDate(r.updatedAt||r.lastActiveAt), JSON.stringify(userPayload)]);
  }
  for (let i=0;i<state.users.length;i++) {
    const user = state.users[i];
    const userId = stableId('users', user, i);
    for (const token of (Array.isArray(user.refreshTokens) ? user.refreshTokens : [])) {
      if (!token || !token.id || !token.familyId || !token.hash || !token.createdAt || !token.expiresAt) continue;
      await connection.query(
        'INSERT INTO refresh_tokens (id,user_id,family_id,parent_id,token_hash,created_at,expires_at,used_at,revoked_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [String(token.id), userId, String(token.familyId), token.parentId ? String(token.parentId) : null, String(token.hash), toSqlDate(token.createdAt), toSqlDate(token.expiresAt), toSqlDate(token.usedAt), toSqlDate(token.revokedAt)]
      );
    }
  }
  for (let i=0;i<state.badges.length;i++) { const r=state.badges[i]; await connection.query('INSERT INTO badges (id,name,payload) VALUES (?,?,?)',[stableId('badges',r,i),r.name||null,JSON.stringify(r)]); }
  for (let i=0;i<state.memberships.length;i++) { const r=state.memberships[i]; await connection.query('INSERT INTO memberships (id,name,price,platform_fee_reduction,payload) VALUES (?,?,?,?,?)',[stableId('memberships',r,i),r.name||stableId('memberships',r,i),numberOrNull(r.price)||0,numberOrNull(r.platformFeeReduction),JSON.stringify(r)]); }
  for (let i=0;i<state.addons.length;i++) { const r=state.addons[i]; await connection.query('INSERT INTO addons (id,name,price,duration,payload) VALUES (?,?,?,?,?)',[stableId('addons',r,i),r.name||stableId('addons',r,i),numberOrNull(r.price)||0,r.duration||null,JSON.stringify(r)]); }
  for (let i=0;i<state.products.length;i++) { const r=state.products[i]; await connection.query('INSERT INTO products (id,seller_id,code,platform,status,price,created_at,payload) VALUES (?,?,?,?,?,?,?,?)',[stableId('products',r,i),normalizeFk(r.sellerId,userIds),r.code||null,r.platform||null,r.status||null,numberOrNull(r.price),toSqlDate(r.createdAt),JSON.stringify(r)]); }
  for (let i=0;i<state.comments.length;i++) { const r=state.comments[i]; await connection.query('INSERT INTO comments (id,product_id,user_id,created_at,payload) VALUES (?,?,?,?,?)',[stableId('comments',r,i),normalizeFk(r.productId,productIds),normalizeFk(r.userId,userIds),toSqlDate(r.createdAt||r.ts),JSON.stringify(r)]); }
  for (let i=0;i<state.scanned_ids.length;i++) { const r=state.scanned_ids[i]; await connection.query('INSERT INTO scanned_ids (id,user_id,status,created_at,payload) VALUES (?,?,?,?,?)',[stableId('scanned_ids',r,i),normalizeFk(r.userId,userIds),r.status||null,toSqlDate(r.createdAt||r.submittedAt),JSON.stringify(r)]); }
  for (let i=0;i<state.adSpaces.length;i++) { const r=state.adSpaces[i]; await connection.query('INSERT INTO ad_spaces (id,created_by,position,price,created_at,payload) VALUES (?,?,?,?,?,?)',[stableId('adSpaces',r,i),normalizeFk(r.createdBy,userIds),r.position||null,numberOrNull(r.price),toSqlDate(r.createdAt),JSON.stringify(r)]); }
  for (let i=0;i<state.transactions.length;i++) { const r=state.transactions[i]; await connection.query('INSERT INTO transactions (id,product_id,listing_id,buyer_id,seller_id,escrow_agent_id,status,stage,amount,created_at,updated_at,payload) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[stableId('transactions',r,i),normalizeFk(r.productId,productIds),normalizeFk(r.listingId,productIds),normalizeFk(r.buyerId,userIds),normalizeFk(r.sellerId,userIds),normalizeFk(r.escrowAgentId||r.escrowId,userIds),r.status||null,r.stage||null,numberOrNull(r.amount??r.productPrice??r.listingPrice),toSqlDate(r.createdAt),toSqlDate(r.updatedAt||r.completedAt),JSON.stringify(r)]); }
  for (let i=0;i<state.chats.length;i++) { const r=state.chats[i]; await connection.query('INSERT INTO chats (id,transaction_id,chat_type,created_at,payload) VALUES (?,?,?,?,?)',[stableId('chats',r,i),normalizeFk(r.txId||r.transactionId,transactionIds),r.type||null,toSqlDate(r.createdAt),JSON.stringify(r)]); }
  for (let i=0;i<state.supportChats.length;i++) { const r=state.supportChats[i]; await connection.query('INSERT INTO support_chats (id,user_id,assigned_to,status,created_at,payload) VALUES (?,?,?,?,?,?)',[stableId('supportChats',r,i),normalizeFk(r.userId,userIds),normalizeFk(r.assignedTo||r.assignedAdminId,userIds),r.status||null,toSqlDate(r.createdAt),JSON.stringify(r)]); }
  for (let i=0;i<state.bids.length;i++) { const r=state.bids[i]; await connection.query('INSERT INTO bids (id,listing_id,bidder_id,transaction_id,status,bid_amount,created_at,payload) VALUES (?,?,?,?,?,?,?,?)',[stableId('bids',r,i),normalizeFk(r.listingId,productIds),normalizeFk(r.bidderId,userIds),normalizeFk(r.transactionId,transactionIds),r.status||null,numberOrNull(r.bidAmount),toSqlDate(r.createdAt),JSON.stringify(r)]); }
  for (let i=0;i<state.escrow.length;i++) { const r=state.escrow[i]; const tx=normalizeFk(r.transactionId,transactionIds); if (!tx) continue; await connection.query('INSERT INTO escrow (id,transaction_id,status,started_at,ends_at,payload) VALUES (?,?,?,?,?,?)',[stableId('escrow',r,i),tx,r.status||null,toSqlDate(r.startedAt),toSqlDate(r.endsAt),JSON.stringify(r)]); }
  for (let i=0;i<state.notifications.length;i++) { const r=state.notifications[i]; await connection.query('INSERT INTO notifications (id,user_id,unread,notification_type,created_at,payload) VALUES (?,?,?,?,?,?)',[stableId('notifications',r,i),normalizeFk(r.userId,userIds),r.unread===false?0:1,r.type||null,toSqlDate(r.createdAt||r.ts),JSON.stringify(r)]); }
  for (let i=0;i<state.idempotencyKeys.length;i++) { const r=state.idempotencyKeys[i]; await connection.query('INSERT INTO idempotency_keys (idem_key,user_id,method,route,fingerprint,status_code,created_at,expires_at,payload) VALUES (?,?,?,?,?,?,?,?,?)',[String(r.key||r.idempotencyKey||stableId('idem',r,i)).slice(0,191),normalizeFk(r.userId,userIds),r.method||null,r.path||r.route||null,r.fingerprint||null,numberOrNull(r.statusCode),toSqlDate(r.createdAt),toSqlDate(r.expiresAt),JSON.stringify(r)]); }
  for (let i=0;i<state.reviews.length;i++) { const r=state.reviews[i]; await connection.query('INSERT INTO reviews (id,target_id,author_id,transaction_id,review_type,rating,created_at,payload) VALUES (?,?,?,?,?,?,?,?)',[stableId('reviews',r,i),r.targetId?String(r.targetId):null,normalizeFk(r.authorId,userIds),normalizeFk(r.transactionId,transactionIds),r.type||null,numberOrNull(r.rating),toSqlDate(r.createdAt||r.ts),JSON.stringify(r)]); }
  for (let i=0;i<state.user_badges.length;i++) { const r=state.user_badges[i]; const u=normalizeFk(r.userId,userIds), b=normalizeFk(r.badgeId,badgeIds); if(!u||!b) continue; await connection.query('INSERT INTO user_badges (id,user_id,badge_id,earned_at,visible,payload) VALUES (?,?,?,?,?,?)',[stableId('user_badges',r,i),u,b,toSqlDate(r.earnedAt),r.visible===false?0:1,JSON.stringify(r)]); }
  for (let i=0;i<state.bannedIps.length;i++) { const r=state.bannedIps[i]; const ip=typeof r==='string'?r:(r.ip||r.address); if(!ip) continue; await connection.query('INSERT INTO banned_ips (ip,created_at,payload) VALUES (?,?,?)',[String(ip).slice(0,64),toSqlDate(r.createdAt),JSON.stringify(r)]); }
  for (let i=0;i<state.emailDeleteBlocks.length;i++) { const r=state.emailDeleteBlocks[i]; if(!r.email) continue; await connection.query('INSERT INTO email_delete_blocks (email,blocked_until,payload) VALUES (?,?,?)',[String(r.email).toLowerCase(),toSqlDate(r.until||r.blockedUntil),JSON.stringify(r)]); }
  for (let i=0;i<state.user_memberships.length;i++) { const r=state.user_memberships[i]; const u=normalizeFk(r.userId,userIds), m=normalizeFk(r.membershipTierId,membershipIds); if(!u||!m) continue; await connection.query('INSERT INTO user_memberships (id,user_id,membership_tier_id,status,start_date,end_date,amount,payload) VALUES (?,?,?,?,?,?,?,?)',[stableId('user_memberships',r,i),u,m,r.status||null,toSqlDate(r.startDate),toSqlDate(r.endDate),numberOrNull(r.amount),JSON.stringify(r)]); }
  for (let i=0;i<state.user_addons.length;i++) { const r=state.user_addons[i]; const u=normalizeFk(r.userId,userIds), a=normalizeFk(r.addonId,addonIds); if(!u||!a) continue; await connection.query('INSERT INTO user_addons (id,user_id,addon_id,active,purchased_at,payload) VALUES (?,?,?,?,?,?)',[stableId('user_addons',r,i),u,a,r.active===false?0:1,toSqlDate(r.purchasedAt||r.createdAt),JSON.stringify(r)]); }

  const analytics = state.analytics || { pageViews: 0 };
  await connection.query('UPDATE analytics SET page_views=?, payload=? WHERE id=1',[Math.max(0,Number(analytics.pageViews)||0),JSON.stringify(analytics)]);
}

async function replaceStateInTransaction(connection, state, expectedVersion) {
  const [metaRows] = await connection.query('SELECT state_version FROM app_meta WHERE id=1 FOR UPDATE');
  const currentVersion = Number(metaRows[0]?.state_version ?? 0);
  if (expectedVersion !== undefined && expectedVersion !== null && Number(expectedVersion) !== currentVersion) {
    const error = new Error('Database state changed concurrently; retry the operation');
    error.code = 'DB_CONCURRENT_MODIFICATION';
    error.status = 409;
    throw error;
  }
  for (const table of DELETE_ORDER) await connection.query(`DELETE FROM \`${table}\``);
  await insertRows(connection, backfillMissingCollections(state));
  await connection.query('UPDATE app_meta SET state_version=state_version+1, schema_version=1 WHERE id=1');
  return currentVersion + 1;
}

async function saveState(state) {
  const started = Date.now();
  if (USE_FILE_DB) {
    try { writeDB(state); metrics.observeDatabase('state.save.test', Date.now() - started, true); return; }
    catch (error) { metrics.observeDatabase('state.save.test', Date.now() - started, false); throw error; }
  }
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const nextVersion = await replaceStateInTransaction(connection, state, state.__stateVersion);
    await connection.commit();
    Object.defineProperty(state, '__stateVersion', { value: nextVersion, writable: true, enumerable: false, configurable: true });
    metrics.observeDatabase('state.save', Date.now() - started, true);
  } catch (error) {
    await connection.rollback();
    metrics.observeDatabase('state.save', Date.now() - started, false);
    throw error;
  } finally { connection.release(); }
}

async function withDbLock(mutator) {
  const started = Date.now();
  if (USE_FILE_DB) {
    try {
      const db = readDB(); const result = await mutator(db); writeDB(db);
      metrics.observeDatabase('state.lockedMutation.test', Date.now() - started, true); return result;
    } catch (error) { metrics.observeDatabase('state.lockedMutation.test', Date.now() - started, false); throw error; }
  }
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const db = await readStateFromConnection(connection, { lockMeta: true });
    const result = await mutator(db);
    await replaceStateInTransaction(connection, db, db.__stateVersion);
    await connection.commit();
    metrics.observeDatabase('state.lockedMutation', Date.now() - started, true);
    return result;
  } catch (error) {
    await connection.rollback();
    metrics.observeDatabase('state.lockedMutation', Date.now() - started, false);
    throw error;
  } finally { connection.release(); }
}

async function checkDatabaseConnection() {
  if (USE_FILE_DB) return { ok: true, driver: USE_TEST_FILE_DB ? 'test-json' : 'file-json' };
  const started = Date.now();
  try {
    await getMysqlPool().query('SELECT 1 AS ok');
    const latencyMs = Date.now() - started; metrics.observeDatabase('health.ping', latencyMs, true);
    return { ok: true, driver: 'mysql', latencyMs };
  } catch (error) { metrics.observeDatabase('health.ping', Date.now() - started, false); throw error; }
}

async function closeDatabase() {
  if (mysqlPool) { const pool=mysqlPool; mysqlPool=null; await pool.end(); }
}

module.exports = {
  DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME, DB_CONNECTION_LIMIT,
  DB_DRIVER, DB_FILE, USE_TEST_FILE_DB, USE_FILE_DB, getMysqlPool, initializeDatabase, closeDatabase,
  checkDatabaseConnection, getDefaultDatabase, backfillMissingCollections,
  loadState, saveState, withDbLock,
    loadUserById, updateUserLastActive,
  // test-only compatibility
  readDB, writeDB
};
