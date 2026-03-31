'use strict';

const http = require('http');
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');

process.env.DC1_DB_PATH = process.env.DC1_DB_PATH || ':memory:';

const db = require('../../src/db');
const v1Router = require('../../src/routes/v1');
const providersRouter = require('../../src/routes/providers');

function safeDelete(table) {
  try {
    db.prepare(`DELETE FROM ${table}`).run();
  } catch (_) {}
}

function resetDb() {
  [
    'renter_api_keys',
    'jobs',
    'model_registry',
    'providers',
    'renters',
  ].forEach(safeDelete);
}

function nowIso() {
  return new Date().toISOString();
}

async function startMockProvider(mode, capture = []) {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        capture.push(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (_) {
        capture.push(null);
      }

      if (mode === 'stream') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(`data: ${JSON.stringify({
          id: 'chatcmpl-stream',
          object: 'chat.completion.chunk',
          model: 'parity-model',
          created: Math.floor(Date.now() / 1000),
          choices: [{ index: 0, delta: { content: 'Mar' }, finish_reason: null }],
        })}\n\n`);
        res.write(`data: ${JSON.stringify({
          id: 'chatcmpl-stream',
          object: 'chat.completion.chunk',
          model: 'parity-model',
          created: Math.floor(Date.now() / 1000),
          choices: [{ index: 0, delta: { content: 'haba' }, finish_reason: 'stop' }],
        })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        model: 'parity-model',
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
      }));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return {
    endpointUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function seedRenter(apiKey) {
  db.prepare(
    `INSERT INTO renters
      (name, email, api_key, status, balance_halala, total_spent_halala, total_jobs, created_at)
     VALUES (?, ?, ?, 'active', ?, 0, 0, ?)`
  ).run('Parity Renter', `${apiKey}@dc1.test`, apiKey, 100000, nowIso());
}

function seedProvider(endpointUrl) {
  const result = db.prepare(
    `INSERT INTO providers
      (name, email, api_key, gpu_model, vram_gb, gpu_vram_mib, approval_status, status,
       supported_compute_types, vllm_endpoint_url, last_heartbeat, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'approved', 'online', '["inference"]', ?, ?, ?, ?)`
  ).run(
    'Parity Provider',
    `provider-${Date.now()}@dc1.test`,
    `provider-${crypto.randomBytes(6).toString('hex')}`,
    'RTX 4090',
    24,
    24576,
    endpointUrl,
    nowIso(),
    nowIso(),
    nowIso()
  );
  return result.lastInsertRowid;
}

function seedModel(modelId = 'parity-model') {
  db.prepare(
    `INSERT OR REPLACE INTO model_registry
      (model_id, display_name, family, vram_gb, quantization, context_window, use_cases,
       min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    modelId,
    'Parity Model',
    'test',
    8,
    'fp16',
    4096,
    '[]',
    4,
    20,
    nowIso()
  );
}

describe('/v1 OpenRouter parity', () => {
  let app;

  beforeEach(() => {
    resetDb();
    app = express();
    app.use(express.json());
    app.use('/v1', v1Router);
    app.use('/api/providers', providersRouter);
  });

  test('GET /v1/models returns OpenAI list payload even when model_registry has no parameter_count column', async () => {
    seedModel();

    const res = await request(app).get('/v1/models');
    const parityModel = (res.body.data || []).find((model) => model.id === 'parity-model');

    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(parityModel).toMatchObject({
      id: 'parity-model',
      object: 'model',
      display_name: 'Parity Model',
    });
    expect(parityModel).toHaveProperty('parameter_count');
  });

  test('POST /v1/chat/completions with stream=true preserves SSE output and DONE terminator', async () => {
    const provider = await startMockProvider('stream');
    const renterKey = 'parity-renter-stream';
    try {
      seedModel();
      seedRenter(renterKey);
      seedProvider(provider.endpointUrl);

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${renterKey}`)
        .send({
          model: 'parity-model',
          messages: [{ role: 'user', content: 'hello' }],
          stream: true,
        });

      expect(res.status).toBe(200);
      expect(String(res.headers['content-type'] || '')).toContain('text/event-stream');
      expect(res.text).toContain('data: [DONE]');
      expect(res.text).toContain('Mar');
    } finally {
      await provider.close();
    }
  });

  test('POST /v1/chat/completions forwards tools and tool_choice to provider', async () => {
    const providerCapture = [];
    const provider = await startMockProvider('json', providerCapture);
    const renterKey = 'parity-renter-tools';

    try {
      seedModel();
      seedRenter(renterKey);
      seedProvider(provider.endpointUrl);

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${renterKey}`)
        .send({
          model: 'parity-model',
          messages: [{ role: 'user', content: 'call tool' }],
          tools: [{
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather by city',
              parameters: {
                type: 'object',
                properties: { city: { type: 'string' } },
                required: ['city'],
              },
            },
          }],
          tool_choice: { type: 'function', function: { name: 'get_weather' } },
        });

      expect(res.status).toBe(200);
      expect(providerCapture[0]?.tools?.length).toBe(1);
      expect(providerCapture[0]?.tool_choice).toEqual({ type: 'function', function: { name: 'get_weather' } });
    } finally {
      await provider.close();
    }
  });

  test('model catalog required fields stay parity-aligned between /v1/models and /api/providers/model-catalog', async () => {
    seedModel('parity-catalog-model');
    const providerId = seedProvider('http://127.0.0.1:9');
    db.prepare('UPDATE providers SET cached_models = ? WHERE id = ?').run(
      JSON.stringify([{ model_id: 'parity-catalog-model', display_name: 'Parity Model' }]),
      providerId
    );

    const [v1Res, providerRes] = await Promise.all([
      request(app).get('/v1/models'),
      request(app).get('/api/providers/model-catalog'),
    ]);

    expect(v1Res.status).toBe(200);
    expect(providerRes.status).toBe(200);

    const v1Model = (v1Res.body.data || []).find((entry) => entry.id === 'parity-catalog-model');
    const providerModel = (providerRes.body.data || []).find((entry) => entry.id === 'parity-catalog-model');

    expect(v1Model).toBeDefined();
    expect(providerModel).toBeDefined();

    const requiredParityKeys = [
      'id',
      'name',
      'created',
      'modalities',
      'context_length',
      'max_output_tokens',
      'quantization',
      'pricing',
      'capability_flags',
      'supported_features',
    ];

    requiredParityKeys.forEach((key) => {
      expect(v1Model).toHaveProperty(key);
      expect(providerModel).toHaveProperty(key);
    });

    expect(typeof v1Model.created).toBe('number');
    expect(typeof providerModel.created).toBe('number');
    expect(v1Model.pricing).toEqual(providerModel.pricing);
    expect(v1Model.capability_flags).toEqual(providerModel.capability_flags);
    expect(v1Model.supported_features).toEqual(providerModel.supported_features);
    expect(v1Model.pricing.usd_per_minute).toMatch(/^\d+\.\d{6}$/);

    const assertKeyOrder = (entry) => {
      const keys = Object.keys(entry);
      const indexes = requiredParityKeys.map((key) => keys.indexOf(key));
      expect(indexes.every((idx) => idx >= 0)).toBe(true);
      for (let i = 1; i < indexes.length; i += 1) {
        expect(indexes[i]).toBeGreaterThan(indexes[i - 1]);
      }
    };

    assertKeyOrder(v1Model);
    assertKeyOrder(providerModel);
  });
});
