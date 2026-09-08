#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { initializeDatabase, getMysqlPool, closeDatabase } = require('../config/db');
const required = ['users','refresh_tokens','products','comments','transactions','chats','support_chats','scanned_ids','bids','escrow','notifications','idempotency_keys','reviews','badges','user_badges','ad_spaces','banned_ips','email_delete_blocks','memberships','user_memberships','addons','user_addons','analytics','app_meta'];
(async () => {
  await initializeDatabase();
  const pool = getMysqlPool();
  const [tables] = await pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema=?', [process.env.DB_NAME || 'getsocs_db']);
  const names = new Set(tables.map(r => r.TABLE_NAME || r.table_name));
  const missing = required.filter(t => !names.has(t));
  if (missing.length) throw new Error(`Missing tables: ${missing.join(', ')}`);
  const [meta] = await pool.query('SELECT schema_version,state_version FROM app_meta WHERE id=1');
  const [counts] = await pool.query('SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM refresh_tokens) refreshTokens,(SELECT COUNT(*) FROM products) products,(SELECT COUNT(*) FROM transactions) transactions,(SELECT COUNT(*) FROM escrow) escrow');
  console.log(JSON.stringify({ ok:true, meta:meta[0], counts:counts[0] }, null, 2));
})().finally(closeDatabase).catch(error => { console.error(error.stack || error.message); process.exit(1); });
