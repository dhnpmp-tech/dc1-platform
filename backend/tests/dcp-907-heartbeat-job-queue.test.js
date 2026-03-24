/**
 * DCP-907: Provider heartbeat API + job assignment queue
 *
 * Tests:
 *   1. POST /api/providers/:id/heartbeat persists model_loaded into cached_models
 *   2. POST /api/providers/:id/heartbeat persists vram_total into vram_mb
 *   3. GET /api/admin/providers/status returns is_online, last_seen, gpu_util_pct, model_loaded
 *   4. GET /api/admin/providers/status requires admin token
 *   5. GET /api/admin/providers/status correctly marks provider offline after stale heartbeat
 *   6. POST /api/vllm/complete assigns provider_id to job (no_capacity when no providers)
 */

'use strict';

const http = require('http');
const crypto = require('crypto');

process.env.DC1_DB_PATH = ':memory:';
process.env.ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT = '1';
process.env.DC1_ADMIN_TOKEN = 'test-admin-token-dcp907';
// Supabase stubs required by supabase.js at module load time
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test';

const db = require('../src/db');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: { ...headers },
    };
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

const PORT = 19907;
let server;
let providerId;
let providerKey;
let adminToken;

async function setup() {
  const express = require('express');
  const app = express();

  // Raw body for main HMAC heartbeat path
  app.use('/api/providers/heartbeat', express.raw({ type: 'application/json' }), (req, _res, next) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
      try { req.body = JSON.parse(req.body.toString('utf8')); } catch { req.body = {}; }
    }
    next();
  });
  app.use(express.json());

  const providersRouter = require('../src/routes/providers');
  const adminRouter = require('../src/routes/admin');
  app.use('/api/providers', providersRouter);
  app.use('/api/admin', adminRouter);

  await new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', resolve);
  });

  adminToken = process.env.DC1_ADMIN_TOKEN;

  // Seed a provider
  providerKey = 'dcp-prov-test-' + crypto.randomBytes(8).toString('hex');
  const provResult = db.run(
    `INSERT INTO providers (name, email, api_key, gpu_model, vram_gb, approval_status, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'approved', 'online', datetime('now'), datetime('now'))`,
    'Test Provider', 'provider@test.com', providerKey, 'RTX 4090', 24
  );
  providerId = provResult.lastInsertRowid;
}

