'use strict';

/**
 * e2e-marketplace.test.js — End-to-end marketplace smoke test suite (DCP-767)
 *
 * Exercises the complete Sprint 28 marketplace flow end-to-end:
 *   1. Provider activation flow (register → benchmark → online → API key)
 *   2. Renter credit flow (admin topup → balance check → 402 on insufficient funds)
 *   3. Job dispatch flow (submit → assign → result → billing settlement)
 *   4. Provider earnings flow (accumulate → payout request)
 *   5. Pricing verification (RTX 4090 rate, SAR conversion, competitor prices)
 *
 * Uses in-memory SQLite (jest-setup.js sets DC1_DB_PATH=:memory:).
 * External services (email, Telegram, on-chain escrow) are stubbed via missing env vars
 * which the services already handle gracefully (warn + skip).
 */

// ── Environment stubs (must be set before any require) ────────────────────────
process.env.SUPABASE_URL         = process.env.SUPABASE_URL         || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key-stub';

const request    = require('supertest');
const express    = require('express');
const db         = require('../src/db');
const { SAR_USD_RATE, GPU_RATE_TABLE } = require('../src/config/pricing');

const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN || 'test-admin-token-jest';

// ── Test application factory ──────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/providers', require('../src/routes/providers'));
  app.use('/api/renters',   require('../src/routes/renters'));
  app.use('/api/jobs',      require('../src/routes/jobs'));
  app.use('/api/admin',     require('../src/routes/admin'));
  app.use('/api/models',    require('../src/routes/models'));
  app.use('/api',           require('../src/routes/payouts')); // payouts mounted at /api
  return app;
}

const app = createApp();

// ── DB helpers ────────────────────────────────────────────────────────────────

function cleanDb() {
  const safe = (t) => { try { db.prepare(`DELETE FROM ${t}`).run(); } catch (_) {} };
  try { db.prepare('PRAGMA foreign_keys = OFF').run(); } catch (_) {}
  for (const t of [
    'payout_requests', 'credit_holds', 'escrow_holds', 'job_lifecycle_events',
    'job_executions', 'job_logs', 'benchmark_runs', 'provider_benchmarks',
    'provider_api_keys', 'quota_log', 'renter_quota', 'heartbeat_log',
    'withdrawal_requests', 'jobs', 'renters', 'providers',
  ]) { safe(t); }
  try { db.prepare('PRAGMA foreign_keys = ON').run(); } catch (_) {}
}

/** Register a provider via API and return { id, apiKey } */
async function registerProvider(overrides = {}) {
  const res = await request(app).post('/api/providers/register').send({
    name:      overrides.name      || `Provider-${Date.now()}`,
    email:     overrides.email     || `prov-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
    gpu_model: overrides.gpu_model || 'RTX 4090',
    os:        overrides.os        || 'linux',
  });
  expect(res.status).toBe(200);
  return { id: res.body.provider_id, apiKey: res.body.api_key };
}

/** Bring provider online via heartbeat */
async function bringOnline(apiKey) {
  return request(app).post('/api/providers/heartbeat').send({
    api_key: apiKey,
    gpu_status: { temp: 45, utilization: 0 },
    uptime: 3600,
    provider_ip: '10.0.0.1',
    provider_hostname: 'test-node',
  });
}

/** Register a renter via API and return { id, apiKey } */
async function registerRenter(overrides = {}) {
  const res = await request(app).post('/api/renters/register').send({
    name:  overrides.name  || `Renter-${Date.now()}`,
    email: overrides.email || `renter-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
  });
  expect([200, 201]).toContain(res.status);
  return { id: res.body.renter_id, apiKey: res.body.api_key };
}

/** Credit a renter's account via admin topup API */
async function topupRenter(renterId, amountHalala) {
  const res = await request(app)
    .post(`/api/renters/${renterId}/topup`)
    .set('x-admin-token', ADMIN_TOKEN)
    .send({ amount_halala: amountHalala });
  expect(res.status).toBe(200);
  return res.body;
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => cleanDb());

