'use strict';

const http = require('http');
const express = require('express');
const request = require('supertest');

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';

const db = require('../src/db');
const v1Router = require('../src/routes/v1');

function nowIso() {
  return new Date().toISOString();
}

function safeDelete(table) {
  try {
    db.prepare(`DELETE FROM ${table}`).run();
  } catch (_) {}
}

function resetDb() {
  [
    'openrouter_settlement_alerts',
    'openrouter_settlement_items',
    'openrouter_settlement_topups',
    'openrouter_settlement_invoices',
    'openrouter_settlements',
    'openrouter_usage_ledger',
    'renter_api_keys',
    'jobs',
    'inference_stream_events',
    'benchmark_runs',
    'model_registry',
    'providers',
    'renters',
  ].forEach(safeDelete);
}

function seedModel(modelId = 'openrouter-failover-model') {
  db.prepare(
    `INSERT OR REPLACE INTO model_registry
      (model_id, display_name, family, vram_gb, quantization, context_window, use_cases,
       min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    modelId,
    'OpenRouter Failover Model',
    'qa',
    8,
    'fp16',
    8192,
    '["qa"]',
    4,
    20,
    nowIso()
  );
}

function seedRenter(apiKey = 'qa-failover-renter', balanceHalala = 10_000) {
  db.prepare(
    `INSERT INTO renters
      (name, email, api_key, status, balance_halala, total_spent_halala, total_jobs, created_at)
     VALUES (?, ?, ?, 'active', ?, 0, 0, ?)`
  ).run(
    'Failover Renter',
    `${apiKey}@dc1.test`,
    apiKey,
    balanceHalala,
    nowIso()
  );
  return apiKey;
}

function seedProvider(endpointUrl, { gpuUtilPct = null } = {}) {
  const result = db.prepare(
    `INSERT INTO providers
      (name, email, api_key, gpu_model, vram_gb, gpu_vram_mib, approval_status, status,
       supported_compute_types, vllm_endpoint_url, last_heartbeat, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'approved', 'online', '["inference"]', ?, ?, ?, ?)`
  ).run(
    'Failover Provider',
    `provider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@dc1.test`,
    `provider-${Math.random().toString(36).slice(2, 12)}`,
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
    } catch (_) {}
  }

  return Number(result.lastInsertRowid);
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function startMockProvider(mode, modelId = 'openrouter-failover-model') {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    if (mode === 'error') {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'upstream failure' }));
      return;
    }

    if (mode === 'stream_no_done') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({
        id: 'chatcmpl-fallback-stream',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{ index: 0, delta: { content: 'fal' }, finish_reason: null }],
      })}\n\n`);
      res.write(`data: ${JSON.stringify({
        id: 'chatcmpl-fallback-stream',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{ index: 0, delta: { content: 'lback' }, finish_reason: 'stop' }],
      })}\n\n`);
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'chatcmpl-fallback-json',
      object: 'chat.completion',
      model: modelId,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'fallback json success' },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
    }));
  });

  const port = await listen(server);
  return {
    endpointUrl: `http://127.0.0.1:${port}`,
    close: () => closeServer(server),
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/v1', v1Router);
  return app;
}

async function runJsonFallbackProof() {
  resetDb();
  seedModel();
  const renterKey = seedRenter('qa-failover-json-renter');
  const primary = await startMockProvider('error');
  const fallback = await startMockProvider('json');

  try {
    const primaryId = seedProvider(primary.endpointUrl, { gpuUtilPct: 1 });
    const fallbackId = seedProvider(fallback.endpointUrl, { gpuUtilPct: 90 });
    const res = await request(createApp())
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${renterKey}`)
      .send({
        model: 'openrouter-failover-model',
        messages: [{ role: 'user', content: 'json fallback probe' }],
      });

    assert(res.status === 200, `JSON fallback expected 200, got ${res.status}`);
    assert(res.body?.choices?.[0]?.message?.content === 'fallback json success', 'JSON fallback did not return fallback provider payload');
    assert(Number(res.headers['x-dcp-provider-id']) === fallbackId, `JSON fallback expected provider ${fallbackId}, got ${res.headers['x-dcp-provider-id']}`);
    return { primaryId, fallbackId, status: res.status };
  } finally {
    await primary.close();
    await fallback.close();
  }
}

async function runSseFallbackProof() {
  resetDb();
  seedModel();
  const renterKey = seedRenter('qa-failover-sse-renter');
  const primary = await startMockProvider('error');
  const fallback = await startMockProvider('stream_no_done');

  try {
    seedProvider(primary.endpointUrl, { gpuUtilPct: 1 });
    seedProvider(fallback.endpointUrl, { gpuUtilPct: 90 });
    const res = await request(createApp())
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${renterKey}`)
      .send({
        model: 'openrouter-failover-model',
        messages: [{ role: 'user', content: 'sse fallback probe' }],
        stream: true,
      });

    const doneCount = (String(res.text || '').match(/data:\s*\[DONE\]/g) || []).length;
    assert(res.status === 200, `SSE fallback expected 200, got ${res.status}`);
    assert(String(res.headers['content-type'] || '').includes('text/event-stream'), `SSE fallback expected text/event-stream, got ${res.headers['content-type'] || 'missing'}`);
    assert(doneCount === 1, `SSE fallback expected exactly one [DONE], got ${doneCount}`);
    assert(String(res.text || '').includes('fal'), 'SSE fallback did not stream fallback content');
    return { status: res.status, doneCount };
  } finally {
    await primary.close();
    await fallback.close();
  }
}

async function runFallbackExhaustedProof() {
  resetDb();
  seedModel();
  const renterKey = seedRenter('qa-failover-exhausted-renter');
  const primary = await startMockProvider('error');
  const fallback = await startMockProvider('error');

  try {
    seedProvider(primary.endpointUrl, { gpuUtilPct: 1 });
    seedProvider(fallback.endpointUrl, { gpuUtilPct: 90 });
    const res = await request(createApp())
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${renterKey}`)
      .send({
        model: 'openrouter-failover-model',
        messages: [{ role: 'user', content: 'fallback exhausted probe' }],
      });

    assert(res.status !== 200, `Fallback exhausted expected non-200, got ${res.status}`);
    assert(res.status === 503 || res.status === 504, `Fallback exhausted expected 503/504, got ${res.status}`);
    assert(res.body?.error?.code === 'provider_unavailable' || res.body?.error?.code === 'upstream_timeout', `Fallback exhausted returned unexpected error code: ${res.body?.error?.code || 'missing'}`);
    return { status: res.status, errorCode: res.body?.error?.code || null };
  } finally {
    await primary.close();
    await fallback.close();
  }
}

async function main() {
  const jsonProof = await runJsonFallbackProof();
  const sseProof = await runSseFallbackProof();
  const exhaustedProof = await runFallbackExhaustedProof();

  console.log('# OpenRouter Failover Proof');
  console.log(`- JSON fallback: PASS (status=${jsonProof.status}, fallback_provider_id=${jsonProof.fallbackId})`);
  console.log(`- SSE fallback: PASS (status=${sseProof.status}, done_count=${sseProof.doneCount})`);
  console.log(`- Fallback exhausted: PASS (status=${exhaustedProof.status}, code=${exhaustedProof.errorCode})`);
}

main().catch((error) => {
  console.error('OpenRouter failover proof failed:', error?.message || error);
  process.exit(1);
});
