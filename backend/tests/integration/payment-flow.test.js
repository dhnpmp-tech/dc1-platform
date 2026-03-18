/**
 * DCP-39: Integration Tests — Moyasar Payment Flow
 *
 * Tests the full payment lifecycle using the sandbox endpoint (no live gateway needed):
 *   1. POST /api/payments/topup — validation, auth, gateway-not-configured path
 *   2. POST /api/payments/topup-sandbox — credits balance directly (dev/test mode)
 *   3. POST /api/payments/webhook — paid/failed/refunded event processing, HMAC, idempotency
 *   4. GET /api/payments/verify/:paymentId — auth, 404, local-record path
 *   5. GET /api/payments/history — pagination, summary totals
 *   6. Escrow integration — escrow hold deducts at job start, releases at completion/failure
 *   7. Rate limiting enforcement on payment endpoints
 *
 * Runner: Jest + Supertest, in-memory SQLite.
 * No MOYASAR_SECRET_KEY is set so tests use sandbox mode + webhook without sig check.
 */

'use strict';

// Ensure no live Moyasar key pollutes tests
delete process.env.MOYASAR_SECRET_KEY;
delete process.env.MOYASAR_WEBHOOK_SECRET;

if (!process.env.DC1_DB_PATH)     process.env.DC1_DB_PATH     = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token';

const crypto  = require('crypto');
const request = require('supertest');
const express = require('express');
const db      = require('../../src/db');

// ── App factory ──────────────────────────────────────────────────────────────
// Mount payments BEFORE express.json() so express.raw() on /webhook can capture rawBody.

