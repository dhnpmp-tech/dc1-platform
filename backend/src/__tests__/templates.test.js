/**
 * Integration tests for /api/templates routes.
 * Covers: GET /api/templates, GET /api/templates/:id, POST /api/templates/:id/deploy
 */

const Database = require('better-sqlite3');
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');

let app;
let manifestPath;

// ── DB mock shared across test and module ────────────────────────────────────
// flatParams is defined inside the factory via hoisting (function declaration after return)
jest.mock('../db', () => {
  return {
    get run() { return (sql, ...params) => global.__testDb.prepare(sql).run(...flatParams(params)); },
    get get() { return (sql, ...params) => global.__testDb.prepare(sql).get(...flatParams(params)); },
    get all() { return (sql, ...params) => global.__testDb.prepare(sql).all(...flatParams(params)); },
    get prepare() { return (sql) => global.__testDb.prepare(sql); },
    get _db() { return global.__testDb; },
    close: () => {},
  };

  // eslint-disable-next-line no-unreachable
  function flatParams(params) {
    if (params.length === 1 && Array.isArray(params[0])) return params[0];
    return params.reduce((acc, p) => (Array.isArray(p) ? acc.concat(p) : acc.concat([p])), []);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS renters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      api_key TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'active',
      balance_halala INTEGER DEFAULT 0,
      total_jobs INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'active',
      api_key TEXT,
      gpu_model TEXT,
      vram_gb INTEGER,
      gpu_vram_mib INTEGER,
      last_heartbeat DATETIME
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL UNIQUE,
      provider_id INTEGER,
      renter_id INTEGER NOT NULL,
      job_type TEXT NOT NULL,
      model TEXT,
      status TEXT DEFAULT 'pending',
      submitted_at DATETIME,
      duration_minutes REAL,
      cost_halala INTEGER,
      gpu_requirements TEXT,
      container_spec TEXT,
      task_spec TEXT,
      task_spec_hmac TEXT,
      max_duration_seconds INTEGER,
      timeout_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      priority INTEGER DEFAULT 2,
      pricing_class TEXT DEFAULT 'standard',
      prewarm_requested INTEGER DEFAULT 0,
      workspace_volume_name TEXT,
      checkpoint_enabled INTEGER DEFAULT 0,
      template_id TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS quota_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      renter_id INTEGER,
      job_id TEXT,
      check_type TEXT,
      allowed INTEGER,
      limit_value REAL,
      current_value REAL,
      requested_value REAL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

function insertRenter(db, { apiKey = 'test-renter-key', balanceHalala = 100000 } = {}) {
  db.prepare(
    `INSERT INTO renters (email, api_key, status, balance_halala) VALUES (?, ?, 'active', ?)`
  ).run(`renter-${Date.now()}@test.com`, apiKey, balanceHalala);
}

function insertProvider(db, { vramGb = 24, heartbeatOffsetMs = -60 * 1000 } = {}) {
  const lastHeartbeat = new Date(Date.now() + heartbeatOffsetMs).toISOString();
  db.prepare(
    `INSERT INTO providers (name, email, status, gpu_model, vram_gb, gpu_vram_mib, last_heartbeat)
     VALUES (?, ?, 'active', ?, ?, ?, ?)`
  ).run('TestProvider', `provider-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`, 'RTX 4090', vramGb, vramGb * 1024, lastHeartbeat);
}

function insertActiveJobForProvider(db, { providerId, renterId = 1, status = 'running' } = {}) {
  db.prepare(
    `INSERT INTO jobs (job_id, provider_id, renter_id, job_type, model, status, submitted_at, duration_minutes, cost_halala, created_at)
     VALUES (?, ?, ?, 'llm-inference', 'meta-llama/Meta-Llama-3-8B-Instruct', ?, ?, 60, 100, ?)`
  ).run(`job-active-${Date.now()}-${Math.random().toString(36).slice(2)}`, providerId, renterId, status, new Date().toISOString(), new Date().toISOString());
}

// ── Setup / teardown ─────────────────────────────────────────────────────────
beforeEach(() => {
  global.__testDb = buildDb();
  manifestPath = path.join(os.tmpdir(), `instant-tier-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({
    images: [
      {
        name: 'llm-worker',
        templates: ['nemotron-nano'],
        published_refs: {
          mutable: 'docker.io/dc1/llm-worker:latest',
          immutable: 'docker.io/dc1/llm-worker:sha-test',
          canonical: 'docker.io/dc1/llm-worker@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      },
      {
        name: 'sd-worker',
        templates: ['sdxl', 'stable-diffusion'],
        published_refs: {
          mutable: 'docker.io/dc1/sd-worker:latest',
          immutable: 'docker.io/dc1/sd-worker:sha-test',
          canonical: 'docker.io/dc1/sd-worker@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      },
    ],
  }), 'utf8');
  process.env.DISABLE_RATE_LIMIT = '1';
  process.env.INSTANT_TIER_MANIFEST_PATH = manifestPath;

  // Re-require the router each time to pick up fresh DB mock state
  const routerPath = require.resolve('../routes/templates');
  delete require.cache[routerPath];

  // Also clear auth middleware cache
  const authPath = require.resolve('../middleware/auth');
  delete require.cache[authPath];

  const templatesRouter = require('../routes/templates');
  app = express();
  app.use(express.json());
  app.use('/api/templates', templatesRouter);
});

afterEach(() => {
  delete process.env.DISABLE_RATE_LIMIT;
  delete process.env.INSTANT_TIER_MANIFEST_PATH;
  if (manifestPath && fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
  try { global.__testDb.close(); } catch {}
});

// ── GET /api/templates ───────────────────────────────────────────────────────
describe('GET /api/templates', () => {
  it('returns templates array with count', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(typeof res.body.count).toBe('number');
    expect(res.body.count).toBe(res.body.templates.length);
  });

  it('returns at least 1 template (docker-templates/ exists in repo)', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
  });

  it('all returned templates have pricing info', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    for (const t of res.body.templates) {
      // estimated_price_sar_per_hour must be a positive number
      expect(typeof t.estimated_price_sar_per_hour).toBe('number');
      expect(t.estimated_price_sar_per_hour).toBeGreaterThan(0);
    }
  });

  it('strips approved_images from list response', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    for (const t of res.body.templates) {
      expect(t.approved_images).toBeUndefined();
    }
  });

  it('filters by category=llm', async () => {
    const res = await request(app).get('/api/templates?category=llm');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
    // All results should have at least one llm-related tag
    for (const t of res.body.templates) {
      const tags = t.tags || [];
      const llmTags = ['llm', 'inference', 'chat', 'instruct', 'arabic'];
      expect(tags.some(tag => llmTags.includes(tag))).toBe(true);
    }
  });

  it('filters by tag', async () => {
    const res = await request(app).get('/api/templates?tag=arabic');
    expect(res.status).toBe(200);
    for (const t of res.body.templates) {
      expect(t.tags).toContain('arabic');
    }
  });

  it('includes instant-tier manifest refs in whitelist response', async () => {
    const res = await request(app).get('/api/templates/whitelist');
    expect(res.status).toBe(200);
    expect(res.body.approved_images).toContain('docker.io/dc1/llm-worker@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(res.body.approved_images).toContain('docker.io/dc1/sd-worker@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  });
});

// ── GET /api/templates/:id ───────────────────────────────────────────────────
describe('GET /api/templates/:id', () => {
  it('returns a known template by id', async () => {
    const res = await request(app).get('/api/templates/llama3-8b');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('llama3-8b');
    expect(res.body.min_vram_gb).toBeGreaterThan(0);
    expect(res.body.estimated_price_sar_per_hour).toBeGreaterThan(0);
  });

  it('returns 404 for unknown template', async () => {
    const res = await request(app).get('/api/templates/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns falcon-h1-arabic-7b by id', async () => {
    const res = await request(app).get('/api/templates/falcon-h1-arabic-7b');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('falcon-h1-arabic-7b');
    expect(res.body.params?.model).toBe('tiiuae/Falcon-H1-7B-Instruct');
  });
});

// ── POST /api/templates/:id/deploy ──────────────────────────────────────────
describe('POST /api/templates/:id/deploy', () => {
  const RENTER_KEY = 'renter-api-key-test';

  it('returns 401 when no renter key is provided', async () => {
    const res = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .send({ duration_minutes: 60 });
    expect(res.status).toBe(401);
  });

  it('returns 403 for an invalid renter key', async () => {
    const res = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', 'bad-key')
      .send({ duration_minutes: 60 });
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown template', async () => {
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: 100000 });
    const res = await request(app)
      .post('/api/templates/ghost-template/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 60 });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 402 when renter balance is zero', async () => {
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: 0 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 60 });
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/balance/i);
  });

  it('returns 402 when renter balance is insufficient', async () => {
    // llama3-8b is llm-inference @ 9 halala/min × 60 min = 540 halala
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: 100 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 60 });
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/insufficient/i);
    expect(res.body.required_halala).toBeGreaterThan(0);
    expect(res.body.shortfall_halala).toBeGreaterThan(0);
  });

  it('returns 503 when no provider is available', async () => {
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: 100000 });
    // No providers in DB → should get 503

    const res = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 60 });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/no gpu provider/i);
  });

  it('returns 503 when provider VRAM is insufficient for template', async () => {
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: 100000 });
    // llama3-8b requires 16GB VRAM; insert a provider with only 8GB
    insertProvider(global.__testDb, { vramGb: 8 });

    const res = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 60 });
    expect(res.status).toBe(503);
  });

  it('returns deploy capacity snapshot for a template', async () => {
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app).get('/api/templates/jais-13b-chat/deploy/check');
    expect(res.status).toBe(200);
    expect(res.body.template.id).toBe('jais-13b-chat');
    expect(res.body.required_vram_gb).toBe(24);
    expect(res.body.capable_provider_count).toBeGreaterThanOrEqual(1);
  });

  it('allows deploy when matching provider exists but is currently running work', async () => {
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: 100000 });
    insertProvider(global.__testDb, { vramGb: 24 });
    const provider = global.__testDb.prepare('SELECT id FROM providers ORDER BY id DESC LIMIT 1').get();
    insertActiveJobForProvider(global.__testDb, { providerId: provider.id, status: 'running' });

    const res = await request(app)
      .post('/api/templates/allam-7b-instruct/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 60 });

    expect(res.status).toBe(201);
    expect(res.body.template.id).toBe('allam-7b-instruct');
    expect(res.body.provider.id).toBe(provider.id);
  });

  it('returns 503 when provider heartbeat is stale (>10 min old)', async () => {
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: 100000 });
    // Insert provider with heartbeat 15 minutes ago
    insertProvider(global.__testDb, { vramGb: 24, heartbeatOffsetMs: -15 * 60 * 1000 });

    const res = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 60 });
    expect(res.status).toBe(503);
  });

  it('creates a job and returns 201 on success', async () => {
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: 100000 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 60 });

    expect(res.status).toBe(201);
    expect(res.body.jobId).toMatch(/^job-/);
    expect(res.body.status).toBe('pending');
    expect(typeof res.body.estimatedStart).toBe('string');
    expect(res.body.gpuTier).toBeTruthy();
    expect(res.body.totalCost.halala).toBeGreaterThan(0);
    expect(typeof res.body.totalCost.sar).toBe('string');
    expect(res.body.template.id).toBe('llama3-8b');
  });

  it('creates a job when deploying falcon-h1-arabic-7b', async () => {
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: 100000 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/falcon-h1-arabic-7b/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 60 });

    expect(res.status).toBe(201);
    expect(res.body.template.id).toBe('falcon-h1-arabic-7b');
    expect(res.body.template.name).toBe('Falcon-H1 7B Arabic Instruct');
  });

  it('uses manifest canonical image ref for instant-tier template deploys', async () => {
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: 100000 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/nemotron-nano/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 30 });

    expect(res.status).toBe(201);
    const job = global.__testDb.prepare(`SELECT container_spec FROM jobs WHERE job_id = ?`).get(res.body.jobId);
    const parsedSpec = JSON.parse(job.container_spec);
    expect(parsedSpec.image_override).toBe('docker.io/dc1/llm-worker@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('deducts cost from renter balance on success', async () => {
    const initialBalance = 100000;
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: initialBalance });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 60 });
    expect(res.status).toBe(201);

    const renter = global.__testDb.prepare(`SELECT balance_halala FROM renters WHERE api_key = ?`).get(RENTER_KEY);
    expect(renter.balance_halala).toBe(initialBalance - res.body.totalCost.halala);
  });

  it('inserts a job record into the database on success', async () => {
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: 100000 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 60 });
    expect(res.status).toBe(201);

    const job = global.__testDb.prepare(`SELECT * FROM jobs WHERE job_id = ?`).get(res.body.jobId);
    expect(job).toBeTruthy();
    expect(job.status).toBe('pending');
    expect(job.job_type).toBe('llm-inference');
    expect(job.template_id).toBe('llama3-8b');
    expect(job.cost_halala).toBe(res.body.totalCost.halala);
    expect(job.duration_minutes).toBe(60);
  });

  it('defaults duration_minutes to 60 when omitted', async () => {
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: 100000 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({});
    expect(res.status).toBe(201);

    const job = global.__testDb.prepare(`SELECT duration_minutes FROM jobs WHERE job_id = ?`).get(res.body.jobId);
    expect(job.duration_minutes).toBe(60);
  });

  it('returns 400 for invalid duration_minutes', async () => {
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: 100000 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const res = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: -5 });
    expect(res.status).toBe(400);
  });

  it('respects pricing_class=priority with +20% surcharge', async () => {
    // Use two separate renters and two providers so deploys don't conflict
    const RENTER_KEY_2 = 'renter-api-key-priority';
    global.__testDb.prepare(
      `INSERT INTO renters (email, api_key, status, balance_halala) VALUES (?,?,?,?)`
    ).run('renter1@t.com', RENTER_KEY, 'active', 100000);
    global.__testDb.prepare(
      `INSERT INTO renters (email, api_key, status, balance_halala) VALUES (?,?,?,?)`
    ).run('renter2@t.com', RENTER_KEY_2, 'active', 100000);
    // Two providers — one per deploy so neither is marked busy before the other runs
    insertProvider(global.__testDb, { vramGb: 24 });
    insertProvider(global.__testDb, { vramGb: 24 });

    const stdRes = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 60, pricing_class: 'standard' });

    const priRes = await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', RENTER_KEY_2)
      .send({ duration_minutes: 60, pricing_class: 'priority' });

    expect(stdRes.status).toBe(201);
    expect(priRes.status).toBe(201);
    expect(priRes.body.totalCost.halala).toBeGreaterThan(stdRes.body.totalCost.halala);
  });

  it('does not deduct balance when returning 503', async () => {
    const initialBalance = 100000;
    insertRenter(global.__testDb, { apiKey: RENTER_KEY, balanceHalala: initialBalance });
    // No provider → 503

    await request(app)
      .post('/api/templates/llama3-8b/deploy')
      .set('x-renter-key', RENTER_KEY)
      .send({ duration_minutes: 60 });

    const renter = global.__testDb.prepare(`SELECT balance_halala FROM renters WHERE api_key = ?`).get(RENTER_KEY);
    expect(renter.balance_halala).toBe(initialBalance);
  });
});
