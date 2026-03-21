/**
 * E2E Job Flow — full lifecycle: register → heartbeat → submit → execute → complete → billing
 *
 * Updated for current API: job submission requires x-renter-key auth (DCP-2).
 * The full daemon-driven flow (submit→assigned→result) is covered in
 * job-pipeline-routes.test.js. These E2E tests verify the higher-level contracts
 * across provider + renter + job APIs.
 */
const request = require('supertest');
const { createApp } = require('./test-app');
const { cleanDb, registerProvider, registerRenter, bringOnline, db } = require('./helpers');
const { enforceJobTimeouts } = require('../../src/routes/jobs');

const app = createApp();

beforeEach(() => cleanDb());

describe('E2E Job Flow', () => {
  it('full lifecycle: register → heartbeat → submit → assign → result → billing', async () => {
    // 1. Register provider and bring online
    const { apiKey: providerKey, providerId } = await registerProvider(request, app);
    await bringOnline(request, app, providerKey);

    const provider = db.get('SELECT * FROM providers WHERE id = ?', providerId);
    expect(provider.status).toBe('online');

    // 2. Register renter with sufficient balance
    const { apiKey: renterKey, renterId } = await registerRenter(request, app, { balanceHalala: 50_000 });

    // 3. Submit a job (requires x-renter-key)
    const jobRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({
        provider_id: providerId,
        job_type: 'llm_inference',
        duration_minutes: 10,
        params: { prompt: 'Hello', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
      });
    expect(jobRes.status).toBe(201);
    expect(jobRes.body.success).toBe(true);
    expect(jobRes.body.job.status).toBe('pending');
    expect(jobRes.body.job.cost_halala).toBe(150); // 15 halala/min × 10 min

    const jobId = jobRes.body.job.job_id;

    // Verify balance was deducted at submit (pre-pay)
    const renterAfterSubmit = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId);
    expect(renterAfterSubmit.balance_halala).toBe(50_000 - 150);

    // 4. Provider daemon picks up job (GET /assigned)
    const assignedRes = await request(app).get(`/api/jobs/assigned?key=${providerKey}`);
    expect(assignedRes.status).toBe(200);
    expect(assignedRes.body.job.job_id).toBe(jobId);
    expect(assignedRes.body.job.status).toBe('assigned');

    // 5. Provider submits result (marks job completed)
    const resultRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'Hello, world!', duration_seconds: 600 });
    expect(resultRes.status).toBe(200);
    expect(resultRes.body.success).toBe(true);

    // 6. Verify billing — provider credited 75%
    const billing = resultRes.body.billing;
    expect(billing.provider_earned_halala).toBeGreaterThan(0);
    expect(billing.dc1_fee_halala).toBeGreaterThan(0);
    expect(billing.provider_earned_halala + billing.dc1_fee_halala).toBe(billing.actual_cost_halala);

    const updatedProvider = db.get('SELECT * FROM providers WHERE id = ?', providerId);
    expect(updatedProvider.total_jobs).toBe(1);
    expect(updatedProvider.claimable_earnings_halala).toBeGreaterThan(0);

    // 7. Verify job record is completed
    const completedJob = db.get('SELECT * FROM jobs WHERE job_id = ?', jobId);
    expect(completedJob.status).toBe('completed');
    expect(completedJob.completed_at).toBeDefined();
  });

  it('rejects job submission to offline provider', async () => {
    const { providerId } = await registerProvider(request, app);
    // Don't send heartbeat — provider stays 'registered', not 'online'
    const { apiKey: renterKey } = await registerRenter(request, app, { balanceHalala: 50_000 });

    const res = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ provider_id: providerId, job_type: 'training', duration_minutes: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not online/i);
  });

  it('rejects job submission without renter key (401)', async () => {
    const { providerId } = await registerProvider(request, app);
    await bringOnline(request, app, (await registerProvider(request, app)).apiKey);

    const res = await request(app)
      .post('/api/jobs/submit')
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 5 });
    expect(res.status).toBe(401);
  });

  it('rejects duplicate result submission for same job (409)', async () => {
    const { apiKey: providerKey, providerId } = await registerProvider(request, app);
    await bringOnline(request, app, providerKey);
    const { apiKey: renterKey } = await registerRenter(request, app, { balanceHalala: 50_000 });

    const jobRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({
        provider_id: providerId,
        job_type: 'llm_inference',
        duration_minutes: 5,
        params: { prompt: 'test', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
      });
    const jobId = jobRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);
    await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'done', duration_seconds: 60 });

    // Second result → 409
    const dup = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'done again' });
    expect(dup.status).toBe(409);
  });

  it('times out overdue jobs and refunds renter + releases escrow to renter', async () => {
    const { apiKey: providerKey, providerId } = await registerProvider(request, app);
    await bringOnline(request, app, providerKey);
    const { apiKey: renterKey, renterId } = await registerRenter(request, app, { balanceHalala: 50_000 });

    const submit = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({
        provider_id: providerId,
        job_type: 'llm_inference',
        duration_minutes: 5,
        max_duration_seconds: 1,
        params: { prompt: 'timeout test', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
      });
    expect(submit.status).toBe(201);
    const jobId = submit.body.job.job_id;

    // Move job to assigned/locked state so timeout path covers execution-stage jobs too.
    const assigned = await request(app).get(`/api/jobs/assigned?key=${providerKey}`);
    expect(assigned.status).toBe(200);
    expect(assigned.body.job.job_id).toBe(jobId);

    // Force timeout to be overdue, then trigger enforcer directly.
    db.run(`UPDATE jobs SET timeout_at = datetime('now', '-2 minutes') WHERE job_id = ?`, jobId);
    const timedOutCount = enforceJobTimeouts();
    expect(timedOutCount).toBeGreaterThanOrEqual(1);

    const timedOutJob = db.get('SELECT status, refunded_at FROM jobs WHERE job_id = ?', jobId);
    expect(timedOutJob.status).toBe('failed');
    expect(timedOutJob.refunded_at).toBeDefined();

    const renterAfter = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId);
    expect(renterAfter.balance_halala).toBe(50_000);

    const escrow = db.get('SELECT status FROM escrow_holds WHERE job_id = ?', jobId);
    expect(escrow.status).toBe('released_renter');
  });
});
