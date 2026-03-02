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

// Idempotent schema migrations — run on every startup.
// ALTER TABLE fails silently if column already exists (SQLite "duplicate column" error).
// This ensures the schema is always correct regardless of DB state — no manual VPS steps needed.
// Recovery orchestrator table
db.exec(`
  CREATE TABLE IF NOT EXISTS recovery_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('WARNING','RECONNECT','FAILOVER','CRITICAL','DEGRADED')),
    timestamp TEXT NOT NULL,
    details TEXT,
    resolved_at TEXT
  )
`);

const migrations = [
  'ALTER TABLE providers ADD COLUMN gpu_status TEXT',
  'ALTER TABLE providers ADD COLUMN provider_ip TEXT',
  'ALTER TABLE providers ADD COLUMN provider_hostname TEXT',
  'ALTER TABLE providers ADD COLUMN last_heartbeat TEXT',
  'ALTER TABLE providers ADD COLUMN gpu_name_detected TEXT',
  'ALTER TABLE providers ADD COLUMN gpu_vram_mib INTEGER DEFAULT 0',
  'ALTER TABLE providers ADD COLUMN gpu_driver TEXT',
  'ALTER TABLE providers ADD COLUMN gpu_compute TEXT',
  'ALTER TABLE providers ADD COLUMN total_earnings REAL DEFAULT 0',
  'ALTER TABLE providers ADD COLUMN total_jobs INTEGER DEFAULT 0',
  'ALTER TABLE providers ADD COLUMN uptime_percent REAL DEFAULT 0',
  'ALTER TABLE providers ADD COLUMN reliability_score INTEGER DEFAULT 0',
];

// Additional idempotent table creation for jobs and recovery
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE NOT NULL,
    provider_id INTEGER,
    status TEXT DEFAULT 'pending',
    vram_required INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS recovery_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT,
    from_provider_id INTEGER,
    to_provider_id INTEGER,
    reason TEXT,
    status TEXT NOT NULL CHECK(status IN ('pending','success','failed','no_backup')),
    started_at TEXT NOT NULL,
    completed_at TEXT,
    notes TEXT
  )
`);

migrations.forEach(sql => {
  try {
    db.exec(sql);
  } catch (e) {
    // Column already exists — safe to ignore
  }
});

// Create jobs table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    job_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    submitted_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    duration_minutes INTEGER,
    cost_halala INTEGER DEFAULT 0,
    gpu_requirements TEXT,
    notes TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);

// Billing columns on jobs table (needed for reconciliation)
const jobMigrations = [
  'ALTER TABLE jobs ADD COLUMN cost_halala INTEGER DEFAULT 0',
  'ALTER TABLE jobs ADD COLUMN provider_earned_halala INTEGER',
  'ALTER TABLE jobs ADD COLUMN dc1_fee_halala INTEGER',
  'ALTER TABLE jobs ADD COLUMN proof_hash TEXT',
  'ALTER TABLE jobs ADD COLUMN session_id TEXT',
  'ALTER TABLE jobs ADD COLUMN job_type TEXT',
  'ALTER TABLE jobs ADD COLUMN submitted_at TEXT',
  'ALTER TABLE jobs ADD COLUMN completed_at TEXT',
];
jobMigrations.forEach(sql => { try { db.exec(sql); } catch (e) { /* column exists */ } });

// Reconciliation runs table
db.exec(`
  CREATE TABLE IF NOT EXISTS reconciliation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at TEXT NOT NULL,
    jobs_checked INTEGER DEFAULT 0,
    jobs_clean INTEGER DEFAULT 0,
    jobs_flagged INTEGER DEFAULT 0,
    total_collected_halala INTEGER DEFAULT 0,
    total_paid_halala INTEGER DEFAULT 0,
    dc1_margin_halala INTEGER DEFAULT 0,
    notes TEXT
  )
`);

// Benchmark runs table
db.exec(`
  CREATE TABLE IF NOT EXISTS benchmark_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    benchmark_type TEXT NOT NULL CHECK(benchmark_type IN ('quick','standard','full')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed')),
    started_at TEXT,
    completed_at TEXT,
    score_gflops REAL,
    temp_max_celsius REAL,
    vram_used_mib INTEGER,
    latency_ms REAL,
    notes TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
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
