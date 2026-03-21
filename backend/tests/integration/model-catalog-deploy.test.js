'use strict';

const request = require('supertest');
const express = require('express');
const db = require('../../src/db');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/models', require('../../src/routes/models'));
  return app;
}

describe('Model catalog comparison + deploy handoff', () => {
  const app = createApp();

  test('GET /api/models/catalog returns enriched model payloads', async () => {
    const res = await request(app).get('/api/models/catalog');

    expect(res.status).toBe(200);
    expect(res.body.total_models).toBeGreaterThan(0);
    expect(Array.isArray(res.body.models)).toBe(true);

    const model = res.body.models.find((entry) => entry.model_id === 'Qwen/Qwen2-7B-Instruct');
    expect(model).toBeDefined();
    expect(model).toEqual(expect.objectContaining({
      availability: expect.objectContaining({
        providers_online: expect.any(Number),
        providers_warm: expect.any(Number),
        status: expect.any(String),
      }),
      pricing: expect.objectContaining({
        default_halala_per_min: expect.any(Number),
        avg_sar_per_min: expect.any(Number),
      }),
      benchmark: expect.objectContaining({
        latency_ms: expect.objectContaining({ p95: expect.any(Number) }),
        arabic_quality: expect.objectContaining({ arabic_mmlu_score: expect.any(Number) }),
      }),
      estimated_cold_start_ms: expect.any(Number),
    }));
  });

  test('GET /api/models/compare enforces at least two ids and returns ranking', async () => {
    const badRes = await request(app).get('/api/models/compare?ids=Qwen/Qwen2-7B-Instruct');
    expect(badRes.status).toBe(400);
    expect(badRes.body.error).toContain('at least two');

    const res = await request(app).get('/api/models/compare?ids=Qwen/Qwen2-7B-Instruct,mistralai/Mistral-7B-Instruct-v0.2');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.models)).toBe(true);
    expect(res.body.models.length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(res.body.ranking)).toBe(true);
    expect(res.body.ranking[0]).toEqual(expect.objectContaining({
      rank: 1,
      model_id: expect.any(String),
      avg_price_sar_per_min: expect.any(Number),
    }));
  });

  test('POST /api/models/:model_id/deploy requires renter auth and returns submit handoff payload', async () => {
    const unique = Date.now();
    const apiKey = `dcp-renter-${unique}`;
    db.prepare(
      `INSERT INTO renters (name, email, api_key, organization, status, balance_halala, total_spent_halala, total_jobs, created_at)
       VALUES (?, ?, ?, ?, 'active', 0, 0, 0, ?)`
    ).run(
      'Catalog Deploy Test',
      `catalog-deploy-${unique}@example.com`,
      apiKey,
      'DCP QA',
      new Date().toISOString()
    );

    const unauthorized = await request(app)
      .post('/api/models/Qwen%2FQwen2-7B-Instruct/deploy')
      .send({ duration_minutes: 90 });
    expect(unauthorized.status).toBe(401);

    const res = await request(app)
      .post('/api/models/Qwen%2FQwen2-7B-Instruct/deploy')
      .set('x-renter-key', apiKey)
      .send({ duration_minutes: 90, dtype: 'bfloat16', prewarm_requested: true });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.deploy_mode).toBe('vllm_serve');
    expect(res.body.submit).toEqual(expect.objectContaining({
      endpoint: '/api/jobs/submit',
      method: 'POST',
      auth: 'x-renter-key',
      body: expect.objectContaining({
        job_type: 'vllm_serve',
        duration_minutes: 90,
        model: 'Qwen/Qwen2-7B-Instruct',
      }),
    }));
    expect(res.body.estimate).toEqual(expect.objectContaining({
      duration_minutes: 90,
      estimated_cost_halala: expect.any(Number),
      providers_online: expect.any(Number),
    }));
  });
});
