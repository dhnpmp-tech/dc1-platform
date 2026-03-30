/**
 * DCP-892: Provider heartbeat health + renter job history API tests
 */
'use strict';

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');

process.env.DC1_DB_PATH = ':memory:';
process.env.ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT = '1';

const db = require('../src/db');
const providersRouter = require('../src/routes/providers');
const rentersRouter = require('../src/routes/renters');

const app = express();
app.use('/api/providers/heartbeat', express.raw({ type: 'application/json' }), (req, _res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.rawBody = req.body;
    try { req.body = JSON.parse(req.body.toString('utf8')); } catch { req.body = {}; }
  }
  next();
});
app.use(express.json());
app.use('/api/providers', providersRouter);
app.use('/api/renters', rentersRouter);

function cleanDb() {
  const tables = [
    'provider_metrics',
    'provider_gpu_telemetry',
    'heartbeat_log',
    'serve_sessions',
    'jobs',
    'renter_api_keys',
    'renters',
    'providers',
    'model_registry',
  ];
  for (const table of tables) {
    try { db.run(`DELETE FROM ${table}`); } catch (_) {}
  }
}

describe('DCP-892 heartbeat metrics + renter jobs', () => {
  let providerId;
  let providerKey;
  let renterId;
  let renterKey;

  beforeEach(() => {
    cleanDb();

    providerKey = `dcp-prov-test-${crypto.randomBytes(8).toString('hex')}`;
    const provResult = db.run(
      `INSERT INTO providers (name, email, api_key, gpu_model, approval_status, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'approved', 'online', datetime('now'), datetime('now'))`,
      'Test Provider', 'provider@test.com', providerKey, 'RTX 4090'
    );
    providerId = Number(provResult.lastInsertRowid);

    renterKey = `dcp-renter-test-${crypto.randomBytes(8).toString('hex')}`;
    const renterResult = db.run(
      `INSERT INTO renters (name, email, api_key, status, balance_halala, total_spent_halala, total_jobs, created_at)
       VALUES (?, ?, ?, 'active', 10000, 0, 0, datetime('now'))`,
      'Test Renter', 'renter@test.com', renterKey
    );
    renterId = Number(renterResult.lastInsertRowid);

    for (const [status, model] of [['completed', 'llama3-8b'], ['failed', 'mistral-7b'], ['running', 'llama3-8b']]) {
      const jobId = `job-${crypto.randomBytes(6).toString('hex')}`;
      db.run(
        `INSERT INTO jobs (job_id, renter_id, provider_id, model, status, template_id, cost_halala, actual_cost_halala, submitted_at, started_at, completed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, datetime('now'))`,
        jobId, renterId, providerId, model, status, 'llama3-8b-template', 500, 450,
        status === 'completed' ? new Date().toISOString() : null
      );
      if (status === 'completed') {
        db.run(
          `INSERT INTO serve_sessions (id, job_id, provider_id, model, status, started_at, expires_at, total_tokens, total_billed_halala, created_at)
           VALUES (?, ?, ?, ?, 'stopped', datetime('now'), datetime('now', '+1 hour'), ?, ?, datetime('now'))`,
          `sess-${crypto.randomBytes(6).toString('hex')}`, jobId, providerId, model, 1200, 450
        );
      }
    }
  });

  test('POST /api/providers/:id/heartbeat with gpu_utilization_pct writes provider_metrics', async () => {
    const res = await request(app)
      .post(`/api/providers/${providerId}/heartbeat`)
      .set('x-provider-key', providerKey)
      .send({ gpu_utilization_pct: 72.5, vram_used_mb: 8192, active_jobs: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('online');

    const row = db.get('SELECT * FROM provider_metrics WHERE provider_id = ? ORDER BY id DESC LIMIT 1', providerId);
    expect(row).toBeTruthy();
    expect(row.gpu_utilization_pct).toBe(72.5);
    expect(row.vram_used_mb).toBe(8192);
    expect(row.active_jobs).toBe(2);
  });

  test('POST /api/providers/:id/heartbeat accepts legacy gpu_utilization alias', async () => {
    const res = await request(app)
      .post(`/api/providers/${providerId}/heartbeat`)
      .set('x-provider-key', providerKey)
      .send({ gpu_utilization: 55.0, vram_used_mb: 4096, jobs_active: 1 });

    expect(res.status).toBe(200);
    const row = db.get('SELECT gpu_utilization_pct FROM provider_metrics WHERE provider_id = ? ORDER BY id DESC LIMIT 1', providerId);
    expect(row.gpu_utilization_pct).toBe(55.0);
  });

  test('GET /api/providers/:id/metrics returns 1h timeseries', async () => {
    await request(app)
      .post(`/api/providers/${providerId}/heartbeat`)
      .set('x-provider-key', providerKey)
      .send({ gpu_utilization_pct: 70, vram_used_mb: 8000, active_jobs: 1 });
    await request(app)
      .post(`/api/providers/${providerId}/heartbeat`)
      .set('x-provider-key', providerKey)
      .send({ gpu_utilization_pct: 71, vram_used_mb: 8100, active_jobs: 2 });

    const res = await request(app).get(`/api/providers/${providerId}/metrics`);

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('1h');
    expect(Array.isArray(res.body.metrics)).toBe(true);
    expect(res.body.metrics.length).toBeGreaterThanOrEqual(2);
    expect(typeof res.body.count).toBe('number');

    const sample = res.body.metrics[0];
    expect(sample).toHaveProperty('recorded_at');
    expect(sample).toHaveProperty('gpu_utilization_pct');
    expect(sample).toHaveProperty('vram_used_mb');
    expect(sample).toHaveProperty('active_jobs');
  });

  test('GET /api/providers/:id/metrics supports period=6h', async () => {
    const res = await request(app).get(`/api/providers/${providerId}/metrics?period=6h`);
    expect(res.status).toBe(200);
    expect(res.body.period).toBe('6h');
  });

  test('GET /api/providers/:id/metrics returns 400 for invalid period', async () => {
    const res = await request(app).get(`/api/providers/${providerId}/metrics?period=99y`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  test('GET /api/providers/:id/metrics returns 404 for unknown provider', async () => {
    const res = await request(app).get('/api/providers/999999/metrics');
    expect(res.status).toBe(404);
  });

  test('GET /api/renters/jobs returns paginated job list', async () => {
    const res = await request(app)
      .get('/api/renters/jobs')
      .set('Authorization', `Bearer ${renterKey}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.jobs)).toBe(true);
    expect(res.body.jobs.length).toBe(3);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(typeof res.body.pages).toBe('number');

    const job = res.body.jobs[0];
    expect(job).toHaveProperty('job_id');
    expect(job).toHaveProperty('template_id');
    expect(job).toHaveProperty('provider_id');
    expect(job).toHaveProperty('status');
    expect(job).toHaveProperty('started_at');
    expect(job).toHaveProperty('completed_at');
    expect(job).toHaveProperty('cost_halala');
    expect(job).toHaveProperty('output_tokens');
  });

  test('GET /api/renters/jobs filters by status=completed', async () => {
    const res = await request(app)
      .get('/api/renters/jobs?status=completed')
      .set('x-renter-key', renterKey);

    expect(res.status).toBe(200);
    expect(res.body.jobs.length).toBe(1);
    expect(res.body.jobs[0].status).toBe('completed');
  });

  test('GET /api/renters/jobs filters by status=failed', async () => {
    const res = await request(app)
      .get('/api/renters/jobs?status=failed')
      .set('x-renter-key', renterKey);

    expect(res.status).toBe(200);
    expect(res.body.jobs.length).toBe(1);
    expect(res.body.jobs[0].status).toBe('failed');
  });

  test('GET /api/renters/jobs paginates correctly', async () => {
    const res = await request(app)
      .get('/api/renters/jobs?page=1&limit=1')
      .set('x-renter-key', renterKey);

    expect(res.status).toBe(200);
    expect(res.body.jobs.length).toBe(1);
    expect(res.body.total).toBe(3);
    expect(res.body.pages).toBe(3);
    expect(res.body.limit).toBe(1);
  });

  test('GET /api/renters/jobs includes output_tokens from serve_sessions', async () => {
    const res = await request(app)
      .get('/api/renters/jobs?status=completed')
      .set('x-renter-key', renterKey);

    expect(res.status).toBe(200);
    expect(res.body.jobs[0].output_tokens).toBe(1200);
  });

  test('GET /api/renters/jobs returns 401 without auth', async () => {
    const res = await request(app).get('/api/renters/jobs');
    expect(res.status).toBe(401);
  });

  test('GET /api/renters/jobs returns 401 for invalid key', async () => {
    const res = await request(app)
      .get('/api/renters/jobs')
      .set('x-renter-key', 'bad-key-here');

    expect(res.status).toBe(401);
  });
});
