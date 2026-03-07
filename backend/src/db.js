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

// ─── TABLE DEFINITIONS (single definition per table, no duplicates) ───

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

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE,
    provider_id INTEGER,
    job_type TEXT,
    status TEXT DEFAULT 'pending',
    vram_required INTEGER DEFAULT 0,
    cost_halala INTEGER DEFAULT 0,
    gpu_requirements TEXT,
    notes TEXT,
    submitted_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    updated_at TEXT,
    created_at TEXT,
    duration_minutes INTEGER,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS recovery_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT,
    provider_id INTEGER,
    from_provider_id INTEGER,
    to_provider_id INTEGER,
    event_type TEXT,
    reason TEXT,
    status TEXT CHECK(status IN ('pending','success','failed','no_backup')),
    timestamp TEXT,
    details TEXT,
    started_at TEXT,
    completed_at TEXT,
    resolved_at TEXT,
    notes TEXT
  )
`);

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

db.exec(`
  CREATE TABLE IF NOT EXISTS bottleneck_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    trigger TEXT NOT NULL CHECK(trigger IN ('high_utilization','queue_overflow','timeout')),
    utilization_pct REAL,
    jobs_affected INTEGER DEFAULT 0,
    action_taken TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL
  )
`);

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

// ─── MIGRATIONS (idempotent — safe to re-run) ───

const migrations = [
  // providers columns
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
  // jobs columns (for existing DBs that had the old narrow schema)
  'ALTER TABLE jobs ADD COLUMN job_type TEXT',
  'ALTER TABLE jobs ADD COLUMN cost_halala INTEGER DEFAULT 0',
  'ALTER TABLE jobs ADD COLUMN gpu_requirements TEXT',
  'ALTER TABLE jobs ADD COLUMN notes TEXT',
  'ALTER TABLE jobs ADD COLUMN submitted_at TEXT',
  'ALTER TABLE jobs ADD COLUMN started_at TEXT',
  'ALTER TABLE jobs ADD COLUMN completed_at TEXT',
  'ALTER TABLE jobs ADD COLUMN duration_minutes INTEGER',
  // jobs columns added by sync E2E branch (needed on deployed VPS)
  'ALTER TABLE jobs ADD COLUMN assigned_at TEXT',
  'ALTER TABLE jobs ADD COLUMN picked_up_at TEXT',
  'ALTER TABLE jobs ADD COLUMN task_spec TEXT',
  'ALTER TABLE jobs ADD COLUMN result TEXT',
  'ALTER TABLE jobs ADD COLUMN error TEXT',
  // billing actuals — set at completion from real elapsed time (not submitted estimate)
  'ALTER TABLE jobs ADD COLUMN actual_cost_halala INTEGER',
  'ALTER TABLE jobs ADD COLUMN actual_duration_minutes INTEGER',
  'ALTER TABLE jobs ADD COLUMN provider_earned_halala INTEGER',
  'ALTER TABLE jobs ADD COLUMN dc1_fee_halala INTEGER',
  // renter_id for renter auth (existing jobs may lack this)
  'ALTER TABLE jobs ADD COLUMN renter_id INTEGER',
  // job timeout enforcement
  'ALTER TABLE jobs ADD COLUMN max_duration_seconds INTEGER DEFAULT 600',
  'ALTER TABLE jobs ADD COLUMN timeout_at TEXT',
  // HMAC signature for task_spec security
  'ALTER TABLE jobs ADD COLUMN task_spec_hmac TEXT',
  // provider self-service columns
  'ALTER TABLE providers ADD COLUMN run_mode TEXT DEFAULT \'always-on\'',
  'ALTER TABLE providers ADD COLUMN scheduled_start TEXT DEFAULT \'23:00\'',
  'ALTER TABLE providers ADD COLUMN scheduled_end TEXT DEFAULT \'07:00\'',
  'ALTER TABLE providers ADD COLUMN gpu_usage_cap_pct INTEGER DEFAULT 80',
  'ALTER TABLE providers ADD COLUMN vram_reserve_gb INTEGER DEFAULT 1',
  'ALTER TABLE providers ADD COLUMN temp_limit_c INTEGER DEFAULT 85',
  'ALTER TABLE providers ADD COLUMN is_paused INTEGER DEFAULT 0',
  // provider readiness + daemon tracking
  'ALTER TABLE providers ADD COLUMN readiness_status TEXT DEFAULT \'pending\'',
  'ALTER TABLE providers ADD COLUMN readiness_details TEXT',
  'ALTER TABLE providers ADD COLUMN daemon_version TEXT',
  'ALTER TABLE providers ADD COLUMN current_job_id TEXT',
  // machine verification columns
  'ALTER TABLE providers ADD COLUMN verification_status TEXT DEFAULT \'unverified\'',
  'ALTER TABLE providers ADD COLUMN verification_score INTEGER',
  'ALTER TABLE providers ADD COLUMN verification_last_at TEXT',
  'ALTER TABLE providers ADD COLUMN verification_challenge TEXT',
  'ALTER TABLE providers ADD COLUMN verified_gpu TEXT',
  // recovery_events columns (for existing DBs that had the old narrow schema)
  'ALTER TABLE recovery_events ADD COLUMN job_id TEXT',
  'ALTER TABLE recovery_events ADD COLUMN provider_id INTEGER',
  'ALTER TABLE recovery_events ADD COLUMN from_provider_id INTEGER',
  'ALTER TABLE recovery_events ADD COLUMN to_provider_id INTEGER',
  'ALTER TABLE recovery_events ADD COLUMN event_type TEXT',
  'ALTER TABLE recovery_events ADD COLUMN reason TEXT',
  'ALTER TABLE recovery_events ADD COLUMN status TEXT',
  'ALTER TABLE recovery_events ADD COLUMN timestamp TEXT',
  'ALTER TABLE recovery_events ADD COLUMN details TEXT',
  'ALTER TABLE recovery_events ADD COLUMN started_at TEXT',
  'ALTER TABLE recovery_events ADD COLUMN completed_at TEXT',
  'ALTER TABLE recovery_events ADD COLUMN resolved_at TEXT',
  'ALTER TABLE recovery_events ADD COLUMN notes TEXT',
];

migrations.forEach(sql => {
  try {
    db.exec(sql);
  } catch (e) {
    // Column already exists — safe to ignore
  }
});

// ─── RENTERS TABLE ───
db.exec(`
  CREATE TABLE IF NOT EXISTS renters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    api_key TEXT NOT NULL UNIQUE,
    organization TEXT,
    status TEXT DEFAULT 'active',
    balance_halala INTEGER DEFAULT 0,
    total_spent_halala INTEGER DEFAULT 0,
    total_jobs INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )
