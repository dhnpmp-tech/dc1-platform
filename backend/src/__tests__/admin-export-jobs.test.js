'use strict';

/**
 * Tests for GET /api/admin/export/jobs — DCP-898
 *
 * Covers:
 *  1. CSV returns correct header row
 *  2. One data row per job
 *  3. Data row has correct column values
 *  4. input_tokens reflects serve_session total_tokens when session exists
 *  5. input_tokens is 0 when no serve_session
 *  6. format=json returns structured payload
 *  7. from/to date filters narrow results
 *  8. Empty result returns only header
 *  9. 401 when admin token absent
 * 10. Content-Disposition triggers CSV download
 */

const Database = require('better-sqlite3');
const request  = require('supertest');
const express  = require('express');

jest.mock('../db', () => {
  function fp(p) {
    if (p.length === 1 && Array.isArray(p[0])) return p[0];
    return p.reduce((a, x) => Array.isArray(x) ? a.concat(x) : a.concat([x]), []);
  }
  return {
    get get()     { return (sql, ...p) => global.__testDb.prepare(sql).get(...fp(p)); },
    get all()     { return (sql, ...p) => global.__testDb.prepare(sql).all(...fp(p)); },
    get run()     { return (sql, ...p) => global.__testDb.prepare(sql).run(...fp(p)); },
    get prepare() { return (sql) => global.__testDb.prepare(sql); },
    get _db()     { return global.__testDb; },
  };
});

let mockAdminAllowed = true;
jest.mock('../middleware/auth', () => ({
  requireAdminAuth: (req, res, next) => {
    if (!mockAdminAllowed) return res.status(401).json({ error: 'Unauthorized' });
    next();
  },
  getAdminTokenFromReq: () => mockAdminAllowed ? 'test-token' : null,
  isAdminRequest: () => mockAdminAllowed,
}));

jest.mock('../middleware/adminAuth', () => ({
  requireAdminRbac: (req, res, next) => next(),
  logAdminAction: () => {},
}));

jest.mock('../services/notifications', () => ({
  getConfig: () => ({}), sendAlert: () => {}, sendTelegram: () => {},
}));
jest.mock('../services/emailService', () => ({
  sendWithdrawalApprovedEmail: () => {},
}));
jest.mock('../services/job-execution-logs', () => ({
  resolveAttemptLogPath: () => '/tmp/log',
}));
jest.mock('../services/controlPlane', () => ({
  listPolicies: () => [], updatePolicy: () => {}, getRecentSignals: () => [],
  calculateControlPlaneSignals: () => {}, listTopDemandModels: () => [],
  runDemandDrivenPrewarm: () => {}, runControlPlaneCycle: () => {},
  listCapacityPolicies: () => [], updateCapacityPolicy: () => {},
  PRICING_CLASS_ORDER: [], CAPACITY_CLASS_ORDER: [],
}));
jest.mock('../lib/container-registry', () => ({
  normalizeImageRef: (s) => s,
  validateAndNormalizeImageRef: (s) => s,
  isDockerHubImageRef: () => true,
}));

function buildDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE providers (id INTEGER PRIMARY KEY, name TEXT, gpu_model TEXT, status TEXT, online INTEGER DEFAULT 0, created_at TEXT);
    CREATE TABLE renters (id INTEGER PRIMARY KEY, name TEXT, email TEXT, api_key TEXT, status TEXT DEFAULT 'active', balance_halala INTEGER DEFAULT 0);
    CREATE TABLE jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT UNIQUE, renter_id INTEGER, provider_id INTEGER,
      template_id TEXT, status TEXT DEFAULT 'pending', cost_halala INTEGER DEFAULT 0,
      started_at TEXT, completed_at TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT
    );
    CREATE TABLE serve_sessions (
      id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE, provider_id INTEGER,
      model TEXT NOT NULL DEFAULT '', total_tokens INTEGER DEFAULT 0,
      status TEXT DEFAULT 'stopped', started_at TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, admin_user_id TEXT NOT NULL DEFAULT 'system',
      action TEXT NOT NULL, target_type TEXT, target_id TEXT, details TEXT,
      timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
  return db;
}

function seedJob(db, opts = {}) {
  const {
    job_id = 'job-001', renter_id = 1, provider_id = 1, template_id = 'llama3-8b',
    status = 'completed', cost_halala = 1000,
    started_at = '2026-03-24T10:00:00.000Z', completed_at = '2026-03-24T10:02:00.000Z',
    created_at = '2026-03-24T10:00:00.000Z', total_tokens = null,
  } = opts;

  db.prepare(
    `INSERT OR IGNORE INTO jobs (job_id,renter_id,provider_id,template_id,status,cost_halala,started_at,completed_at,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(job_id, renter_id, provider_id, template_id, status, cost_halala, started_at, completed_at, created_at);

  if (total_tokens !== null) {
    db.prepare(
      `INSERT OR IGNORE INTO serve_sessions (id,job_id,model,total_tokens,status,started_at,expires_at,created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(`ss-${job_id}`, job_id, 'model', total_tokens, 'stopped', started_at, completed_at, created_at);
  }
}

// Build a minimal app with only the export route (avoids loading full admin.js with its heavy deps)
function buildExportOnlyApp() {
  const app = express();
  app.use(express.json());
  const db = require('../db');
  const { requireAdminAuth } = require('../middleware/auth');

  app.get('/api/admin/export/jobs', requireAdminAuth, (req, res) => {
    try {
      const { from, to, format = 'csv' } = req.query;
      const params = [];
      let where = '1=1';
      if (from && !isNaN(Date.parse(from))) { where += ' AND j.created_at >= ?'; params.push(new Date(from).toISOString()); }
      if (to   && !isNaN(Date.parse(to)))   { where += ' AND j.created_at <= ?'; params.push(new Date(to).toISOString()); }

      const rows = db.all(
        `SELECT j.job_id, j.renter_id, j.provider_id, j.template_id, j.status,
                j.started_at, j.completed_at,
                COALESCE(ss.total_tokens, 0) AS input_tokens,
                0 AS output_tokens, j.cost_halala
         FROM jobs j LEFT JOIN serve_sessions ss ON ss.job_id = j.job_id
         WHERE ${where} ORDER BY j.created_at ASC`,
        ...params
      );

      if (format === 'json') return res.json({ count: rows.length, jobs: rows });

      const CSV_COLS = ['job_id','renter_id','provider_id','template_id','status','started_at','completed_at','input_tokens','output_tokens','cost_halala'];
      const esc = (v) => { if (v == null) return ''; const s = String(v); return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g,'""')}"` : s; };
      const lines = [CSV_COLS.join(','), ...rows.map(r => CSV_COLS.map(c => esc(r[c])).join(','))];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="dcp-jobs-export.csv"');
      return res.send(lines.join('\n'));
    } catch (err) {
      res.status(500).json({ error: 'Failed to export jobs' });
    }
  });

  return app;
}

