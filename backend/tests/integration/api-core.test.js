/**
 * DC1 Backend API — Core Integration Test Suite (DCP-35)
 *
 * Covers: Provider API, Renter API, Admin API
 * Runner: Jest + Supertest (--runInBand, shared SQLite DB)
 * DB: same providers.db used by tests — cleanDb() wipes all test data before each test
 */

'use strict';

// DC1_DB_PATH and DC1_ADMIN_TOKEN are set by tests/jest-setup.js (setupFiles)
// Kept here as a fallback when running this file directly outside Jest
if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token-jest';

const request = require('supertest');
const express = require('express');
const db = require('../../src/db');

// ── Build a minimal Express app with all routes under test ────────────────────
function createTestApp() {
  const app = express();
  app.use(express.json());

  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters',   require('../../src/routes/renters'));
  app.use('/api/admin',     require('../../src/routes/admin'));

  return app;
}

const app = createTestApp();
const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN || 'test-admin-token-jest';

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanDb() {
  try { db.run('DELETE FROM heartbeat_log'); } catch (_) {}
  try { db.run('DELETE FROM jobs'); }         catch (_) {}
  try { db.run('DELETE FROM renters'); }      catch (_) {}
  try { db.run('DELETE FROM providers'); }    catch (_) {}
}

async function registerProvider(overrides = {}) {
  const payload = {
    name:      overrides.name      || 'Test Provider',
    email:     overrides.email     || `prov-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
    gpu_model: overrides.gpu_model || 'RTX 4090',
    os:        overrides.os        || 'Linux',
    ...overrides,
  };
  return request(app).post('/api/providers/register').send(payload);
}

async function registerRenter(overrides = {}) {
  const payload = {
    name:  overrides.name  || 'Test Renter',
    email: overrides.email || `renter-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
    ...overrides,
  };
  return request(app).post('/api/renters/register').send(payload);
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => cleanDb());
afterAll(() => cleanDb());

// =============================================================================
// PROVIDER API
// =============================================================================

describe('Provider API — POST /api/providers/register', () => {
  it('returns 200 with api_key and provider_id on success', async () => {
    const res = await registerProvider();
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.api_key).toBe('string');
    expect(res.body.api_key).toMatch(/^dc1-provider-/);
    expect(res.body.provider_id).toBeDefined();
  });

  it('returns 409 for duplicate email', async () => {
    const email = `dup-${Date.now()}@dc1.test`;
    await registerProvider({ email });
    const res = await registerProvider({ email });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/providers/register').send({ name: 'No GPU' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/providers/register')
      .send({ name: 'Test', gpu_model: 'RTX 4090', os: 'Linux' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when gpu_model is missing', async () => {
    const res = await request(app)
      .post('/api/providers/register')
      .send({ name: 'Test', email: 'test@dc1.test', os: 'Linux' });
    expect(res.status).toBe(400);
  });

  it('accepts human-readable OS labels and stores canonical OS values', async () => {
    const res = await registerProvider({ os: 'Ubuntu 22.04' });
    expect(res.status).toBe(200);
    const row = db.get('SELECT os FROM providers WHERE id = ?', res.body.provider_id);
    expect(row.os).toBe('linux');
  });
});

