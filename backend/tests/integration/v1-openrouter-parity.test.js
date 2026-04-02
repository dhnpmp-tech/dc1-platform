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
    'inference_stream_events',
    'benchmark_runs',
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

      if (mode === 'error') {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'upstream failure' }));
        return;
      }

      if (mode === 'stream' || mode === 'stream_no_done' || mode === 'stream_double_done') {
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
        if (mode !== 'stream_no_done') {
          res.write('data: [DONE]\n\n');
        }
        if (mode === 'stream_double_done') {
          res.write('data: [DONE]\n\n');
        }
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

function seedProvider(endpointUrl, { gpuUtilPct = null } = {}) {
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const result = db.prepare(
    `INSERT INTO providers
      (name, email, api_key, gpu_model, vram_gb, gpu_vram_mib, approval_status, status,
       supported_compute_types, vllm_endpoint_url, last_heartbeat, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'approved', 'online', '["inference"]', ?, ?, ?, ?)`
  ).run(
    'Parity Provider',
    `provider-${uniqueSuffix}@dc1.test`,
    `provider-${crypto.randomBytes(6).toString('hex')}`,
    'RTX 4090',
    24,
    24576,
    endpointUrl,
    nowIso(),
    nowIso(),
    nowIso()
  );
  if (gpuUtilPct != null) {
    try {
      db.prepare('UPDATE providers SET gpu_util_pct = ? WHERE id = ?').run(gpuUtilPct, result.lastInsertRowid);
    } catch (_) {
      // Older schema snapshots used by tests may not include gpu_util_pct.
    }
  }
  return result.lastInsertRowid;
}

function seedBenchmarkRun(providerId, latencyMs, benchmarkType = 'standard') {
  db.prepare(
    `INSERT INTO benchmark_runs
      (provider_id, benchmark_type, status, started_at, completed_at, latency_ms, notes)
     VALUES (?, ?, 'completed', ?, ?, ?, ?)`
  ).run(providerId, benchmarkType, nowIso(), nowIso(), latencyMs, 'v1 latency gate test');
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
  let envSnapshot;

  beforeEach(() => {
    resetDb();
    envSnapshot = { ...process.env };
    app = express();
    app.use(express.json());
    app.use('/v1', v1Router);
    app.use('/api/providers', providersRouter);
  });

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in envSnapshot)) {
        delete process.env[key];
      }
    });
    Object.keys(envSnapshot).forEach((key) => {
      process.env[key] = envSnapshot[key];
    });
  });

  test('GET /v1/models returns OpenRouter-required model fields', async () => {
    seedModel();

    const res = await request(app).get('/v1/models');
    const parityModel = (res.body.data || []).find((model) => model.id === 'parity-model');

    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(parityModel).toMatchObject({
      id: 'parity-model',
      object: 'model',
      name: 'Parity Model',
      display_name: 'Parity Model',
      description: expect.any(String),
      context_length: expect.any(Number),
      architecture: {
        tokenizer: 'test',
        instruct_type: 'instruct',
        modality: 'text',
      },
      endpoints: [{ url: expect.stringMatching(/\/v1\/chat\/completions$/), type: 'chat' }],
      provider_priority: ['dcp'],
    });
    expect(parityModel.pricing).toMatchObject({
      prompt_tokens: expect.any(String),
      completion_tokens: expect.any(String),
    });
    expect(typeof parityModel.pricing.prompt_tokens).toBe('string');
    expect(parityModel.pricing.prompt_tokens).toMatch(/^\d+\.\d{6}$/);
    expect(parityModel.pricing.completion_tokens).toMatch(/^\d+\.\d{6}$/);
    expect(parityModel.pricing.usd_per_minute).toMatch(/^\d+\.\d{6}$/);
    expect(parityModel.pricing.usd_per_1m_input_tokens).toMatch(/^\d+\.\d{6}$/);
    expect(parityModel.pricing.usd_per_1m_output_tokens).toMatch(/^\d+\.\d{6}$/);
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
      expect((res.text.match(/data:\s*\[DONE\]/g) || [])).toHaveLength(1);
      expect(res.text).toContain('Mar');
    } finally {
      await provider.close();
    }
  });

  test('POST /v1/chat/completions stream emits exactly one DONE even when provider emits duplicates', async () => {
    const provider = await startMockProvider('stream_double_done');
    const renterKey = 'parity-renter-stream-double-done';
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
      expect((res.text.match(/data:\s*\[DONE\]/g) || [])).toHaveLength(1);
    } finally {
      await provider.close();
    }
  });

  test('POST /v1/chat/completions stream fallback path terminates with one DONE when fallback provider omits DONE', async () => {
    const primary = await startMockProvider('error');
    const fallback = await startMockProvider('stream_no_done');
    const renterKey = 'parity-renter-stream-fallback';
    try {
      seedModel();
      seedRenter(renterKey);
      seedProvider(primary.endpointUrl, { gpuUtilPct: 1 });
      seedProvider(fallback.endpointUrl, { gpuUtilPct: 90 });

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${renterKey}`)
        .send({
          model: 'parity-model',
          messages: [{ role: 'user', content: 'hello fallback' }],
          stream: true,
        });

      expect(res.status).toBe(200);
      expect(String(res.headers['content-type'] || '')).toContain('text/event-stream');
      expect(res.text).toContain('Mar');
      expect((res.text.match(/data:\s*\[DONE\]/g) || [])).toHaveLength(1);
    } finally {
      await primary.close();
      await fallback.close();
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

  test('POST /v1/chat/completions preserves explicit tools/tool_choice payload values without normalization', async () => {
    const providerCapture = [];
    const provider = await startMockProvider('json', providerCapture);
    const renterKey = 'parity-renter-raw-tool-fields';
    const toolsPayload = { raw: true, schema_version: 2, nested: { depth: ['x', 'y'] } };

    try {
      seedModel();
      seedRenter(renterKey);
      seedProvider(provider.endpointUrl);

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${renterKey}`)
        .send({
          model: 'parity-model',
          messages: [{ role: 'user', content: 'passthrough payloads' }],
          tools: toolsPayload,
          tool_choice: false,
        });

      expect(res.status).toBe(200);
      expect(providerCapture[0]?.tools).toEqual(toolsPayload);
      expect(providerCapture[0]?.tool_choice).toBe(false);
    } finally {
      await provider.close();
    }
  });

  test('POST /v1/chat/completions forwards optional OpenAI-compatible request fields unchanged', async () => {
    const providerCapture = [];
    const provider = await startMockProvider('json', providerCapture);
    const renterKey = 'parity-renter-optional-field-passthrough';

    try {
      seedModel();
      seedRenter(renterKey);
      seedProvider(provider.endpointUrl);

      const payload = {
        model: 'parity-model',
        messages: [{ role: 'user', content: 'optional fields passthrough' }],
        top_p: 0.55,
        frequency_penalty: 0.25,
        presence_penalty: -0.5,
        stop: ['</tool>', 'END'],
        n: 2,
        seed: 42,
        stream_options: { include_usage: true },
        response_format: { type: 'json_object' },
        parallel_tool_calls: false,
        user: 'renter_qa',
        metadata: { source: 'integration-test', tier: 'qa' },
      };

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${renterKey}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(providerCapture[0]?.top_p).toBe(payload.top_p);
      expect(providerCapture[0]?.frequency_penalty).toBe(payload.frequency_penalty);
      expect(providerCapture[0]?.presence_penalty).toBe(payload.presence_penalty);
      expect(providerCapture[0]?.stop).toEqual(payload.stop);
      expect(providerCapture[0]?.n).toBe(payload.n);
      expect(providerCapture[0]?.seed).toBe(payload.seed);
      expect(providerCapture[0]?.stream_options).toEqual(payload.stream_options);
      expect(providerCapture[0]?.response_format).toEqual(payload.response_format);
      expect(providerCapture[0]?.parallel_tool_calls).toBe(payload.parallel_tool_calls);
      expect(providerCapture[0]?.user).toBe(payload.user);
      expect(providerCapture[0]?.metadata).toEqual(payload.metadata);
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
    expect(v1Model.pricing).toMatchObject(providerModel.pricing);
    expect(v1Model.pricing).toMatchObject({
      prompt_tokens: expect.any(String),
      completion_tokens: expect.any(String),
    });
    expect(v1Model.capability_flags).toEqual(providerModel.capability_flags);
    expect(v1Model.supported_features).toEqual(providerModel.supported_features);
    expect(v1Model.pricing.prompt_tokens).toMatch(/^\d+\.\d{6}$/);
    expect(v1Model.pricing.completion_tokens).toMatch(/^\d+\.\d{6}$/);
    expect(v1Model.pricing.usd_per_minute).toMatch(/^\d+\.\d{6}$/);
    expect(v1Model.pricing.usd_per_1m_input_tokens).toMatch(/^\d+\.\d{6}$/);
    expect(v1Model.pricing.usd_per_1m_output_tokens).toMatch(/^\d+\.\d{6}$/);

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

  test('POST /v1/chat/completions allows sparse-provider fallback mode when telemetry is below sample floor', async () => {
    const provider = await startMockProvider('json');
    const renterKey = 'parity-renter-sparse-fallback';
    try {
      process.env.V1_LATENCY_GATE_MIN_SAMPLES = '4';
      process.env.V1_LATENCY_GATE_MIN_STREAM_SAMPLES = '2';
      process.env.V1_LATENCY_GATE_MAX_P50_MS = '300';
      process.env.V1_LATENCY_GATE_BASELINE_P95_MS = '900';
      process.env.V1_LATENCY_GATE_MAX_P95_REGRESSION_PCT = '0.2';

      seedModel();
      seedRenter(renterKey);
      const providerId = seedProvider(provider.endpointUrl, { gpuUtilPct: 12 });
      seedBenchmarkRun(providerId, 180);

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${renterKey}`)
        .send({
          model: 'parity-model',
          messages: [{ role: 'user', content: 'sparse fallback probe' }],
        });

      expect(res.status).toBe(200);
      expect(res.headers['x-dcp-latency-gate-mode']).toBe('sparse_provider_fallback');
    } finally {
      await provider.close();
    }
  });

  test('POST /v1/chat/completions rejects provider routing when latency budget is breached', async () => {
    const provider = await startMockProvider('json');
    const renterKey = 'parity-renter-gate-breach';
    try {
      process.env.V1_LATENCY_GATE_MIN_SAMPLES = '3';
      process.env.V1_LATENCY_GATE_MIN_STREAM_SAMPLES = '0';
      process.env.V1_LATENCY_GATE_MAX_P50_MS = '300';
      process.env.V1_LATENCY_GATE_BASELINE_P95_MS = '900';
      process.env.V1_LATENCY_GATE_MAX_P95_REGRESSION_PCT = '0.1';

      seedModel();
      seedRenter(renterKey);
      const providerId = seedProvider(provider.endpointUrl, { gpuUtilPct: 3 });
      [450, 520, 610, 640].forEach((latency) => seedBenchmarkRun(providerId, latency));

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${renterKey}`)
        .send({
          model: 'parity-model',
          messages: [{ role: 'user', content: 'budget breach probe' }],
        });

      expect(res.status).toBe(503);
      expect(res.body?.type || res.body?.error?.type).toBe('latency_budget_gate_error');
      expect(JSON.stringify((res.body?.details || res.body?.error?.details)?.reasons || [])).toMatch(/p50|p95|latency/i);
    } finally {
      await provider.close();
    }
  });
});
