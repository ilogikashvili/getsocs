#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function runSql(connection, file) {
  const sql = fs.readFileSync(file, 'utf8');
  // mysql2 supports multiple statements only when explicitly enabled on this
  // one administrative connection. Application connections keep it disabled.
  await connection.query(sql);
}

(async () => {
  const database = process.env.DB_NAME || 'getsocs_db';
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error('DB_NAME may contain only letters, numbers, and underscores');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASS, multipleStatements: true
  });
  try {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8').replaceAll('`getsocs_db`', `\`${database}\``);
    let seed = fs.readFileSync(seedPath, 'utf8').replaceAll('`getsocs_db`', `\`${database}\``);
    await connection.query(schema);
    await connection.query(seed);
    console.log(`MySQL schema and seed initialized in ${database}.`);
  } finally { await connection.end(); }
})().catch(error => { console.error(error.message); process.exit(1); });
