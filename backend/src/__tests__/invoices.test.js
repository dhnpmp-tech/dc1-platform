'use strict';

/**
 * Unit tests for DCP-780: Invoice & settlement record generation
 *
 * Tests:
 *   1. Invoice generates correctly for a completed job
 *   2. SAR conversion uses the correct fixed peg (1 USD = 3.75 SAR)
 *   3. settlement_hash is deterministic (same inputs → same hash)
 *   4. Platform fee is exactly 15% of gross
 *   5. Invoice returns 409 for non-completed jobs
 *   6. Invoice endpoint is auth-protected
 *   7. /renters/:id/invoices returns paginated list
 *   8. /renters/:id/invoices?format=csv returns CSV
 */

const Database = require('better-sqlite3');
const request = require('supertest');
const crypto = require('crypto');

// ── In-memory DB mock ─────────────────────────────────────────────────────────

function flatParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params.reduce((acc, p) => (Array.isArray(p) ? acc.concat(p) : acc.concat([p])), []);
}

jest.mock('../db', () => ({
  get get()     { return (sql, ...params) => global.__testDb.prepare(sql).get(...flatParams(params)); },
  get all()     { return (sql, ...params) => global.__testDb.prepare(sql).all(...flatParams(params)); },
  get run()     { return (sql, ...params) => global.__testDb.prepare(sql).run(...flatParams(params)); },
  get prepare() { return (sql) => global.__testDb.prepare(sql); },
  get _db()     { return global.__testDb; },
}));

// ── Auth middleware mock ───────────────────────────────────────────────────────

let mockIsAdmin = false;
let mockRenterId = null;

jest.mock('../middleware/auth', () => ({
  getApiKeyFromReq: (req) => req.headers['x-renter-key'] || req.query.key || null,
  isAdminRequest: () => mockIsAdmin,
}));

// ── App setup ─────────────────────────────────────────────────────────────────

const express = require('express');
const { jobsInvoiceRouter, rentersInvoiceRouter } = require('../routes/invoices');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/jobs', jobsInvoiceRouter);
  app.use('/api/renters', rentersInvoiceRouter);
  return app;
}

// ── DB schema helpers ─────────────────────────────────────────────────────────

