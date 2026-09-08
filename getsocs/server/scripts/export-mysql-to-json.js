#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { initializeDatabase, loadState, closeDatabase } = require('../config/db');
const outArg = process.argv.find(a => a.startsWith('--out='));
const out = path.resolve(outArg ? outArg.slice('--out='.length) : `mysql-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
(async () => {
  await initializeDatabase();
  const db = await loadState();
  fs.writeFileSync(out, JSON.stringify(db, null, 2), { mode: 0o600 });
  console.log(`Exported MySQL application data to ${out}`);
})().finally(closeDatabase).catch(error => { console.error(error.stack || error.message); process.exit(1); });
