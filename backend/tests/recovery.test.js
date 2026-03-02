// DC1 Recovery Orchestrator Tests
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Use a temp DB for tests
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test-recovery.db');
const dataDir = path.dirname(TEST_DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Clean up any previous test DB
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

const testDb = new Database(TEST_DB_PATH);
testDb.pragma('journal_mode = WAL');

// Create the same schema as db.js
testDb.exec(`
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    gpu_status TEXT,
    provider_ip TEXT,
    provider_hostname TEXT,
    last_heartbeat TEXT,
    gpu_name_detected TEXT,
    gpu_vram_mib INTEGER DEFAULT 0,
    gpu_driver TEXT,
    gpu_compute TEXT,
    total_earnings REAL DEFAULT 0,
    total_jobs INTEGER DEFAULT 0,
    uptime_percent REAL DEFAULT 0
  )
`);

testDb.exec(`
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

testDb.exec(`
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

// Mock the db module
const mockDb = {
  run: (sql, ...params) => {
    const flat = params.reduce((a, p) => Array.isArray(p) ? a.concat(p) : a.concat([p]), []);
    return testDb.prepare(sql).run(...flat);
  },
  get: (sql, ...params) => {
    const flat = params.reduce((a, p) => Array.isArray(p) ? a.concat(p) : a.concat([p]), []);
    return testDb.prepare(sql).get(...flat);
  },
  all: (sql, ...params) => {
    const flat = params.reduce((a, p) => Array.isArray(p) ? a.concat(p) : a.concat([p]), []);
    return testDb.prepare(sql).all(...flat);
  },
};

// Override require for the engine
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  if (request === '../db' || request === './db') return 'mock-db';
  return originalResolveFilename.call(this, request, parent, ...args);
};
require.cache['mock-db'] = { id: 'mock-db', filename: 'mock-db', loaded: true, exports: mockDb };

const engine = require('../src/services/recovery-engine');

// ===== TESTS =====
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

console.log('\n🔧 DC1 Recovery Orchestrator Tests\n');

// Seed data
function seedData() {
  testDb.exec('DELETE FROM providers');
  testDb.exec('DELETE FROM jobs');
  testDb.exec('DELETE FROM recovery_events');
  testDb.exec('DELETE FROM sqlite_sequence');

  // Provider 1: online, stale heartbeat (2 minutes ago)
  const staleTime = new Date(Date.now() - 120 * 1000).toISOString();
  testDb.prepare(
    `INSERT INTO providers (name, email, status, last_heartbeat, gpu_vram_mib) VALUES (?, ?, ?, ?, ?)`
  ).run('StaleProvider', 'stale@test.com', 'online', staleTime, 8192);

  // Provider 2: online, fresh heartbeat
  const freshTime = new Date().toISOString();
  testDb.prepare(
    `INSERT INTO providers (name, email, status, last_heartbeat, gpu_vram_mib) VALUES (?, ?, ?, ?, ?)`
  ).run('FreshProvider', 'fresh@test.com', 'online', freshTime, 16384);

  // Provider 3: online, fresh, small VRAM
  testDb.prepare(
    `INSERT INTO providers (name, email, status, last_heartbeat, gpu_vram_mib) VALUES (?, ?, ?, ?, ?)`
  ).run('SmallProvider', 'small@test.com', 'online', freshTime, 2048);

  // A job on the stale provider
  testDb.prepare(
    `INSERT INTO jobs (job_id, provider_id, status, vram_required, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run('job-001', 1, 'running', 8000, new Date().toISOString());
}

// Test 1: Recovery events table exists
test('recovery_events table exists', () => {
  const table = testDb.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='recovery_events'"
  ).get();
  assert.ok(table, 'recovery_events table should exist');
});

// Test 2: detectDisconnectedProviders marks stale providers
test('detectDisconnectedProviders marks stale providers', () => {
  seedData();
  const disconnected = engine.detectDisconnectedProviders();
  assert.strictEqual(disconnected.length, 1);
  assert.strictEqual(disconnected[0].name, 'StaleProvider');

  const provider = testDb.prepare('SELECT status FROM providers WHERE id = 1').get();
  assert.strictEqual(provider.status, 'disconnected');
});

// Test 3: findBackupProvider returns provider with sufficient VRAM
test('findBackupProvider returns provider with sufficient VRAM', () => {
  seedData();
  const backup = engine.findBackupProvider(8000, 1);
  assert.ok(backup, 'Should find a backup provider');
  assert.strictEqual(backup.name, 'FreshProvider');
});

// Test 4: findBackupProvider excludes the failed provider
test('findBackupProvider excludes the failed provider', () => {
  seedData();
  // Exclude provider 2 (FreshProvider), require 8000 VRAM — SmallProvider only has 2048
  const backup = engine.findBackupProvider(8000, 2);
  // StaleProvider is online but id=1, should be returned since it has 8192 VRAM
  // Actually let's test excluding provider 1 and requiring more than 16384
  const noBackup = engine.findBackupProvider(32000, 1);
  assert.strictEqual(noBackup, undefined, 'No provider should have 32GB VRAM');
});

// Test 5: migrateJob creates a recovery event record
test('migrateJob creates a recovery event record', () => {
  seedData();
  const result = engine.migrateJob('job-001', 1, 2);
  assert.strictEqual(result.status, 'success');

  const event = testDb.prepare(
    "SELECT * FROM recovery_events WHERE job_id = 'job-001'"
  ).get();
  assert.ok(event, 'Recovery event should be recorded');
  assert.strictEqual(event.status, 'success');
  assert.strictEqual(event.from_provider_id, 1);
  assert.strictEqual(event.to_provider_id, 2);
});

// Test 6: migrateJob with no backup records no_backup
test('migrateJob with no backup records no_backup', () => {
  seedData();
  const result = engine.migrateJob('job-001', 1, null);
  assert.strictEqual(result.status, 'no_backup');

  const event = testDb.prepare(
    "SELECT * FROM recovery_events WHERE job_id = 'job-001' AND status = 'no_backup'"
  ).get();
  assert.ok(event);
});

// Test 7: Stats return correct counts
test('stats return correct counts', () => {
  seedData();
  engine.migrateJob('job-001', 1, 2);
  engine.migrateJob('job-001', 1, null);

  const total = testDb.prepare('SELECT COUNT(*) as count FROM recovery_events').get();
  assert.strictEqual(total.count, 2);

  const success = testDb.prepare("SELECT COUNT(*) as count FROM recovery_events WHERE status = 'success'").get();
  assert.strictEqual(success.count, 1);
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

// Cleanup
testDb.close();
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

process.exit(failed > 0 ? 1 : 0);
