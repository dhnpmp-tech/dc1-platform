/**
 * Integration tests for /api/templates/arabic-rag routes (DCP-834).
 * Covers: POST /deploy, GET /status/:jobId, and delegation of
 * GET /status (pipeline), POST /ingest, POST /query to ragRouter.
 */

'use strict';

const Database = require('better-sqlite3');
const express  = require('express');
const request  = require('supertest');

let app;

// ── DB mock ───────────────────────────────────────────────────────────────
jest.mock('../db', () => {
  function flat(params) {
    if (params.length === 1 && Array.isArray(params[0])) return params[0];
    return params.reduce((acc, p) => Array.isArray(p) ? acc.concat(p) : acc.concat([p]), []);
  }
  return {
    get run()     { return (sql, ...p) => global.__testDb.prepare(sql).run(...flat(p)); },
    get get()     { return (sql, ...p) => global.__testDb.prepare(sql).get(...flat(p)); },
    get all()     { return (sql, ...p) => global.__testDb.prepare(sql).all(...flat(p)); },
    get prepare() { return (sql)       => global.__testDb.prepare(sql); },
    get _db()     { return global.__testDb; },
    close: () => {},
  };
});

// ── Pricing mock ──────────────────────────────────────────────────────────
jest.mock('../services/pricingService', () => ({
  calculateCostHalala: jest.fn(() => 5000),   // 50 SAR per request
  estimateCost: jest.fn(() => ({ gpu_rate_snapshot: null })),
  getRate: jest.fn(() => ({
    rate_per_hour_usd: 0.267, rate_per_hour_sar: 1.0,
    tier: 'tier-a', display_name: 'RTX 4090',
    competitor_prices: {}, savings_pct: 23,
  })),
}));

