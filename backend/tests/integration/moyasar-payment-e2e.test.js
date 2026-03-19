/**
 * DCP-213: Pre-write Moyasar E2E test flow (do not run in CI yet).
 *
 * This suite targets a live backend at http://localhost:8083 and is intentionally
 * gated by env vars so it skips cleanly until VPS payment secrets are configured.
 */

'use strict';

const crypto = require('crypto');
const supertest = require('supertest');

const BASE_URL = process.env.DCP_E2E_BASE_URL || 'http://localhost:8083';
const api = supertest(BASE_URL);

const HAS_MOYASAR_SECRET = Boolean(process.env.MOYASAR_SECRET_KEY);
const HAS_WEBHOOK_SECRET = Boolean(process.env.MOYASAR_WEBHOOK_SECRET);
const HAS_ADMIN_TOKEN = Boolean(process.env.DC1_ADMIN_TOKEN);

let renterKey;
let renterId;
let providerKey;
let providerId;
let initialBalanceHalala = 0;
let paymentId;
let submittedJobId;

beforeAll(async () => {
  const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const renterRes = await api
    .post('/api/renters/register')
    .send({
      name: `Moyasar E2E Renter ${uniq}`,
      email: `moyasar-e2e-renter-${uniq}@dc1.test`,
      organization: 'DCP E2E',
    });

  expect(renterRes.status).toBe(201);
  renterKey = renterRes.body.api_key;
  renterId = renterRes.body.renter_id;

  const providerRes = await api
    .post('/api/providers/register')
    .send({
      name: `Moyasar E2E Provider ${uniq}`,
      email: `moyasar-e2e-provider-${uniq}@dc1.test`,
      gpu_model: 'RTX 4090',
      os: 'Linux',
      phone: '+966500000000',
    });

  expect(providerRes.status).toBe(201);
  providerKey = providerRes.body.api_key;
  providerId = providerRes.body.provider_id;

  // Bring provider online so job submission can target it deterministically.
  const heartbeatRes = await api
    .post('/api/providers/heartbeat')
    .send({
      api_key: providerKey,
      uptime: 120,
      provider_ip: '127.0.0.1',
      provider_hostname: 'moyasar-e2e-host',
      gpu_status: { temp: 41, utilization: 5, memory_used_mb: 512 },
    });

  expect([200, 201]).toContain(heartbeatRes.status);

  const meRes = await api.get(`/api/renters/me?key=${encodeURIComponent(renterKey)}`);
  expect(meRes.status).toBe(200);
  initialBalanceHalala = Number(meRes.body?.renter?.balance_halala || 0);
});

describe('Moyasar payment E2E (pre-written, env-gated)', () => {
  if (!HAS_MOYASAR_SECRET) {
    test.skip('skips all payment E2E tests when MOYASAR_SECRET_KEY is not set', () => {});
    return;
  }

  test('1) POST /api/payments/topup with amount_halala=5000 returns payment_id and checkout_url', async () => {
    // Current API contract accepts amount_sar; keep amount_halala in payload to match issue wording.
    const topupRes = await api
      .post('/api/payments/topup')
      .set('x-renter-key', renterKey)
      .send({
        amount_halala: 5000,
        amount_sar: 50,
        source_type: 'mada',
      });

    expect(topupRes.status).toBe(200);
    expect(topupRes.body).toEqual(
      expect.objectContaining({
        payment_id: expect.any(String),
        checkout_url: expect.anything(),
      })
    );

    paymentId = topupRes.body.payment_id;
  });

  if (!HAS_WEBHOOK_SECRET) {
    test.skip('2) skips webhook simulation when MOYASAR_WEBHOOK_SECRET is not set', () => {});
    test.skip('3) skips renter balance verification because webhook credit cannot run', () => {});
    test.skip('4) skips job submit dependent on verified top-up credit', () => {});
    test.skip('5) skips admin escrow verification because no job was submitted', () => {});
    return;
  }

  test('2) POST /api/payments/webhook with HMAC signed status=paid payload returns 200', async () => {
    const payload = JSON.stringify({
      id: paymentId,
      status: 'paid',
      amount: 5000,
      currency: 'SAR',
      metadata: { renter_id: renterId },
    });

    const signature = crypto
      .createHmac('sha256', process.env.MOYASAR_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    const webhookRes = await api
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-moyasar-signature', signature)
      .send(payload);

    expect(webhookRes.status).toBe(200);
  });

  test('3) GET /api/renters/me shows balance_halala increased by at least 5000', async () => {
    const renterMeRes = await api.get(`/api/renters/me?key=${encodeURIComponent(renterKey)}`);
    expect(renterMeRes.status).toBe(200);

    const updatedBalance = Number(renterMeRes.body?.renter?.balance_halala || 0);
    expect(updatedBalance).toBeGreaterThanOrEqual(initialBalanceHalala + 5000);
  });

  test('4) POST /api/jobs/submit with valid resource_spec succeeds', async () => {
    const submitRes = await api
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({
        provider_id: providerId,
        job_type: 'llm_inference',
        duration_minutes: 1,
        // resource_spec requested in issue; route currently uses gpu_requirements.
        resource_spec: { min_vram_gb: 8 },
        gpu_requirements: { min_vram_gb: 8 },
        params: {
          prompt: 'Return one word: ready',
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          max_tokens: 16,
        },
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body?.success).toBe(true);
    expect(submitRes.body?.job?.job_id).toEqual(expect.any(String));

    submittedJobId = submitRes.body.job.job_id;
  });

  if (!HAS_ADMIN_TOKEN) {
    test.skip('5) skips admin escrow verification when DC1_ADMIN_TOKEN is not set', () => {});
    return;
  }

  test('5) GET /api/admin/escrow shows a pending hold for submitted job', async () => {
    const escrowRes = await api
      .get('/api/admin/escrow?limit=100')
      .set('x-admin-token', process.env.DC1_ADMIN_TOKEN);

    expect(escrowRes.status).toBe(200);
    expect(Array.isArray(escrowRes.body?.holds)).toBe(true);

    const matchingHold = escrowRes.body.holds.find((h) => h.job_id === submittedJobId);
    expect(matchingHold).toBeDefined();
    expect(['held', 'locked']).toContain(matchingHold.status);
  });
});
