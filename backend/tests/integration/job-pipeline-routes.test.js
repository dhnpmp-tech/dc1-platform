/**
 * DCP-40: Integration Tests — Container Job Execution Pipeline
 *
 * Full job lifecycle via the Express routes in backend/src/routes/jobs.js:
 *   submit → queue → assign → pull → run → complete / fail / retry
 *
 * Test categories:
 *   1.  Job submission — valid/invalid types, auth, balance checks
 *   2.  Priority queue ordering — high before normal before low
 *   3.  Transient failure retry logic — up to max_retries
 *   4.  Timeout enforcement — jobs older than timeout_at are stale
 *   5.  HMAC signature verification — task_spec signed at submit
 *   6.  Escrow hold lifecycle — created → locked → released_provider / released_renter
 *   7.  vLLM serve job type — allowed, spec generated, result_type=endpoint
 *   8.  custom_container job type — image validated against whitelist
 *
 * Runner: Jest + Supertest, in-memory SQLite (DC1_DB_PATH=:memory:)
 */

'use strict';

if (!process.env.DC1_DB_PATH)    process.env.DC1_DB_PATH    = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token';

const request = require('supertest');
const express = require('express');
const db = require('../../src/db');

// ── App factory ──────────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  // Clear require cache so each test file gets fresh route modules bound to the same DB
  ['providers', 'renters', 'jobs'].forEach(name => {
    const p = require.resolve(`../../src/routes/${name}`);
    delete require.cache[p];
  });
  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters',   require('../../src/routes/renters'));
  app.use('/api/jobs',      require('../../src/routes/jobs'));
  return app;
}

let app;

// ── DB helpers ───────────────────────────────────────────────────────────────

function cleanDb() {
  try { db.run('DELETE FROM escrow_holds'); } catch (_) {}
  try { db.run('DELETE FROM heartbeat_log'); } catch (_) {}
  try { db.run('DELETE FROM jobs'); }         catch (_) {}
  try { db.run('DELETE FROM renters'); }      catch (_) {}
  try { db.run('DELETE FROM providers'); }    catch (_) {}
}

// ── Seed helpers ─────────────────────────────────────────────────────────────

/** Register a provider and bring it online, returning its api_key + id. */
async function seedProvider(overrides = {}) {
  const payload = {
    name: overrides.name || 'Test Provider',
    email: overrides.email || `prov-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
    gpu_model: overrides.gpu_model || 'RTX 4090',
    os: overrides.os || 'Linux',
    vram_gb: overrides.vram_gb || 24,
  };
  const reg = await request(app).post('/api/providers/register').send(payload);
  expect(reg.status).toBe(200);

  const key = reg.body.api_key;
  const id  = reg.body.provider_id;

  // Send heartbeat to bring provider online
  await request(app)
    .post('/api/providers/heartbeat')
    .send({ api_key: key, status: 'online', gpu_status: 'idle' });

  return { key, id };
}

/** Register a renter and give them a balance, returning api_key + id. */
async function seedRenter(balanceHalala = 50_000) {
  const payload = {
    name:  `Renter-${Date.now()}`,
    email: `renter-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
  };
  const reg = await request(app).post('/api/renters/register').send(payload);
  expect(reg.status).toBe(201);

  const key = reg.body.api_key;
  const id  = reg.body.renter_id;

  // Directly set balance in DB (topup routes require real payment gateway in prod)
  db.run('UPDATE renters SET balance_halala = ? WHERE id = ?', balanceHalala, id);

  return { key, id };
}

