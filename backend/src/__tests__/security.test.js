const Database = require('better-sqlite3');
const express = require('express');
const request = require('supertest');

let app;
const ADMIN_TOKEN = 'test-admin-token';

function flatParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params.reduce((acc, p) => Array.isArray(p) ? acc.concat(p) : acc.concat([p]), []);
}

// Use global to share DB between mock and tests
jest.mock('../db', () => {
  return {
    get run() { return (sql, ...params) => global.__testDb.prepare(sql).run(...flatParams(params)); },
    get get() { return (sql, ...params) => global.__testDb.prepare(sql).get(...flatParams(params)); },
    get all() { return (sql, ...params) => global.__testDb.prepare(sql).all(...flatParams(params)); },
    get prepare() { return (sql) => global.__testDb.prepare(sql); },
    get _db() { return global.__testDb; },
    close: () => {},
  };

  function flatParams(params) {
    if (params.length === 1 && Array.isArray(params[0])) return params[0];
    return params.reduce((acc, p) => Array.isArray(p) ? acc.concat(p) : acc.concat([p]), []);
  }
});

beforeEach(() => {
  process.env.DC1_ADMIN_TOKEN = ADMIN_TOKEN;
  global.__testDb = new Database(':memory:');
  global.__testDb.pragma('journal_mode = WAL');
  global.__testDb.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      organization TEXT, gpu_model TEXT, gpu_count INTEGER DEFAULT 1,
      vram_gb INTEGER, os TEXT DEFAULT 'linux', bandwidth_mbps INTEGER,
      storage_tb REAL, location TEXT, ip_address TEXT,
      status TEXT DEFAULT 'pending', api_key TEXT, notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_heartbeat DATETIME, provider_ip TEXT, provider_hostname TEXT, gpu_status TEXT
    )
  `);
  global.__testDb.exec(`
    CREATE TABLE IF NOT EXISTS provider_status_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL, old_status TEXT, new_status TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Re-require security route each time
  const secPath = require.resolve('../routes/security');
  delete require.cache[secPath];
  const securityRouter = require('../routes/security');
  app = express();
  app.use(express.json());
  app.use('/api/security', securityRouter);
});

afterEach(() => {
  delete process.env.DC1_ADMIN_TOKEN;
  try { global.__testDb.close(); } catch {}
});

test('GET /api/security/events returns events array', async () => {
  const res = await request(app).get('/api/security/events').set('x-admin-token', ADMIN_TOKEN);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.events)).toBe(true);
  expect(typeof res.body.total).toBe('number');
});

test('GET /api/security/summary returns severity counts', async () => {
  const res = await request(app).get('/api/security/summary').set('x-admin-token', ADMIN_TOKEN);
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('total');
  expect(res.body).toHaveProperty('critical');
  expect(res.body).toHaveProperty('warning');
  expect(res.body).toHaveProperty('info');
});

test('detects stale heartbeat as critical event', async () => {
  global.__testDb.prepare(
    `INSERT INTO providers (name, email, gpu_model, os, status, last_heartbeat, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', '-10 minutes'), datetime('now', '-2 days'))`
  ).run('StaleGuy', 'stale@test.com', 'RTX 4090', 'linux', 'online');

  const res = await request(app).get('/api/security/events').set('x-admin-token', ADMIN_TOKEN);
  expect(res.status).toBe(200);
  const staleEvents = res.body.events.filter(e => e.type === 'failed_heartbeat');
  expect(staleEvents.length).toBe(1);
  expect(staleEvents[0].severity).toBe('critical');
});

test('detects new registrations as info events', async () => {
  global.__testDb.prepare(
    `INSERT INTO providers (name, email, gpu_model, os, status, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', '-1 hour'))`
  ).run('NewGuy', 'new@test.com', 'RTX 3090', 'linux', 'registered');

  const res = await request(app).get('/api/security/events').set('x-admin-token', ADMIN_TOKEN);
  const newEvents = res.body.events.filter(e => e.type === 'new_registration');
  expect(newEvents.length).toBe(1);
  expect(newEvents[0].severity).toBe('info');
});

test('POST /api/security/flag requires admin token', async () => {
  global.__testDb.prepare(
    `INSERT INTO providers (name, email, gpu_model, os, status) VALUES (?, ?, ?, ?, ?)`
  ).run('Target', 'target@test.com', 'RTX 4090', 'linux', 'online');
  const res = await request(app).post('/api/security/flag/1');
  expect(res.status).toBe(401);
});

test('POST /api/security/flag rejects nonexistent provider', async () => {
  const res = await request(app)
    .post('/api/security/flag/9999')
    .set('x-admin-token', ADMIN_TOKEN);
  expect(res.status).toBe(404);
});

test('empty DB returns zero events without error', async () => {
  const res = await request(app).get('/api/security/events').set('x-admin-token', ADMIN_TOKEN);
  expect(res.status).toBe(200);
  expect(res.body.events).toEqual([]);
  expect(res.body.total).toBe(0);
});

test('events have required schema fields', async () => {
  global.__testDb.prepare(
    `INSERT INTO providers (name, email, gpu_model, os, status, last_heartbeat, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', '-10 minutes'), datetime('now', '-1 hour'))`
  ).run('SchemaTest', 'schema@test.com', 'RTX 4090', 'linux', 'online');

  const res = await request(app).get('/api/security/events').set('x-admin-token', ADMIN_TOKEN);
  expect(res.status).toBe(200);
  for (const event of res.body.events) {
    expect(event).toHaveProperty('type');
    expect(event).toHaveProperty('severity');
    expect(event).toHaveProperty('provider_id');
    expect(event).toHaveProperty('provider_name');
    expect(event).toHaveProperty('description');
    expect(event).toHaveProperty('timestamp');
    expect(['info', 'warning', 'critical']).toContain(event.severity);
  }
});
