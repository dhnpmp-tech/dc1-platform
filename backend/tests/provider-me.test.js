const http = require('http');
const db = require('../src/db');
const crypto = require('crypto');

// Simple test runner
let passed = 0, failed = 0;
const PORT = 19083;

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

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port: PORT, path, method, headers: {} };
    if (body) {
      const data = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let json;
        try { json = JSON.parse(raw); } catch (_) { json = null; }
        resolve({ status: res.statusCode, headers: res.headers, body: json, text: raw });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const TEST_KEY = 'dc1-provider-test-' + crypto.randomBytes(8).toString('hex');
let testProviderId;

async function run() {
  // Start server
  process.env.DC1_PROVIDER_PORT = PORT;
  const express = require('express');
  const cors = require('cors');
  const path = require('path');
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  const providersRouter = require('../src/routes/providers');
  app.use('/api/providers', providersRouter);

  const server = await new Promise(resolve => {
    const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
  });

  // Setup test data
  const result = db.run(
    `INSERT INTO providers (name, email, gpu_model, os, api_key, status, gpu_vram_mib, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    'Test Provider', `test-${Date.now()}@dc1.test`, 'RTX 4090', 'Windows', TEST_KEY, 'online', 8192, new Date().toISOString()
  );
  testProviderId = Number(result.lastInsertRowid);

  try {
    await test('GET /me returns provider data', async () => {
      const res = await request('GET', `/api/providers/me?key=${TEST_KEY}`);
      assert(res.status === 200, `status ${res.status}`);
      assert(res.body.provider, 'Missing provider key');
      assert(res.body.provider.name === 'Test Provider');
      assert(res.body.provider.gpu_model === 'RTX 4090');
      assert(res.body.provider.run_mode === 'always-on');
      assert(res.body.provider.is_paused === false);
      assert(res.body.provider.gpu_metrics != null);
      assert(res.body.provider.active_job === null);
      assert(res.body.provider.gpu_vram_mib === 8192);
    });

    await test('GET /me returns 404 for bad key', async () => {
      const res = await request('GET', `/api/providers/me?key=invalid-key`);
      assert(res.status === 404, `status ${res.status}`);
    });

    await test('POST /pause sets paused', async () => {
      const res = await request('POST', '/api/providers/pause', { key: TEST_KEY });
      assert(res.status === 200);
      assert(res.body.success === true);
      assert(res.body.status === 'paused');

      const me = await request('GET', `/api/providers/me?key=${TEST_KEY}`);
      assert(me.body.provider.is_paused === true);
      assert(me.body.provider.status === 'paused');
    });

    await test('POST /resume unpauses', async () => {
      const res = await request('POST', '/api/providers/resume', { key: TEST_KEY });
      assert(res.status === 200);
      assert(res.body.success === true);
    });

    await test('POST /preferences updates prefs', async () => {
      const res = await request('POST', '/api/providers/preferences', {
        key: TEST_KEY, run_mode: 'scheduled', gpu_usage_cap_pct: 60, temp_limit_c: 75
      });
      assert(res.status === 200);
      assert(res.body.success === true);
      assert(res.body.preferences.run_mode === 'scheduled');
      assert(res.body.preferences.gpu_usage_cap_pct === 60);
      assert(res.body.preferences.temp_limit_c === 75);
    });

    await test('GET /download returns file', async () => {
      const res = await request('GET', `/api/providers/download?key=${TEST_KEY}&platform=windows`);
      assert(res.status === 200, `status ${res.status}`);
      const cd = res.headers['content-disposition'];
      assert(cd && cd.includes('dc1-setup.ps1'), 'Wrong filename');
      assert(res.text.includes(TEST_KEY), 'Key not injected');
      assert(res.text.includes('scheduled'), 'Run mode not injected');
    });

    await test('POST /preferences rejects invalid run_mode', async () => {
      const res = await request('POST', '/api/providers/preferences', {
        key: TEST_KEY, run_mode: 'invalid'
      });
      assert(res.status === 400, `status ${res.status}`);
    });
  } finally {
    // Cleanup
    db.run('DELETE FROM providers WHERE api_key = ?', TEST_KEY);
    db.run('DELETE FROM jobs WHERE provider_id = ?', testProviderId);
    server.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