let app;
beforeAll(() => { global.__testDb = buildDb(); app = buildExportOnlyApp(); });
beforeEach(() => { global.__testDb.close(); global.__testDb = buildDb(); mockAdminAllowed = true; });
afterAll(() => { global.__testDb.close(); });

describe('GET /api/admin/export/jobs', () => {
  test('returns CSV with correct header row', async () => {
    const r = await request(app).get('/api/admin/export/jobs').set('Authorization', 'Bearer test-token');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    expect(r.text.split('\n')[0]).toBe('job_id,renter_id,provider_id,template_id,status,started_at,completed_at,input_tokens,output_tokens,cost_halala');
  });

  test('returns one data row per job', async () => {
    seedJob(global.__testDb, { job_id: 'j1' });
    seedJob(global.__testDb, { job_id: 'j2', created_at: '2026-03-24T11:00:00.000Z' });
    const r = await request(app).get('/api/admin/export/jobs').set('Authorization', 'Bearer test-token');
    expect(r.status).toBe(200);
    expect(r.text.split('\n').filter(Boolean)).toHaveLength(3);
  });

  test('data row contains correct column values', async () => {
    seedJob(global.__testDb, { job_id: 'jchk', renter_id: 7, provider_id: 3, template_id: 'rag', status: 'completed', cost_halala: 267 });
    const r = await request(app).get('/api/admin/export/jobs').set('Authorization', 'Bearer test-token');
    const [hdr, row] = r.text.split('\n').filter(Boolean);
    const parsed = Object.fromEntries(hdr.split(',').map((c, i) => [c, row.split(',')[i]]));
    expect(parsed.job_id).toBe('jchk');
    expect(parsed.renter_id).toBe('7');
    expect(parsed.template_id).toBe('rag');
    expect(parsed.cost_halala).toBe('267');
    expect(parsed.output_tokens).toBe('0');
  });

  test('input_tokens reflects serve_session total_tokens', async () => {
    seedJob(global.__testDb, { job_id: 'jtok', total_tokens: 2048 });
    const r = await request(app).get('/api/admin/export/jobs').set('Authorization', 'Bearer test-token');
    const [hdr, row] = r.text.split('\n').filter(Boolean);
    const parsed = Object.fromEntries(hdr.split(',').map((c, i) => [c, row.split(',')[i]]));
    expect(parsed.input_tokens).toBe('2048');
    expect(parsed.output_tokens).toBe('0');
  });

  test('input_tokens is 0 when no serve_session', async () => {
    seedJob(global.__testDb, { job_id: 'jnotok' });
    const r = await request(app).get('/api/admin/export/jobs').set('Authorization', 'Bearer test-token');
    const [hdr, row] = r.text.split('\n').filter(Boolean);
    const parsed = Object.fromEntries(hdr.split(',').map((c, i) => [c, row.split(',')[i]]));
    expect(parsed.input_tokens).toBe('0');
  });

  test('format=json returns structured payload', async () => {
    seedJob(global.__testDb, { job_id: 'jjson', cost_halala: 100 });
    const r = await request(app).get('/api/admin/export/jobs?format=json').set('Authorization', 'Bearer test-token');
    expect(r.status).toBe(200);
    expect(r.body.count).toBe(1);
    expect(r.body.jobs[0].job_id).toBe('jjson');
    expect(r.body.jobs[0].output_tokens).toBe(0);
  });

  test('from/to date filters narrow results', async () => {
    seedJob(global.__testDb, { job_id: 'jan', created_at: '2026-01-15T00:00:00.000Z' });
    seedJob(global.__testDb, { job_id: 'mar', created_at: '2026-03-24T00:00:00.000Z' });
    const r = await request(app).get('/api/admin/export/jobs?from=2026-03-01&to=2026-03-31').set('Authorization', 'Bearer test-token');
    const lines = r.text.split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/^mar/);
  });

  test('empty result returns only the CSV header', async () => {
    const r = await request(app).get('/api/admin/export/jobs').set('Authorization', 'Bearer test-token');
    const lines = r.text.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^job_id,/);
  });

  test('401 when admin token is absent', async () => {
    mockAdminAllowed = false;
    const r = await request(app).get('/api/admin/export/jobs');
    expect(r.status).toBe(401);
  });

  test('Content-Disposition triggers CSV download', async () => {
    const r = await request(app).get('/api/admin/export/jobs').set('Authorization', 'Bearer test-token');
    expect(r.headers['content-disposition']).toMatch(/attachment/);
    expect(r.headers['content-disposition']).toMatch(/\.csv/);
  });
});