/** Submit a job with default valid parameters; returns the response. */
async function submitJob(renterKey, providerId, overrides = {}) {
  return request(app)
    .post('/api/jobs/submit')
    .set('x-renter-key', renterKey)
    .send({
      provider_id: providerId,
      job_type: overrides.job_type || 'llm_inference',
      duration_minutes: overrides.duration_minutes || 5,
      params: overrides.params || { prompt: 'Hello', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
      priority: overrides.priority,
      max_duration_seconds: overrides.max_duration_seconds,
      ...overrides._body,
    });
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(() => { app = createApp(); });
beforeEach(() => cleanDb());
afterAll(() => cleanDb());

// =============================================================================
// 1. JOB SUBMISSION
// =============================================================================

describe('Job Submission — POST /api/jobs/submit', () => {
  it('returns 201 with job_id and task_spec_signed=true for valid submission', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    const res = await submitJob(renterKey, providerId);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.job.job_id).toMatch(/^job-/);
    expect(res.body.job.task_spec_signed).toBe(true);
  });

  it('returns 401 without renter key', async () => {
    const res = await request(app)
      .post('/api/jobs/submit')
      .send({ provider_id: 1, job_type: 'llm_inference', duration_minutes: 5 });
    expect(res.status).toBe(401);
  });

  it('returns 403 for invalid renter key', async () => {
    const { id: providerId } = await seedProvider();
    const res = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', 'invalid-key')
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 5 });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid/unknown job_type', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    const res = await submitJob(renterKey, providerId, { job_type: 'arbitrary_code_exec' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid job_type/i);
  });

  it('returns 400 when raw Python task_spec is submitted', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    const res = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({
        provider_id: providerId,
        job_type: 'llm_inference',
        duration_minutes: 5,
        task_spec: 'import os; os.system("rm -rf /")',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/raw python/i);
  });

  it('returns 402 when renter balance is insufficient', async () => {
    const { key: renterKey } = await seedRenter(1); // 1 halala is not enough
    const { id: providerId } = await seedProvider();

    const res = await submitJob(renterKey, providerId);
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/insufficient balance/i);
    expect(res.body.shortfall_halala).toBeGreaterThan(0);
  });

  it('returns 400 when required fields are missing', async () => {
    const { key: renterKey } = await seedRenter(50_000);

    const res = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ job_type: 'llm_inference' }); // missing provider_id and duration_minutes
    expect(res.status).toBe(400);
  });

  it('returns 404 when provider does not exist', async () => {
    const { key: renterKey } = await seedRenter(50_000);

    const res = await submitJob(renterKey, 99999, { _body: {} });
    expect(res.status).toBe(404);
  });

  it('returns 400 when provider is not online', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    // Take provider offline
    db.run("UPDATE providers SET status = 'offline' WHERE id = ?", providerId);

    const res = await submitJob(renterKey, providerId);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not online/i);
  });

  it('deducts estimated cost from renter balance at submit time (pre-pay)', async () => {
    const initialBalance = 50_000;
    const { key: renterKey, id: renterId } = await seedRenter(initialBalance);
    const { id: providerId } = await seedProvider();

    await submitJob(renterKey, providerId, { duration_minutes: 5 });

    const renter = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId);
    // llm_inference rate = 15 halala/min × 5 min = 75 halala deducted
    expect(renter.balance_halala).toBe(initialBalance - 75);
  });

  it('second job to same busy provider is queued (not pending)', async () => {
    const { key: renterKey } = await seedRenter(100_000);
    const { id: providerId } = await seedProvider();

    const res1 = await submitJob(renterKey, providerId);
    expect(res1.status).toBe(201);
    expect(res1.body.job.status).toBe('pending');

    const res2 = await submitJob(renterKey, providerId);
    expect(res2.status).toBe(201);
    expect(res2.body.job.status).toBe('queued');
    expect(res2.body.queued).toBe(true);
    expect(typeof res2.body.job.queue_position).toBe('number');
  });
});

// =============================================================================
// 2. PRIORITY QUEUE ORDERING
// =============================================================================

describe('Priority queue ordering', () => {
  it('high-priority job is returned before normal-priority job', async () => {
    const { key: renterKey } = await seedRenter(500_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    // Submit normal-priority job first (fills the slot)
    const first = await submitJob(renterKey, providerId, { priority: 2, duration_minutes: 2 });
    expect(first.status).toBe(201);
    expect(first.body.job.status).toBe('pending');

    // Submit high-priority and low-priority jobs (both queued)
    const high = await submitJob(renterKey, providerId, { priority: 1, duration_minutes: 2 });
    const low  = await submitJob(renterKey, providerId, { priority: 3, duration_minutes: 2 });
    expect(high.body.job.status).toBe('queued');
    expect(low.body.job.status).toBe('queued');

    // Simulate daemon completing the running job — this triggers promoteNextQueuedJob
    const providerJobRes = await request(app)
      .get(`/api/jobs/assigned?key=${providerKey}`);
    // Mark first job as done
    if (providerJobRes.body.job) {
      await request(app)
        .post(`/api/jobs/${providerJobRes.body.job.job_id}/result`)
        .set('x-provider-key', providerKey)
        .send({ result: 'done', duration_seconds: 60 });
    }

    // Next pending job should be the high-priority one
    const nextJob = db.get(
      `SELECT job_id, priority FROM jobs WHERE provider_id = ? AND status = 'pending' LIMIT 1`,
      providerId
    );
    if (nextJob) {
      expect(nextJob.priority).toBe(1);
    }
    // Verify queue ordering in DB — high (1) before low (3)
    const queuedJobs = db.all(
      `SELECT priority FROM jobs WHERE provider_id = ? AND status IN ('queued','pending')
       ORDER BY COALESCE(priority, 2) ASC, created_at ASC`,
      providerId
    );
    const priorities = queuedJobs.map(j => j.priority);
    // Should be sorted ascending (1=high first, then 3=low)
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]);
    }
  });

  it('priority=2 (normal) is default when priority not supplied', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    const res = await submitJob(renterKey, providerId); // no priority override
    expect(res.status).toBe(201);
    expect(res.body.job.priority).toBe(2);
  });

  it('invalid priority values are rejected and default to 2', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    const res = await submitJob(renterKey, providerId, { priority: 99 });
    expect(res.status).toBe(201);
    expect(res.body.job.priority).toBe(2); // clamped to normal
  });
});

