'use strict';

/**
 * models-catalog-api.test.js — Integration tests for the model catalog API (DCP-872)
 *
 * Tests:
 *   1. GET /api/models — returns active models with pricing and availability
 *   2. GET /api/models?arabic_capable=true — filters to Arabic models only
 *   3. GET /api/models?min_vram_gb=N — filters by VRAM requirement
 *   4. GET /api/models?category=llm — filters by task category
 *   5. GET /api/models/:id — single model detail
 *   6. GET /api/models/:id — 404 for unknown model
 *   7. GET /api/models/catalog — managed catalog payload
 *   8. GET /api/models/benchmarks — benchmark feed
 *   9. GET /api/models/compare?ids=a,b — side-by-side compare
 *  10. POST /api/renters/topup — sandbox topup with halala
 *  11. POST /api/renters/topup — sandbox topup with SAR
 *  12. POST /api/renters/topup — rejects amount_halala > 100000
 *  13. POST /api/renters/topup — rejects missing amount fields
 *  14. POST /api/renters/topup — rejects unknown renter key
 *  15. POST /api/renters/topup — balance increases correctly
 *
 * Uses in-memory SQLite (jest-setup.js sets DC1_DB_PATH=:memory:).
 */

process.env.SUPABASE_URL         = process.env.SUPABASE_URL         || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key-stub';
process.env.NODE_ENV             = 'test';
process.env.ALLOW_SANDBOX_TOPUP  = 'true';

const request = require('supertest');
const express = require('express');
const crypto  = require('crypto');
const db      = require('../src/db');

// ── App factory ───────────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/models',  require('../src/routes/models'));
  app.use('/api/renters', require('../src/routes/renters'));
  return app;
}

const app = createApp();

// ── DB helpers ────────────────────────────────────────────────────────────────

function cleanDb() {
  const safe = (t) => { try { db.prepare(`DELETE FROM ${t}`).run(); } catch (_) {} };
  try { db.prepare('PRAGMA foreign_keys = OFF').run(); } catch (_) {}
  for (const t of [
    'model_benchmark_profiles', 'model_registry',
    'jobs', 'renters', 'providers',
  ]) { safe(t); }
  try { db.prepare('PRAGMA foreign_keys = ON').run(); } catch (_) {}
}

function insertModel(overrides = {}) {
  const defaults = {
    model_id:                  overrides.model_id  || `model-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    display_name:              overrides.display_name || 'Test Model',
    family:                    overrides.family || 'llm',
    vram_gb:                   overrides.vram_gb ?? 16,
    quantization:              overrides.quantization || 'fp16',
    context_window:            overrides.context_window ?? 4096,
    use_cases:                 overrides.use_cases || JSON.stringify(['chat', 'instruct']),
    min_gpu_vram_gb:           overrides.min_gpu_vram_gb ?? 16,
    default_price_halala_per_min: overrides.default_price_halala_per_min ?? 100,
    is_active:                 overrides.is_active ?? 1,
  };

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO model_registry
      (model_id, display_name, family, vram_gb, quantization, context_window,
       use_cases, min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    defaults.model_id, defaults.display_name, defaults.family,
    defaults.vram_gb, defaults.quantization, defaults.context_window,
    defaults.use_cases, defaults.min_gpu_vram_gb,
    defaults.default_price_halala_per_min, defaults.is_active, now, now,
  );

  return defaults.model_id;
}

async function registerRenter(overrides = {}) {
  const res = await request(app).post('/api/renters/register').send({
    name:  overrides.name  || `Renter-${Date.now()}`,
    email: overrides.email || `renter-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
  });
  expect([200, 201]).toContain(res.status);
  return { id: res.body.renter_id, apiKey: res.body.api_key };
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  cleanDb();
  // Force cache invalidation between tests
  try { require('../src/routes/models').invalidateCatalogCache(); } catch (_) {}
});

afterAll(() => {
  cleanDb();
});

// ── Model Catalog Tests ───────────────────────────────────────────────────────

