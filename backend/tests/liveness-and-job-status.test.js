'use strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key-stub';

const request = require('supertest');
const express = require('express');
const db      = require('../src/db');
const { runLivenessSweep } = require('../src/services/providerLivenessMonitor');

const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN || 'test-admin-token-jest';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/providers', require('../src/routes/providers'));
  app.use('/api/renters',   require('../src/routes/renters'));
  app.use('/api/jobs',      require('../src/routes/jobs'));
  app.use('/api/admin',     require('../src/routes/admin'));
  return app;
}

const app = createApp();

function cleanDb() {
  const safe = (t) => { try { db.prepare(`DELETE FROM ${t}`).run(); } catch (_) {} };
  try { db.prepare('PRAGMA foreign_keys = OFF').run(); } catch (_) {}
  ['serve_sessions','payout_requests','credit_holds','escrow_holds','job_lifecycle_events',
   'job_executions','job_logs','benchmark_runs','provider_benchmarks','provider_api_keys',
   'quota_log','renter_quota','heartbeat_log','withdrawal_requests','jobs','renters','providers',
  ].forEach(safe);
  try { db.prepare('PRAGMA foreign_keys = ON').run(); } catch (_) {}
}

beforeEach(() => cleanDb());

let _seq = 0;
const uid = () => `${Date.now()}-${++_seq}-${Math.random().toString(36).slice(2)}`;

async function registerProvider(o = {}) {
  const res = await request(app).post('/api/providers/register').send({
    name: o.name || `Prov-${uid()}`, email: o.email || `p-${uid()}@dc1.test`,
    gpu_model: o.gpu_model || 'RTX 4090', os: o.os || 'linux',
  });
  expect(res.status).toBe(200);
  return { id: res.body.provider_id, apiKey: res.body.api_key };
}

const bringOnline = (apiKey) => request(app).post('/api/providers/heartbeat').send({
  api_key: apiKey, gpu_status: { temp: 45, utilization: 0 }, uptime: 3600,
  provider_ip: '10.0.0.1', provider_hostname: 'test-node',
});

async function registerRenter(o = {}) {
  const res = await request(app).post('/api/renters/register').send({
    name: o.name || `Renter-${uid()}`, email: o.email || `r-${uid()}@dc1.test`,
  });
  expect([200, 201]).toContain(res.status);
  return { id: res.body.renter_id, apiKey: res.body.api_key };
}

const topupRenter = async (renterId, amount = 50000) => {
  const res = await request(app).post(`/api/renters/${renterId}/topup`)
    .set('x-admin-token', ADMIN_TOKEN).send({ amount_halala: amount });
  expect(res.status).toBe(200);
  return res.body;
};

async function submitJob(renterApiKey, o = {}) {
  const res = await request(app).post('/api/jobs/submit').set('x-renter-key', renterApiKey)
    .send({ job_type: 'llm_inference', duration_minutes: 5, params: { prompt: 'test' }, ...o });
  expect([200, 201]).toContain(res.status);
  return res.body.job;
}

// ── 1. Heartbeat job_tokens ───────────────────────────────────────────────────

