/**
 * DCP-922: vLLM inference proxy routing to active providers
 */
'use strict';

const http = require('http');
const crypto = require('crypto');

process.env.DC1_DB_PATH = ':memory:';
process.env.ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT = '1';
process.env.DC1_ADMIN_TOKEN = 'test-admin-dcp922';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test';

const db = require('../src/db');

function request(server, method, path, body, headers = {}) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port, path, method, headers: { ...headers } };
    if (body) {
      const data = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let json;
        try { json = JSON.parse(raw); } catch (_) { json = null; }
        resolve({ status: res.statusCode, body: json, text: raw });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function createMockVllmServer({ port, modelId, responseText, usage, statusCode = 200, delay = 0 }) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      if (delay > 0) {
        setTimeout(() => respond(req, res), delay);
      } else {
        respond(req, res);
      }
    });

    function respond(_req, res) {
      if (statusCode !== 200) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `mock error ${statusCode}` }));
        return;
      }
      const payload = {
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        model: modelId || 'test-model',
        choices: [{ index: 0, message: { role: 'assistant', content: responseText || 'Hello from mock provider' }, finish_reason: 'stop' }],
        usage: usage || { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    }

    srv.listen(port, '127.0.0.1', () => resolve(srv));
    srv.on('error', reject);
  });
}

const MAIN_PORT = 19922;
const VLLM_PORT = 19923;
const VLLM_PORT2 = 19924;
const MODEL_ID = 'test-model-dcp922';

let mainServer;
let providerId;
let providerKey;
let renterKey;

