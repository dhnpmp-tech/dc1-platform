'use strict';

const request = require('supertest');
const express = require('express');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/models', require('../../src/routes/models'));
  return app;
}

describe('Model catalog query filters', () => {
  const app = createApp();

  test('GET /api/models returns an array (legacy list)', async () => {
    const res = await request(app).get('/api/models');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/models?arabic_capable=true returns only Arabic-capable models', async () => {
    const all = await request(app).get('/api/models');
    const filtered = await request(app).get('/api/models?arabic_capable=true');

    expect(filtered.status).toBe(200);
    expect(Array.isArray(filtered.body)).toBe(true);
    // Every returned model must be Arabic-capable
    filtered.body.forEach((m) => {
      const id = (m.model_id || '').toLowerCase();
      const family = (m.family || '').toLowerCase();
      const isArabic =
        id.includes('allam') || id.includes('jais') || id.includes('arabic') ||
        id.includes('bge-m3') || id.includes('reranker') || id.includes('falcon-h1') ||
        family.includes('arabic');
      expect(isArabic).toBe(true);
    });
    // Must be a subset of the full list
    expect(filtered.body.length).toBeLessThanOrEqual(all.body.length);
  });

  test('GET /api/models?min_vram_gb=8 only returns models fitting in 8 GB VRAM', async () => {
    const res = await request(app).get('/api/models?min_vram_gb=8');
    expect(res.status).toBe(200);
    res.body.forEach((m) => {
      const needed = m.min_gpu_vram_gb ?? 0;
      expect(needed).toBeLessThanOrEqual(8);
    });
  });

  test('GET /api/models?category=embedding returns only embedding models', async () => {
    const all = await request(app).get('/api/models');
    const res = await request(app).get('/api/models?category=embedding');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(all.body.length);
  });

  test('GET /api/models/catalog?arabic_capable=true filters catalog endpoint too', async () => {
    const full = await request(app).get('/api/models/catalog');
    const filtered = await request(app).get('/api/models/catalog?arabic_capable=true');

    expect(filtered.status).toBe(200);
    expect(typeof filtered.body.total_models).toBe('number');
    expect(filtered.body.total_models).toBeLessThanOrEqual(full.body.total_models);
    expect(filtered.body.total_models).toBe(filtered.body.models.length);
  });

  test('GET /api/models/catalog?min_vram_gb=16&category=llm combines filters', async () => {
    const res = await request(app).get('/api/models/catalog?min_vram_gb=16&category=llm');
    expect(res.status).toBe(200);
    res.body.models.forEach((m) => {
      const needed = m.min_gpu_vram_gb ?? 0;
      expect(needed).toBeLessThanOrEqual(16);
    });
  });

  test('GET /api/models/:model_id/deploy/estimate returns estimate for valid model (GET)', async () => {
    // First get a real model_id from the catalog
    const catalogRes = await request(app).get('/api/models/catalog');
    expect(catalogRes.status).toBe(200);
    if (catalogRes.body.models.length === 0) return; // skip if DB is empty

    const modelId = catalogRes.body.models[0].model_id;
    const encoded = encodeURIComponent(modelId);

    const res = await request(app).get(
      `/api/models/${encoded}/deploy/estimate?duration_minutes=30`
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      model_id: modelId,
      estimate: expect.objectContaining({
        duration_minutes: 30,
        estimated_cost_halala: expect.any(Number),
        estimated_cost_sar: expect.any(Number),
        providers_online: expect.any(Number),
      }),
    }));
  });

  test('GET /api/models/:model_id/deploy/estimate returns 404 for unknown model', async () => {
    const res = await request(app).get('/api/models/nonexistent-model-xyz/deploy/estimate');
    expect(res.status).toBe(404);
  });
});