function buildTestDb() {
  const db = new Database(':memory:');

  db.exec(`
    CREATE TABLE renters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, email TEXT, organization TEXT, api_key TEXT,
      status TEXT DEFAULT 'active', balance_halala INTEGER DEFAULT 0,
      total_spent_halala INTEGER DEFAULT 0, total_jobs INTEGER DEFAULT 0,
      created_at TEXT DEFAULT '2026-01-01T00:00:00.000Z',
      updated_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, gpu_model TEXT, api_key TEXT,
      status TEXT DEFAULT 'active'
    )
  `);

  db.exec(`
    CREATE TABLE jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT UNIQUE NOT NULL,
      renter_id INTEGER,
      provider_id INTEGER,
      model TEXT,
      job_type TEXT DEFAULT 'llm-inference',
      status TEXT DEFAULT 'pending',
      cost_halala INTEGER DEFAULT 0,
      actual_cost_halala INTEGER,
      duration_minutes INTEGER,
      duration_seconds INTEGER,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT '2026-01-01T00:00:00.000Z',
      updated_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE job_settlements (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE,
      provider_id INTEGER,
      renter_id INTEGER NOT NULL,
      duration_seconds INTEGER,
      gpu_rate_per_second REAL,
      gross_amount_halala INTEGER NOT NULL,
      platform_fee_halala INTEGER NOT NULL,
      provider_payout_halala INTEGER NOT NULL,
      status TEXT DEFAULT 'completed',
      settled_at TEXT NOT NULL,
      created_at TEXT DEFAULT '2026-01-01T00:00:00.000Z'
    )
  `);

  db.exec(`
    CREATE TABLE serve_sessions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE,
      provider_id INTEGER,
      model TEXT,
      total_tokens INTEGER DEFAULT 0,
      status TEXT DEFAULT 'stopped',
      started_at TEXT, expires_at TEXT, created_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE invoices (
      invoice_id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE,
      renter_id INTEGER NOT NULL,
      provider_id INTEGER,
      amount_usd REAL NOT NULL,
      sar_equivalent REAL NOT NULL,
      settlement_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  return db;
}

// ── Seed helpers ──────────────────────────────────────────────────────────────

function seedRenter(db, { id = 1, name = 'Test Renter', email = 'test@dcp.sa', apiKey = 'test-key-123' } = {}) {
  db.prepare('INSERT OR IGNORE INTO renters (id, name, email, api_key) VALUES (?, ?, ?, ?)')
    .run(id, name, email, apiKey);
}

function seedProvider(db, { id = 1, name = 'Provider A', gpu_model = 'RTX 4090' } = {}) {
  db.prepare('INSERT OR IGNORE INTO providers (id, name, gpu_model) VALUES (?, ?, ?)')
    .run(id, name, gpu_model);
}

function seedJob(db, overrides = {}) {
  const defaults = {
    job_id: 'job-test-001',
    renter_id: 1,
    provider_id: 1,
    model: 'llama3-8b',
    job_type: 'llm-inference',
    status: 'completed',
    cost_halala: 1000,
    actual_cost_halala: null,
    duration_minutes: 5,
    duration_seconds: 300,
    started_at: '2026-03-24T01:00:00.000Z',
    completed_at: '2026-03-24T01:05:00.000Z',
  };
  const row = { ...defaults, ...overrides };
  db.prepare(`
    INSERT OR IGNORE INTO jobs
      (job_id, renter_id, provider_id, model, job_type, status, cost_halala,
       actual_cost_halala, duration_minutes, duration_seconds, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.job_id, row.renter_id, row.provider_id, row.model, row.job_type,
    row.status, row.cost_halala, row.actual_cost_halala, row.duration_minutes,
    row.duration_seconds, row.started_at, row.completed_at
  );
}

function seedSettlement(db, { jobId = 'job-test-001', renterId = 1, providerId = 1, grossHalala = 1000 } = {}) {
  const platformFee = Math.round(grossHalala * 0.15);
  const providerPayout = grossHalala - platformFee;
  db.prepare(`
    INSERT OR IGNORE INTO job_settlements
      (id, job_id, provider_id, renter_id, duration_seconds, gross_amount_halala,
       platform_fee_halala, provider_payout_halala, settled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'settle-001', jobId, providerId, renterId, 300,
    grossHalala, platformFee, providerPayout,
    '2026-03-24T01:05:01.000Z'
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  global.__testDb = buildTestDb();
  mockIsAdmin = false;
  mockRenterId = null;
});

afterEach(() => {
  global.__testDb.close();
});

describe('GET /api/jobs/:jobId/invoice', () => {
  test('returns structured invoice JSON for a completed job', async () => {
    const db = global.__testDb;
    seedRenter(db);
    seedProvider(db);
    seedJob(db);
    seedSettlement(db, { grossHalala: 1000 });

    mockIsAdmin = true;
    const app = buildApp();
    const res = await request(app).get('/api/jobs/job-test-001/invoice');

    expect(res.status).toBe(200);
    const inv = res.body;
    expect(inv.job_id).toBe('job-test-001');
    expect(inv.model).toBe('llama3-8b');
    expect(inv.renter.email).toBe('test@dcp.sa');
    expect(inv.provider.gpu_model).toBe('RTX 4090');
    expect(typeof inv.settlement_hash).toBe('string');
    expect(inv.settlement_hash).toHaveLength(64); // SHA-256 hex
    expect(inv.invoice_id).toBeTruthy();
  });

  test('SAR conversion uses 1 USD = 3.75 SAR fixed peg', async () => {
    const db = global.__testDb;
    seedRenter(db);
    seedProvider(db);
    seedJob(db, { cost_halala: 375 }); // 375 halala = 3.75 SAR = 1 USD
    seedSettlement(db, { grossHalala: 375 });

    mockIsAdmin = true;
    const app = buildApp();
    const res = await request(app).get('/api/jobs/job-test-001/invoice');

    expect(res.status).toBe(200);
    const inv = res.body;
    // 375 halala / 100 = 3.75 SAR; 3.75 SAR / 3.75 = 1.0 USD
    expect(inv.total_usd).toBeCloseTo(1.0, 4);
    expect(inv.sar_equivalent).toBeCloseTo(3.75, 4);
  });

  test('platform fee is exactly 15% of gross', async () => {
    const db = global.__testDb;
    seedRenter(db);
    seedProvider(db);
    seedJob(db, { cost_halala: 2000 });
    seedSettlement(db, { grossHalala: 2000 });

    mockIsAdmin = true;
    const app = buildApp();
    const res = await request(app).get('/api/jobs/job-test-001/invoice');

    expect(res.status).toBe(200);
    const inv = res.body;
    // gross = 2000 halala; 15% = 300 halala; subtotal = 1700 halala
    // gross USD = 2000/100/3.75 ≈ 0.5333
    // fee USD = 300/100/3.75 = 0.08
    // subtotal USD = 1700/100/3.75 ≈ 0.4533
    expect(inv.platform_fee_usd + inv.subtotal_usd).toBeCloseTo(inv.total_usd, 6);
    expect(inv.platform_fee_usd / inv.total_usd).toBeCloseTo(0.15, 4);
  });

  test('settlement_hash is deterministic for the same job', async () => {
    const db = global.__testDb;
    seedRenter(db);
    seedProvider(db);
    seedJob(db);
    seedSettlement(db, { grossHalala: 1000 });

    mockIsAdmin = true;
    const app = buildApp();

    const res1 = await request(app).get('/api/jobs/job-test-001/invoice');
    const res2 = await request(app).get('/api/jobs/job-test-001/invoice');
    expect(res1.status).toBe(200);
    expect(res1.body.settlement_hash).toBe(res2.body.settlement_hash);
  });

  test('returns 409 for non-completed job', async () => {
    const db = global.__testDb;
    seedRenter(db);
    seedProvider(db);
    seedJob(db, { status: 'running' });

    mockIsAdmin = true;
    const app = buildApp();
    const res = await request(app).get('/api/jobs/job-test-001/invoice');
    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });

  test('returns 404 for unknown job', async () => {
    mockIsAdmin = true;
    const app = buildApp();
    const res = await request(app).get('/api/jobs/non-existent-job/invoice');
    expect(res.status).toBe(404);
  });

  test('returns 403 for renter accessing another renter job', async () => {
    const db = global.__testDb;
    seedRenter(db, { id: 1, apiKey: 'renter-1-key' });
    seedRenter(db, { id: 2, email: 'other@dcp.sa', apiKey: 'renter-2-key' });
    seedProvider(db);
    seedJob(db, { renter_id: 1 });

    mockIsAdmin = false;
    const app = buildApp();
    // renter 2 tries to access renter 1's job
    const res = await request(app)
      .get('/api/jobs/job-test-001/invoice')
      .set('x-renter-key', 'renter-2-key');
    expect(res.status).toBe(403);
  });

  test('allows the owning renter to access their invoice', async () => {
    const db = global.__testDb;
    seedRenter(db, { id: 1, apiKey: 'renter-1-key' });
    seedProvider(db);
    seedJob(db, { renter_id: 1 });
    seedSettlement(db, { grossHalala: 500 });

    mockIsAdmin = false;
    const app = buildApp();
    const res = await request(app)
      .get('/api/jobs/job-test-001/invoice')
      .set('x-renter-key', 'renter-1-key');
    expect(res.status).toBe(200);
    expect(res.body.job_id).toBe('job-test-001');
  });

  test('falls back to job cost when no settlement record exists', async () => {
    const db = global.__testDb;
    seedRenter(db);
    seedProvider(db);
    seedJob(db, { cost_halala: 750 }); // no settlement record

    mockIsAdmin = true;
    const app = buildApp();
    const res = await request(app).get('/api/jobs/job-test-001/invoice');

    expect(res.status).toBe(200);
    // 750 halala / 100 / 3.75 = 2 SAR / 3.75 = 0.5333 USD
    expect(res.body.total_usd).toBeCloseTo(750 / 100 / 3.75, 4);
  });
});

describe('GET /api/renters/:renterId/invoices', () => {
  test('returns paginated invoice list for a renter (admin)', async () => {
    const db = global.__testDb;
    seedRenter(db);
    seedProvider(db);

    // Seed 3 completed jobs with invoices
    for (let i = 1; i <= 3; i++) {
      const jobId = `job-inv-${i}`;
      seedJob(db, { job_id: jobId, cost_halala: i * 100 });
      db.prepare(`
        INSERT INTO invoices (invoice_id, job_id, renter_id, provider_id, amount_usd, sar_equivalent, settlement_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`inv-${i}`, jobId, 1, 1, i * 0.1, i * 0.375, `hash${i}`);
    }

    mockIsAdmin = true;
    const app = buildApp();
    const res = await request(app).get('/api/renters/1/invoices');

    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.page).toBe(1);
  });

  test('returns CSV when format=csv is passed', async () => {
    const db = global.__testDb;
    seedRenter(db);
    seedProvider(db);
    seedJob(db);
    db.prepare(`
      INSERT INTO invoices (invoice_id, job_id, renter_id, provider_id, amount_usd, sar_equivalent, settlement_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('inv-csv-1', 'job-test-001', 1, 1, 0.266, 0.999, 'abc123hash');

    mockIsAdmin = true;
    const app = buildApp();
    const res = await request(app).get('/api/renters/1/invoices?format=csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toContain('invoice_id'); // header row
    expect(lines[1]).toContain('inv-csv-1');
  });

  test('returns 403 for renter accessing another renter invoices', async () => {
    const db = global.__testDb;
    seedRenter(db, { id: 1, apiKey: 'r1-key' });
    seedRenter(db, { id: 2, email: 'other@dcp.sa', apiKey: 'r2-key' });

    mockIsAdmin = false;
    const app = buildApp();
    const res = await request(app)
      .get('/api/renters/1/invoices')
      .set('x-renter-key', 'r2-key');
    expect(res.status).toBe(403);
  });

  test('pagination limits and offsets correctly', async () => {
    const db = global.__testDb;
    seedRenter(db);
    seedProvider(db);
    for (let i = 1; i <= 5; i++) {
      const jobId = `job-page-${i}`;
      seedJob(db, { job_id: jobId });
      db.prepare(`
        INSERT INTO invoices (invoice_id, job_id, renter_id, provider_id, amount_usd, sar_equivalent, settlement_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`inv-p${i}`, jobId, 1, 1, 0.1, 0.375, `hash${i}`);
    }

    mockIsAdmin = true;
    const app = buildApp();
    const res = await request(app).get('/api/renters/1/invoices?page=2&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(2);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.total).toBe(5);
    expect(res.body.pagination.pages).toBe(3);
  });
});
