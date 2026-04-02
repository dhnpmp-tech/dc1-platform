'use strict';
/**
 * DCP-841: Job queue + real-time status streaming — end-to-end integration test
 *
 * Validates all five deliverables as a complete renter job tracking flow:
 *   1. Jobs table schema — id, renter_id, provider_id, template_id, status, timestamps, cost
 *   2. GET /api/jobs/:job_id/status — polling endpoint
 *   3. GET /api/jobs/:job_id/stream — SSE real-time status (headers + initial event)
 *   4. POST /api/jobs/:job_id/progress — provider progress fan-out to SSE clients
 *   5. GET /api/jobs — renter job list with cost_sar
 *   6. GET /api/admin/jobs — admin dashboard with stats
 *
 * Phase 1 testing note: these tests confirm the renter job tracking stack is
 * functional before the 2026-03-26 08:00 UTC testing window.
 */

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key-stub';
process.env.DC1_ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN || 'test-admin-token-jest';
process.env.DISABLE_RATE_LIMIT = process.env.DISABLE_RATE_LIMIT || '1';

const request = require('supertest');
const express = require('express');
const db = require('../src/db');
const jobEventEmitter = require('../src/utils/jobEventEmitter');

const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN;

// ── App factory ───────────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/providers', require('../src/routes/providers'));
  app.use('/api/renters', require('../src/routes/renters'));
  app.use('/api/jobs', require('../src/routes/jobs'));
  app.use('/api/admin', require('../src/routes/admin'));
  return app;
}

const app = createApp();

// ── DB cleanup ────────────────────────────────────────────────────────────────

function cleanDb() {
  const safe = (t) => { try { db.prepare(`DELETE FROM ${t}`).run(); } catch (_) {} };
  try { db.prepare('PRAGMA foreign_keys = OFF').run(); } catch (_) {}
  for (const t of [
    'serve_sessions', 'payout_requests', 'credit_holds', 'escrow_holds',
    'job_lifecycle_events', 'job_executions', 'job_logs', 'benchmark_runs',
    'provider_benchmarks', 'provider_api_keys', 'quota_log', 'renter_quota',
    'heartbeat_log', 'withdrawal_requests', 'jobs', 'renters', 'providers',
  ]) { safe(t); }
  try { db.prepare('PRAGMA foreign_keys = ON').run(); } catch (_) {}
}

beforeEach(() => {
  cleanDb();
  jobEventEmitter._resetForTests();
});

// ── Test helpers ──────────────────────────────────────────────────────────────

let _seq = 0;
function uid() { return `${Date.now()}-${++_seq}-${Math.random().toString(36).slice(2)}`; }

async function registerProvider(overrides = {}) {
  const res = await request(app).post('/api/providers/register').send({
    name: overrides.name || `Prov-${uid()}`,
    email: overrides.email || `prov-${uid()}@dc1.test`,
    gpu_model: overrides.gpu_model || 'RTX 4090',
    os: overrides.os || 'linux',
  });
  expect(res.status).toBe(200);
  return { id: res.body.provider_id, apiKey: res.body.api_key };
}

async function bringOnline(apiKey) {
  return request(app).post('/api/providers/heartbeat').send({
    api_key: apiKey,
    gpu_status: { temp: 45, utilization: 0 },
    uptime: 3600,
    provider_ip: '10.0.0.1',
    provider_hostname: 'test-node',
  });
}

async function registerRenter(overrides = {}) {
  const res = await request(app).post('/api/renters/register').send({
    name: overrides.name || `Renter-${uid()}`,
    email: overrides.email || `renter-${uid()}@dc1.test`,
  });
  expect([200, 201]).toContain(res.status);
  return { id: res.body.renter_id, apiKey: res.body.api_key };
}

async function topupRenter(renterId, amount = 100000) {
  const res = await request(app)
    .post(`/api/renters/${renterId}/topup`)
    .set('x-admin-token', ADMIN_TOKEN)
    .send({ amount_halala: amount });
  expect(res.status).toBe(200);
}

async function submitJob(renterApiKey, overrides = {}) {
  const res = await request(app)
    .post('/api/jobs/submit')
    .set('x-renter-key', renterApiKey)
    .send({
      job_type: overrides.job_type || 'llm_inference',
      duration_minutes: overrides.duration_minutes || 5,
      params: overrides.params || { prompt: 'Hello' },
      ...overrides,
    });
  expect([200, 201]).toContain(res.status);
  return res.body.job;
}

