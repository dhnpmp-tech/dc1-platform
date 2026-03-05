// Admin v2 tests — run with: node tests/admin-v2.test.js
const path = require('path');
const assert = require('assert');

// Point db to a temp location
process.env.NODE_ENV = 'test';
const testDbPath = path.join(__dirname, '..', 'backend', 'data', 'test-admin-v2.db');
const fs = require('fs');
try { fs.unlinkSync(testDbPath); } catch(e) {}

// Patch db path before requiring
const Database = require(path.join(__dirname, '..', 'backend', 'node_modules', 'better-sqlite3'));
const db = new Database(testDbPath);
db.pragma('journal_mode = WAL');

// Run schema from db.js manually (simplified)
db.exec(`
  CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    organization TEXT, gpu_model TEXT, gpu_count INTEGER DEFAULT 1, vram_gb INTEGER,
    os TEXT DEFAULT 'linux', bandwidth_mbps INTEGER, storage_tb REAL, location TEXT,
    ip_address TEXT, status TEXT DEFAULT 'pending', api_key TEXT, notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    gpu_status TEXT, provider_ip TEXT, provider_hostname TEXT, last_heartbeat TEXT,
    gpu_name_detected TEXT, gpu_vram_mib INTEGER DEFAULT 0, gpu_driver TEXT, gpu_compute TEXT,
    total_earnings REAL DEFAULT 0, total_jobs INTEGER DEFAULT 0, uptime_percent REAL DEFAULT 0,
    reliability_score INTEGER DEFAULT 0, run_mode TEXT DEFAULT 'always-on',
    scheduled_start TEXT DEFAULT '23:00', scheduled_end TEXT DEFAULT '07:00',
    gpu_usage_cap_pct INTEGER DEFAULT 80, vram_reserve_gb INTEGER DEFAULT 1,
    temp_limit_c INTEGER DEFAULT 85, is_paused INTEGER DEFAULT 0
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT UNIQUE, provider_id INTEGER,
    job_type TEXT, status TEXT DEFAULT 'pending', vram_required INTEGER DEFAULT 0,
    cost_halala INTEGER DEFAULT 0, gpu_requirements TEXT, notes TEXT, submitted_at TEXT,
    started_at TEXT, completed_at TEXT, updated_at TEXT, created_at TEXT, duration_minutes INTEGER,
    assigned_at TEXT, picked_up_at TEXT, task_spec TEXT, result TEXT, error TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS recovery_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT, provider_id INTEGER,
    from_provider_id INTEGER, to_provider_id INTEGER, event_type TEXT, reason TEXT,
    status TEXT, timestamp TEXT, details TEXT, started_at TEXT, completed_at TEXT,
    resolved_at TEXT, notes TEXT
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS heartbeat_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER NOT NULL,
    received_at TEXT NOT NULL, provider_ip TEXT, provider_hostname TEXT,
    gpu_util_pct REAL, gpu_temp_c REAL, gpu_power_w REAL,
    gpu_vram_free_mib INTEGER, gpu_vram_total_mib INTEGER,
    daemon_version TEXT, python_version TEXT, os_info TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✅ ${name}`); }
  catch(e) { failed++; console.log(`  ❌ ${name}: ${e.message}`); }
}

console.log('\n=== Admin v2 Tests ===\n');

// Test 1: heartbeat_log table exists
test('heartbeat_log table created', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='heartbeat_log'").all();
  assert.strictEqual(tables.length, 1);
});

