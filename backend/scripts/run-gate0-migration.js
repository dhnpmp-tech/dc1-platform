#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.argv[2] || path.join(__dirname, '..', 'data', 'providers.db');
const sqlPath = path.join(__dirname, '..', 'migrations', '2026-03-03-gate0-provider-readiness.sql');

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}
if (!fs.existsSync(sqlPath)) {
  console.error(`Migration not found: ${sqlPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');
const db = new Database(dbPath);

for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
  try {
    db.exec(`${stmt};`);
    console.log(`ok: ${stmt}`);
  } catch (err) {
    if (String(err.message || '').includes('duplicate column name')) {
      console.log(`skip: ${stmt}`);
      continue;
    }
    throw err;
  }
}

console.log('Gate 0 migration complete');
