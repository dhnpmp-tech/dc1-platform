/**
 * DCP-44: Admin Endpoint Integration Tests
 *
 * Covers admin endpoints NOT already tested in api-core.test.js:
 *   - GET /api/admin/renters
 *   - GET /api/admin/escrow
 *   - Auth enforcement on all admin routes
 *
 * Already covered in api-core.test.js (do not duplicate):
 *   - GET /api/admin/dashboard
 *   - GET /api/admin/providers
 */

'use strict';

if (!process.env.DC1_DB_PATH)     process.env.DC1_DB_PATH     = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token';

const request = require('supertest');
const express = require('express');
const db      = require('../../src/db');

// ── App factory ──────────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  ['providers', 'renters', 'jobs', 'admin'].forEach(name => {
    const p = require.resolve(`../../src/routes/${name}`);
    delete require.cache[p];
  });
  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters',   require('../../src/routes/renters'));
  app.use('/api/jobs',      require('../../src/routes/jobs'));
  app.use('/api/admin',     require('../../src/routes/admin'));
  return app;
}

const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN;

let app;

function cleanDb() {
  try { db.run('DELETE FROM serve_sessions'); }  catch (_) {}
  try { db.run('DELETE FROM escrow_holds'); }    catch (_) {}
  try { db.run('DELETE FROM heartbeat_log'); }   catch (_) {}
  try { db.run('DELETE FROM jobs'); }            catch (_) {}
  try { db.run('DELETE FROM renters'); }         catch (_) {}
  try { db.run('DELETE FROM providers'); }       catch (_) {}
}

async function seedRenter(balanceHalala = 10_000) {
  const res = await request(app).post('/api/renters/register').send({
    name: `Admin-Test-Renter-${Date.now()}`,
    email: `adminr-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
  });
  expect(res.status).toBe(201);
  db.run('UPDATE renters SET balance_halala = ? WHERE id = ?', balanceHalala, res.body.renter_id);
  return { key: res.body.api_key, id: res.body.renter_id };
}

async function seedProvider() {
  const res = await request(app).post('/api/providers/register').send({
    name: `Admin-Test-Provider-${Date.now()}`,
    email: `adminp-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
    gpu_model: 'RTX 4090', os: 'Linux', vram_gb: 24,
  });
  expect(res.status).toBe(200);
  await request(app).post('/api/providers/heartbeat').send({
    api_key: res.body.api_key, status: 'online', gpu_status: 'idle',
  });
  return { key: res.body.api_key, id: res.body.provider_id };
}

beforeAll(() => { app = createApp(); });
beforeEach(() => cleanDb());
afterAll(() => cleanDb());

// =============================================================================
// Admin auth enforcement
// =============================================================================

describe('Admin API — auth enforcement', () => {
  const adminPaths = [
    ['GET',  '/api/admin/dashboard'],
    ['GET',  '/api/admin/providers'],
    ['GET',  '/api/admin/renters'],
    ['GET',  '/api/admin/escrow'],
  ];

  for (const [method, path] of adminPaths) {
    it(`${method} ${path} returns 401 without admin token`, async () => {
      const res = await request(app)[method.toLowerCase()](path);
      expect(res.status).toBe(401);
    });

    it(`${method} ${path} returns 401 with wrong token`, async () => {
      const res = await request(app)[method.toLowerCase()](path)
        .set('x-admin-token', 'wrong-token');
      expect(res.status).toBe(401);
    });

    it(`${method} ${path} accepts token via Authorization: Bearer header`, async () => {
      const res = await request(app)[method.toLowerCase()](path)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(200);
    });
  }
});

// =============================================================================
// GET /api/admin/renters
// =============================================================================

describe('Admin API — GET /api/admin/renters', () => {
  it('returns 200 with renters array', async () => {
    const res = await request(app)
      .get('/api/admin/renters')
      .set('x-admin-token', ADMIN_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.renters)).toBe(true);
  });

  it('reflects newly registered renters in list', async () => {
    const { id: renterId } = await seedRenter();

    const res = await request(app)
      .get('/api/admin/renters')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const renter = res.body.renters.find(r => r.id === renterId);
    expect(renter).toBeDefined();
  });

  it('does not expose full api_key in renter list (should be masked or absent)', async () => {
    await seedRenter();

    const res = await request(app)
      .get('/api/admin/renters')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    if (res.body.renters.length > 0) {
      const renter = res.body.renters[0];
      // api_key must be absent or partially masked (not the full 32+ char key)
      if (renter.api_key !== undefined) {
        expect(renter.api_key.length).toBeLessThan(40);
      }
    }
  });
});

// =============================================================================
// GET /api/admin/escrow
// =============================================================================