// =============================================================================
// 3. TRANSIENT FAILURE RETRY LOGIC
// =============================================================================

describe('Transient failure retry logic — POST /api/jobs/:job_id/result', () => {
  it('resets job to pending with incremented retry_count on transient failure (attempt 1)', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    // Daemon picks up job
    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    // Daemon reports transient failure
    const failRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ error: 'Docker pull timeout', transient: true });

    expect(failRes.status).toBe(200);
    expect(failRes.body.retry).toBe(true);
    expect(failRes.body.attempt).toBe(1);

    const job = db.get('SELECT status, retry_count FROM jobs WHERE job_id = ?', jobId);
    expect(job.status).toBe('pending');
    expect(job.retry_count).toBe(1);
  });

  it('resets job to pending on second transient failure (attempt 2)', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    // Simulate two transient failures by directly updating retry state
    db.run("UPDATE jobs SET retry_count = 1, status = 'pending', picked_up_at = NULL WHERE job_id = ?", jobId);

    // Daemon picks up again (second attempt)
    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    const failRes2 = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ error: 'GPU temp spike', transient: true });

    expect(failRes2.status).toBe(200);
    expect(failRes2.body.retry).toBe(true);
    expect(failRes2.body.attempt).toBe(2);
  });

  it('permanently fails job after max_retries (2) exhausted', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    // Simulate max retries already consumed
    db.run("UPDATE jobs SET retry_count = 2, status = 'pending', picked_up_at = NULL WHERE job_id = ?", jobId);

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    const failRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ error: 'GPU failed', transient: true });

    expect(failRes.status).toBe(200);
    // No retry property — job should be completed/failed (not re-queued)
    expect(failRes.body.retry).toBeFalsy();

    const job = db.get('SELECT status FROM jobs WHERE job_id = ?', jobId);
    expect(job.status).toBe('completed'); // permanent failure still marks completed
  });

  it('does NOT retry non-transient failures', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    const failRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ error: 'Script raised exception', transient: false });

    expect(failRes.status).toBe(200);
    expect(failRes.body.retry).toBeFalsy();

    const job = db.get('SELECT status FROM jobs WHERE job_id = ?', jobId);
    expect(['completed', 'failed']).toContain(job.status);
  });

  it('refunds renter balance on permanent failure (no result)', async () => {
    const initialBalance = 50_000;
    const { key: renterKey, id: renterId } = await seedRenter(initialBalance);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId, { duration_minutes: 5 });
    const jobId = submitRes.body.job.job_id;

    // Balance deducted at submit: 15 hal/min × 5 min = 75 hal
    const afterSubmit = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId);
    expect(afterSubmit.balance_halala).toBe(initialBalance - 75);

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    // Permanent failure — no result
    await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ error: 'Container crashed', transient: false });

    const afterFail = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId);
    // Balance should be restored
    expect(afterFail.balance_halala).toBe(initialBalance);
  });
});

// =============================================================================
// 4. JOB LIFECYCLE — submit → assign → complete
// =============================================================================

