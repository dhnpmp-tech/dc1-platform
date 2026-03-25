'use strict';
/**
 * Integration tests for DCP-967: Arabic RAG API endpoints
 *
 * Covers:
 *   GET  /api/templates/bundles       — bundle catalog
 *   GET  /api/pricing/arabic-rag      — pricing comparison
 *   POST /api/jobs/submit (bundle_id) — bundle job dispatch
 */

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token-jest';

const request = require('supertest');
const express = require('express');
const db = require('../../src/db');

function createApp() {
  const app = express();
  app.use(express.json());
  // Clear require cache so each test suite gets fresh module state
  [
    '../../src/routes/templates',
    '../../src/routes/pricing',
    '../../src/routes/jobs',
  ].forEach(p => { try { delete require.cache[require.resolve(p)]; } catch (_) {} });

  app.use('/api/templates', require('../../src/routes/templates'));
  app.use('/api/pricing', require('../../src/routes/pricing'));
  app.use('/api/jobs', require('../../src/routes/jobs'));
  return app;
}

const app = createApp();

// ── Helpers ───────────────────────────────────────────────────────────────────

function seedRenter(opts = {}) {
  const now = new Date().toISOString();
  const apiKey = opts.apiKey || 'test-renter-key-rag-' + Date.now();
  const id = opts.id || 'renter-rag-test-' + Date.now();
  db.prepare(
    `INSERT OR REPLACE INTO renters
       (id, api_key, email, balance_halala, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`
  ).run(id, apiKey, opts.email || 'rag@test.dcp', opts.balance || 100000, now, now);
  return { id, apiKey };
}

