#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { initializeDatabase, loadState, saveState, closeDatabase, backfillMissingCollections } = require('../config/db');

const sourceArg = process.argv.find(a => a.startsWith('--source='));
const source = path.resolve(sourceArg ? sourceArg.slice('--source='.length) : path.join(__dirname, '..', 'db.json'));
const force = process.argv.includes('--force');

function counts(db) {
  return Object.fromEntries(Object.entries(db).filter(([,v]) => Array.isArray(v)).map(([k,v]) => [k,v.length]));
}

(async () => {
  if (!fs.existsSync(source)) throw new Error(`Source JSON database not found: ${source}`);
  const sourceDb = backfillMissingCollections(JSON.parse(fs.readFileSync(source, 'utf8')));
  await initializeDatabase();
  const existing = await loadState();
  const existingCount = Object.values(counts(existing)).reduce((a,b)=>a+b,0);
  if (existingCount > 3 && !force) {
    throw new Error(`Target MySQL database is not empty (${existingCount} records). Re-run with --force only after taking a backup.`);
  }
  await saveState(sourceDb);
  const migrated = await loadState();
  const before = counts(sourceDb), after = counts(migrated);
  const mismatches = Object.keys(before).filter(k => before[k] !== after[k]);
  console.log('Migration counts:', JSON.stringify(after, null, 2));
  if (mismatches.length) throw new Error(`Migration verification failed for: ${mismatches.join(', ')}`);
  console.log('JSON -> MySQL migration completed and record counts verified.');
})().finally(closeDatabase).catch(error => { console.error(error.stack || error.message); process.exit(1); });