// ─────────────────────────────────────────────────────────────────────────────
// 1. Provider activation flow
// ─────────────────────────────────────────────────────────────────────────────

describe('1. Provider activation flow', () => {
  it('registers a provider and returns api_key + provider_id', async () => {
    const res = await request(app).post('/api/providers/register').send({
      name: 'Smoke Test Provider',
      email: `smoke-prov-${Date.now()}@dc1.test`,
      gpu_model: 'RTX 4090',
      os: 'linux',
    });

    expect(res.status).toBe(200);
    expect(res.body.api_key).toBeDefined();
    expect(res.body.provider_id).toBeGreaterThan(0);
  });

  it('submits a GPU benchmark and receives tier classification', async () => {
    const { id, apiKey } = await registerProvider();

    const benchRes = await request(app)
      .post(`/api/providers/${id}/benchmark-submit`)
      .set('x-provider-key', apiKey)
      .send({
        gpu_model: 'RTX 4090',
        vram_gb: 24,
        tflops: 82.6,       // < 200 TF threshold → Tier C
        tokens_per_sec: 3200,
        bandwidth_gbps: 21.0,
      });

    expect(benchRes.status).toBe(200);
    expect(benchRes.body.success).toBe(true);
    expect(benchRes.body.tier).toBe('C');   // 82.6 TF < 200 TF req → Tier C
    expect(benchRes.body.gpu_model).toBe('RTX 4090');
    expect(benchRes.body.meets_minimum_requirements).toBeDefined();
  });

  it('submits Tier B benchmark (>= 200 TF, >= 20GB VRAM)', async () => {
    const { id, apiKey } = await registerProvider();

    const benchRes = await request(app)
      .post(`/api/providers/${id}/benchmark-submit`)
      .set('x-provider-key', apiKey)
      .send({
        gpu_model: 'RTX 4090',
        vram_gb: 24,
        tflops: 250,        // >= 200 TF → Tier B
        tokens_per_sec: 5000,
        bandwidth_gbps: 30.0,
      });

    expect(benchRes.status).toBe(200);
    expect(benchRes.body.success).toBe(true);
    expect(benchRes.body.tier).toBe('B');
  });

  it('brings provider online via heartbeat', async () => {
    const { id, apiKey } = await registerProvider();
    const hbRes = await bringOnline(apiKey);
    expect([200, 201]).toContain(hbRes.status);

    const row = db.prepare('SELECT status FROM providers WHERE id = ?').get(id);
    expect(row.status).toBe('online');
  });

  it('issues a scoped dcp_prov_* API key for the provider', async () => {
    const { id, apiKey } = await registerProvider();

    const keyRes = await request(app)
      .post(`/api/providers/${id}/keys`)
      .set('x-provider-key', apiKey)
      .send({ label: 'smoke-test-key' });

    expect(keyRes.status).toBe(201);
    expect(keyRes.body.key).toMatch(/^dcp_prov_/);
    expect(keyRes.body.key_id).toBeDefined();
    expect(keyRes.body.message).toMatch(/save/i);
  });

  it('dcp_prov_* key works on provider-only route (earnings endpoint)', async () => {
    const { id, apiKey } = await registerProvider();

    // Issue scoped key
    const keyRes = await request(app)
      .post(`/api/providers/${id}/keys`)
      .set('x-provider-key', apiKey)
      .send({ label: 'earnings-test' });
    expect(keyRes.status).toBe(201);
    const scopedKey = keyRes.body.key;

    // Use scoped key to access earnings via payout route
    const earningsRes = await request(app)
      .get(`/api/providers/${id}/earnings`)
      .set('Authorization', `Bearer ${scopedKey}`);

    expect(earningsRes.status).toBe(200);
    // payoutService.getEarningsSummary returns availableHalala/availableSar/availableUsd
    expect(earningsRes.body).toHaveProperty('availableHalala');
    expect(earningsRes.body).toHaveProperty('minimumPayoutUsd');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Renter credit flow
// ─────────────────────────────────────────────────────────────────────────────

describe('2. Renter credit flow', () => {
  it('top-ups renter balance via admin route and reflects in balance check', async () => {
    const { id, apiKey } = await registerRenter();

    // Admin top-up (renters start with 1000 halala welcome credit)
    const topupRes = await topupRenter(id, 5000);
    expect(topupRes.new_balance_halala).toBe(6000); // 1000 initial + 5000

    // Verify via renter balance endpoint
    const balRes = await request(app)
      .get('/api/renters/balance')
      .set('x-renter-key', apiKey);

    expect(balRes.status).toBe(200);
    expect(balRes.body.balance_halala).toBe(6000);
    expect(balRes.body.balance_sar).toBe(60);
  });

  it('second top-up accumulates on top of existing balance', async () => {
    const { id, apiKey } = await registerRenter();

    await topupRenter(id, 3000);
    await topupRenter(id, 2000);

    const balRes = await request(app)
      .get('/api/renters/balance')
      .set('x-renter-key', apiKey);

    expect(balRes.status).toBe(200);
    // 1000 initial + 3000 + 2000 = 6000
    expect(balRes.body.balance_halala).toBe(6000);
  });

  it('returns 402 when renter submits a job with insufficient balance', async () => {
    const { id: providerId, apiKey: providerKey } = await registerProvider();
    await bringOnline(providerKey);

    const { apiKey: renterKey } = await registerRenter(); // starts with 1000 halala

    // Request a job that costs more than the 1000 halala welcome balance.
    // RTX 4090 rate: ~1.67 halala/min. 700 min × 1.67 ≈ 1169 > 1000 halala.
    const jobRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({
        provider_id: providerId,
        job_type: 'llm_inference',
        duration_minutes: 700,
        params: { prompt: 'test' },
      });

    expect(jobRes.status).toBe(402);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Job dispatch flow
// ─────────────────────────────────────────────────────────────────────────────

describe('3. Job dispatch flow', () => {
  it('full lifecycle: submit → assign → result → billing settlement', async () => {
    // Set up online provider
    const { id: providerId, apiKey: providerKey } = await registerProvider({
      gpu_model: 'RTX 4090',
    });
    await bringOnline(providerKey);

    // Set up funded renter (starts with 1000 halala welcome credit)
    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId, 50_000);

    const balanceBefore = db.prepare('SELECT balance_halala FROM renters WHERE id = ?').get(renterId);
    expect(balanceBefore.balance_halala).toBe(51_000); // 1000 initial + 50000

    // Submit job
    const jobRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({
        provider_id: providerId,
        job_type: 'llm_inference',
        duration_minutes: 10,
        params: { prompt: 'Hello from smoke test', model: 'ALLaM-7B' },
      });

    expect(jobRes.status).toBe(201);
    expect(jobRes.body.success).toBe(true);
    expect(jobRes.body.job.status).toBe('pending');
    expect(jobRes.body.job.cost_halala).toBeGreaterThan(0);

    const jobId = jobRes.body.job.job_id;
    const estimatedCost = jobRes.body.job.cost_halala;

    // Verify balance was deducted at submit (pre-pay)
    const balanceAfterSubmit = db.prepare('SELECT balance_halala FROM renters WHERE id = ?').get(renterId);
    expect(balanceAfterSubmit.balance_halala).toBe(51_000 - estimatedCost);

    // Provider daemon picks up job
    const assignedRes = await request(app)
      .get('/api/jobs/assigned')
      .query({ key: providerKey });

    expect(assignedRes.status).toBe(200);
    expect(assignedRes.body.job.job_id).toBe(jobId);
    expect(assignedRes.body.job.status).toBe('assigned');

    // Verify the job is assigned to this provider
    const assignedJob = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId);
    expect(assignedJob.provider_id).toBe(providerId);

    // Provider submits result (completes job)
    const resultRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'مرحبا من نظام DCP', duration_seconds: 600 });

    expect(resultRes.status).toBe(200);
    expect(resultRes.body.success).toBe(true);

    // Billing settlement — provider credited, DC1 takes fee
    const billing = resultRes.body.billing;
    expect(billing.provider_earned_halala).toBeGreaterThan(0);
    expect(billing.dc1_fee_halala).toBeGreaterThan(0);
    expect(billing.provider_earned_halala + billing.dc1_fee_halala).toBe(billing.actual_cost_halala);

    // Provider earnings accumulated
    const updatedProvider = db.prepare('SELECT * FROM providers WHERE id = ?').get(providerId);
    expect(updatedProvider.total_jobs).toBe(1);
    expect(updatedProvider.claimable_earnings_halala).toBeGreaterThan(0);

    // Job marked completed
    const completedJob = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId);
    expect(completedJob.status).toBe('completed');
    expect(completedJob.completed_at).toBeDefined();
  });

  it('manual job complete via /complete endpoint after provider assignment', async () => {
    const { id: providerId, apiKey: providerKey } = await registerProvider();
    await bringOnline(providerKey);

    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId, 20_000);

    const jobRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({
        provider_id: providerId,
        job_type: 'training',
        duration_minutes: 5,
        params: {},
      });
    expect(jobRes.status).toBe(201);

    const jobId = jobRes.body.job.job_id;

    // Assign the job via provider daemon
    await request(app).get('/api/jobs/assigned').query({ key: providerKey });

    // Force to 'running' in DB (simulating daemon starting the container)
    db.prepare("UPDATE jobs SET status = 'running', started_at = datetime('now') WHERE job_id = ?").run(jobId);

    // Admin completes the job
    const completeRes = await request(app)
      .post(`/api/jobs/${jobId}/complete`)
      .set('x-admin-token', ADMIN_TOKEN);

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.job.status).toBe('completed');

    // Provider gets credited
    const prov = db.prepare('SELECT claimable_earnings_halala, total_jobs FROM providers WHERE id = ?').get(providerId);
    expect(prov.total_jobs).toBe(1);
    expect(prov.claimable_earnings_halala).toBeGreaterThan(0);
  });

  it('rejects job submission without renter authentication (401)', async () => {
    const { id: providerId, apiKey: providerKey } = await registerProvider();
    await bringOnline(providerKey);

    const jobRes = await request(app)
      .post('/api/jobs/submit')
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 5, params: {} });

    expect(jobRes.status).toBe(401);
  });

  it('rejects job submission to offline provider (400)', async () => {
    const { id: providerId } = await registerProvider();
    // Provider NOT brought online

    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId, 50_000);

    const jobRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 5, params: {} });

    expect(jobRes.status).toBe(400);
    expect(jobRes.body.error).toMatch(/not online/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Provider earnings flow
// ─────────────────────────────────────────────────────────────────────────────

describe('4. Provider earnings flow', () => {
  it('accumulates claimable earnings after job completion', async () => {
    const { id: providerId, apiKey: providerKey } = await registerProvider();
    await bringOnline(providerKey);

    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId, 50_000);

    const jobRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 10, params: {} });
    expect(jobRes.status).toBe(201);

    await request(app).get('/api/jobs/assigned').query({ key: providerKey });

    await request(app)
      .post(`/api/jobs/${jobRes.body.job.job_id}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'done', duration_seconds: 600 });

    const prov = db.prepare('SELECT claimable_earnings_halala FROM providers WHERE id = ?').get(providerId);
    expect(prov.claimable_earnings_halala).toBeGreaterThan(0);
  });

  it('requests a payout (minimum $50 USD) after accumulating sufficient earnings', async () => {
    const { id: providerId, apiKey: providerKey } = await registerProvider();

    // Seed provider with sufficient earnings (> $50 USD = 18750 halala at 3.75 SAR/USD * 100)
    const minPayoutHalala = Math.ceil(50 * SAR_USD_RATE * 100); // 18750
    db.prepare(
      `UPDATE providers SET claimable_earnings_halala = ?, total_earnings = ? WHERE id = ?`
    ).run(minPayoutHalala + 1000, (minPayoutHalala + 1000) / 100, providerId);

    // Request payout of exactly $50 USD using legacy provider key
    const payoutRes = await request(app)
      .post(`/api/providers/${providerId}/payouts`)
      .set('x-provider-key', providerKey)
      .send({ amount_usd: 50 });

    expect(payoutRes.status).toBe(201);
    expect(payoutRes.body.requestId).toBeDefined();
    expect(payoutRes.body.status).toBe('pending');
    expect(payoutRes.body.amountUsd).toBe(50);
    expect(payoutRes.body.amountSar).toBe(187.50);

    // Verify payout appears in history (returns { payouts: [], pagination: {} })
    const historyRes = await request(app)
      .get(`/api/providers/${providerId}/payouts`)
      .set('x-provider-key', providerKey);

    expect(historyRes.status).toBe(200);
    expect(Array.isArray(historyRes.body.payouts)).toBe(true);
    expect(historyRes.body.payouts.length).toBeGreaterThan(0);
    expect(historyRes.body.payouts[0].status).toBe('pending');
  });

  it('rejects payout below $50 minimum', async () => {
    const { id: providerId, apiKey: providerKey } = await registerProvider();
    db.prepare('UPDATE providers SET claimable_earnings_halala = 999999 WHERE id = ?').run(providerId);

    const payoutRes = await request(app)
      .post(`/api/providers/${providerId}/payouts`)
      .set('x-provider-key', providerKey)
      .send({ amount_usd: 10 });

    expect(payoutRes.status).toBe(400);
    expect(payoutRes.body.error).toBe('BELOW_MINIMUM');
  });

  it('rejects payout when claimable balance is insufficient', async () => {
    const { id: providerId, apiKey: providerKey } = await registerProvider();
    // Set earnings just above $50 minimum in halala (but we request more than available)
    const minPayoutHalala = Math.ceil(50 * SAR_USD_RATE * 100); // 18750
    db.prepare('UPDATE providers SET claimable_earnings_halala = ? WHERE id = ?').run(minPayoutHalala - 1, providerId);

    const payoutRes = await request(app)
      .post(`/api/providers/${providerId}/payouts`)
      .set('x-provider-key', providerKey)
      .send({ amount_usd: 50 });

    // 49.99 USD worth of halala → below minimum or insufficient balance
    expect([400, 402]).toContain(payoutRes.status);
    expect(['BELOW_MINIMUM', 'INSUFFICIENT_BALANCE']).toContain(payoutRes.body.error);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Pricing verification
// ─────────────────────────────────────────────────────────────────────────────

describe('5. Pricing verification', () => {
  it('RTX 4090 floor rate is $0.267/hr in GPU_RATE_TABLE', () => {
    const rtx4090 = GPU_RATE_TABLE.find(e =>
      e.models.some(m => m.toLowerCase().includes('rtx 4090'))
    );
    expect(rtx4090).toBeDefined();
    expect(rtx4090.rate_per_hour_usd).toBe(0.267);
  });

  it('RTX 4090 rate_per_second_usd is rate_per_hour_usd / 3600', () => {
    const rtx4090 = GPU_RATE_TABLE.find(e =>
      e.models.some(m => m.toLowerCase().includes('rtx 4090'))
    );
    // Use loose comparison since stored value may be rounded slightly
    const computed = rtx4090.rate_per_hour_usd / 3600;
    expect(Math.abs(rtx4090.rate_per_second_usd - computed)).toBeLessThan(0.000001);
  });

  it('SAR/USD exchange rate is 3.75 (Saudi peg)', () => {
    expect(SAR_USD_RATE).toBe(3.75);
  });

  it('RTX 4090 SAR/hr is rate_per_hour_usd * 3.75', () => {
    const rtx4090 = GPU_RATE_TABLE.find(e =>
      e.models.some(m => m.toLowerCase().includes('rtx 4090'))
    );
    const sarPerHour = rtx4090.rate_per_hour_usd * SAR_USD_RATE;
    // $0.267 * 3.75 = $1.00125 SAR/hr
    expect(sarPerHour).toBeCloseTo(1.00125, 4);
  });

  it('RTX 4090 is at least 23% cheaper than Vast.ai', () => {
    const rtx4090 = GPU_RATE_TABLE.find(e =>
      e.models.some(m => m.toLowerCase().includes('rtx 4090'))
    );
    expect(rtx4090.competitor_prices.vast_ai).toBeGreaterThan(rtx4090.rate_per_hour_usd);
    expect(rtx4090.competitor_prices.runpod).toBeGreaterThan(rtx4090.rate_per_hour_usd);
    expect(rtx4090.competitor_prices.aws).toBeGreaterThan(rtx4090.rate_per_hour_usd);

    // DCP is 23.7% below Vast.ai for RTX 4090 (from strategic brief)
    const discountVsVastAi = 1 - (rtx4090.rate_per_hour_usd / rtx4090.competitor_prices.vast_ai);
    expect(discountVsVastAi).toBeGreaterThanOrEqual(0.23);
  });

  it('GET /api/models/catalog returns model list with display_name and model_id', async () => {
    const res = await request(app).get('/api/models/catalog');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.models)).toBe(true);
    expect(typeof res.body.total_models).toBe('number');

    if (res.body.models.length > 0) {
      const model = res.body.models[0];
      expect(model).toHaveProperty('model_id');
      expect(model).toHaveProperty('display_name');
    }
  });

  it('job cost calculation uses halala units (100 halala = 1 SAR)', async () => {
    const { id: providerId, apiKey: providerKey } = await registerProvider({ gpu_model: 'RTX 4090' });
    await bringOnline(providerKey);

    const { id: renterId, apiKey: renterKey } = await registerRenter();
    await topupRenter(renterId, 50_000);

    const jobRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({
        provider_id: providerId,
        job_type: 'llm_inference',
        duration_minutes: 60,
        params: {},
      });

    expect(jobRes.status).toBe(201);
    const costHalala = jobRes.body.job.cost_halala;

    // Cost must be a positive integer in halala
    expect(Number.isInteger(costHalala)).toBe(true);
    expect(costHalala).toBeGreaterThan(0);

    // RTX 4090: $0.267/hr * 3.75 SAR/USD * 100 halala/SAR = 100.125 halala/hr
    // 60 min = 100 halala approximately (GPU-rate based pricing)
    expect(costHalala).toBeGreaterThanOrEqual(90); // at least 90 halala for 60 min
  });

  it('all GPU models in rate table have competitor_prices (vast_ai, runpod, aws)', () => {
    for (const entry of GPU_RATE_TABLE) {
      if (entry.models.includes('default')) continue; // fallback entry
      expect(entry.competitor_prices).toBeDefined();
      expect(typeof entry.competitor_prices.vast_ai).toBe('number');
      expect(typeof entry.competitor_prices.runpod).toBe('number');
      expect(typeof entry.competitor_prices.aws).toBe('number');
      // DCP price must be below all competitor prices
      expect(entry.rate_per_hour_usd).toBeLessThan(entry.competitor_prices.vast_ai);
      expect(entry.rate_per_hour_usd).toBeLessThan(entry.competitor_prices.runpod);
      expect(entry.rate_per_hour_usd).toBeLessThan(entry.competitor_prices.aws);
    }
  });
});