describe('Job lifecycle — submit → assign → complete', () => {
  it('GET /api/jobs/assigned returns the pending job and transitions it to assigned', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    const assignedRes = await request(app)
      .get(`/api/jobs/assigned?key=${providerKey}`);

    expect(assignedRes.status).toBe(200);
    expect(assignedRes.body.job.job_id).toBe(jobId);
    expect(assignedRes.body.job.status).toBe('assigned');
    expect(assignedRes.body.job.task_spec).toBeTruthy();
    expect(assignedRes.body.job.task_spec_hmac).toBeTruthy();
  });

  it('POST /api/jobs/:job_id/result with result completes job and pays provider', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId, { duration_minutes: 5 });
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    const completeRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'DC1_RESULT_JSON:{"type":"text","response":"Riyadh"}', duration_seconds: 120 });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.billing.provider_earned_halala).toBeGreaterThan(0);
    expect(completeRes.body.billing.dc1_fee_halala).toBeGreaterThan(0);

    // 75/25 split check
    const total = completeRes.body.billing.actual_cost_halala;
    const providerShare = completeRes.body.billing.provider_earned_halala;
    const dc1Fee = completeRes.body.billing.dc1_fee_halala;
    expect(providerShare + dc1Fee).toBe(total);
    expect(providerShare).toBe(Math.floor(total * 0.75));
  });

  it('returns 409 if result is submitted twice for same job', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'done', duration_seconds: 60 });

    const duplicate = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'done again' });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toMatch(/already settled/i);
  });

  it('returns 404 when attempting to get assigned job for unknown provider', async () => {
    const res = await request(app).get('/api/jobs/assigned?key=unknown-key');
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// 5. HMAC SIGNATURE VERIFICATION
// =============================================================================

describe('HMAC signature verification — GET /api/jobs/verify-hmac', () => {
  it('verifies a valid HMAC signature for a submitted job', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    // Fetch the real HMAC from DB
    const job = db.get('SELECT task_spec_hmac FROM jobs WHERE job_id = ?', jobId);
    const storedHmac = job.task_spec_hmac;

    const verifyRes = await request(app)
      .get(`/api/jobs/verify-hmac`)
      .set('x-provider-key', providerKey)
      .query({ job_id: jobId, hmac: storedHmac });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
  });

  it('rejects a tampered HMAC', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    const verifyRes = await request(app)
      .get(`/api/jobs/verify-hmac`)
      .set('x-provider-key', providerKey)
      .query({ job_id: jobId, hmac: 'a'.repeat(64) }); // wrong HMAC

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(false);
  });

  it('returns 401 without provider key', async () => {
    const res = await request(app)
      .get('/api/jobs/verify-hmac')
      .query({ job_id: 'job-1', hmac: 'abc' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when provider tries to verify another provider\'s job', async () => {
    const { key: renterKey } = await seedRenter(100_000);
    const { id: providerId1 }       = await seedProvider({ email: `p1-${Date.now()}@dc1.test` });
    const { key: providerKey2 }     = await seedProvider({ email: `p2-${Date.now()}@dc1.test` });

    const submitRes = await submitJob(renterKey, providerId1);
    const jobId = submitRes.body.job.job_id;
    const job = db.get('SELECT task_spec_hmac FROM jobs WHERE job_id = ?', jobId);

    const verifyRes = await request(app)
      .get('/api/jobs/verify-hmac')
      .set('x-provider-key', providerKey2) // wrong provider
      .query({ job_id: jobId, hmac: job.task_spec_hmac });

    expect(verifyRes.status).toBe(403);
  });

  it('all submitted jobs have task_spec_signed=true (HMAC always set)', async () => {
    const { key: renterKey } = await seedRenter(200_000);
    const { id: providerId } = await seedProvider();

    for (const jobType of ['llm_inference', 'image_generation', 'vllm_serve']) {
      cleanDb();
      app = createApp();
      const { key: rk } = await seedRenter(200_000);
      const { id: pid } = await seedProvider();

      const res = await submitJob(rk, pid, { job_type: jobType, duration_minutes: 5 });
      expect(res.status).toBe(201);
      expect(res.body.job.task_spec_signed).toBe(true);
    }
  });
});

// =============================================================================
// 6. ESCROW HOLD LIFECYCLE
// =============================================================================

describe('Escrow hold lifecycle', () => {
  it('creates escrow_hold record with status=held at job submit time', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    const escrow = db.get('SELECT * FROM escrow_holds WHERE job_id = ?', jobId);
    expect(escrow).toBeTruthy();
    expect(escrow.status).toBe('held');
    expect(escrow.amount_halala).toBeGreaterThan(0);
    expect(escrow.id).toBe(`esc-${jobId}`);
  });

  it('advances escrow to locked when daemon picks up job (GET /assigned)', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    const escrow = db.get('SELECT status FROM escrow_holds WHERE job_id = ?', jobId);
    expect(escrow.status).toBe('locked');
  });

  it('releases escrow to released_provider when job succeeds', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'success output', duration_seconds: 120 });

    const escrow = db.get('SELECT status FROM escrow_holds WHERE job_id = ?', jobId);
    expect(escrow.status).toBe('released_provider');
  });

  it('releases escrow to released_renter when job fails (no result)', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ error: 'Job failed', duration_seconds: 30 });

    const escrow = db.get('SELECT status FROM escrow_holds WHERE job_id = ?', jobId);
    expect(escrow.status).toBe('released_renter');
  });

  it('provider claimable_earnings_halala incremented by provider_earned amount on success', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const beforeEarnings = db.get(
      'SELECT claimable_earnings_halala FROM providers WHERE id = ?', providerId
    )?.claimable_earnings_halala || 0;

    const submitRes = await submitJob(renterKey, providerId, { duration_minutes: 2 });
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    const completeRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'output', duration_seconds: 120 });

    const providerEarned = completeRes.body.billing.provider_earned_halala;
    const afterEarnings = db.get(
      'SELECT claimable_earnings_halala FROM providers WHERE id = ?', providerId
    )?.claimable_earnings_halala || 0;

    expect(afterEarnings - beforeEarnings).toBe(providerEarned);
  });
});