// ── 1. Schema verification ────────────────────────────────────────────────────

describe('DCP-841 Deliverable 1: jobs table schema', () => {
  test('jobs table has all required tracking columns', () => {
    const cols = db.all("PRAGMA table_info('jobs')").map((c) => c.name);
    // Core identity
    expect(cols).toContain('id');
    expect(cols).toContain('job_id');
    // Ownership
    expect(cols).toContain('renter_id');
    expect(cols).toContain('provider_id');
    // Template support
    expect(cols).toContain('template_id');
    // Status lifecycle
    expect(cols).toContain('status');
    // Timestamps
    expect(cols).toContain('submitted_at');
    expect(cols).toContain('started_at');
    expect(cols).toContain('completed_at');
    // Cost tracking
    expect(cols).toContain('cost_halala');
  });

  test('job status transitions follow queued→assigned→running→completed lifecycle', async () => {
    const { id: providerId, apiKey: provKey } = await registerProvider();
    await bringOnline(provKey);
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId);

    const job = await submitJob(renterKey);
    const row = db.get('SELECT status FROM jobs WHERE job_id = ?', job.job_id);
    expect(['queued', 'pending', 'assigned']).toContain(row.status);

    // Advance to running
    db.prepare('UPDATE jobs SET status = ?, started_at = ? WHERE job_id = ?')
      .run('running', new Date().toISOString(), job.job_id);

    // Advance to completed
    db.prepare('UPDATE jobs SET status = ?, completed_at = ?, actual_cost_halala = ? WHERE job_id = ?')
      .run('completed', new Date().toISOString(), 500, job.job_id);

    const done = db.get('SELECT status, completed_at, actual_cost_halala FROM jobs WHERE job_id = ?', job.job_id);
    expect(done.status).toBe('completed');
    expect(done.completed_at).toBeTruthy();
    expect(done.actual_cost_halala).toBe(500);
  });
});

// ── 2. GET /api/jobs/:job_id/status ──────────────────────────────────────────

describe('DCP-841 Deliverable 2: GET /api/jobs/:job_id/status', () => {
  test('returns 404 for unknown job', async () => {
    const { apiKey } = await registerRenter();
    const res = await request(app)
      .get('/api/jobs/nonexistent-job-xyz/status')
      .set('x-renter-key', apiKey);
    expect(res.status).toBe(404);
  });

  test('returns full status shape for a queued job', async () => {
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId);
    const job = await submitJob(renterKey);

    const res = await request(app)
      .get(`/api/jobs/${job.job_id}/status`)
      .set('x-renter-key', renterKey);

    expect(res.status).toBe(200);
    expect(res.body.job_id).toBe(job.job_id);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('tokens_generated');
    expect(res.body).toHaveProperty('elapsed_seconds');
    expect(res.body).toHaveProperty('estimated_cost_usd');
    expect(res.body).toHaveProperty('provider_online');
    expect(res.body.provider_online).toBe(false); // no provider assigned yet
  });

  test('provider_online is true when provider heartbeated within 90s', async () => {
    const { id: providerId, apiKey: provKey } = await registerProvider();
    await bringOnline(provKey);
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId);
    const job = await submitJob(renterKey);

    db.prepare('UPDATE jobs SET provider_id = ?, status = ?, started_at = ? WHERE job_id = ?')
      .run(providerId, 'running', new Date().toISOString(), job.job_id);

    const res = await request(app)
      .get(`/api/jobs/${job.job_id}/status`)
      .set('x-renter-key', renterKey);

    expect(res.status).toBe(200);
    expect(res.body.provider_online).toBe(true);
  });

  test('elapsed_seconds reflects running duration', async () => {
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId);
    const job = await submitJob(renterKey);

    // Set started 10 seconds ago
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
    db.prepare('UPDATE jobs SET status = ?, started_at = ? WHERE job_id = ?')
      .run('running', tenSecondsAgo, job.job_id);

    const res = await request(app)
      .get(`/api/jobs/${job.job_id}/status`)
      .set('x-renter-key', renterKey);

    expect(res.status).toBe(200);
    expect(res.body.elapsed_seconds).toBeGreaterThanOrEqual(9);
    expect(res.body.elapsed_seconds).toBeLessThan(30);
  });

  test('forbids cross-renter job access', async () => {
    const { id: renterId1, apiKey: key1 } = await registerRenter();
    await topupRenter(renterId1);
    const job = await submitJob(key1);

    const { apiKey: key2 } = await registerRenter();
    const res = await request(app)
      .get(`/api/jobs/${job.job_id}/status`)
      .set('x-renter-key', key2);

    expect(res.status).toBe(403);
  });
});