async function teardown() {
  if (server) server.close();
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

async function run() {
  await setup();

  // 1. model_loaded is stored in cached_models
  await test('POST /:id/heartbeat with model_loaded updates cached_models in providers table', async () => {
    const res = await request('POST', `/api/providers/${providerId}/heartbeat`, {
      gpu_utilization_pct: 45.0,
      vram_used_mb: 16000,
      model_loaded: 'ALLaM-7B-Instruct',
    }, { 'x-provider-key': providerKey });

    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'Expected success=true');
    assertEqual(res.body.model_loaded, 'ALLaM-7B-Instruct', 'model_loaded should be echoed in response');

    const row = db.get('SELECT cached_models FROM providers WHERE id = ?', providerId);
    assert(row && row.cached_models, 'cached_models should be set');
    const parsed = JSON.parse(row.cached_models);
    assert(Array.isArray(parsed) && parsed[0] === 'ALLaM-7B-Instruct', `Expected ALLaM-7B-Instruct in cached_models, got ${row.cached_models}`);
  });

  // 2. vram_total is stored in vram_mb
  await test('POST /:id/heartbeat with vram_total updates vram_mb in providers table', async () => {
    const res = await request('POST', `/api/providers/${providerId}/heartbeat`, {
      gpu_utilization_pct: 60.0,
      vram_used_mb: 12000,
      vram_total: 24576,
      model_loaded: 'mistral-7b',
    }, { 'x-provider-key': providerKey });

    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);

    const row = db.get('SELECT vram_mb FROM providers WHERE id = ?', providerId);
    assertEqual(row.vram_mb, 24576, `Expected vram_mb=24576, got ${row.vram_mb}`);
  });

  // 3. GET /api/admin/providers/status returns expected fields
  await test('GET /api/admin/providers/status returns provider list with is_online, last_seen, model_loaded', async () => {
    // Post a fresh heartbeat so provider is online
    await request('POST', `/api/providers/${providerId}/heartbeat`, {
      gpu_utilization_pct: 33.3,
      vram_used_mb: 8000,
      model_loaded: 'qwen2.5-7b',
    }, { 'x-provider-key': providerKey });

    const res = await request('GET', '/api/admin/providers/status', null, {
      'x-admin-token': adminToken,
    });
    assertEqual(res.status, 200, `Expected 200, got ${res.status}: ${res.text}`);

    assert(typeof res.body.total === 'number', 'Response should have total count');
    assert(typeof res.body.online === 'number', 'Response should have online count');
    assert(Array.isArray(res.body.providers), 'providers should be an array');

    const p = res.body.providers.find((x) => x.id === providerId);
    assert(p, 'Should find our test provider in the response');
    assert(p.is_online === true, `Provider should be online, got is_online=${p.is_online}`);
    assert(p.last_seen !== null, 'last_seen should not be null');
    assert(typeof p.heartbeat_age_seconds === 'number', 'heartbeat_age_seconds should be a number');
    assertEqual(p.model_loaded, 'qwen2.5-7b', `Expected model_loaded='qwen2.5-7b', got '${p.model_loaded}'`);
    assert(res.body.online >= 1, 'Should have at least 1 online provider');
  });

  // 4. GET /api/admin/providers/status requires admin token
  await test('GET /api/admin/providers/status returns 401 without admin token', async () => {
    const res = await request('GET', '/api/admin/providers/status');
    assert(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
  });

  // 5. Offline provider marked correctly based on stale last_heartbeat
  await test('GET /api/admin/providers/status marks provider offline when heartbeat is stale', async () => {
    // Insert a second provider with an old heartbeat (2 hours ago)
    const staleKey = 'dcp-prov-stale-' + crypto.randomBytes(6).toString('hex');
    const staleResult = db.run(
      `INSERT INTO providers (name, email, api_key, gpu_model, approval_status, status, last_heartbeat, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'approved', 'online', datetime('now', '-2 hours'), datetime('now'), datetime('now'))`,
      'Stale Provider', 'stale@test.com', staleKey, 'GTX 3080'
    );
    const staleId = staleResult.lastInsertRowid;

    const res = await request('GET', '/api/admin/providers/status', null, {
      'x-admin-token': adminToken,
    });
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);

    const stale = res.body.providers.find((x) => x.id === staleId);
    assert(stale, 'Should find the stale provider');
    assert(stale.is_online === false, `Stale provider should have is_online=false, got ${stale.is_online}`);
    assert(stale.heartbeat_age_seconds > 90, `Stale provider should have heartbeat_age > 90s, got ${stale.heartbeat_age_seconds}`);
  });

  // 6. vllm complete returns 503 when no capable providers available
  await test('POST /api/vllm/complete returns 503 no_capacity when no providers meet VRAM requirement', async () => {
    // This test verifies the assignProvider path returns 503 when no provider qualifies.
    // Seed a renter with sufficient balance but require huge VRAM no provider has.
    const renterKey = 'dcp-renter-test-' + crypto.randomBytes(8).toString('hex');
    db.run(
      `INSERT INTO renters (name, email, api_key, status, balance_halala, total_spent_halala, total_jobs, created_at)
       VALUES (?, ?, ?, 'active', 1000000, 0, 0, datetime('now'))`,
      'Test Renter', 'renter907@test.com', renterKey
    );

    // Register a model requiring 999 GB VRAM (no provider can satisfy this)
    db.run(
      `INSERT OR REPLACE INTO model_registry
       (model_id, display_name, family, vram_gb, quantization, context_window, use_cases, min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      'huge-model-dcp907-test', 'Huge Model', 'test', 999, 'fp16', 4096, '[]', 999, 100
    );

    // Mount vllm router in a separate test server on a different port
    const express2 = require('express');
    const app2 = express2();
    app2.use(express2.json());
    const vllmRouter = require('../src/routes/vllm');
    app2.use('/api/vllm', vllmRouter);

    const PORT2 = 19908;
    const server2 = await new Promise((resolve) => {
      const s = app2.listen(PORT2, '127.0.0.1', () => resolve(s));
    });

    try {
      const res = await new Promise((resolve, reject) => {
        const body = JSON.stringify({
          model: 'huge-model-dcp907-test',
          messages: [{ role: 'user', content: 'hello' }],
        });
        const opts = {
          hostname: '127.0.0.1', port: PORT2,
          path: '/api/vllm/complete',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'x-renter-key': renterKey,
          },
        };
        const req = http.request(opts, (r) => {
          const chunks = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () => {
            try { resolve({ status: r.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
            catch (_) { resolve({ status: r.statusCode, body: null }); }
          });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      assertEqual(res.status, 503, `Expected 503 no_capacity, got ${res.status}`);
      assert(res.body && res.body.error === 'no_capacity', `Expected error='no_capacity', got ${JSON.stringify(res.body)}`);
      assert(res.body.diagnostics && typeof res.body.diagnostics.capable_providers === 'number', 'Should include diagnostics.capable_providers');
    } finally {
      server2.close();
    }
  });

  await teardown();

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