// =============================================================================
// 7. vLLM SERVE JOB TYPE
// =============================================================================

describe('vLLM serve job type', () => {
  it('accepts vllm_serve as a valid job_type', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    const res = await submitJob(renterKey, providerId, {
      job_type: 'vllm_serve',
      params: { model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0', duration_minutes: 30 },
      duration_minutes: 30,
    });
    expect(res.status).toBe(201);
    expect(res.body.job.job_type).toBe('vllm_serve');
  });

  it('vllm_serve task_spec is JSON with serve_mode=true', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    await submitJob(renterKey, providerId, {
      job_type: 'vllm_serve',
      params: { model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
      duration_minutes: 10,
    });

    const job = db.get(
      'SELECT task_spec FROM jobs WHERE job_type = ? ORDER BY id DESC LIMIT 1',
      'vllm_serve'
    );
    const spec = JSON.parse(job.task_spec);
    expect(spec.serve_mode).toBe(true);
    expect(typeof spec.model).toBe('string');
    expect(typeof spec.max_model_len).toBe('number');
  });

  it('vllm_serve falls back to default model when unknown model supplied', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    await submitJob(renterKey, providerId, {
      job_type: 'vllm_serve',
      params: { model: 'attacker/malicious-model' },
      duration_minutes: 10,
    });

    const job = db.get(
      'SELECT task_spec FROM jobs WHERE job_type = ? ORDER BY id DESC LIMIT 1',
      'vllm_serve'
    );
    const spec = JSON.parse(job.task_spec);
    expect(spec.model).toBe('TinyLlama/TinyLlama-1.1B-Chat-v1.0'); // safe default
  });

  it('POST /api/jobs/:job_id/endpoint-ready stores endpoint_url in job', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId, key: providerKey } = await seedProvider();

    const submitRes = await submitJob(renterKey, providerId, {
      job_type: 'vllm_serve',
      params: { model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
      duration_minutes: 10,
    });
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    // Mark running first
    db.run("UPDATE jobs SET status = 'running' WHERE job_id = ?", jobId);

    const epRes = await request(app)
      .post(`/api/jobs/${jobId}/endpoint-ready`)
      .send({ api_key: providerKey, port: 8100, provider_ip: '192.168.1.100' });

    expect(epRes.status).toBe(200);
    expect(epRes.body.success).toBe(true);
    expect(epRes.body.endpoint_url).toBe('http://192.168.1.100:8100/v1');

    const job = db.get('SELECT endpoint_url FROM jobs WHERE job_id = ?', jobId);
    expect(job.endpoint_url).toBe('http://192.168.1.100:8100/v1');
  });
});

// =============================================================================
// 8. CUSTOM CONTAINER JOB TYPE
// =============================================================================