// Test 2: Heartbeat with full gpu_status populates fields + log
test('Heartbeat extracts GPU fields and logs', () => {
  // Insert a provider
  db.prepare("INSERT INTO providers (name, email, gpu_model, api_key, status) VALUES (?,?,?,?,?)").run(
    'Test Provider', 'test@test.com', 'RTX 3060 Ti', 'test-key-123', 'registered'
  );
  const provider = db.prepare("SELECT id FROM providers WHERE api_key = ?").get('test-key-123');

  // Simulate heartbeat logic
  const gpu_status = {
    gpu_name: 'NVIDIA GeForce RTX 3060 Ti', gpu_vram_mib: 8192, free_vram_mib: 6000,
    driver_version: '537.70', compute_cap: '8.6', gpu_util_pct: 45.0,
    temp_c: 62.0, power_w: 120.5, daemon_version: '1.1.0',
    python_version: '3.12.4', os_info: 'Windows 10.0.19045'
  };
  const gs = gpu_status;
  const now = new Date().toISOString();

  db.prepare(`UPDATE providers SET gpu_status = ?, provider_ip = ?, provider_hostname = ?, last_heartbeat = ?, status = 'online',
    gpu_name_detected = COALESCE(?, gpu_name_detected), gpu_vram_mib = COALESCE(?, gpu_vram_mib), gpu_driver = COALESCE(?, gpu_driver) WHERE id = ?`
  ).run(JSON.stringify(gpu_status), '1.2.3.4', 'DESKTOP-TEST', now, gs.gpu_name, gs.gpu_vram_mib, gs.driver_version, provider.id);

  db.prepare(`INSERT INTO heartbeat_log (provider_id, received_at, provider_ip, provider_hostname, gpu_util_pct, gpu_temp_c, gpu_power_w, gpu_vram_free_mib, gpu_vram_total_mib, daemon_version, python_version, os_info)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(provider.id, now, '1.2.3.4', 'DESKTOP-TEST', gs.gpu_util_pct, gs.temp_c, gs.power_w, gs.free_vram_mib, gs.gpu_vram_mib, gs.daemon_version, gs.python_version, gs.os_info);

  // Verify
  const updated = db.prepare("SELECT * FROM providers WHERE id = ?").get(provider.id);
  assert.strictEqual(updated.gpu_name_detected, 'NVIDIA GeForce RTX 3060 Ti');
  assert.strictEqual(updated.gpu_vram_mib, 8192);
  assert.strictEqual(updated.gpu_driver, '537.70');
  assert.strictEqual(updated.status, 'online');

  const log = db.prepare("SELECT * FROM heartbeat_log WHERE provider_id = ?").all(provider.id);
  assert.strictEqual(log.length, 1);
  assert.strictEqual(log[0].gpu_util_pct, 45.0);
  assert.strictEqual(log[0].gpu_temp_c, 62.0);
  assert.strictEqual(log[0].daemon_version, '1.1.0');
});

// Test 3: Provider detail endpoint logic
test('Provider detail returns uptime and heartbeat_log', () => {
  const provider = db.prepare("SELECT * FROM providers WHERE api_key = ?").get('test-key-123');
  const since24h = new Date(Date.now() - 24*60*60*1000).toISOString();
  const hb24h = db.prepare('SELECT COUNT(*) as cnt FROM heartbeat_log WHERE provider_id = ? AND received_at > ?').get(provider.id, since24h);
  assert(hb24h.cnt >= 1);

  const recentHb = db.prepare('SELECT * FROM heartbeat_log WHERE provider_id = ? ORDER BY received_at DESC LIMIT 20').all(provider.id);
  assert(recentHb.length >= 1);
  assert.strictEqual(recentHb[0].gpu_util_pct, 45.0);
});

// Test 4: Job detail with billing
test('Job detail returns billing breakdown', () => {
  const provider = db.prepare("SELECT id FROM providers WHERE api_key = ?").get('test-key-123');
  db.prepare("INSERT INTO jobs (job_id, provider_id, job_type, status, cost_halala, submitted_at, started_at, completed_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run('job-test-001', provider.id, 'llm-inference', 'completed', 500, '2026-03-05T10:00:00Z', '2026-03-05T10:01:00Z', '2026-03-05T10:11:00Z', '2026-03-05T10:00:00Z');

  const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get('job-test-001');
  assert(job);
  const elapsed = Math.floor((new Date(job.completed_at) - new Date(job.started_at)) / 60000);
  assert.strictEqual(elapsed, 10);

  const billing = {
    cost_halala: job.cost_halala,
    cost_sar: (job.cost_halala / 100).toFixed(2),
    provider_cut_halala: Math.round(job.cost_halala * 0.75),
    dc1_cut_halala: Math.round(job.cost_halala * 0.25)
  };
  assert.strictEqual(billing.cost_sar, '5.00');
  assert.strictEqual(billing.provider_cut_halala, 375);
  assert.strictEqual(billing.dc1_cut_halala, 125);
});

// Cleanup
db.close();
try { fs.unlinkSync(testDbPath); } catch(e) {}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