describe('DCP-804: Heartbeat job_tokens update', () => {
  test('heartbeat with job_tokens updates serve_sessions total_tokens', async () => {
    const { id: providerId, apiKey } = await registerProvider();
    await bringOnline(apiKey);
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId);
    const job = await submitJob(renterKey);
    const jobId = job.job_id;

    db.prepare(
      `INSERT OR REPLACE INTO serve_sessions (id, job_id, provider_id, model, status, started_at, expires_at, created_at, total_tokens)
       VALUES (?, ?, ?, 'test-model', 'serving', datetime('now'), datetime('now','+1 hour'), datetime('now'), 0)`
    ).run('sess-' + jobId, jobId, providerId);

    const res = await request(app)
      .post(`/api/providers/${providerId}/heartbeat`)
      .set('X-Provider-Key', apiKey)
      .send({ job_tokens: { [jobId]: 512 } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const session = db.get('SELECT total_tokens FROM serve_sessions WHERE job_id = ?', jobId);
    expect(session.total_tokens).toBe(512);
  });

  test('heartbeat without job_tokens works normally', async () => {
    const { id: providerId, apiKey } = await registerProvider();
    const res = await request(app)
      .post(`/api/providers/${providerId}/heartbeat`)
      .set('X-Provider-Key', apiKey).send({ gpu_utilization: 25 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── 2. GET /api/jobs/:id/status ───────────────────────────────────────────────

describe('DCP-804: GET /api/jobs/:id/status endpoint', () => {
  test('returns 404 for unknown job', async () => {
    const { apiKey } = await registerRenter();
    const res = await request(app).get('/api/jobs/does-not-exist-xyz/status').set('x-renter-key', apiKey);
    expect(res.status).toBe(404);
  });

  test('returns live status shape for a queued job', async () => {
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId);
    const job = await submitJob(renterKey);
    const res = await request(app).get(`/api/jobs/${job.job_id}/status`).set('x-renter-key', renterKey);
    expect(res.status).toBe(200);
    expect(res.body.job_id).toBe(job.job_id);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('tokens_generated');
    expect(res.body).toHaveProperty('elapsed_seconds');
    expect(res.body).toHaveProperty('estimated_cost_usd');
    expect(res.body).toHaveProperty('provider_online');
    expect(typeof res.body.tokens_generated).toBe('number');
    expect(res.body.provider_online).toBe(false);
  });

  test('provider_online true when provider heartbeated recently', async () => {
    const { id: providerId, apiKey: provKey } = await registerProvider();
    await bringOnline(provKey);
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId);
    const job = await submitJob(renterKey);
    db.prepare(`UPDATE jobs SET provider_id = ?, status = 'running', started_at = ? WHERE job_id = ?`)
      .run(providerId, new Date().toISOString(), job.job_id);
    const res = await request(app).get(`/api/jobs/${job.job_id}/status`).set('x-renter-key', renterKey);
    expect(res.status).toBe(200);
    expect(res.body.provider_online).toBe(true);
    expect(res.body.status).toBe('running');
    expect(res.body.elapsed_seconds).toBeGreaterThanOrEqual(0);
  });

  test('tokens_generated reflects serve_session total_tokens', async () => {
    const { id: providerId } = await registerProvider();
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId);
    const job = await submitJob(renterKey);
    db.prepare(
      `INSERT INTO serve_sessions (id, job_id, provider_id, model, status, started_at, expires_at, created_at, total_tokens)
       VALUES (?, ?, ?, 'llama3', 'serving', datetime('now'), datetime('now','+1 hour'), datetime('now'), 1024)`
    ).run('sess2-' + job.job_id, job.job_id, providerId);
    const res = await request(app).get(`/api/jobs/${job.job_id}/status`).set('x-renter-key', renterKey);
    expect(res.status).toBe(200);
    expect(res.body.tokens_generated).toBe(1024);
  });

  test('returns 403 for a different renter', async () => {
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId);
    const job = await submitJob(renterKey);
    const { apiKey: otherKey } = await registerRenter();
    const res = await request(app).get(`/api/jobs/${job.job_id}/status`).set('x-renter-key', otherKey);
    expect(res.status).toBe(403);
  });
});

// ── 3. runLivenessSweep ───────────────────────────────────────────────────────

describe('DCP-804: runLivenessSweep', () => {
  test('returns zero counts when all providers are fresh', async () => {
    const { apiKey } = await registerProvider();
    await bringOnline(apiKey);
    const result = runLivenessSweep();
    expect(result.offlined).toBe(0);
    expect(result.requeued).toBe(0);
  });

  test('marks stale provider offline', async () => {
    const { id: providerId, apiKey } = await registerProvider();
    await bringOnline(apiKey);
    db.prepare(`UPDATE providers SET last_heartbeat = ?, status = 'online' WHERE id = ?`)
      .run(new Date(Date.now() - 200 * 1000).toISOString(), providerId);
    const result = runLivenessSweep();
    expect(result.offlined).toBeGreaterThanOrEqual(1);
    expect(db.get('SELECT status FROM providers WHERE id = ?', providerId).status).toBe('offline');
  });

  test('requeues running job when provider goes stale', async () => {
    const { id: providerId, apiKey: provKey } = await registerProvider();
    await bringOnline(provKey);
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId);
    const job = await submitJob(renterKey);
    db.prepare(`UPDATE jobs SET provider_id = ?, status = 'running', started_at = ? WHERE job_id = ?`)
      .run(providerId, new Date().toISOString(), job.job_id);
    db.prepare(`UPDATE providers SET last_heartbeat = ?, status = 'online' WHERE id = ?`)
      .run(new Date(Date.now() - 200 * 1000).toISOString(), providerId);
    const result = runLivenessSweep();
    expect(result.requeued).toBeGreaterThanOrEqual(1);
    const updatedJob = db.get('SELECT status, provider_id FROM jobs WHERE job_id = ?', job.job_id);
    expect(updatedJob.status).toBe('pending');
    expect(updatedJob.provider_id).toBeNull();
  });
});