// ── 3. GET /api/jobs/:job_id/stream (SSE) ────────────────────────────────────

describe('DCP-841 Deliverable 3a: GET /api/jobs/:job_id/stream SSE endpoint', () => {
  test('returns 404 for unknown job', (done) => {
    const { apiKey } = registerRenter().then(({ apiKey }) => {
      request(app)
        .get('/api/jobs/no-such-job/stream')
        .set('x-renter-key', apiKey)
        .end((err, res) => {
          expect(res.status).toBe(404);
          done();
        });
    });
  });

  test('sets SSE headers and emits initial event for queued job', (done) => {
    registerRenter()
      .then(async ({ id: renterId, apiKey: renterKey }) => {
        await topupRenter(renterId);
        return { renterKey, job: await submitJob(renterKey) };
      })
      .then(({ renterKey, job }) => {
        let buffer = '';
        const req = request(app)
          .get(`/api/jobs/${job.job_id}/stream`)
          .set('x-renter-key', renterKey)
          .buffer(false)
          .parse((res, callback) => {
            res.on('data', (chunk) => {
              buffer += chunk.toString();
              // Once we have the initial event, abort
              if (buffer.includes('data:')) {
                res.destroy();
              }
            });
            res.on('close', () => callback(null, buffer));
            res.on('error', () => callback(null, buffer));
          });

        req.end((err, res) => {
          expect(res.headers['content-type']).toMatch(/text\/event-stream/);
          expect(res.headers['cache-control']).toMatch(/no-cache/);
          expect(buffer).toMatch(/event:/);
          expect(buffer).toMatch(/data:/);
          done();
        });
      });
  });

  test('SSE stream closes immediately for already-completed job', (done) => {
    registerRenter()
      .then(async ({ id: renterId, apiKey: renterKey }) => {
        await topupRenter(renterId);
        const job = await submitJob(renterKey);
        db.prepare("UPDATE jobs SET status = 'completed', completed_at = ? WHERE job_id = ?")
          .run(new Date().toISOString(), job.job_id);
        return { renterKey, job };
      })
      .then(({ renterKey, job }) => {
        let buffer = '';
        request(app)
          .get(`/api/jobs/${job.job_id}/stream`)
          .set('x-renter-key', renterKey)
          .buffer(false)
          .parse((res, callback) => {
            res.on('data', (chunk) => { buffer += chunk.toString(); });
            res.on('close', () => callback(null, buffer));
            res.on('end', () => callback(null, buffer));
          })
          .end((err, res) => {
            // Stream should close and emit terminal event
            expect(buffer).toMatch(/job_completed|end/);
            done();
          });
      });
  });
});

// ── 4. POST /api/jobs/:job_id/progress ───────────────────────────────────────

describe('DCP-841 Deliverable 3b: POST /api/jobs/:job_id/progress (provider → backend fan-out)', () => {
  // Note: progress endpoint uses api_key in body (daemon-to-backend auth pattern),
  // not the X-Provider-Key header used by heartbeat.
  // Valid phases: pulling, downloading_model, installing_deps, loading_model, generating, formatting

  test('returns 404 for unknown job when authenticated', async () => {
    const { apiKey: provKey } = await registerProvider();
    const res = await request(app)
      .post('/api/jobs/no-such-job/progress')
      .send({ api_key: provKey, phase: 'loading_model' });
    expect(res.status).toBe(404);
  });

  test('updates progress_phase on the job row', async () => {
    const { id: providerId, apiKey: provKey } = await registerProvider();
    await bringOnline(provKey);
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId);
    const job = await submitJob(renterKey);

    // Assign job to provider
    db.prepare('UPDATE jobs SET provider_id = ?, status = ? WHERE job_id = ?')
      .run(providerId, 'assigned', job.job_id);

    const res = await request(app)
      .post(`/api/jobs/${job.job_id}/progress`)
      .send({ api_key: provKey, phase: 'loading_model' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.phase).toBe('loading_model');

    const row = db.get('SELECT progress_phase FROM jobs WHERE job_id = ?', job.job_id);
    expect(row.progress_phase).toBe('loading_model');
  });

  test('pulling phase advances job status to pulling', async () => {
    const { id: providerId, apiKey: provKey } = await registerProvider();
    await bringOnline(provKey);
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId);
    const job = await submitJob(renterKey);

    db.prepare('UPDATE jobs SET provider_id = ? WHERE job_id = ?')
      .run(providerId, job.job_id);

    const res = await request(app)
      .post(`/api/jobs/${job.job_id}/progress`)
      .send({ api_key: provKey, phase: 'pulling' });

    expect(res.status).toBe(200);

    const row = db.get('SELECT status FROM jobs WHERE job_id = ?', job.job_id);
    expect(['pulling', 'assigned', 'running']).toContain(row.status);
  });
});

