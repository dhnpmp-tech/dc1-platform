'use strict';

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token-jest';

const request = require('supertest');
const express = require('express');
const db = require('../../src/db');

const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN;

function createApp() {
  const app = express();
  app.use(express.json());

  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters', require('../../src/routes/renters'));
  app.use('/api/jobs', require('../../src/routes/jobs'));
  app.use('/api/vllm', require('../../src/routes/vllm'));
  app.use('/api/containers', require('../../src/routes/containers'));
  app.use('/api/admin', require('../../src/routes/admin'));

  return app;
}

const app = createApp();

function safeDelete(table) {
  try {
    db.prepare(`DELETE FROM ${table}`).run();
  } catch (_) {
    // Table may not exist in older schema snapshots.
  }
}

function cleanDb() {
  safeDelete('escrow_holds');
  safeDelete('job_executions');
  safeDelete('jobs');
  safeDelete('withdrawal_requests');
  safeDelete('approved_container_images');
  safeDelete('image_scans');
  safeDelete('allowed_images');
  safeDelete('heartbeat_log');
  safeDelete('renters');
  safeDelete('providers');
}

async function createProvider(overrides = {}) {
  const payload = {
    name: overrides.name || 'Smoke Provider',
    email: overrides.email || `provider-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
    gpu_model: overrides.gpu_model || 'RTX 4090',
    os: overrides.os || 'linux',
  };

  const res = await request(app).post('/api/providers/register').send(payload);
  if (res.status !== 200 || !res.body?.api_key) {
    throw new Error(`Provider registration failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    id: res.body.provider_id,
    apiKey: res.body.api_key,
    email: payload.email,
  };
}