`);

// ─── WITHDRAWALS TABLE ───
db.exec(`
  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    withdrawal_id TEXT NOT NULL UNIQUE,
    provider_id INTEGER NOT NULL,
    amount_sar REAL NOT NULL,
    payout_method TEXT DEFAULT 'bank_transfer',
    payout_details TEXT,
    status TEXT DEFAULT 'pending',
    requested_at TEXT NOT NULL,
    processed_at TEXT,
    notes TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);

// ─── VERIFICATION RUNS TABLE ───
db.exec(`
  CREATE TABLE IF NOT EXISTS verification_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    challenge_id TEXT NOT NULL UNIQUE,
    challenge_params TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed')),
    requested_at TEXT,
    completed_at TEXT,
    result_data TEXT,
    verdict TEXT CHECK(verdict IN ('verified','suspect','failed')),
    score INTEGER,
    flags TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);

// ─── HEARTBEAT LOG TABLE ───
db.exec(`
  CREATE TABLE IF NOT EXISTS heartbeat_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    received_at TEXT NOT NULL,
    provider_ip TEXT,
    provider_hostname TEXT,
    gpu_util_pct REAL,
    gpu_temp_c REAL,
    gpu_power_w REAL,
    gpu_vram_free_mib INTEGER,
    gpu_vram_total_mib INTEGER,
    daemon_version TEXT,
    python_version TEXT,
    os_info TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);

// Compatibility wrapper: providers.js uses db.run/get/all (async sqlite3 style)
// better-sqlite3 uses db.prepare().run/get/all - these wrappers bridge the gap
function flatParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
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