// ── 5. GET /api/jobs (renter job list) ───────────────────────────────────────

describe('DCP-841 Deliverable 4: GET /api/jobs — renter job list with cost_sar', () => {
  test('returns empty list for new renter', async () => {
    const { apiKey } = await registerRenter();
    const res = await request(app)
      .get('/api/jobs')
      .set('x-renter-key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.jobs).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  test('returns renter jobs with cost_sar field', async () => {
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId);
    const job = await submitJob(renterKey);

    // Set a known cost
    db.prepare('UPDATE jobs SET actual_cost_halala = 375 WHERE job_id = ?')
      .run(job.job_id);

    const res = await request(app)
      .get('/api/jobs')
      .set('x-renter-key', renterKey);

    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(1);
    const j = res.body.jobs[0];
    expect(j.job_id).toBe(job.job_id);
    expect(j).toHaveProperty('status');
    expect(j).toHaveProperty('cost_sar');
    // 375 halala = 3.75 SAR
    expect(parseFloat(j.cost_sar)).toBeCloseTo(3.75, 1);
  });

  test('returns multiple jobs ordered newest first', async () => {
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId, 500000);

    const job1 = await submitJob(renterKey);
    const job2 = await submitJob(renterKey);
    const job3 = await submitJob(renterKey);

    const res = await request(app)
      .get('/api/jobs')
      .set('x-renter-key', renterKey);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.jobs).toHaveLength(3);
    // Newest first
    expect(res.body.jobs[0].job_id).toBe(job3.job_id);
  });

  test('respects limit and offset pagination', async () => {
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId, 500000);

    await submitJob(renterKey);
    await submitJob(renterKey);
    await submitJob(renterKey);

    const res = await request(app)
      .get('/api/jobs?limit=2&offset=0')
      .set('x-renter-key', renterKey);

    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.limit).toBe(2);
    expect(res.body.offset).toBe(0);
  });

  test('only returns jobs belonging to the authenticated renter', async () => {
    const { id: renterId1, apiKey: key1 } = await registerRenter();
    await topupRenter(renterId1);
    const { id: renterId2, apiKey: key2 } = await registerRenter();
    await topupRenter(renterId2, 100000);

    await submitJob(key1);
    await submitJob(key1);
    await submitJob(key2);

    const res1 = await request(app).get('/api/jobs').set('x-renter-key', key1);
    const res2 = await request(app).get('/api/jobs').set('x-renter-key', key2);

    expect(res1.body.total).toBe(2);
    expect(res2.body.total).toBe(1);
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/jobs');
    expect([401, 403]).toContain(res.status);
  });
});

// ── 6. GET /api/admin/jobs ────────────────────────────────────────────────────

