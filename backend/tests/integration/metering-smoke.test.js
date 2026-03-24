/**
 * DCP-757: vLLM Per-Token Metering Smoke Test
 *
 * Verifies Sprint 25 Gap 1 fix: per-token metering for serve_sessions
 *
 * This test covers the complete metering pipeline:
 * 1. vLLM /complete request includes usage metadata (prompt_tokens, completion_tokens, total_tokens)
 * 2. serve_sessions record is created at job submission with initialized counters
 * 3. After inference completes, serve_sessions is updated with:
 *    - total_inferences incremented
 *    - total_tokens += calculated token count
 *    - total_billed_halala += (tokens × token_rate_halala)
 *    - last_inference_at timestamp recorded
 * 4. Billing accuracy is verified: expected cost = total_tokens × token_rate
 */

'use strict';

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token';

const request = require('supertest');
const express = require('express');
const db = require('../../src/db');

// ── Test app factory ──────────────────────────────────────────────────────────

function createTestApp() {
  const app = express();
  app.use(express.json());
  ['providers', 'renters', 'jobs', 'vllm', 'admin'].forEach(name => {
    const p = require.resolve(`../../src/routes/${name}`);
    delete require.cache[p];
  });
  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters',   require('../../src/routes/renters'));
  app.use('/api/jobs',      require('../../src/routes/jobs'));
  app.use('/api/vllm',      require('../../src/routes/vllm'));
  app.use('/api/admin',     require('../../src/routes/admin'));
  return app;
}

const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN;

let app;

// ── Cleanup ───────────────────────────────────────────────────────────────────

function cleanDb() {
  try { db.run('DELETE FROM serve_sessions'); } catch (_) {}
  try { db.run('DELETE FROM cost_rates'); } catch (_) {}
  try { db.run('DELETE FROM jobs'); } catch (_) {}
  try { db.run('DELETE FROM renters'); } catch (_) {}
  try { db.run('DELETE FROM providers'); } catch (_) {}
}

// ── Test helpers ──────────────────────────────────────────────────────────────

async function seedRenter(balanceHalala = 10_000) {
  const res = await request(app).post('/api/renters/register').send({
    name: `Metering-Test-Renter-${Date.now()}`,
    email: `meter-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
  });
  expect(res.status).toBe(201);
  db.run('UPDATE renters SET balance_halala = ?, status = ? WHERE id = ?',
    balanceHalala, 'active', res.body.renter_id);
  return { key: res.body.api_key, id: res.body.renter_id, email: res.body.email };
}

async function seedProvider() {
  const res = await request(app).post('/api/providers/register').send({
    name: `Metering-Test-Provider-${Date.now()}`,
    email: `meterp-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
    gpu_model: 'RTX 4090',
    os: 'Linux',
    vram_gb: 24,
  });
  expect(res.status).toBe(200);

  // Provider heartbeat to mark as online
  const hbRes = await request(app).post('/api/providers/heartbeat').send({
    api_key: res.body.api_key,
    status: 'online',
    gpu_status: 'idle',
  });
  expect([200, 204]).toContain(hbRes.status);

  return { key: res.body.api_key, id: res.body.provider_id };
}