function seedProvider(opts = {}) {
  const now = new Date().toISOString();
  const id = opts.id || Date.now();
  const recentHeartbeat = new Date(Date.now() - 60 * 1000).toISOString(); // 1 min ago
  db.prepare(
    `INSERT OR REPLACE INTO providers
       (id, name, status, gpu_model, vram_gb, gpu_vram_mib, last_heartbeat, created_at, updated_at)
     VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    opts.name || 'test-provider-rag',
    opts.gpuModel || 'RTX 4090',
    opts.vramGb || 24,
    opts.vramMib || 24576,
    recentHeartbeat,
    now,
    now
  );
  return id;
}

// ── GET /api/templates/bundles ─────────────────────────────────────────────

describe('GET /api/templates/bundles — bundle catalog', () => {
  it('returns 200 with bundles array and count', async () => {
    const res = await request(app).get('/api/templates/bundles');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bundles)).toBe(true);
    expect(typeof res.body.count).toBe('number');
    expect(res.body.count).toBe(res.body.bundles.length);
  });

  it('includes the arabic-rag bundle', async () => {
    const res = await request(app).get('/api/templates/bundles');
    expect(res.status).toBe(200);
    const arabicRag = res.body.bundles.find(b => b.id === 'arabic-rag');
    expect(arabicRag).toBeDefined();
    expect(arabicRag.name).toBe('Arabic RAG Pipeline');
    expect(arabicRag.pdpl_compliant).toBe(true);
  });

  it('arabic-rag bundle has required fields', async () => {
    const res = await request(app).get('/api/templates/bundles');
    const bundle = res.body.bundles.find(b => b.id === 'arabic-rag');
    expect(bundle).toHaveProperty('components');
    expect(Array.isArray(bundle.components)).toBe(true);
    expect(bundle.components).toContain('arabic-embeddings');
    expect(bundle.components).toContain('arabic-reranker');
    expect(bundle.components).toContain('allam-7b');
    expect(bundle).toHaveProperty('price_per_hour_usd');
    expect(bundle).toHaveProperty('price_per_hour_sar');
    expect(bundle).toHaveProperty('vram_required_gb');
    expect(bundle).toHaveProperty('deploy_endpoint');
    expect(bundle.languages).toContain('ar');
  });

  it('price_per_hour_sar is roughly price_per_hour_usd × SAR rate (3.5–4.0)', async () => {
    const res = await request(app).get('/api/templates/bundles');
    const bundle = res.body.bundles.find(b => b.id === 'arabic-rag');
    const impliedRate = bundle.price_per_hour_sar / bundle.price_per_hour_usd;
    expect(impliedRate).toBeGreaterThan(3.5);
    expect(impliedRate).toBeLessThan(4.0);
  });

  it('returns 200 and does not conflict with GET /api/templates/:id path', async () => {
    // 'bundles' should not be caught by /:id handler
    const bundlesRes = await request(app).get('/api/templates/bundles');
    expect(bundlesRes.status).toBe(200);
    expect(bundlesRes.body).toHaveProperty('bundles');

    // A non-existent template still 404s correctly
    const notFoundRes = await request(app).get('/api/templates/does-not-exist-xyz');
    expect(notFoundRes.status).toBe(404);
  });
});

// ── GET /api/pricing/arabic-rag ───────────────────────────────────────────

describe('GET /api/pricing/arabic-rag — pricing comparison', () => {
  it('returns 200 with required top-level fields', async () => {
    const res = await request(app).get('/api/pricing/arabic-rag');
    expect(res.status).toBe(200);
    expect(res.body.bundle_id).toBe('arabic-rag');
    expect(res.body.pdpl_compliant).toBe(true);
    expect(res.body).toHaveProperty('dcp_pricing');
    expect(res.body).toHaveProperty('competitors');
    expect(res.body).toHaveProperty('sar_usd_rate');
    expect(res.body).toHaveProperty('generated_at');
  });

  it('dcp_pricing includes USD and SAR hourly rates', async () => {
    const res = await request(app).get('/api/pricing/arabic-rag');
    const { dcp_pricing } = res.body;
    expect(dcp_pricing.price_per_hour_usd).toBe(1.20);
    expect(typeof dcp_pricing.price_per_hour_sar).toBe('number');
    expect(dcp_pricing.price_per_hour_sar).toBeGreaterThan(0);
    expect(dcp_pricing).toHaveProperty('monthly_cost_usd');
    expect(dcp_pricing).toHaveProperty('monthly_cost_sar');
    expect(dcp_pricing).toHaveProperty('usage_assumption');
  });

  it('competitors array has at least 2 entries with savings_vs_dcp_pct > 0', async () => {
    const res = await request(app).get('/api/pricing/arabic-rag');
    expect(Array.isArray(res.body.competitors)).toBe(true);
    expect(res.body.competitors.length).toBeGreaterThanOrEqual(2);
    const withSavings = res.body.competitors.filter(c => c.savings_vs_dcp_pct > 0);
    expect(withSavings.length).toBeGreaterThanOrEqual(2);
  });

  it('competitor monthly costs are price_per_hour × 176h', async () => {
    const HOURS_PER_MONTH = 8 * 22;
    const res = await request(app).get('/api/pricing/arabic-rag');
    res.body.competitors.forEach(c => {
      const expected = parseFloat((c.price_per_hour_usd * HOURS_PER_MONTH).toFixed(2));
      expect(c.monthly_cost_usd).toBeCloseTo(expected, 1);
    });
  });

  it('bundle_components lists all 3 pipeline stages', async () => {
    const res = await request(app).get('/api/pricing/arabic-rag');
    expect(Array.isArray(res.body.bundle_components)).toBe(true);
    expect(res.body.bundle_components.length).toBe(3);
  });
});

// ── POST /api/jobs/submit with bundle_id ─────────────────────────────────

describe('POST /api/jobs/submit — bundle_id dispatch', () => {
  let renterKey;
  let providerId;

  beforeEach(() => {
    ({ apiKey: renterKey } = seedRenter({ balance: 500000 }));
    providerId = seedProvider({ vramGb: 24, vramMib: 24576 });
  });

  it('returns 400 for unknown bundle_id', async () => {
    const res = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ bundle_id: 'nonexistent-bundle', duration_minutes: 60 });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/bundle/i);
    expect(Array.isArray(res.body.available_bundles)).toBe(true);
    expect(res.body.available_bundles).toContain('arabic-rag');
  });

  it('accepts bundle_id arabic-rag and creates a rag-pipeline job', async () => {
    const res = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ bundle_id: 'arabic-rag', duration_minutes: 60 });

    // Either created or queued — both are valid depending on provider availability
    expect([201, 201]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.success).toBe(true);
      expect(res.body.job.job_type).toBe('rag-pipeline');
      expect(res.body.job.bundle_id).toBe('arabic-rag');
      expect(Array.isArray(res.body.job.bundle_components)).toBe(true);
      expect(res.body.job.bundle_components.length).toBe(3);
    }
  });

  it('bundle_id arabic-rag requires duration_minutes', async () => {
    const res = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ bundle_id: 'arabic-rag' });
    // Without duration_minutes this should fail validation
    expect([400, 422]).toContain(res.status);
  });

  it('bundle_id is validated by schema — rejects non-string', async () => {
    const res = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ bundle_id: 123, duration_minutes: 60 });
    expect(res.status).toBe(400);
  });

  it('returns 401 without renter key', async () => {
    const res = await request(app)
      .post('/api/jobs/submit')
      .send({ bundle_id: 'arabic-rag', duration_minutes: 60 });
    expect(res.status).toBe(401);
  });
});