async function createRenter(overrides = {}) {
  const payload = {
    name: overrides.name || 'Smoke Renter',
    email: overrides.email || `renter-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
  };

  const res = await request(app).post('/api/renters/register').send(payload);
  if (res.status !== 201 || !res.body?.api_key) {
    throw new Error(`Renter registration failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  if (overrides.balance_halala != null) {
    db.prepare('UPDATE renters SET balance_halala = ? WHERE id = ?').run(overrides.balance_halala, res.body.renter_id);
  }

  return {
    id: res.body.renter_id,
    apiKey: res.body.api_key,
    email: payload.email,
  };
}

function insertJob(overrides = {}) {
  const now = new Date().toISOString();
  const jobId = overrides.job_id || `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const result = db.prepare(
    `INSERT INTO jobs (
      job_id, provider_id, renter_id, job_type, model, status,
      submitted_at, created_at, updated_at, duration_minutes, cost_halala,
      container_spec, task_spec, max_duration_seconds, notes, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    jobId,
    overrides.provider_id ?? null,
    overrides.renter_id ?? null,
    overrides.job_type || 'llm_inference',
    overrides.model || 'mistralai/Mistral-7B-Instruct-v0.2',
    overrides.status || 'failed',
    overrides.submitted_at || now,
    now,
    now,
    overrides.duration_minutes ?? 5,
    overrides.cost_halala ?? 100,
    overrides.container_spec || JSON.stringify({ image_type: 'pytorch-cuda', gpu_count: 1, vram_required_mb: 4096, compute_type: 'inference' }),
    overrides.task_spec || 'print("retry")',
    overrides.max_duration_seconds ?? 1800,
    overrides.notes || 'smoke test job',
    overrides.priority ?? 5
  );

  return {
    id: result.lastInsertRowid,
    job_id: jobId,
  };
}

async function waitFor(predicate, { timeoutMs = 5000, intervalMs = 50 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

beforeEach(() => {
  cleanDb();
});

afterAll(() => {
  cleanDb();
});

describe('Sprint 19-20 smoke: provider withdrawal flow', () => {
  test('creates withdrawal request, blocks duplicate pending, admin transition processing -> failed restores claimable', async () => {
    const provider = await createProvider();
    db.prepare(
      `UPDATE providers
       SET approval_status = 'approved',
           claimable_earnings_halala = 9000,
           status = 'online',
           last_heartbeat = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(new Date().toISOString(), new Date().toISOString(), provider.id);

    const createRes = await request(app)
      .post(`/api/providers/me/withdraw?key=${provider.apiKey}`)
      .send({ amount_halala: 3000, iban: 'SA1234567890123456789012' });

    expect([200, 201]).toContain(createRes.status);
    expect(createRes.body.withdrawal_request?.id).toBeDefined();

    const duplicateRes = await request(app)
      .post(`/api/providers/me/withdraw?key=${provider.apiKey}`)
      .send({ amount_halala: 2000, iban: 'SA1234567890123456789012' });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error).toMatch(/pending withdrawal request/i);

    const withdrawalId = createRes.body.withdrawal_request.id;

    const processingRes = await request(app)
      .patch(`/api/admin/withdrawals/${withdrawalId}`)
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ status: 'processing', admin_note: 'queued for payout' });

    expect(processingRes.status).toBe(200);
    expect(processingRes.body.withdrawal_request.status).toBe('processing');

    const failedRes = await request(app)
      .patch(`/api/admin/withdrawals/${withdrawalId}`)
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ status: 'failed', admin_note: 'bank transfer rejected' });

    expect(failedRes.status).toBe(200);
    expect(failedRes.body.withdrawal_request.status).toBe('failed');

    const providerRow = db.prepare('SELECT claimable_earnings_halala FROM providers WHERE id = ?').get(provider.id);
    expect(providerRow.claimable_earnings_halala).toBe(9000);
  });
});

describe('Sprint 19-20 smoke: manual job retry', () => {
  test('retries failed job and returns new job id', async () => {
    const renter = await createRenter({ balance_halala: 5000 });
    const source = insertJob({
      renter_id: renter.id,
      status: 'failed',
      duration_minutes: 2,
      job_type: 'llm_inference',
    });

    const retryRes = await request(app)
      .post(`/api/jobs/${source.job_id}/retry?key=${renter.apiKey}`)
      .send({});

    expect([200, 201]).toContain(retryRes.status);
    expect(retryRes.body.job?.job_id).toBeDefined();
    expect(retryRes.body.job?.job_id).not.toBe(source.job_id);
  });

  test('rejects retry when source job is not failed', async () => {
    const renter = await createRenter({ balance_halala: 5000 });
    const source = insertJob({
      renter_id: renter.id,
      status: 'completed',
      duration_minutes: 2,
      job_type: 'llm_inference',
    });

    const retryRes = await request(app)
      .post(`/api/jobs/${source.job_id}/retry?key=${renter.apiKey}`)
      .send({});

    expect(retryRes.status).toBe(400);
    expect(retryRes.body.error).toMatch(/only failed jobs can be retried/i);
  });

  test('returns 402 with required_halala when renter balance is insufficient', async () => {
    const renter = await createRenter({ balance_halala: 0 });
    const source = insertJob({
      renter_id: renter.id,
      status: 'failed',
      duration_minutes: 120,
      job_type: 'llm_inference',
    });

    const retryRes = await request(app)
      .post(`/api/jobs/${source.job_id}/retry?key=${renter.apiKey}`)
      .send({});

    expect(retryRes.status).toBe(402);
    expect(typeof retryRes.body.required_halala).toBe('number');
    expect(retryRes.body.required_halala).toBeGreaterThan(0);
  });
});

describe('Sprint 19-20 smoke: vLLM completion', () => {
  test('fails fast with 503 + diagnostics when no capable providers are online', async () => {
    const renter = await createRenter({ balance_halala: 20000 });

    const res = await request(app)
      .post(`/api/vllm/complete?key=${renter.apiKey}`)
      .send({
        model: 'mistralai/Mistral-7B-Instruct-v0.2',
        messages: [{ role: 'user', content: 'Capacity check' }],
        max_tokens: 16,
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('no_capacity');
    expect(res.body.diagnostics).toEqual(expect.objectContaining({
      model_id: expect.any(String),
      min_vram_gb: expect.any(Number),
      capable_providers: 0,
      queued_vllm_jobs: expect.any(Number),
    }));
  });

  test('completes with valid model+prompt and returns choices[0].message.content', async () => {
    const renter = await createRenter({ balance_halala: 20000 });
    const provider = await createProvider({ gpu_model: 'RTX 4090' });

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE providers
       SET approval_status = 'approved',
           status = 'online',
           is_paused = 0,
           last_heartbeat = ?,
           supported_compute_types = ?,
           vram_mb = ?,
           gpu_vram_mb = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(now, JSON.stringify(['inference']), 24576, 24576, now, provider.id);

    // Attach handlers immediately so the Supertest request starts now (not only when awaited later).
    const responsePromise = request(app)
      .post(`/api/vllm/complete?key=${renter.apiKey}`)
      .send({
        model: 'mistralai/Mistral-7B-Instruct-v0.2',
        messages: [{ role: 'user', content: 'Say hello from smoke test.' }],
        max_tokens: 32,
      })
      .then((response) => response);

    const pendingJob = await waitFor(() => db.prepare(
      `SELECT id, job_id
       FROM jobs
       WHERE renter_id = ? AND job_type = 'vllm' AND status = 'pending'
       ORDER BY id DESC
       LIMIT 1`
    ).get(renter.id));

    expect(pendingJob).toBeTruthy();

    db.prepare(
      `UPDATE jobs
       SET status = 'completed',
           result = ?,
           completed_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      'DC1_RESULT_JSON:{"type":"text","response":"Smoke completion ok","tokens_generated":3}',
      new Date().toISOString(),
      new Date().toISOString(),
      pendingJob.id
    );

    const res = await responsePromise;
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.choices)).toBe(true);
    expect(typeof res.body.choices[0]?.message?.content).toBe('string');
  });

  test('rate limits on request 11 and returns Retry-After header', async () => {
    const renter = await createRenter({ balance_halala: 5000 });

    let eleventh;
    for (let i = 0; i < 11; i += 1) {
      const res = await request(app)
        .post(`/api/vllm/complete?key=${renter.apiKey}`)
        .send({ messages: [{ role: 'user', content: 'missing model to keep request fast' }] });
      if (i === 10) eleventh = res;
    }

    expect(eleventh.status).toBe(429);
    expect(eleventh.headers['retry-after']).toBeDefined();
  });
});

describe('Sprint 19-20 smoke: container registry and public marketplace', () => {
  test('returns container registry with template images including pytorch-cuda', async () => {
    const res = await request(app).get('/api/containers/registry');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.images)).toBe(true);
    expect(res.body.images.some((img) => String(img.image_ref || '').includes('pytorch'))).toBe(true);
  });

  test('admin approve-image validates invalid image format', async () => {
    const res = await request(app)
      .post('/api/admin/containers/approve-image')
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ image_ref: 'NOT A VALID IMAGE REF' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid|must/i);
  });

  test('public providers endpoint responds without auth and returns gpu listing payload', async () => {
    const provider = await createProvider({ gpu_model: 'NVIDIA RTX 4090' });
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE providers
       SET approval_status = 'approved',
           status = 'online',
           is_paused = 0,
           last_heartbeat = ?,
           gpu_model = ?,
           gpu_name_detected = ?,
           gpu_vram_mib = ?,
           gpu_count = ?,
           supported_compute_types = ?,
           cost_per_gpu_second_halala = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      now,
      'NVIDIA RTX 4090',
      'NVIDIA RTX 4090',
      24576,
      1,
      JSON.stringify(['inference', 'training']),
      1,
      now,
      provider.id
    );

    const res = await request(app).get('/api/providers/public');

    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBeDefined();
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toEqual(expect.objectContaining({
      gpu_model: expect.any(String),
      cost_per_hour_sar: expect.any(Number),
    }));
  });
});
