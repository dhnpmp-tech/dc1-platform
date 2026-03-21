// DC1 Daily Standup Aggregator — Tests
const Database = require('better-sqlite3');
const path = require('path');

// Create in-memory DB before requiring standup module
const testDb = new Database(':memory:');
testDb.pragma('journal_mode = WAL');
testDb.exec(`
  CREATE TABLE providers (
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
    gpu_status TEXT,
    provider_ip TEXT,
    provider_hostname TEXT,
    last_heartbeat DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Mock db module
const mockDb = {
  run: (sql, ...params) => {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return testDb.prepare(sql).run(...flat);
  },
  get: (sql, ...params) => {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return testDb.prepare(sql).get(...flat);
  },
  all: (sql, ...params) => {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return testDb.prepare(sql).all(...flat);
  },
  prepare: (sql) => testDb.prepare(sql),
  close: () => testDb.close(),
  _db: testDb
};

// Override require for db
jest.mock('../db', () => mockDb);

const { generateStandupData, sendToTelegram, _setLatestStandup, _getLatestStandup } = require('../routes/standup');
const standupRouter = require('../routes/standup');

// Helper to insert a provider
function insertProvider(overrides = {}) {
  const p = {
    name: 'Test Provider',
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.sa`,
    gpu_model: 'RTX 3090',
    os: 'linux',
    status: 'online',
    api_key: 'dc1-test-' + Math.random().toString(36).slice(2),
    created_at: new Date().toISOString(),
    gpu_status: null,
    last_heartbeat: new Date().toISOString(),
    ...overrides
  };
  mockDb.run(
    `INSERT INTO providers (name, email, gpu_model, os, status, api_key, created_at, gpu_status, last_heartbeat)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.name, p.email, p.gpu_model, p.os, p.status, p.api_key, p.created_at, p.gpu_status, p.last_heartbeat]
  );
  return p;
}

// Clear table before each test
beforeEach(() => {
  testDb.exec('DELETE FROM providers');
  _setLatestStandup(null);
});

afterAll(() => {
  testDb.close();
});

// ── Tests ────────────────────────────────────────────────────────────────────

test('1. generateStandupData returns correct structure', () => {
  const data = generateStandupData();
  expect(data).toHaveProperty('generated_at');
  expect(data).toHaveProperty('fleet');
  expect(data).toHaveProperty('gpu_mix');
  expect(data).toHaveProperty('telegram_text');
  expect(data).toHaveProperty('days_to_gate0');
  expect(data.fleet).toHaveProperty('total');
  expect(data.fleet).toHaveProperty('online');
  expect(data.fleet).toHaveProperty('offline');
});

test('2. empty DB returns zero counts', () => {
  const data = generateStandupData();
  expect(data.fleet.total).toBe(0);
  expect(data.fleet.online).toBe(0);
  expect(data.fleet.offline).toBe(0);
  expect(data.new_24h).toBe(0);
});

test('3. counts online and offline providers correctly', () => {
  insertProvider({ status: 'online' });
  insertProvider({ status: 'online' });
  insertProvider({ status: 'offline' });
  const data = generateStandupData();
  expect(data.fleet.total).toBe(3);
  expect(data.fleet.online).toBe(2);
  expect(data.fleet.offline).toBe(1);
});

test('4. counts new registrations in last 24h', () => {
  insertProvider({ created_at: new Date().toISOString() });
  insertProvider({ created_at: '2020-01-01T00:00:00Z' });
  const data = generateStandupData();
  expect(data.new_24h).toBe(1);
});

test('5. GPU model distribution groups correctly', () => {
  insertProvider({ gpu_model: 'RTX 3090' });
  insertProvider({ gpu_model: 'RTX 3090' });
  insertProvider({ gpu_model: 'RTX 3060' });
  const data = generateStandupData();
  expect(data.gpu_mix).toHaveLength(2);
  const m3090 = data.gpu_mix.find(g => g.gpu_model === 'RTX 3090');
  expect(m3090.count).toBe(2);
});

test('6. GPU utilization average computed from gpu_status JSON', () => {
  insertProvider({ gpu_status: JSON.stringify({ gpu_util_pct: 80 }) });
  insertProvider({ gpu_status: JSON.stringify({ gpu_util_pct: 60 }) });
  const data = generateStandupData();
  expect(data.avg_utilization).toBe(70);
});

test('7. at-risk providers detected by stale heartbeat', () => {
  const stale = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  insertProvider({ status: 'online', last_heartbeat: stale });
  insertProvider({ status: 'online', last_heartbeat: new Date().toISOString() });
  const data = generateStandupData();
  expect(data.at_risk_count).toBe(1);
});

test('8. telegram_text contains expected markers', () => {
  insertProvider({});
  const data = generateStandupData();
  expect(data.telegram_text).toContain('DC1 Daily Standup');
  expect(data.telegram_text).toContain('Fleet:');
  expect(data.telegram_text).toContain('Gate 0:');
});

test('9. days_to_gate0 is a non-negative number', () => {
  const data = generateStandupData();
  expect(typeof data.days_to_gate0).toBe('number');
  expect(data.days_to_gate0).toBeGreaterThanOrEqual(0);
});

test('10. sendToTelegram returns error when no token', async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  const result = await sendToTelegram('test');
  expect(result.ok).toBe(false);
  expect(result.error).toContain('No bot token');
});

test('11. latestStandup cached after generate', () => {
  expect(_getLatestStandup()).toBeNull();
  generateStandupData();
  expect(_getLatestStandup()).not.toBeNull();
});

test('12. avg_utilization is null when no gpu_status data', () => {
  insertProvider({ gpu_status: null });
  const data = generateStandupData();
  expect(data.avg_utilization).toBeNull();
});