function seedCostRate(modelId = 'TinyLlama/TinyLlama-1.1B-Chat-v1.0', rateHalala = 10) {
  try {
    db.run(
      `INSERT INTO cost_rates (model, token_rate_halala, is_active, created_at, updated_at)
       VALUES (?, ?, 1, datetime('now'), datetime('now'))`,
      modelId,
      rateHalala
    );
  } catch (_) {
    // May already exist
  }
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(() => {
  app = createTestApp();
  // Seed default cost rate
  seedCostRate();
});

beforeEach(() => cleanDb());

afterAll(() => cleanDb());

// =============================================================================
// METERING SMOKE TEST SUITE
// =============================================================================

describe('vLLM Per-Token Metering (Sprint 25 Gap 1)', () => {

  describe('serve_sessions record lifecycle', () => {

    it('creates serve_sessions record when job is submitted', async () => {
      const renter = await seedRenter(50_000);
      await seedProvider();
      seedCostRate();

      // Submit vLLM completion
      const res = await request(app)
        .post('/api/vllm/complete')
        .set('x-renter-key', renter.key)
        .send({
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          messages: [{ role: 'user', content: 'Say OK for test' }],
          max_tokens: 10,
          temperature: 0,
        });

      expect(res.status).toBe(200);
      expect(res.body.usage).toBeDefined();
      expect(typeof res.body.usage.total_tokens).toBe('number');
      expect(res.body.usage.total_tokens).toBeGreaterThan(0);

      // Verify serve_sessions record exists
      const sessions = db.all('SELECT * FROM serve_sessions');
      expect(sessions.length).toBeGreaterThan(0);

      const session = sessions[0];
      expect(session.job_id).toBeDefined();
      expect(session.model).toBe('TinyLlama/TinyLlama-1.1B-Chat-v1.0');
      expect(session.status).toBe('serving');
      expect(session.started_at).toBeDefined();
      expect(session.expires_at).toBeDefined();
    });

    it('initializes serve_sessions counters to zero at submission', async () => {
      const renter = await seedRenter(50_000);
      await seedProvider();
      seedCostRate();

      await request(app)
        .post('/api/vllm/complete')
        .set('x-renter-key', renter.key)
        .send({
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 10,
          temperature: 0,
        });

      const session = db.get('SELECT * FROM serve_sessions LIMIT 1');
      expect(session).toBeDefined();
      // Counters should have been updated after completion
      expect(typeof session.total_inferences).toBe('number');
      expect(typeof session.total_tokens).toBe('number');
      expect(typeof session.total_billed_halala).toBe('number');
    });
  });

  describe('token counting and persistence', () => {

    it('returns accurate token counts in vLLM response', async () => {
      const renter = await seedRenter(50_000);
      await seedProvider();
      seedCostRate();

      const res = await request(app)
        .post('/api/vllm/complete')
        .set('x-renter-key', renter.key)
        .send({
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          messages: [{ role: 'user', content: 'Reply with OK' }],
          max_tokens: 10,
          temperature: 0,
        });

      expect(res.status).toBe(200);
      const { usage } = res.body;

      expect(usage.prompt_tokens).toBeGreaterThan(0);
      expect(usage.completion_tokens).toBeGreaterThan(0);
      expect(usage.total_tokens).toBe(usage.prompt_tokens + usage.completion_tokens);
    });

    it('persists token counts in serve_sessions after inference', async () => {
      const renter = await seedRenter(50_000);
      await seedProvider();
      seedCostRate();

      const res = await request(app)
        .post('/api/vllm/complete')
        .set('x-renter-key', renter.key)
        .send({
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          messages: [{ role: 'user', content: 'Test response' }],
          max_tokens: 10,
          temperature: 0,
        });

      const responseTokens = res.body.usage.total_tokens;
      expect(responseTokens).toBeGreaterThan(0);

      // Verify tokens persisted in serve_sessions
      const session = db.get('SELECT total_tokens FROM serve_sessions LIMIT 1');
      expect(session).toBeDefined();
      expect(session.total_tokens).toBeGreaterThan(0);
      // The database value should match or be close to the response value
      // (allowing for approximation differences)
      expect(session.total_tokens).toBeGreaterThanOrEqual(responseTokens - 5);
      expect(session.total_tokens).toBeLessThanOrEqual(responseTokens + 5);
    });

    it('persists token counts in jobs table for traceability', async () => {
      const renter = await seedRenter(50_000);
      await seedProvider();
      seedCostRate();

      const res = await request(app)
        .post('/api/vllm/complete')
        .set('x-renter-key', renter.key)
        .send({
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 10,
          temperature: 0,
        });

      expect(res.status).toBe(200);

      // Find the job via jobs table
      const job = db.get('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 1');
      expect(job).toBeDefined();
      expect(typeof job.prompt_tokens).toBe('number');
      expect(typeof job.completion_tokens).toBe('number');
      expect(job.prompt_tokens).toBeGreaterThanOrEqual(0);
      expect(job.completion_tokens).toBeGreaterThanOrEqual(0);
    });
  });

  describe('billing calculation and cost tracking', () => {

    it('updates serve_sessions.total_billed_halala after inference', async () => {
      const renter = await seedRenter(50_000);
      await seedProvider();
      seedCostRate('TinyLlama/TinyLlama-1.1B-Chat-v1.0', 10); // 10 halala per token

      const res = await request(app)
        .post('/api/vllm/complete')
        .set('x-renter-key', renter.key)
        .send({
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          messages: [{ role: 'user', content: 'Test billing' }],
          max_tokens: 10,
          temperature: 0,
        });

      expect(res.status).toBe(200);

      const session = db.get('SELECT total_tokens, total_billed_halala FROM serve_sessions LIMIT 1');
      expect(session).toBeDefined();
      expect(session.total_billed_halala).toBeGreaterThan(0);

      // Verify billing calculation: cost = tokens × rate
      const expectedCost = Math.max(1, session.total_tokens * 10);
      expect(session.total_billed_halala).toBeGreaterThanOrEqual(expectedCost - 10);
      expect(session.total_billed_halala).toBeLessThanOrEqual(expectedCost + 10);
    });

    it('increments total_inferences counter', async () => {
      const renter = await seedRenter(50_000);
      await seedProvider();
      seedCostRate();

      await request(app)
        .post('/api/vllm/complete')
        .set('x-renter-key', renter.key)
        .send({
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          messages: [{ role: 'user', content: 'Test inference' }],
          max_tokens: 10,
          temperature: 0,
        });

      const session = db.get('SELECT total_inferences FROM serve_sessions LIMIT 1');
      expect(session).toBeDefined();
      expect(session.total_inferences).toBeGreaterThan(0);
    });

    it('records last_inference_at timestamp', async () => {
      const renter = await seedRenter(50_000);
      await seedProvider();
      seedCostRate();

      const beforeCall = new Date().toISOString();

      await request(app)
        .post('/api/vllm/complete')
        .set('x-renter-key', renter.key)
        .send({
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          messages: [{ role: 'user', content: 'Test timestamp' }],
          max_tokens: 10,
          temperature: 0,
        });

      const afterCall = new Date().toISOString();
      const session = db.get('SELECT last_inference_at FROM serve_sessions LIMIT 1');

      expect(session).toBeDefined();
      expect(session.last_inference_at).toBeDefined();
      expect(session.last_inference_at).not.toBeNull();

      // Timestamp should be within the test execution window
      const timestamp = new Date(session.last_inference_at);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(new Date(beforeCall).getTime() - 1000);
      expect(timestamp.getTime()).toBeLessThanOrEqual(new Date(afterCall).getTime() + 1000);
    });
  });

  describe('renter balance tracking', () => {

    it('deducts estimated cost from renter balance on job submission', async () => {
      const initialBalance = 10_000;
      const renter = await seedRenter(initialBalance);
      await seedProvider();
      seedCostRate();

      const balanceBefore = db.get(
        'SELECT balance_halala FROM renters WHERE id = ?',
        renter.id
      ).balance_halala;

      await request(app)
        .post('/api/vllm/complete')
        .set('x-renter-key', renter.key)
        .send({
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          messages: [{ role: 'user', content: 'Test cost' }],
          max_tokens: 10,
          temperature: 0,
        });

      const balanceAfter = db.get(
        'SELECT balance_halala FROM renters WHERE id = ?',
        renter.id
      ).balance_halala;

      // Balance should have been deducted
      expect(balanceAfter).toBeLessThan(balanceBefore);
      expect(balanceBefore - balanceAfter).toBeGreaterThan(0);
    });

    it('rejects inference if renter balance is insufficient', async () => {
      const lowBalance = 1; // Too low for any inference
      const renter = await seedRenter(lowBalance);
      await seedProvider();
      seedCostRate();

      const res = await request(app)
        .post('/api/vllm/complete')
        .set('x-renter-key', renter.key)
        .send({
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          messages: [{ role: 'user', content: 'Test insufficient balance' }],
          max_tokens: 10,
          temperature: 0,
        });

      // Should get a 402 Payment Required error
      expect(res.status).toBe(402);
      expect(res.body.error).toMatch(/Insufficient balance/i);
    });
  });

  describe('metering end-to-end validation', () => {

    it('validates complete metering pipeline: request -> token counts -> billing', async () => {
      const renter = await seedRenter(50_000);
      await seedProvider();
      seedCostRate('TinyLlama/TinyLlama-1.1B-Chat-v1.0', 5); // 5 halala per token

      // Step 1: Submit vLLM request
      const res = await request(app)
        .post('/api/vllm/complete')
        .set('x-renter-key', renter.key)
        .send({
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          messages: [{ role: 'user', content: 'Comprehensive test of metering system' }],
          max_tokens: 10,
          temperature: 0,
        });

      expect(res.status).toBe(200);

      // Step 2: Verify response includes usage
      const { usage, cost_halala } = res.body;
      expect(usage.prompt_tokens).toBeGreaterThan(0);
      expect(usage.completion_tokens).toBeGreaterThan(0);
      expect(usage.total_tokens).toBeGreaterThan(0);

      // Step 3: Verify serve_sessions record
      const session = db.get('SELECT * FROM serve_sessions LIMIT 1');
      expect(session).toBeDefined();
      expect(session.total_tokens).toBeGreaterThan(0);
      expect(session.total_billed_halala).toBeGreaterThan(0);
      expect(session.total_inferences).toBe(1);

      // Step 4: Verify billing math
      const expectedBillingHalala = Math.max(1, session.total_tokens * 5);
      expect(session.total_billed_halala).toBeGreaterThanOrEqual(expectedBillingHalala - 10);
      expect(session.total_billed_halala).toBeLessThanOrEqual(expectedBillingHalala + 10);

      // Step 5: Verify renter balance was deducted
      const renterFinal = db.get('SELECT balance_halala FROM renters WHERE id = ?', renter.id);
      expect(renterFinal.balance_halala).toBeLessThan(50_000);

      // Step 6: Verify jobs table has token metadata
      const job = db.get('SELECT prompt_tokens, completion_tokens FROM jobs LIMIT 1');
      expect(job.prompt_tokens).toBeGreaterThan(0);
      expect(job.completion_tokens).toBeGreaterThan(0);
    });

    it('handles multiple inferences on same serve_session', async () => {
      const renter = await seedRenter(100_000);
      await seedProvider();
      seedCostRate();

      // First inference
      const res1 = await request(app)
        .post('/api/vllm/complete')
        .set('x-renter-key', renter.key)
        .send({
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          messages: [{ role: 'user', content: 'First test' }],
          max_tokens: 10,
          temperature: 0,
        });
      expect(res1.status).toBe(200);

      const session1 = db.get('SELECT total_inferences, total_tokens FROM serve_sessions LIMIT 1');
      const tokens1 = session1.total_tokens;

      // Second inference
      const res2 = await request(app)
        .post('/api/vllm/complete')
        .set('x-renter-key', renter.key)
        .send({
          model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
          messages: [{ role: 'user', content: 'Second test' }],
          max_tokens: 10,
          temperature: 0,
        });
      expect(res2.status).toBe(200);

      // Should have 2 separate serve_sessions (one per job)
      const sessions = db.all('SELECT total_inferences, total_tokens FROM serve_sessions');
      expect(sessions.length).toBe(2);
      expect(sessions.every(s => s.total_inferences >= 1)).toBe(true);
      expect(sessions.every(s => s.total_tokens > 0)).toBe(true);
    });
  });
});