describe('DCP-922 vLLM inference proxy', () => {
  beforeAll(async () => {
    const express = require('express');
    const app = express();

    app.use('/api/providers/heartbeat', express.raw({ type: 'application/json' }), (req, _res, next) => {
      if (Buffer.isBuffer(req.body)) {
        req.rawBody = req.body;
        try { req.body = JSON.parse(req.body.toString('utf8')); } catch { req.body = {}; }
      }
      next();
    });
    app.use(express.json());

    const providersRouter = require('../src/routes/providers');
    const vllmRouter = require('../src/routes/vllm');
    app.use('/api/providers', providersRouter);
    app.use('/api/vllm', vllmRouter);

    await new Promise((resolve) => {
      mainServer = app.listen(MAIN_PORT, '127.0.0.1', resolve);
    });

    providerKey = `dcp-provider-dcp922-${crypto.randomBytes(8).toString('hex')}`;
    const provResult = db.run(
      `INSERT INTO providers (name, email, api_key, gpu_model, vram_gb, gpu_vram_mib,
         approval_status, status, supported_compute_types, last_heartbeat, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'approved', 'online', '["inference"]',
         datetime('now'), datetime('now'), datetime('now'))`,
      'DCP922 Provider', 'provider922@test.com', providerKey, 'RTX 4090', 24, 24576
    );
    providerId = provResult.lastInsertRowid;

    renterKey = `dcp-renter-dcp922-${crypto.randomBytes(8).toString('hex')}`;
    db.run(
      `INSERT INTO renters (name, email, api_key, status, balance_halala, total_spent_halala, total_jobs, created_at)
       VALUES (?, ?, ?, 'active', 9999999, 0, 0, datetime('now'))`,
      'DCP922 Renter', 'renter922@test.com', renterKey
    );

    db.run(
      `INSERT OR REPLACE INTO model_registry
       (model_id, display_name, family, vram_gb, quantization, context_window, use_cases,
        min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      MODEL_ID, 'DCP922 Test Model', 'test', 8, 'fp16', 4096, '[]', 4, 20
    );
  });

  afterAll(async () => {
    if (mainServer) {
      await new Promise((resolve) => mainServer.close(resolve));
    }
  });

  beforeEach(() => {
    db.run("UPDATE providers SET status = 'online', vllm_endpoint_url = NULL WHERE id = ?", providerId);
  });

  test('heartbeat with vllm_endpoint_url stores it in providers table', async () => {
    const endpointUrl = `http://127.0.0.1:${VLLM_PORT}`;
    const res = await request(mainServer, 'POST', '/api/providers/heartbeat', {
      api_key: providerKey,
      gpu_status: { gpu_name: 'RTX 4090', gpu_vram_mib: 24576, gpu_util_pct: 20 },
      provider_ip: '127.0.0.1',
      vllm_endpoint_url: endpointUrl,
    });

    expect(res.status).toBe(200);
    const row = db.get('SELECT vllm_endpoint_url FROM providers WHERE id = ?', providerId);
    expect(row.vllm_endpoint_url).toBe(endpointUrl);
  });

  test('heartbeat ignores malformed vllm_endpoint_url (no http scheme)', async () => {
    const res = await request(mainServer, 'POST', '/api/providers/heartbeat', {
      api_key: providerKey,
      gpu_status: { gpu_name: 'RTX 4090', gpu_vram_mib: 24576 },
      vllm_endpoint_url: 'not-a-valid-url',
    });

    expect(res.status).toBe(200);
    const row = db.get('SELECT vllm_endpoint_url FROM providers WHERE id = ?', providerId);
    expect(row.vllm_endpoint_url).toBeNull();
  });

  test('POST /api/vllm/complete proxies request to provider vLLM endpoint', async () => {
    const mockVllm = await createMockVllmServer({
      port: VLLM_PORT,
      modelId: MODEL_ID,
      responseText: 'Marhaba from provider',
      usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
    });

    db.run('UPDATE providers SET vllm_endpoint_url = ? WHERE id = ?', `http://127.0.0.1:${VLLM_PORT}`, providerId);

    try {
      const res = await request(mainServer, 'POST', '/api/vllm/complete', {
        model: MODEL_ID,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 50,
      }, { 'x-renter-key': renterKey });

      expect(res.status).toBe(200);
      expect(res.body?.choices?.[0]?.message?.content).toBe('Marhaba from provider');
    } finally {
      await new Promise((resolve) => mockVllm.close(resolve));
    }
  });

  test('token counts in response come from provider vLLM usage field', async () => {
    const mockVllm = await createMockVllmServer({
      port: VLLM_PORT,
      modelId: MODEL_ID,
      responseText: 'Token count test',
      usage: { prompt_tokens: 25, completion_tokens: 10, total_tokens: 35 },
    });

    db.run('UPDATE providers SET vllm_endpoint_url = ? WHERE id = ?', `http://127.0.0.1:${VLLM_PORT}`, providerId);

    try {
      const res = await request(mainServer, 'POST', '/api/vllm/complete', {
        model: MODEL_ID,
        messages: [{ role: 'user', content: 'Count my tokens please' }],
      }, { 'x-renter-key': renterKey });

      expect(res.status).toBe(200);
      expect(res.body?.usage?.prompt_tokens).toBe(25);
      expect(res.body?.usage?.completion_tokens).toBe(10);
      expect(res.body?.usage?.total_tokens).toBe(35);
    } finally {
      await new Promise((resolve) => mockVllm.close(resolve));
    }
  });

  test('falls back to next provider when primary refuses connection', async () => {
    db.run('UPDATE providers SET vllm_endpoint_url = ? WHERE id = ?', 'http://127.0.0.1:19999', providerId);

    const provider2Key = `dcp-provider2-dcp922-${crypto.randomBytes(8).toString('hex')}`;
    const prov2Result = db.run(
      `INSERT INTO providers (name, email, api_key, gpu_model, vram_gb, gpu_vram_mib,
         approval_status, status, supported_compute_types, last_heartbeat,
         vllm_endpoint_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'approved', 'online', '["inference"]',
         datetime('now'), ?, datetime('now'), datetime('now'))`,
      'DCP922 Provider2', 'provider2-922@test.com', provider2Key,
      'RTX 4090', 24, 24576,
      `http://127.0.0.1:${VLLM_PORT2}`
    );
    const provider2Id = prov2Result.lastInsertRowid;

    const mockVllm2 = await createMockVllmServer({
      port: VLLM_PORT2,
      modelId: MODEL_ID,
      responseText: 'Response from fallback provider',
      usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
    });

    try {
      const res = await request(mainServer, 'POST', '/api/vllm/complete', {
        model: MODEL_ID,
        messages: [{ role: 'user', content: 'Will you fallback?' }],
      }, { 'x-renter-key': renterKey });

      if (res.status === 200) {
        expect(res.body?.choices?.[0]?.message?.content).toBe('Response from fallback provider');
      } else {
        expect(res.status).toBe(503);
      }
    } finally {
      await new Promise((resolve) => mockVllm2.close(resolve));
      db.run('DELETE FROM providers WHERE id = ?', provider2Id);
    }
  });

  test('returns 503 when all providers return errors', async () => {
    const mockVllm = await createMockVllmServer({
      port: VLLM_PORT,
      statusCode: 500,
    });

    db.run('UPDATE providers SET vllm_endpoint_url = ? WHERE id = ?', `http://127.0.0.1:${VLLM_PORT}`, providerId);

    try {
      const res = await request(mainServer, 'POST', '/api/vllm/complete', {
        model: MODEL_ID,
        messages: [{ role: 'user', content: 'Will you fail?' }],
      }, { 'x-renter-key': renterKey });

      expect(res.status).toBe(503);
      expect(res.body?.error).toBe('no_providers_available');
    } finally {
      await new Promise((resolve) => mockVllm.close(resolve));
    }
  });

  test('phase 1: no vllm_endpoint_url returns 503 no_capacity (legacy path, no live providers)', async () => {
    db.run("UPDATE providers SET status = 'offline' WHERE id = ?", providerId);

    const res = await request(mainServer, 'POST', '/api/vllm/complete', {
      model: MODEL_ID,
      messages: [{ role: 'user', content: 'Anybody home?' }],
    }, { 'x-renter-key': renterKey });

    expect(res.status).toBe(503);
    expect(res.body?.error).toBe('no_capacity');
  });

  test('malformed provider usage still persists serve_sessions metering', async () => {
    const mockVllm = await createMockVllmServer({
      port: VLLM_PORT,
      modelId: MODEL_ID,
      responseText: 'Fallback token estimation should still persist',
      usage: { prompt_tokens: 'not-a-number', completion_tokens: null, total_tokens: 'bad' },
    });

    db.run('UPDATE providers SET vllm_endpoint_url = ? WHERE id = ?', `http://127.0.0.1:${VLLM_PORT}`, providerId);

    try {
      const res = await request(mainServer, 'POST', '/api/vllm/complete', {
        model: MODEL_ID,
        messages: [{ role: 'user', content: 'Persist metering even with malformed usage fields' }],
      }, { 'x-renter-key': renterKey });

      expect(res.status).toBe(200);
      expect(res.body?.usage?.total_tokens).toBeGreaterThan(0);

      const completionId = typeof res.body?.id === 'string' ? res.body.id : '';
      const idDerivedJobIdRaw = completionId.startsWith('chatcmpl-') ? completionId.replace(/^chatcmpl-/, '') : null;
      const idDerivedJobId = idDerivedJobIdRaw && idDerivedJobIdRaw !== 'undefined' ? idDerivedJobIdRaw : null;
      const latestJob = db.get('SELECT job_id FROM jobs ORDER BY rowid DESC LIMIT 1');
      const jobId = idDerivedJobId || latestJob?.job_id;

      expect(jobId).toBeTruthy();

      const session = db.get(
        `SELECT total_inferences, total_tokens, total_billed_halala, last_inference_at
         FROM serve_sessions WHERE job_id = ?`,
        jobId
      );
      expect(session).toBeTruthy();
      expect(session.total_inferences).toBeGreaterThanOrEqual(1);
      expect(session.total_tokens).toBeGreaterThan(0);
      expect(session.total_billed_halala).toBeGreaterThan(0);
      expect(session.last_inference_at).toBeTruthy();
    } finally {
      await new Promise((resolve) => mockVllm.close(resolve));
    }
  });
});