describe('Admin API — GET /api/admin/escrow', () => {
  it('returns 200 with summary and holds array', async () => {
    const res = await request(app)
      .get('/api/admin/escrow')
      .set('x-admin-token', ADMIN_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(Array.isArray(res.body.holds)).toBe(true);
  });

  it('summary reflects real escrow hold created by job submission', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    // Submit a job — creates an escrow hold
    const submitRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 5,
              params: { prompt: 'test', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' } });
    expect(submitRes.status).toBe(201);

    const res = await request(app)
      .get('/api/admin/escrow')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBeGreaterThanOrEqual(1);
    expect(res.body.summary.held_halala).toBeGreaterThan(0);
    expect(res.body.holds.length).toBeGreaterThanOrEqual(1);
  });

  it('summary held_sar is held_halala / 100 (halala-to-SAR conversion)', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 5,
              params: { prompt: 'test', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' } });

    const res = await request(app)
      .get('/api/admin/escrow')
      .set('x-admin-token', ADMIN_TOKEN);

    const { held_halala, held_sar } = res.body.summary;
    expect(parseFloat(held_sar)).toBeCloseTo(held_halala / 100, 2);
  });

  it('GET /api/admin/escrow?status=held filters by status', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 5,
              params: { prompt: 'test', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' } });

    const res = await request(app)
      .get('/api/admin/escrow?status=held')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    // Every returned hold must have status='held'
    res.body.holds.forEach(h => expect(h.status).toBe('held'));
  });

  it('escrow holds have renter_api_key masked (only first 16 chars shown)', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 5,
              params: { prompt: 'test', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' } });

    const res = await request(app)
      .get('/api/admin/escrow')
      .set('x-admin-token', ADMIN_TOKEN);

    const hold = res.body.holds.find(h => h.status === 'held');
    if (hold && hold.renter_api_key) {
      expect(hold.renter_api_key).toContain('...');
      // Masked: "first16chars..." means total length <= 16 + 3 = 19
      expect(hold.renter_api_key.length).toBeLessThanOrEqual(20);
    }
  });
});

// =============================================================================
// GET /api/admin/serve-sessions/:job_id (DCP-619)
// =============================================================================

describe('Admin API — GET /api/admin/serve-sessions/:job_id', () => {
  it('returns 404 when serve_session not found', async () => {
    const res = await request(app)
      .get('/api/admin/serve-sessions/nonexistent-job-id')
      .set('x-admin-token', ADMIN_TOKEN);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns serve_session record when found', async () => {
    // Seed provider + renter, then submit a job to get a valid job_id
    const { key: renterKey } = await seedRenter(100_000);
    const { id: providerId } = await seedProvider();
    const jobRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ provider_id: providerId, job_type: 'vllm_serve', duration_minutes: 60,
              params: { model: 'test-model' } });
    expect(jobRes.status).toBe(201);
    const jobId = jobRes.body.job.job_id;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO serve_sessions (
        id, job_id, model, status, started_at, expires_at,
        total_inferences, total_tokens, total_billed_halala, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `session-${jobId}`,
      jobId,
      'test-model',
      'serving',
      now,
      new Date(Date.now() + 3600000).toISOString(),
      0,
      0,
      0,
      now,
      now
    );

    const res = await request(app)
      .get(`/api/admin/serve-sessions/${jobId}`)
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.serve_session).toBeDefined();
    expect(res.body.serve_session.job_id).toBe(jobId);
    expect(res.body.serve_session.model).toBe('test-model');
    expect(res.body.serve_session.total_inferences).toBe(0);
  });

  it('includes metering fields in response (tokens, cost, timestamp)', async () => {
    // Seed provider + renter, then submit a job to get a valid job_id
    const { key: renterKey } = await seedRenter(100_000);
    const { id: providerId } = await seedProvider();
    const jobRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ provider_id: providerId, job_type: 'vllm_serve', duration_minutes: 60,
              params: { model: 'nemotron-mini' } });
    expect(jobRes.status).toBe(201);
    const jobId = jobRes.body.job.job_id;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO serve_sessions (
        id, job_id, model, status, started_at, expires_at,
        total_inferences, total_tokens, total_billed_halala, last_inference_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `session-${jobId}`,
      jobId,
      'nemotron-mini',
      'serving',
      now,
      new Date(Date.now() + 3600000).toISOString(),
      1,
      150,
      42,
      now,
      now,
      now
    );

    const res = await request(app)
      .get(`/api/admin/serve-sessions/${jobId}`)
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const session = res.body.serve_session;
    expect(session.total_tokens).toBe(150);
    expect(session.total_billed_halala).toBe(42);
    expect(session.last_inference_at).toBe(now);
    expect(session.total_inferences).toBe(1);
  });

  it('requires admin token (returns 401 without auth)', async () => {
    const res = await request(app)
      .get('/api/admin/serve-sessions/test-job-id');
    expect(res.status).toBe(401);
  });

  it('requires valid admin token (returns 401 with invalid token)', async () => {
    const res = await request(app)
      .get('/api/admin/serve-sessions/test-job-id')
      .set('x-admin-token', 'invalid-token');
    expect(res.status).toBe(401);
  });
});