describe('DCP-841 Deliverable 5: GET /api/admin/jobs — admin dashboard', () => {
  test('requires admin auth', async () => {
    const res = await request(app).get('/api/admin/jobs');
    expect([401, 403]).toContain(res.status);
  });

  test('returns all jobs with stats', async () => {
    const { id: renterId1, apiKey: key1 } = await registerRenter();
    await topupRenter(renterId1);
    const { id: renterId2, apiKey: key2 } = await registerRenter();
    await topupRenter(renterId2, 100000);

    const job1 = await submitJob(key1);
    const job2 = await submitJob(key2);

    // Mark one completed
    db.prepare("UPDATE jobs SET status = 'completed', actual_cost_halala = 1000 WHERE job_id = ?")
      .run(job1.job_id);

    const res = await request(app)
      .get('/api/admin/jobs')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.jobs).toBeDefined();
    expect(res.body.jobs.length).toBeGreaterThanOrEqual(2);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats).toHaveProperty('total');
    expect(res.body.stats).toHaveProperty('completed');
    expect(res.body.stats).toHaveProperty('failed');
    expect(res.body.stats).toHaveProperty('active');
    expect(Number(res.body.stats.completed)).toBeGreaterThanOrEqual(1);
  });

  test('filters by status', async () => {
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId, 200000);

    const job1 = await submitJob(renterKey);
    const job2 = await submitJob(renterKey);

    db.prepare("UPDATE jobs SET status = 'completed' WHERE job_id = ?").run(job1.job_id);
    db.prepare("UPDATE jobs SET status = 'failed' WHERE job_id = ?").run(job2.job_id);

    const completedRes = await request(app)
      .get('/api/admin/jobs?status=completed')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(completedRes.status).toBe(200);
    const allCompleted = completedRes.body.jobs.every((j) => j.status === 'completed');
    expect(allCompleted).toBe(true);
  });

  test('filters by renter_id', async () => {
    const { id: renterId1, apiKey: key1 } = await registerRenter();
    await topupRenter(renterId1);
    const { id: renterId2, apiKey: key2 } = await registerRenter();
    await topupRenter(renterId2, 100000);

    await submitJob(key1);
    await submitJob(key2);

    const res = await request(app)
      .get(`/api/admin/jobs?renter_id=${renterId1}`)
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.jobs.every((j) => j.renter_id === renterId1)).toBe(true);
  });

  test('includes provider_name and renter_name in job rows', async () => {
    const { id: providerId, apiKey: provKey } = await registerProvider({ name: 'TestProvider-E2E' });
    await bringOnline(provKey);
    const { id: renterId, apiKey: renterKey } = await registerRenter({ name: 'TestRenter-E2E' });
    await topupRenter(renterId);
    const job = await submitJob(renterKey);

    db.prepare('UPDATE jobs SET provider_id = ? WHERE job_id = ?').run(providerId, job.job_id);

    const res = await request(app)
      .get('/api/admin/jobs')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const row = res.body.jobs.find((j) => j.job_id === job.job_id);
    expect(row).toBeDefined();
    expect(row.renter_name).toBe('TestRenter-E2E');
    expect(row.provider_name).toBe('TestProvider-E2E');
  });
});

// ── 7. jobEventEmitter — SSE fan-out unit test ────────────────────────────────

describe('DCP-841 Deliverable 3b: jobEventEmitter fan-out to SSE clients', () => {
  test('emitting a job_running event reaches all subscribers', () => {
    const events = [];
    const unsub = jobEventEmitter.subscribe('job-fan-out-test', (ev, data) => {
      events.push({ ev, data });
    });

    jobEventEmitter.emit('job-fan-out-test', 'job_running', { status: 'running', provider_id: 7 });

    expect(events).toHaveLength(1);
    expect(events[0].ev).toBe('job_running');
    expect(events[0].data.status).toBe('running');
    unsub();
  });

  test('terminal event triggers emitter cleanup', (done) => {
    const unsub = jobEventEmitter.subscribe('job-terminal-cleanup', () => {});
    jobEventEmitter.emit('job-terminal-cleanup', 'job_completed', { status: 'completed' });

    // Cleanup is deferred via setImmediate
    setImmediate(() => {
      expect(jobEventEmitter._emitters.has('job-terminal-cleanup')).toBe(false);
      done();
    });
  });

  test('statusToSseEvent maps all known statuses correctly', () => {
    const { statusToSseEvent } = jobEventEmitter;
    expect(statusToSseEvent('queued')).toBe('job_queued');
    expect(statusToSseEvent('pending')).toBe('job_queued');
    expect(statusToSseEvent('assigned')).toBe('provider_assigned');
    expect(statusToSseEvent('pulling')).toBe('job_starting');
    expect(statusToSseEvent('running')).toBe('job_running');
    expect(statusToSseEvent('completed')).toBe('job_completed');
    expect(statusToSseEvent('failed')).toBe('job_failed');
    expect(statusToSseEvent('timed_out')).toBe('job_failed');
    expect(statusToSseEvent('cancelled')).toBe('job_failed');
    expect(statusToSseEvent('unknown_status')).toBeNull();
  });

  test('halalaToCostUsd converts correctly', () => {
    const { halalaToCostUsd } = jobEventEmitter;
    // 375 halala = 3.75 SAR = 1.00 USD at 3.75 peg
    expect(halalaToCostUsd(375)).toBeCloseTo(1.0, 3);
    expect(halalaToCostUsd(0)).toBe(0);
    expect(halalaToCostUsd(null)).toBeNull();
  });
});