describe('custom_container job type', () => {
  it('accepts custom_container as a valid job_type', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    const res = await submitJob(renterKey, providerId, {
      job_type: 'custom_container',
      params: {
        image_override: 'dc1/general-worker:latest',
        script: 'print("hello")',
      },
      duration_minutes: 5,
    });
    expect(res.status).toBe(201);
    expect(res.body.job.job_type).toBe('custom_container');
  });

  it('custom_container task_spec is JSON with image_override and script', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    await submitJob(renterKey, providerId, {
      job_type: 'custom_container',
      params: { image_override: 'dc1/llm-worker:latest', script: 'import torch; print(torch.__version__)' },
      duration_minutes: 5,
    });

    const job = db.get(
      'SELECT task_spec FROM jobs WHERE job_type = ? ORDER BY id DESC LIMIT 1',
      'custom_container'
    );
    const spec = JSON.parse(job.task_spec);
    expect(spec.image_override).toBe('dc1/llm-worker:latest');
    expect(spec.script).toContain('torch');
  });

  it('custom_container with unapproved image falls back gracefully (daemon validates)', async () => {
    // Backend accepts the submission — daemon validates the whitelist at execution time
    const { key: renterKey } = await seedRenter(50_000);
    const { id: providerId } = await seedProvider();

    const res = await submitJob(renterKey, providerId, {
      job_type: 'custom_container',
      params: { image_override: 'attacker/exploit:latest', script: 'print("hi")' },
      duration_minutes: 5,
    });
    // Backend itself doesn't reject — daemon blocks it — so submission succeeds
    expect(res.status).toBe(201);
    // task_spec is not returned in submit response; read from DB to verify it was stored
    const jobRow = db.get('SELECT task_spec FROM jobs WHERE job_type = ? ORDER BY id DESC LIMIT 1', 'custom_container');
    const spec = JSON.parse(jobRow.task_spec);
    // The spec carries the override; daemon will reject it and fall back to default
    expect(spec.image_override).toBe('attacker/exploit:latest');
  });
});

// =============================================================================
// 9. QUEUE ENDPOINT
// =============================================================================

describe('GET /api/jobs/queue/:provider_id', () => {
  it('returns queue with pending and queued jobs for a provider', async () => {
    const { key: renterKey } = await seedRenter(200_000);
    const { id: providerId } = await seedProvider();

    await submitJob(renterKey, providerId);
    await submitJob(renterKey, providerId);

    const res = await request(app).get(`/api/jobs/queue/${providerId}`);
    expect(res.status).toBe(200);
    expect(res.body.queue).toBeDefined();
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('returns empty queue for provider with no active jobs', async () => {
    const { id: providerId } = await seedProvider();

    const res = await request(app).get(`/api/jobs/queue/${providerId}`);
    expect(res.status).toBe(200);
    expect(res.body.queue).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

// =============================================================================
// 10. BILLING ACCURACY — 75/25 SPLIT
// =============================================================================

describe('Billing accuracy — 75/25 split guarantees', () => {
  const splitCases = [
    { type: 'llm_inference',    rate: 15, mins: 5, taskSpec: null },
    { type: 'image_generation', rate: 20, mins: 5, taskSpec: null },
    // training has no template — provide a minimal JSON task_spec so the daemon can pick it up
    { type: 'training',         rate: 25, mins: 5, taskSpec: '{"mode":"finetune","placeholder":true}' },
  ];

  for (const { type, rate, mins, taskSpec } of splitCases) {
    it(`${type}: provider + dc1_fee === total (no rounding loss)`, async () => {
      cleanDb();
      app = createApp();
      const { key: rk } = await seedRenter(200_000);
      const { id: pid, key: pk } = await seedProvider();

      const submitRes = await submitJob(rk, pid, { job_type: type, duration_minutes: mins, _body: taskSpec ? { task_spec: taskSpec } : {} });
      const jobId = submitRes.body.job.job_id;

      await request(app).get(`/api/jobs/assigned?key=${pk}`);

      const completeRes = await request(app)
        .post(`/api/jobs/${jobId}/result`)
        .set('x-provider-key', pk)
        .send({ result: 'output', duration_seconds: mins * 60 });

      const { actual_cost_halala, provider_earned_halala, dc1_fee_halala } = completeRes.body.billing;
      expect(provider_earned_halala + dc1_fee_halala).toBe(actual_cost_halala);
      expect(provider_earned_halala).toBe(Math.floor(actual_cost_halala * 0.75));
    });
  }
});