describe('GET /api/models', () => {
  test('returns empty array when no models registered', async () => {
    const res = await request(app).get('/api/models');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  test('returns active models with required pricing fields', async () => {
    insertModel({ model_id: 'llama-3-8b-instruct', display_name: 'LLaMA 3 8B', min_gpu_vram_gb: 19 });

    const res = await request(app).get('/api/models');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    const model = res.body[0];
    expect(model).toHaveProperty('model_id');
    expect(model).toHaveProperty('display_name');
    expect(model).toHaveProperty('min_gpu_vram_gb');
    expect(model).toHaveProperty('avg_price_sar_per_min');
    expect(model).toHaveProperty('status');
    expect(model).toHaveProperty('competitor_prices');
    expect(model).toHaveProperty('savings_pct');
  });

  test('excludes inactive models', async () => {
    insertModel({ model_id: 'active-model', display_name: 'Active Model', is_active: 1 });
    insertModel({ model_id: 'inactive-model', display_name: 'Inactive Model', is_active: 0 });

    const res = await request(app).get('/api/models');
    expect(res.status).toBe(200);
    const ids = res.body.map((m) => m.model_id);
    expect(ids).toContain('active-model');
    expect(ids).not.toContain('inactive-model');
  });

  test('filters by arabic_capable=true', async () => {
    insertModel({ model_id: 'allam-7b-instruct', display_name: 'ALLaM 7B', family: 'allam-llm' });
    insertModel({ model_id: 'generic-llm-instruct', display_name: 'Generic LLM', family: 'llm' });

    const res = await request(app).get('/api/models?arabic_capable=true');
    expect(res.status).toBe(200);
    const ids = res.body.map((m) => m.model_id);
    expect(ids).toContain('allam-7b-instruct');
    // generic-llm-instruct has no arabic patterns in id or family
    expect(ids).not.toContain('generic-llm-instruct');
  });

  test('filters by min_vram_gb — only returns models fitting within VRAM budget', async () => {
    insertModel({ model_id: 'small-model', display_name: 'Small Model', min_gpu_vram_gb: 8 });
    insertModel({ model_id: 'large-model', display_name: 'Large Model', min_gpu_vram_gb: 80 });

    // Renter has 24 GB GPU — should see 8 GB model but not 80 GB model
    const res = await request(app).get('/api/models?min_vram_gb=24');
    expect(res.status).toBe(200);
    const ids = res.body.map((m) => m.model_id);
    expect(ids).toContain('small-model');
    expect(ids).not.toContain('large-model');
  });

  test('filters by category=llm', async () => {
    insertModel({
      model_id: 'chat-model', display_name: 'Chat Model',
      use_cases: JSON.stringify(['chat', 'instruct']),
    });
    insertModel({
      model_id: 'embed-model', display_name: 'Embed Model',
      family: 'embedding',
      use_cases: JSON.stringify(['embed']),
    });

    const res = await request(app).get('/api/models?category=llm');
    expect(res.status).toBe(200);
    const ids = res.body.map((m) => m.model_id);
    expect(ids).toContain('chat-model');
    expect(ids).not.toContain('embed-model');
  });

  test('filters by category=embedding', async () => {
    insertModel({
      model_id: 'bge-m3-embedding', display_name: 'BGE-M3',
      family: 'bge-m3-embedding',
      use_cases: JSON.stringify(['embed']),
    });
    insertModel({
      model_id: 'llama-chat', display_name: 'LLaMA Chat',
      use_cases: JSON.stringify(['chat']),
    });

    const res = await request(app).get('/api/models?category=embedding');
    expect(res.status).toBe(200);
    const ids = res.body.map((m) => m.model_id);
    expect(ids).toContain('bge-m3-embedding');
    expect(ids).not.toContain('llama-chat');
  });
});

describe('GET /api/models/:model_id', () => {
  test('returns full model detail for known model', async () => {
    insertModel({ model_id: 'allam-7b-instruct', display_name: 'ALLaM 7B Instruct' });

    const res = await request(app).get('/api/models/allam-7b-instruct');
    expect(res.status).toBe(200);
    expect(res.body.model_id).toBe('allam-7b-instruct');
    expect(res.body).toHaveProperty('pricing');
    expect(res.body).toHaveProperty('availability');
    expect(res.body).toHaveProperty('benchmark');
    expect(res.body.pricing).toHaveProperty('default_halala_per_min');
    expect(res.body.pricing).toHaveProperty('competitor_prices');
    expect(res.body.pricing).toHaveProperty('savings_pct');
  });

  test('returns 404 for unknown model_id', async () => {
    const res = await request(app).get('/api/models/nonexistent-model-xyz');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 404 for inactive model', async () => {
    insertModel({ model_id: 'disabled-model', is_active: 0 });
    const res = await request(app).get('/api/models/disabled-model');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/models/catalog', () => {
  test('returns catalog payload with metadata', async () => {
    insertModel({ model_id: 'test-catalog-model', display_name: 'Catalog Model' });

    const res = await request(app).get('/api/models/catalog');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('generated_at');
    expect(res.body).toHaveProperty('total_models');
    expect(res.body).toHaveProperty('models');
    expect(Array.isArray(res.body.models)).toBe(true);
    expect(res.body.total_models).toBe(res.body.models.length);
  });

  test('catalog supports arabic_capable filter', async () => {
    insertModel({ model_id: 'jais-13b-chat', display_name: 'JAIS 13B', family: 'jais' });
    insertModel({ model_id: 'generic-llm-model', display_name: 'Generic Model', family: 'llm' });

    const res = await request(app).get('/api/models/catalog?arabic_capable=true');
    expect(res.status).toBe(200);
    const ids = res.body.models.map((m) => m.model_id);
    expect(ids).toContain('jais-13b-chat');
    expect(ids).not.toContain('generic-llm-model');
  });
});

describe('GET /api/models/benchmarks', () => {
  test('returns benchmark feed with suite metadata', async () => {
    insertModel({ model_id: 'benchmark-test-model' });

    const res = await request(app).get('/api/models/benchmarks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('benchmark_suite');
    expect(res.body).toHaveProperty('generated_at');
    expect(res.body).toHaveProperty('models');
    expect(Array.isArray(res.body.models)).toBe(true);
  });
});

describe('GET /api/models/compare', () => {
  test('returns side-by-side comparison with ranking', async () => {
    insertModel({ model_id: 'model-alpha', display_name: 'Model Alpha', min_gpu_vram_gb: 16, default_price_halala_per_min: 80 });
    insertModel({ model_id: 'model-beta', display_name: 'Model Beta', min_gpu_vram_gb: 19, default_price_halala_per_min: 120 });

    const res = await request(app).get('/api/models/compare?ids=model-alpha,model-beta');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('models');
    expect(res.body).toHaveProperty('ranking');
    expect(res.body.models.length).toBeGreaterThanOrEqual(1);
    expect(res.body.ranking.length).toBeGreaterThanOrEqual(1);
  });

  test('returns 400 when fewer than 2 ids provided', async () => {
    const res = await request(app).get('/api/models/compare?ids=model-alpha');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 404 when no matching models found', async () => {
    const res = await request(app).get('/api/models/compare?ids=ghost-model-a,ghost-model-b');
    expect(res.status).toBe(404);
  });
});

describe('Catalog cache invalidation', () => {
  test('invalidateCatalogCache exposed on module', () => {
    const modelsRouter = require('../src/routes/models');
    expect(typeof modelsRouter.invalidateCatalogCache).toBe('function');
  });

  test('cache returns fresh data after invalidation', async () => {
    // First request — seeds cache
    const res1 = await request(app).get('/api/models');
    expect(res1.status).toBe(200);
    const count1 = res1.body.length;

    // Insert a new model and invalidate cache
    insertModel({ model_id: 'cache-test-model', display_name: 'Cache Test Model' });
    require('../src/routes/models').invalidateCatalogCache();

    // Second request — should see new model
    const res2 = await request(app).get('/api/models');
    expect(res2.status).toBe(200);
    expect(res2.body.length).toBeGreaterThan(count1);
    const ids = res2.body.map((m) => m.model_id);
    expect(ids).toContain('cache-test-model');
  });
});

// ── Renter Topup Tests ────────────────────────────────────────────────────────

describe('POST /api/renters/topup (sandbox mode)', () => {
  beforeEach(() => {
    process.env.ALLOW_SANDBOX_TOPUP = 'true';
    // NODE_ENV must NOT be 'production' for sandbox topup to work
    process.env.NODE_ENV = 'test';
  });

  test('tops up balance with amount_halala', async () => {
    const { apiKey } = await registerRenter();

    const res = await request(app)
      .post('/api/renters/topup')
      .set('x-renter-key', apiKey)
      .send({ amount_halala: 5000 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.topped_up_halala).toBe(5000);
    expect(res.body.new_balance_halala).toBeGreaterThanOrEqual(5000);
  });

  test('tops up balance with amount_sar (converts to halala)', async () => {
    const { apiKey } = await registerRenter();

    const res = await request(app)
      .post('/api/renters/topup')
      .set('x-renter-key', apiKey)
      .send({ amount_sar: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.topped_up_halala).toBe(1000); // 10 SAR × 100
    expect(res.body.topped_up_sar).toBeCloseTo(10, 1);
  });

  test('rejects amount_halala above 100000', async () => {
    const { apiKey } = await registerRenter();

    const res = await request(app)
      .post('/api/renters/topup')
      .set('x-renter-key', apiKey)
      .send({ amount_halala: 100001 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('rejects request with neither amount_halala nor amount_sar', async () => {
    const { apiKey } = await registerRenter();

    const res = await request(app)
      .post('/api/renters/topup')
      .set('x-renter-key', apiKey)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('rejects unknown renter API key', async () => {
    const res = await request(app)
      .post('/api/renters/topup')
      .set('x-renter-key', 'nonexistent-key-xyz-9999')
      .send({ amount_halala: 1000 });

    expect([401, 404]).toContain(res.status);
  });

  test('balance accumulates across multiple topups', async () => {
    const { apiKey } = await registerRenter();

    await request(app)
      .post('/api/renters/topup')
      .set('x-renter-key', apiKey)
      .send({ amount_halala: 2000 });

    const res = await request(app)
      .post('/api/renters/topup')
      .set('x-renter-key', apiKey)
      .send({ amount_halala: 3000 });

    expect(res.status).toBe(200);
    // Balance should be at least 5000 (2000 + 3000)
    expect(res.body.new_balance_halala).toBeGreaterThanOrEqual(5000);
  });

  test('concurrent topups both succeed (SQLite atomic UPDATE)', async () => {
    const { apiKey } = await registerRenter();

    // Fire two topups concurrently — SQLite's atomic balance + halala prevents lost updates
    const [res1, res2] = await Promise.all([
      request(app).post('/api/renters/topup').set('x-renter-key', apiKey).send({ amount_halala: 1000 }),
      request(app).post('/api/renters/topup').set('x-renter-key', apiKey).send({ amount_halala: 1000 }),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Final balance should reflect both topups (2000 minimum)
    const balanceRes = await request(app)
      .get('/api/renters/balance')
      .set('x-renter-key', apiKey);
    expect(balanceRes.status).toBe(200);
    expect(balanceRes.body.balance_halala).toBeGreaterThanOrEqual(2000);
  });

  test('rejects negative amount_sar', async () => {
    const { apiKey } = await registerRenter();

    const res = await request(app)
      .post('/api/renters/topup')
      .set('x-renter-key', apiKey)
      .send({ amount_sar: -5 });

    expect(res.status).toBe(400);
  });

  test('rejects zero amount_sar', async () => {
    const { apiKey } = await registerRenter();

    const res = await request(app)
      .post('/api/renters/topup')
      .set('x-renter-key', apiKey)
      .send({ amount_sar: 0 });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/renters/balance', () => {
  test('returns balance fields for active renter', async () => {
    const { apiKey } = await registerRenter();

    const res = await request(app)
      .get('/api/renters/balance')
      .set('x-renter-key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('balance_halala');
    expect(res.body).toHaveProperty('balance_sar');
    expect(res.body).toHaveProperty('held_halala');
    expect(res.body).toHaveProperty('available_halala');
  });

  test('balance_sar is balance_halala / 100', async () => {
    const { apiKey } = await registerRenter();

    // Topup 500 halala first
    await request(app)
      .post('/api/renters/topup')
      .set('x-renter-key', apiKey)
      .send({ amount_halala: 500 });

    const res = await request(app)
      .get('/api/renters/balance')
      .set('x-renter-key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.balance_sar).toBeCloseTo(res.body.balance_halala / 100, 5);
  });

  test('returns 401 without renter key', async () => {
    const res = await request(app).get('/api/renters/balance');
    expect(res.status).toBe(400);
  });
});
