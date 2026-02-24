// DC1 Provider Onboarding - SQLite Database Module
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'providers.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create providers table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    organization TEXT,
    gpu_model TEXT,
    gpu_count INTEGER DEFAULT 1,
    vram_gb INTEGER,
    os TEXT DEFAULT 'linux',
    bandwidth_mbps INTEGER,
    storage_tb REAL,
    location TEXT,
    ip_address TEXT,
    status TEXT DEFAULT 'pending',
    api_key TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Compatibility wrapper: providers.js uses db.run/get/all (async sqlite3 style)
// better-sqlite3 uses db.prepare().run/get/all - these wrappers bridge the gap
// Flatten params: if a single array is passed, spread it; otherwise pass as-is
function flatParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  // Flatten nested arrays (e.g. [arr1, arr2] -> [...arr1, ...arr2])
  return params.reduce((acc, p) => Array.isArray(p) ? acc.concat(p) : acc.concat([p]), []);
}

module.exports = {
  run: (sql, ...params) => db.prepare(sql).run(...flatParams(params)),
  get: (sql, ...params) => db.prepare(sql).get(...flatParams(params)),
  all: (sql, ...params) => db.prepare(sql).all(...flatParams(params)),
  prepare: (sql) => db.prepare(sql),
  close: () => db.close(),
  _db: db
};