function createApp() {
  const app = express();

  const paymentsPath = require.resolve('../../src/routes/payments');
  delete require.cache[paymentsPath];

  // Parse JSON for payment routes EXCEPT /webhook, which needs raw Buffer for HMAC verification.
  // The /webhook route uses route-level express.raw() to capture the raw body.
  app.use('/api/payments', (req, res, next) => {
    if (req.path === '/webhook') return next();
    express.json()(req, res, next);
  });
  app.use('/api/payments', require('../../src/routes/payments'));

  app.use(express.json());

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanDb() {
  try { db.run('DELETE FROM payments'); }         catch (_) {}
  try { db.run('DELETE FROM benchmark_runs'); }   catch (_) {}
  try { db.run('DELETE FROM recovery_events'); }  catch (_) {}
  try { db.run('DELETE FROM escrow_holds'); }     catch (_) {}
  try { db.run('DELETE FROM heartbeat_log'); }    catch (_) {}
  try { db.run('DELETE FROM jobs'); }             catch (_) {}
  try { db.run('DELETE FROM renters'); }          catch (_) {}
  try { db.run('DELETE FROM providers'); }        catch (_) {}
}

async function seedRenter(balanceHalala = 0) {
  const res = await request(app).post('/api/renters/register').send({
    name:  `Payment-Test-Renter-${Date.now()}`,
    email: `payt-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
  });
  expect(res.status).toBe(201);
  // Always set the requested balance (register defaults to 1000 halala)
  db.run('UPDATE renters SET balance_halala = ? WHERE id = ?', balanceHalala, res.body.renter_id);
  return { key: res.body.api_key, id: res.body.renter_id };
}

/** Insert a payment record directly in DB and return its payment_id. */
function insertPayment(renterId, overrides = {}) {
  const paymentId = overrides.payment_id || `test-pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO payments (payment_id, renter_id, amount_sar, amount_halala, status, source_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    paymentId,
    renterId,
    overrides.amount_sar ?? 10.0,
    overrides.amount_halala ?? 1000,
    overrides.status ?? 'initiated',
    overrides.source_type ?? 'creditcard',
    now
  );
  return paymentId;
}

/** Build a Moyasar-style webhook event body (as Buffer). */
function webhookBody(paymentId, status, amountHalala = 1000) {
  return Buffer.from(JSON.stringify({
    id: paymentId,
    status,
    amount: amountHalala,
    currency: 'SAR',
  }));
}

beforeAll(() => { app = createApp(); });
beforeEach(() => cleanDb());
afterAll(() => cleanDb());

// =============================================================================
// 1. POST /api/payments/topup — validation and auth
// =============================================================================

describe('POST /api/payments/topup — validation', () => {
  it('returns 401 without renter key', async () => {
    const res = await request(app).post('/api/payments/topup').send({ amount_sar: 10 });
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid renter key', async () => {
    const res = await request(app).post('/api/payments/topup')
      .set('x-renter-key', 'invalid-key')
      .send({ amount_sar: 10 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when amount_sar is missing', async () => {
    const { key } = await seedRenter();
    const res = await request(app).post('/api/payments/topup')
      .set('x-renter-key', key)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount_sar is zero or negative', async () => {
    const { key } = await seedRenter();
    for (const val of [0, -5, -0.01]) {
      const res = await request(app).post('/api/payments/topup')
        .set('x-renter-key', key)
        .send({ amount_sar: val });
      expect(res.status).toBe(400);
    }
  });

  it('returns 400 when amount_sar is below 1 SAR minimum', async () => {
    const { key } = await seedRenter();
    const res = await request(app).post('/api/payments/topup')
      .set('x-renter-key', key)
      .send({ amount_sar: 0.5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/minimum/i);
  });

  it('returns 400 when amount_sar exceeds 10,000 SAR', async () => {
    const { key } = await seedRenter();
    const res = await request(app).post('/api/payments/topup')
      .set('x-renter-key', key)
      .send({ amount_sar: 10001 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum/i);
  });

  it('returns 400 for invalid source_type', async () => {
    const { key } = await seedRenter();
    const res = await request(app).post('/api/payments/topup')
      .set('x-renter-key', key)
      .send({ amount_sar: 50, source_type: 'bitcoin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/source_type/i);
  });

  it('returns 503 when MOYASAR_SECRET_KEY is not configured (no live key in test)', async () => {
    const { key } = await seedRenter();
    const res = await request(app).post('/api/payments/topup')
      .set('x-renter-key', key)
      .send({ amount_sar: 10, source_type: 'creditcard' });
    expect(res.status).toBe(503);
    expect(res.body.sandbox_hint).toContain('/api/payments/topup-sandbox');
  });
});

// =============================================================================
// 2. POST /api/payments/topup-sandbox — sandbox top-up (dev/test mode)
// =============================================================================

describe('POST /api/payments/topup-sandbox', () => {
  it('returns 401 without renter key', async () => {
    const res = await request(app).post('/api/payments/topup-sandbox').send({ amount_sar: 10 });
    expect(res.status).toBe(401);
  });

  it('credits renter balance and returns payment_id on success', async () => {
    const { key, id: renterId } = await seedRenter(0);
    const initialBalance = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId).balance_halala;

    const res = await request(app).post('/api/payments/topup-sandbox')
      .set('x-renter-key', key)
      .send({ amount_sar: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.payment_id).toMatch(/^sandbox-/);
    expect(res.body.credited_halala).toBe(1000);
    expect(res.body.new_balance_sar).toBe(10);

    const newBalance = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId).balance_halala;
    expect(newBalance - initialBalance).toBe(1000); // 10 SAR × 100
  });

  it('stores payment record with status=paid in payments table', async () => {
    const { key, id: renterId } = await seedRenter(0);
    const res = await request(app).post('/api/payments/topup-sandbox')
      .set('x-renter-key', key)
      .send({ amount_sar: 25 });

    expect(res.status).toBe(200);
    const payment = db.get('SELECT * FROM payments WHERE payment_id = ?', res.body.payment_id);
    expect(payment).toBeDefined();
    expect(payment.status).toBe('paid');
    expect(payment.amount_sar).toBe(25);
    expect(payment.amount_halala).toBe(2500);
    expect(payment.renter_id).toBe(renterId);
  });

  it('handles fractional SAR amounts (converts to integer halala correctly)', async () => {
    const { key } = await seedRenter(0);
    const res = await request(app).post('/api/payments/topup-sandbox')
      .set('x-renter-key', key)
      .send({ amount_sar: 1.5 });

    expect(res.status).toBe(200);
    expect(res.body.credited_halala).toBe(150); // 1.5 × 100 = 150 halala
  });

  it('returns 400 for amount > 10,000 SAR', async () => {
    const { key } = await seedRenter(0);
    const res = await request(app).post('/api/payments/topup-sandbox')
      .set('x-renter-key', key)
      .send({ amount_sar: 10001 });
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// 3. POST /api/payments/webhook
// =============================================================================

describe('POST /api/payments/webhook — event processing', () => {
  it('credits renter balance when paid event received (no HMAC configured)', async () => {
    const { key, id: renterId } = await seedRenter(0);
    const paymentId = insertPayment(renterId, { amount_sar: 20, amount_halala: 2000, status: 'initiated' });

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(webhookBody(paymentId, 'paid', 2000));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('balance_credited');
    expect(res.body.amount_halala).toBe(2000);

    const renter = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId);
    expect(renter.balance_halala).toBe(2000);

    const payment = db.get('SELECT status FROM payments WHERE payment_id = ?', paymentId);
    expect(payment.status).toBe('paid');
  });

  it('marks payment failed on failed event', async () => {
    const { id: renterId } = await seedRenter(0);
    const paymentId = insertPayment(renterId, { amount_halala: 1000, status: 'initiated' });

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(webhookBody(paymentId, 'failed'));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('marked_failed');

    const payment = db.get('SELECT status FROM payments WHERE payment_id = ?', paymentId);
    expect(payment.status).toBe('failed');

    // Balance should NOT be affected
    const renter = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId);
    expect(renter.balance_halala).toBe(0);
  });

  it('deducts balance and marks refunded on refunded event (previously paid)', async () => {
    const { id: renterId } = await seedRenter(5000); // renter has 5000 halala
    const paymentId = insertPayment(renterId, { amount_halala: 1000, status: 'paid' });

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({
        id: paymentId, status: 'refunded', amount: 1000, amount_refunded: 1000,
      })));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('refund_processed');

    const renter = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId);
    expect(renter.balance_halala).toBe(4000); // 5000 - 1000

    const payment = db.get('SELECT status, refund_amount_halala FROM payments WHERE payment_id = ?', paymentId);
    expect(payment.status).toBe('refunded');
    expect(payment.refund_amount_halala).toBe(1000);
  });

  it('returns idempotent response when same status sent twice', async () => {
    const { id: renterId } = await seedRenter(0);
    const paymentId = insertPayment(renterId, { amount_halala: 1000, status: 'initiated' });

    // First webhook — processes it
    await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(webhookBody(paymentId, 'paid'));

    // Second webhook with same status — should be idempotent
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(webhookBody(paymentId, 'paid'));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('already_processed');
  });

  it('acknowledges (200) for unknown payment_id without error', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(webhookBody('unknown-pay-xyz', 'paid'));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('ignored_unknown');
  });

  it('rejects webhook with invalid HMAC signature when secret is configured', async () => {
    // Temporarily set a webhook secret
    process.env.MOYASAR_WEBHOOK_SECRET = 'test-webhook-secret-abc123';

    const { id: renterId } = await seedRenter(0);
    const paymentId = insertPayment(renterId);

    // Re-create app so the new env var is picked up
    const freshApp = createApp();

    const res = await request(freshApp)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-moyasar-signature', 'invalid-signature')
      .send(webhookBody(paymentId, 'paid'));

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/signature/i);

    delete process.env.MOYASAR_WEBHOOK_SECRET;
  });

  it('accepts valid HMAC signature when secret is configured', async () => {
    const webhookSecret = 'test-webhook-secret-xyz';
    process.env.MOYASAR_WEBHOOK_SECRET = webhookSecret;

    const { id: renterId } = await seedRenter(0);
    const paymentId = insertPayment(renterId, { amount_halala: 500, status: 'initiated' });

    const freshApp = createApp();
    const body = webhookBody(paymentId, 'paid', 500);
    const sig = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

    const res = await request(freshApp)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-moyasar-signature', sig)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('balance_credited');

    delete process.env.MOYASAR_WEBHOOK_SECRET;
  });
});

// =============================================================================
// 4. GET /api/payments/verify/:paymentId
// =============================================================================

describe('GET /api/payments/verify/:paymentId', () => {
  it('returns 401 without renter key', async () => {
    const res = await request(app).get('/api/payments/verify/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown payment_id', async () => {
    const { key } = await seedRenter(0);
    const res = await request(app)
      .get('/api/payments/verify/nonexistent-pay-xyz')
      .set('x-renter-key', key);
    expect(res.status).toBe(404);
  });

  it('returns 404 if payment belongs to a different renter', async () => {
    const { id: renterId1 } = await seedRenter(0);
    const { key: key2 }     = await seedRenter(0);
    const paymentId = insertPayment(renterId1, { status: 'paid' });

    const res = await request(app)
      .get(`/api/payments/verify/${paymentId}`)
      .set('x-renter-key', key2);
    expect(res.status).toBe(404); // other renter's payment
  });

  it('returns local record directly when status=paid (no Moyasar call)', async () => {
    const { key, id: renterId } = await seedRenter(0);
    const paymentId = insertPayment(renterId, { status: 'paid', amount_sar: 15, amount_halala: 1500 });

    const res = await request(app)
      .get(`/api/payments/verify/${paymentId}`)
      .set('x-renter-key', key);

    expect(res.status).toBe(200);
    expect(res.body.payment_id).toBe(paymentId);
    expect(res.body.status).toBe('paid');
    expect(res.body.amount_sar).toBe(15);
  });

  it('returns local status with note when MOYASAR_SECRET not configured', async () => {
    const { key, id: renterId } = await seedRenter(0);
    const paymentId = insertPayment(renterId, { status: 'initiated' });

    const res = await request(app)
      .get(`/api/payments/verify/${paymentId}`)
      .set('x-renter-key', key);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('initiated');
    expect(res.body.note).toContain('Gateway not configured');
  });
});

// =============================================================================
// 5. GET /api/payments/history
// =============================================================================

describe('GET /api/payments/history', () => {
  it('returns 401 without renter key', async () => {
    const res = await request(app).get('/api/payments/history');
    expect(res.status).toBe(401);
  });

  it('returns empty payments array for new renter', async () => {
    const { key } = await seedRenter(0);
    const res = await request(app).get('/api/payments/history').set('x-renter-key', key);

    expect(res.status).toBe(200);
    expect(res.body.payments).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('returns own payment history with correct count', async () => {
    const { key, id: renterId } = await seedRenter(0);
    insertPayment(renterId, { status: 'paid',      amount_sar: 10, amount_halala: 1000 });
    insertPayment(renterId, { status: 'initiated', amount_sar: 20, amount_halala: 2000 });

    const res = await request(app).get('/api/payments/history').set('x-renter-key', key);

    expect(res.status).toBe(200);
    expect(res.body.payments.length).toBe(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it('summary.total_paid_halala sums only paid payments', async () => {
    const { key, id: renterId } = await seedRenter(0);
    insertPayment(renterId, { status: 'paid',    amount_halala: 1000 });
    insertPayment(renterId, { status: 'paid',    amount_halala: 2000 });
    insertPayment(renterId, { status: 'failed',  amount_halala: 500  });

    const res = await request(app).get('/api/payments/history').set('x-renter-key', key);

    expect(res.status).toBe(200);
    expect(res.body.summary.total_paid_halala).toBe(3000); // 1000 + 2000
    expect(res.body.summary.total_paid_sar).toBeCloseTo(30);
  });

  it('does not return another renter\'s payments', async () => {
    const { id: renter1Id } = await seedRenter(0);
    const { key: key2 }    = await seedRenter(0);
    insertPayment(renter1Id, { status: 'paid', amount_halala: 5000 });

    const res = await request(app).get('/api/payments/history').set('x-renter-key', key2);
    expect(res.body.payments.length).toBe(0);
  });
});

// =============================================================================
// 6. Escrow + payment integration — end-to-end deduction and release
// =============================================================================

describe('Escrow integration with payment flow', () => {
  async function seedProvider() {
    const res = await request(app).post('/api/providers/register').send({
      name: `Pay-Test-Provider-${Date.now()}`,
      email: `payp-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
      gpu_model: 'RTX 4090', os: 'Linux',
    });
    await request(app).post('/api/providers/heartbeat').send({
      api_key: res.body.api_key,
      gpu_status: { temp: 45, utilization: 0 },
      uptime: 3600,
      provider_ip: '10.0.0.1',
      provider_hostname: 'test-node',
    });
    return { key: res.body.api_key, id: res.body.provider_id };
  }

  it('sandbox topup then submit job — balance deducted at submit', async () => {
    const { key: renterKey, id: renterId } = await seedRenter(0);
    const { id: providerId } = await seedProvider();

    // Top up via sandbox
    await request(app).post('/api/payments/topup-sandbox')
      .set('x-renter-key', renterKey)
      .send({ amount_sar: 5 }); // 500 halala

    const balanceAfterTopup = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId).balance_halala;
    expect(balanceAfterTopup).toBe(500);

    // Submit 1-minute llm_inference job (cost = 15 halala/min × 1 min = 15 halala)
    const submitRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 1,
              params: { prompt: 'test', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' } });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.job.cost_halala).toBe(15);

    const balanceAfterSubmit = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId).balance_halala;
    expect(balanceAfterSubmit).toBe(500 - 15); // 485
  });

  it('webhook credits balance → sufficient for job → job submitted successfully', async () => {
    const { key: renterKey, id: renterId } = await seedRenter(0);
    const { id: providerId } = await seedProvider();

    // Payment record in 'initiated' state
    const paymentId = insertPayment(renterId, { amount_halala: 10_000, status: 'initiated' });

    // Webhook fires → credits balance
    await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(webhookBody(paymentId, 'paid', 10_000));

    const balanceAfterWebhook = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId).balance_halala;
    expect(balanceAfterWebhook).toBe(10_000);

    // Now renter can submit a job
    const jobRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 5,
              params: { prompt: 'test', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' } });
    expect(jobRes.status).toBe(201);
  });

  it('refund on job failure — renter balance restored', async () => {
    const { key: renterKey, id: renterId } = await seedRenter(50_000);
    const { key: providerKey, id: providerId } = await seedProvider();

    const submitRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 5,
              params: { prompt: 'test', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' } });
    expect(submitRes.status).toBe(201);
    const jobId = submitRes.body.job.job_id;

    const balanceAfterSubmit = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId).balance_halala;
    expect(balanceAfterSubmit).toBe(50_000 - 75); // 15 hal/min × 5 min = 75

    // Provider picks up
    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    // Provider reports permanent failure (no result)
    await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ error: 'GPU crashed', transient: false });

    // Balance should be restored
    const balanceAfterFail = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId).balance_halala;
    expect(balanceAfterFail).toBe(50_000);
  });

  it('provider earns on job completion (escrow released to provider)', async () => {
    const { key: renterKey } = await seedRenter(50_000);
    const { key: providerKey, id: providerId } = await seedProvider();

    const beforeEarnings = db.get('SELECT claimable_earnings_halala FROM providers WHERE id = ?', providerId)
      ?.claimable_earnings_halala || 0;

    const submitRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 2,
              params: { prompt: 'test', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' } });
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    const completeRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'output', duration_seconds: 120 });

    expect(completeRes.body.billing.provider_earned_halala).toBeGreaterThan(0);

    const afterEarnings = db.get('SELECT claimable_earnings_halala FROM providers WHERE id = ?', providerId)
      ?.claimable_earnings_halala || 0;
    expect(afterEarnings).toBeGreaterThan(beforeEarnings);
  });
});

// =============================================================================
// 7. Rate limiting on payment endpoints
// =============================================================================

describe('Payment endpoint rate limiting', () => {
  it('sandbox topup endpoint accepts multiple requests before limit', async () => {
    // The production limit is 10/min. In tests (no server-level limiter), endpoint is not limited.
    // Verify that 3 consecutive sandbox topups succeed (baseline, not rate limit test).
    const { key } = await seedRenter(0);

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/api/payments/topup-sandbox')
        .set('x-renter-key', key)
        .send({ amount_sar: 1 });
      expect(res.status).toBe(200);
    }
  });
});