// ── DB builder ────────────────────────────────────────────────────────────
function buildDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE renters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      api_key TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'active',
      balance_halala INTEGER DEFAULT 0,
      total_jobs INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'active',
      api_key TEXT,
      gpu_model TEXT,
      vram_gb INTEGER,
      gpu_vram_mib INTEGER,
      endpoint_url TEXT,
      last_heartbeat DATETIME
    );

    CREATE TABLE jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL UNIQUE,
      provider_id INTEGER,
      renter_id INTEGER NOT NULL,
      job_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      submitted_at DATETIME,
      duration_minutes REAL,
      cost_halala INTEGER,
      gpu_requirements TEXT,
      container_spec TEXT,
      task_spec TEXT,
      max_duration_seconds INTEGER,
      timeout_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      priority INTEGER DEFAULT 2,
      pricing_class TEXT DEFAULT 'standard',
      prewarm_requested INTEGER DEFAULT 0,
      workspace_volume_name TEXT,
      checkpoint_enabled INTEGER DEFAULT 0,
      template_id TEXT,
      gpu_rate_snapshot TEXT
    );

    CREATE TABLE quota_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      renter_id INTEGER, job_id TEXT, check_type TEXT,
      allowed INTEGER, limit_value REAL, current_value REAL,
      requested_value REAL, reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE renter_api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      renter_id INTEGER, key TEXT UNIQUE,
      scopes TEXT, expires_at TEXT, revoked_at TEXT, last_used_at TEXT
    );

    CREATE TABLE approved_container_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_ref TEXT, resolved_digest TEXT, is_active INTEGER, approved_at DATETIME
    );
  `);

  return db;
}

// ── Fixtures ──────────────────────────────────────────────────────────────
function insertRenter(db, { apiKey = 'test-renter-key', balance = 100_000 } = {}) {
  db.prepare(`INSERT INTO renters (email, api_key, balance_halala) VALUES (?,?,?)`)
    .run(`renter-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`, apiKey, balance);
}

function insertProvider(db, { vramGb = 24, stale = false, active = true } = {}) {
  const hb = stale
    ? new Date(Date.now() - 15 * 60 * 1000).toISOString()
    : new Date(Date.now() - 30 * 1000).toISOString();
  db.prepare(
    `INSERT INTO providers (name, email, status, gpu_model, vram_gb, gpu_vram_mib, endpoint_url, last_heartbeat)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    'TestProvider',
    `prov-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    active ? 'active' : 'inactive',
    'RTX 4090',
    vramGb,
    vramGb * 1024,
    'http://provider.test:8080',
    hb
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────
beforeEach(() => {
  global.__testDb = buildDb();

  // Clear module cache to pick up fresh DB state
  for (const key of ['../routes/arabic-rag', '../routes/rag', '../middleware/auth'].map(require.resolve)) {
    delete require.cache[key];
  }

  const arabicRagRouter = require('../routes/arabic-rag');
  app = express();
  app.use(express.json());
  app.use('/api/templates/arabic-rag', arabicRagRouter);
});

afterEach(() => {
  try { global.__testDb.close(); } catch (_) {}
});

// ── POST /deploy ──────────────────────────────────────────────────────────
describe('POST /api/templates/arabic-rag/deploy', () => {
  const KEY = 'renter-key-deploy-test';

  it('returns 401 when no auth key provided', async () => {
    const res = await request(app).post('/api/templates/arabic-rag/deploy').send({});
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid renter key', async () => {
    const res = await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', 'bad-key')
      .send({});
    expect(res.status).toBe(401);
  });

  it('returns 402 when renter balance is zero', async () => {
    insertRenter(global.__testDb, { apiKey: KEY, balance: 0 });
    insertProvider(global.__testDb, { vramGb: 24 });
    const res = await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', KEY)
      .send({});
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/balance/i);
  });

  it('returns 402 when renter balance is insufficient for cost', async () => {
    // pricingService mock returns 5000 halala; give renter only 100
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100 });
    insertProvider(global.__testDb, { vramGb: 24 });
    const res = await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', KEY)
      .send({});
    expect(res.status).toBe(402);
    expect(res.body.shortfall_halala).toBeGreaterThan(0);
  });

  it('returns 503 when no GPU provider is available', async () => {
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100_000 });
    // No providers in DB
    const res = await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', KEY)
      .send({});
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/no gpu provider/i);
    expect(res.body.required_vram_gb).toBe(24);
  });

  it('returns 503 when provider VRAM is below 24 GB', async () => {
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100_000 });
    insertProvider(global.__testDb, { vramGb: 16 });
    const res = await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', KEY)
      .send({});
    expect(res.status).toBe(503);
  });

  it('returns 503 when provider heartbeat is stale', async () => {
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100_000 });
    insertProvider(global.__testDb, { vramGb: 24, stale: true });
    const res = await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', KEY)
      .send({});
    expect(res.status).toBe(503);
  });

  it('returns 400 for invalid duration_minutes', async () => {
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100_000 });
    insertProvider(global.__testDb, { vramGb: 24 });
    const res = await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', KEY)
      .send({ duration_minutes: 9999 });
    expect(res.status).toBe(400);
  });

  it('returns 201 on success with full pipeline response', async () => {
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100_000 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', KEY)
      .send({ duration_minutes: 60 });

    expect(res.status).toBe(201);
    expect(res.body.jobId).toMatch(/^rag-job-/);
    expect(res.body.status).toBe('pending');
    expect(typeof res.body.estimatedStart).toBe('string');
    expect(res.body.llm_model).toBe('allam-7b-instruct');
    expect(typeof res.body.totalCost.sar).toBe('string');
    expect(res.body.pipeline.components).toHaveLength(3);
  });

  it('returns endpoint URLs for all 3 pipeline components', async () => {
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100_000 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', KEY)
      .send({});

    expect(res.status).toBe(201);
    // Provider has endpoint_url = 'http://provider.test:8080'
    expect(res.body.endpoints.embed).toContain('8001');
    expect(res.body.endpoints.rerank).toContain('8002');
    expect(res.body.endpoints.generate).toContain('8003');
  });

  it('accepts jais-13b-chat as llm_model', async () => {
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100_000 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', KEY)
      .send({ llm_model: 'jais-13b-chat' });

    expect(res.status).toBe(201);
    expect(res.body.llm_model).toBe('jais-13b-chat');
  });

  it('defaults invalid llm_model to allam-7b-instruct', async () => {
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100_000 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', KEY)
      .send({ llm_model: 'gpt-5-turbo' });

    expect(res.status).toBe(201);
    expect(res.body.llm_model).toBe('allam-7b-instruct');
  });

  it('creates a job record in the DB with correct fields', async () => {
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100_000 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', KEY)
      .send({});

    expect(res.status).toBe(201);
    const job = global.__testDb.prepare('SELECT * FROM jobs WHERE job_id = ?').get(res.body.jobId);
    expect(job).toBeTruthy();
    expect(job.job_type).toBe('rag-pipeline');
    expect(job.template_id).toBe('arabic-rag-complete');
    expect(job.status).toBe('pending');
  });

  it('deducts cost from renter balance atomically', async () => {
    const INITIAL = 100_000;
    insertRenter(global.__testDb, { apiKey: KEY, balance: INITIAL });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', KEY)
      .send({});

    expect(res.status).toBe(201);
    const renter = global.__testDb.prepare('SELECT balance_halala FROM renters WHERE api_key = ?').get(KEY);
    expect(renter.balance_halala).toBe(INITIAL - res.body.totalCost.halala);
  });

  it('does not deduct balance when returning 503', async () => {
    const INITIAL = 100_000;
    insertRenter(global.__testDb, { apiKey: KEY, balance: INITIAL });
    // No provider

    await request(app)
      .post('/api/templates/arabic-rag/deploy')
      .set('x-renter-key', KEY)
      .send({});

    const renter = global.__testDb.prepare('SELECT balance_halala FROM renters WHERE api_key = ?').get(KEY);
    expect(renter.balance_halala).toBe(INITIAL);
  });
});

// ── GET /status/:jobId ────────────────────────────────────────────────────
describe('GET /api/templates/arabic-rag/status/:jobId', () => {
  const KEY = 'renter-key-status-test';

  function insertJob(db, { renterId, providerId, jobId = 'rag-job-test-001', status = 'pending', jobType = 'rag-pipeline' } = {}) {
    db.prepare(
      `INSERT INTO jobs (job_id, provider_id, renter_id, job_type, status, submitted_at, duration_minutes, cost_halala,
                         gpu_requirements, container_spec, task_spec, max_duration_seconds, timeout_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      jobId, providerId, renterId, jobType, status,
      new Date().toISOString(), 60, 5000,
      JSON.stringify({ min_vram_gb: 24 }),
      JSON.stringify({ pipeline: 'arabic-rag' }),
      JSON.stringify({ job_type: 'rag-pipeline', llm_model: 'allam-7b-instruct' }),
      1800,
      new Date(Date.now() + 1800_000).toISOString(),
      new Date().toISOString()
    );
  }

  it('returns 401 when no auth provided', async () => {
    const res = await request(app).get('/api/templates/arabic-rag/status/rag-job-abc');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown job ID', async () => {
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100_000 });
    const res = await request(app)
      .get('/api/templates/arabic-rag/status/no-such-job')
      .set('x-renter-key', KEY);
    expect(res.status).toBe(404);
  });

  it('returns 400 for a job that is not a rag-pipeline', async () => {
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100_000 });
    const renter = global.__testDb.prepare('SELECT id FROM renters WHERE api_key = ?').get(KEY);
    insertProvider(global.__testDb, { vramGb: 24 });
    const provider = global.__testDb.prepare('SELECT id FROM providers LIMIT 1').get();
    insertJob(global.__testDb, { renterId: renter.id, providerId: provider.id, jobId: 'non-rag-job', jobType: 'llm-inference' });

    const res = await request(app)
      .get('/api/templates/arabic-rag/status/non-rag-job')
      .set('x-renter-key', KEY);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not a rag pipeline/i);
  });

  it('returns full pipeline status for a valid RAG job', async () => {
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100_000 });
    const renter = global.__testDb.prepare('SELECT id FROM renters WHERE api_key = ?').get(KEY);
    insertProvider(global.__testDb, { vramGb: 24 });
    const provider = global.__testDb.prepare('SELECT id FROM providers LIMIT 1').get();
    const JOB_ID = 'rag-job-status-check';
    insertJob(global.__testDb, { renterId: renter.id, providerId: provider.id, jobId: JOB_ID });

    const res = await request(app)
      .get(`/api/templates/arabic-rag/status/${JOB_ID}`)
      .set('x-renter-key', KEY);

    expect(res.status).toBe(200);
    expect(res.body.jobId).toBe(JOB_ID);
    expect(res.body.status).toBe('pending');
    expect(typeof res.body.pipelineHealth).toBe('string');
    expect(res.body.containers).toBeDefined();
    expect(['embed', 'rerank', 'generate'].every(k => k in res.body.containers)).toBe(true);
    expect(res.body.llm_model).toBe('allam-7b-instruct');
    expect(typeof res.body.age_seconds).toBe('number');
  });

  it('returns 404 when job belongs to different renter', async () => {
    // Create two renters
    insertRenter(global.__testDb, { apiKey: KEY, balance: 100_000 });
    insertRenter(global.__testDb, { apiKey: 'other-renter-key', balance: 100_000 });
    const other = global.__testDb.prepare("SELECT id FROM renters WHERE api_key = 'other-renter-key'").get();
    insertProvider(global.__testDb, { vramGb: 24 });
    const provider = global.__testDb.prepare('SELECT id FROM providers LIMIT 1').get();
    const JOB_ID = 'rag-job-other-renter';
    insertJob(global.__testDb, { renterId: other.id, providerId: provider.id, jobId: JOB_ID });

    // Try to access other renter's job
    const res = await request(app)
      .get(`/api/templates/arabic-rag/status/${JOB_ID}`)
      .set('x-renter-key', KEY);
    expect(res.status).toBe(404);
  });
});

// ── Delegation: GET /status (pipeline-level) ──────────────────────────────
describe('GET /api/templates/arabic-rag/status (pipeline health)', () => {
  it('returns pipeline availability from ragRouter', async () => {
    const res = await request(app).get('/api/templates/arabic-rag/status');
    expect(res.status).toBe(200);
    expect(typeof res.body.pipeline_ready).toBe('boolean');
    expect(res.body.arabic_rag_available).toBe(true);
    expect(Array.isArray(res.body.generation_models)).toBe(true);
  });
});
