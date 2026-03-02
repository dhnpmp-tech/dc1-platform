const Database = require('better-sqlite3');

const mockDatabase = new Database(':memory:');
mockDatabase.exec(`
  CREATE TABLE providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, organization TEXT,
    gpu_model TEXT, gpu_count INTEGER DEFAULT 1, vram_gb INTEGER,
    os TEXT DEFAULT 'linux', bandwidth_mbps INTEGER, storage_tb REAL,
    location TEXT, ip_address TEXT, status TEXT DEFAULT 'pending',
    api_key TEXT, notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    gpu_status TEXT, provider_ip TEXT, provider_hostname TEXT,
    last_heartbeat TEXT, gpu_name_detected TEXT,
    gpu_vram_mib INTEGER DEFAULT 0, gpu_driver TEXT, gpu_compute TEXT,
    total_earnings REAL DEFAULT 0, total_jobs INTEGER DEFAULT 0,
    uptime_percent REAL DEFAULT 0
  );
  CREATE TABLE provider_status_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL, old_status TEXT, new_status TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

function mockFlatParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params.reduce((acc, p) => Array.isArray(p) ? acc.concat(p) : acc.concat([p]), []);
}

jest.mock('../db', () => ({
  run: (sql, ...params) => mockDatabase.prepare(sql).run(...mockFlatParams(params)),
  get: (sql, ...params) => mockDatabase.prepare(sql).get(...mockFlatParams(params)),
  all: (sql, ...params) => mockDatabase.prepare(sql).all(...mockFlatParams(params)),
  prepare: (sql) => mockDatabase.prepare(sql),
  close: () => mockDatabase.close(),
  _db: mockDatabase,
}));

const router = require('../routes/intelligence');

function seed() {
  const stmt = mockDatabase.prepare(`INSERT INTO providers (name, email, gpu_model, gpu_count, vram_gb, status, gpu_name_detected, gpu_vram_mib, gpu_driver, gpu_compute, gpu_status, last_heartbeat, uptime_percent) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  stmt.run('Fadi PC1', 'fadi@dc1.sa', 'RTX 4090', 1, 24, 'online', 'NVIDIA GeForce RTX 4090', 24576, '535.161.08', '8.9', JSON.stringify({ gpu_util_pct: 65 }), '2026-02-25T12:00:00Z', 99.2);
  stmt.run('Peter PC1', 'peter@dc1.sa', 'RTX 4090', 1, 24, 'online', 'NVIDIA GeForce RTX 4090', 24576, '535.161.08', '8.9', JSON.stringify({ gpu_util_pct: 80 }), '2026-02-25T12:05:00Z', 98.5);
  stmt.run('Tareq PC1', 'tareq@dc1.sa', 'RTX 3090', 1, 24, 'offline', 'NVIDIA GeForce RTX 3090', 24576, '530.30.02', '8.6', null, '2026-02-24T10:00:00Z', 45.0);
}

function callRoute(routePath) {
  return new Promise((resolve) => {
    const req = { method: 'GET', query: {}, params: {} };
    const res = {
      _status: 200,
      status(code) { this._status = code; return this; },
      json(data) { resolve({ status: this._status, data }); },
    };
    const layer = router.stack.find(l => l.route && l.route.path === routePath);
    layer.route.stack[0].handle(req, res);
  });
}

afterAll(() => mockDatabase.close());

describe('Intelligence API', () => {
  beforeEach(() => {
    mockDatabase.exec('DELETE FROM providers');
    mockDatabase.exec('DELETE FROM provider_status_log');
  });

  test('1. fleet endpoint returns correct shape', async () => {
    seed();
    const { data } = await callRoute('/fleet');
    for (const key of ['total_providers', 'online_providers', 'total_gpus', 'total_vram_gib', 'gpu_distribution', 'avg_utilization_pct', 'peak_gpu', 'total_compute_tflops']) {
      expect(data).toHaveProperty(key);
    }
  });

  test('2. total VRAM calculation correct', async () => {
    seed();
    const { data } = await callRoute('/fleet');
    expect(data.total_vram_gib).toBe(72);
  });

  test('3. GPU distribution groups same model into same bucket', async () => {
    seed();
    const { data } = await callRoute('/fleet');
    const rtx4090 = data.gpu_distribution.find(d => d.model.includes('4090'));
    expect(rtx4090).toBeDefined();
    expect(rtx4090.count).toBe(2);
    expect(rtx4090.total_vram_gib).toBe(48);
  });

  test('4. avg utilization only counts online providers', async () => {
    seed();
    const { data } = await callRoute('/fleet');
    expect(data.avg_utilization_pct).toBe(73);
  });

  test('5. per-provider endpoint returns array', async () => {
    seed();
    const { data } = await callRoute('/providers');
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(3);
  });

  test('6. utilization extracted from gpu_status JSON', () => {
    const extract = router._extractUtilization;
    expect(extract(JSON.stringify({ gpu_util_pct: 65 }))).toBe(65);
    expect(extract(JSON.stringify({ utilization: 42 }))).toBe(42);
    expect(extract(JSON.stringify({ gpu_utilization: 90 }))).toBe(90);
    expect(extract(null)).toBe(null);
    expect(extract('invalid{')).toBe(null);
  });

  test('7. empty DB returns zero fleet without error', async () => {
    const { status, data } = await callRoute('/fleet');
    expect(status).toBe(200);
    expect(data.total_providers).toBe(0);
    expect(data.total_gpus).toBe(0);
    expect(data.gpu_distribution).toEqual([]);
  });

  test('8. providers endpoint includes all required fields', async () => {
    seed();
    const { data } = await callRoute('/providers');
    for (const f of ['id', 'name', 'status', 'gpu_model', 'gpu_count', 'vram_gib', 'utilization_pct', 'driver', 'compute_cap', 'last_heartbeat', 'uptime_pct']) {
      expect(data[0]).toHaveProperty(f);
    }
  });

  test('9. utilization trend returns trend array', async () => {
    const { data } = await callRoute('/utilization');
    expect(data).toHaveProperty('trend');
    expect(Array.isArray(data.trend)).toBe(true);
  });
});