describe('Provider API — GET /api/providers/me', () => {
  it('returns provider data for valid API key', async () => {
    const reg = await registerProvider();
    const apiKey = reg.body.api_key;

    const res = await request(app).get(`/api/providers/me?key=${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.provider).toBeDefined();
    expect(res.body.provider.name).toBe('Test Provider');
    expect(res.body.provider.gpu_model).toBe('RTX 4090');
  });

  it('returns 404 for unknown API key', async () => {
    const res = await request(app).get('/api/providers/me?key=dc1-provider-invalid-key');
    expect(res.status).toBe(404);
  });

  it('returns 400 when key query param is omitted', async () => {
    const res = await request(app).get('/api/providers/me');
    expect(res.status).toBe(400);
  });
});

describe('Provider API — POST /api/providers/heartbeat', () => {
  it('accepts heartbeat and sets provider online', async () => {
    const reg = await registerProvider();
    const apiKey = reg.body.api_key;

    const res = await request(app).post('/api/providers/heartbeat').send({
      api_key: apiKey,
      gpu_status: { gpu_name: 'RTX 4090', gpu_util_pct: 12, temp_c: 47 },
      uptime: 3600,
      provider_ip: '192.168.1.10',
      provider_hostname: 'test-node',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Confirm last_heartbeat was updated in DB
    const row = db.get('SELECT status, last_heartbeat FROM providers WHERE api_key = ?', apiKey);
    expect(row.status).toBe('online');
    expect(row.last_heartbeat).not.toBeNull();
  });

  it('returns 401 for invalid API key', async () => {
    const res = await request(app).post('/api/providers/heartbeat').send({
      api_key: 'dc1-provider-bogus-key',
      gpu_status: {},
    });
    expect(res.status).toBe(401);
  });

  it('sets daemon update_available flag for outdated daemon version', async () => {
    const reg = await registerProvider();
    const apiKey = reg.body.api_key;

    const res = await request(app).post('/api/providers/heartbeat').send({
      api_key: apiKey,
      gpu_status: { daemon_version: '1.0.0' },
    });

    expect(res.status).toBe(200);
    expect(res.body.update_available).toBe(true);
  });

  it('returns update_available: false for current daemon version', async () => {
    const reg = await registerProvider();
    const apiKey = reg.body.api_key;

    const res = await request(app).post('/api/providers/heartbeat').send({
      api_key: apiKey,
      gpu_status: { daemon_version: '3.3.0' },
    });

    expect(res.status).toBe(200);
    expect(res.body.update_available).toBe(false);
  });
});

describe('Provider API — GET /api/providers/:api_key/jobs', () => {
  it('returns null job when no pending jobs assigned', async () => {
    const reg = await registerProvider();
    const apiKey = reg.body.api_key;

    const res = await request(app).get(`/api/providers/${apiKey}/jobs`);
    expect(res.status).toBe(200);
    expect(res.body.job).toBeNull();
  });

  it('returns 401 for unknown provider key', async () => {
    const res = await request(app).get('/api/providers/dc1-provider-invalid/jobs');
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// RENTER API
// =============================================================================

describe('Renter API — POST /api/renters/register', () => {
  it('returns 201 with api_key on success', async () => {
    const res = await registerRenter();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.api_key).toBe('string');
    expect(res.body.api_key).toMatch(/^dc1-renter-/);
    expect(res.body.renter_id).toBeDefined();
  });

  it('returns 409 for duplicate email', async () => {
    const email = `dup-renter-${Date.now()}@dc1.test`;
    await registerRenter({ email });
    const res = await registerRenter({ email });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/renters/register')
      .send({ email: 'norname@dc1.test' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/renters/register')
      .send({ name: 'No Email' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/renters/register')
      .send({ name: 'Bad Email', email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('new renter starts with 1000 halala starter balance', async () => {
    const res = await registerRenter();
    const row = db.get('SELECT balance_halala FROM renters WHERE api_key = ?', res.body.api_key);
    expect(row.balance_halala).toBe(1000);
  });
});

describe('Renter API — GET /api/renters/me', () => {
  it('returns renter profile for valid key', async () => {
    const reg = await registerRenter({ name: 'Aisha Al-Farsi' });
    const apiKey = reg.body.api_key;

    const res = await request(app).get(`/api/renters/me?key=${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.renter).toBeDefined();
    expect(res.body.renter.name).toBe('Aisha Al-Farsi');
    expect(res.body.renter.balance_halala).toBe(1000);
    expect(Array.isArray(res.body.recent_jobs)).toBe(true);
  });

  it('returns 404 for unknown renter key', async () => {
    const res = await request(app).get('/api/renters/me?key=dc1-renter-bogus');
    expect(res.status).toBe(404);
  });

  it('returns 400 when key param is omitted', async () => {
    const res = await request(app).get('/api/renters/me');
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// ADMIN API
// =============================================================================

describe('Admin API — GET /api/admin/dashboard', () => {
  it('returns dashboard stats with valid admin token', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.stats).toMatchObject({
      total_providers: expect.any(Number),
      online_now: expect.any(Number),
      total_jobs: expect.any(Number),
    });
  });

  it('reflects registered providers in dashboard count', async () => {
    await registerProvider({ name: 'Provider A', email: `a-${Date.now()}@dc1.test` });
    await registerProvider({ name: 'Provider B', email: `b-${Date.now()}@dc1.test` });

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.stats.total_providers).toBeGreaterThanOrEqual(2);
  });

  it('returns 401 without admin token', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong admin token', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('x-admin-token', 'wrong-token');
    expect(res.status).toBe(401);
  });

  it('accepts token via Authorization: Bearer header', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
  });
});

describe('Admin API — GET /api/admin/providers', () => {
  it('returns provider list with valid token', async () => {
    await registerProvider();
    const res = await request(app)
      .get('/api/admin/providers')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.providers).toBeDefined();
    expect(Array.isArray(res.body.providers)).toBe(true);
    // api_key must NOT be exposed
    res.body.providers.forEach(p => {
      expect(p.api_key).toBeUndefined();
    });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/providers');
    expect(res.status).toBe(401);
  });
});
