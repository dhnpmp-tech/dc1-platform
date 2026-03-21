'use strict';

const request = require('supertest');
const express = require('express');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/models', require('../../src/routes/models'));
  return app;
}

describe('Model benchmark + card feeds', () => {
  const app = createApp();

  test('GET /api/models/benchmarks returns Arabic quality + latency + cost metrics', async () => {
    const res = await request(app).get('/api/models/benchmarks');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.models)).toBe(true);
    expect(res.body.models.length).toBeGreaterThan(0);

    const qwen = res.body.models.find((m) => m.model_id === 'Qwen/Qwen2-7B-Instruct');
    expect(qwen).toBeDefined();
    expect(qwen.latency_ms).toEqual(expect.objectContaining({ p50: expect.any(Number), p95: expect.any(Number), p99: expect.any(Number) }));
    expect(qwen.arabic_quality).toEqual(expect.objectContaining({ arabic_mmlu_score: expect.any(Number), arabicaqa_score: expect.any(Number) }));
    expect(qwen.cost_per_1k_tokens_halala).toEqual(expect.any(Number));
    expect(qwen.cost_per_1k_tokens_sar).toEqual(expect.any(Number));
    expect(qwen.vram_required_gb).toEqual(expect.any(Number));
    expect(qwen.cold_start_ms).toEqual(expect.any(Number));
  });

  test('GET /api/models/cards returns bilingual summaries with benchmark metrics', async () => {
    const res = await request(app).get('/api/models/cards');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('bilingual');
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards.length).toBeGreaterThan(0);

    const mistral = res.body.cards.find((c) => c.model_id === 'mistralai/Mistral-7B-Instruct-v0.2');
    expect(mistral).toBeDefined();
    expect(mistral.metrics).toEqual(expect.objectContaining({
      vram_required_gb: expect.any(Number),
      latency_ms: expect.objectContaining({ p50: expect.any(Number), p95: expect.any(Number), p99: expect.any(Number) }),
      arabic_quality: expect.objectContaining({ arabic_mmlu_score: expect.any(Number), arabicaqa_score: expect.any(Number) }),
      cost_per_1k_tokens_halala: expect.any(Number),
      cost_per_1k_tokens_sar: expect.any(Number),
      cold_start_ms: expect.any(Number),
    }));
    expect(typeof mistral.summary.en).toBe('string');
    expect(typeof mistral.summary.ar).toBe('string');
    expect(mistral.summary.ar.length).toBeGreaterThan(0);
  });
});
