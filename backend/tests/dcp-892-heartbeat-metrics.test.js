/**
 * DCP-892: Provider heartbeat health + renter job history API tests
 *
 * Tests:
 *   1. POST /api/providers/:id/heartbeat writes to provider_metrics
 *   2. GET /api/providers/:id/metrics returns timeseries (default 1h, 6h, 24h, 7d)
 *   3. GET /api/renters/jobs returns paginated job history
 *   4. GET /api/renters/jobs filters by status
 *   5. Auth checks for both endpoints
 */

'use strict';

const http = require('http');
const crypto = require('crypto');

process.env.DC1_DB_PATH = ':memory:';
process.env.ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT = '1';

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

const PORT = 19892;
let server;
let providerId;
let providerKey;
let renterKey;

async function setup() {
  const express = require('express');
  const app = express();

  // Raw body for main heartbeat HMAC path
  app.use('/api/providers/heartbeat', express.raw({ type: 'application/json' }), (req, _res, next) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
      try { req.body = JSON.parse(req.body.toString('utf8')); } catch { req.body = {}; }
    }
    next();
  });
  app.use(express.json());

  const providersRouter = require('../src/routes/providers');
  const rentersRouter = require('../src/routes/renters');
  app.use('/api/providers', providersRouter);
  app.use('/api/renters', rentersRouter);

  await new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', resolve);
  });

  // Seed a provider directly in DB
  providerKey = 'dcp-prov-test-' + crypto.randomBytes(8).toString('hex');
  const provResult = db.run(
    `INSERT INTO providers (name, email, api_key, gpu_model, approval_status, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'approved', 'online', datetime('now'), datetime('now'))`,
    'Test Provider', 'provider@test.com', providerKey, 'RTX 4090'
  );
  providerId = provResult.lastInsertRowid;

  // Seed a renter
  renterKey = 'dcp-renter-test-' + crypto.randomBytes(8).toString('hex');
  const renterResult = db.run(
    `INSERT INTO renters (name, email, api_key, status, balance_halala, total_spent_halala, total_jobs, created_at)
     VALUES (?, ?, ?, 'active', 10000, 0, 0, datetime('now'))`,
    'Test Renter', 'renter@test.com', renterKey
  );
  const renterId = renterResult.lastInsertRowid;

  // Seed jobs for the renter
  for (const [status, model] of [['completed', 'llama3-8b'], ['failed', 'mistral-7b'], ['running', 'llama3-8b']]) {
    const jobId = 'job-' + crypto.randomBytes(6).toString('hex');
    db.run(
      `INSERT INTO jobs (job_id, renter_id, provider_id, model, status, template_id, cost_halala, actual_cost_halala, submitted_at, started_at, completed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, datetime('now'))`,
      jobId, renterId, providerId, model, status, 'llama3-8b-template', 500, 450,
      status === 'completed' ? new Date().toISOString() : null
    );
    if (status === 'completed') {
      db.run(
        `INSERT INTO serve_sessions (id, job_id, provider_id, model, status, started_at, expires_at, total_tokens, total_billed_halala, created_at)
         VALUES (?, ?, ?, ?, 'stopped', datetime('now'), datetime('now', '+1 hour'), ?, ?, datetime('now'))`,
        'sess-' + crypto.randomBytes(6).toString('hex'), jobId, providerId, model, 1200, 450
      );
    }
  }
}

async function teardown() {
  if (server) server.close();
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

async function run() {
  await setup();

  // 1. POST /api/providers/:id/heartbeat — writes to provider_metrics with new field names
  await test('POST /:id/heartbeat with gpu_utilization_pct writes to provider_metrics', async () => {
    const res = await request('POST', `/api/providers/${providerId}/heartbeat`, {
      gpu_utilization_pct: 72.5,
      vram_used_mb: 8192,
      active_jobs: 2,
    }, { 'x-provider-key': providerKey });

    assert(res.status === 200, `Expected 200 got ${res.status}: ${res.text}`);
    assert(res.body.success === true, 'Expected success');
    assert(res.body.status === 'online', 'Expected online');

    const row = db.get(
      'SELECT * FROM provider_metrics WHERE provider_id = ? ORDER BY id DESC LIMIT 1',
      providerId
    );
    assert(row !== undefined, 'Expected a provider_metrics row');
    assert(row.gpu_utilization_pct === 72.5, `Expected 72.5 got ${row.gpu_utilization_pct}`);
    assert(row.vram_used_mb === 8192, `Expected 8192 got ${row.vram_used_mb}`);
    assert(row.active_jobs === 2, `Expected 2 got ${row.active_jobs}`);
  });

  // 2. POST /:id/heartbeat — legacy gpu_utilization field still works
  await test('POST /:id/heartbeat accepts legacy gpu_utilization field', async () => {
    const res = await request('POST', `/api/providers/${providerId}/heartbeat`, {
      gpu_utilization: 55.0,
      vram_used_mb: 4096,
      jobs_active: 1,
    }, { 'x-provider-key': providerKey });

    assert(res.status === 200, `Expected 200 got ${res.status}`);
    const row = db.get(
      'SELECT gpu_utilization_pct FROM provider_metrics WHERE provider_id = ? ORDER BY id DESC LIMIT 1',
      providerId
    );
    assert(row.gpu_utilization_pct === 55.0, `Expected 55.0 got ${row.gpu_utilization_pct}`);
  });

  // 3. GET /api/providers/:id/metrics — default 1h period
  await test('GET /:id/metrics returns timeseries for 1h period', async () => {
    const res = await request('GET', `/api/providers/${providerId}/metrics`);
    assert(res.status === 200, `Expected 200 got ${res.status}`);
    assert(res.body.period === '1h', 'Expected period 1h');
    assert(Array.isArray(res.body.metrics), 'Expected metrics array');
    assert(res.body.metrics.length >= 2, `Expected >=2 metrics rows got ${res.body.metrics.length}`);
    assert(typeof res.body.count === 'number', 'Expected count field');
    const sample = res.body.metrics[0];
    assert('recorded_at' in sample, 'Expected recorded_at');
    assert('gpu_utilization_pct' in sample, 'Expected gpu_utilization_pct');
    assert('vram_used_mb' in sample, 'Expected vram_used_mb');
    assert('active_jobs' in sample, 'Expected active_jobs');
  });

  // 4. GET /api/providers/:id/metrics?period=6h
  await test('GET /:id/metrics supports period=6h', async () => {
    const res = await request('GET', `/api/providers/${providerId}/metrics?period=6h`);
    assert(res.status === 200, `Expected 200 got ${res.status}`);
    assert(res.body.period === '6h', 'Expected period 6h');
  });

  // 5. GET /api/providers/:id/metrics — invalid period returns 400
  await test('GET /:id/metrics returns 400 for invalid period', async () => {
    const res = await request('GET', `/api/providers/${providerId}/metrics?period=99y`);
    assert(res.status === 400, `Expected 400 got ${res.status}`);
    assert(res.body.error, 'Expected error message');
  });

  // 6. GET /api/providers/:id/metrics — unknown provider returns 404
  await test('GET /:id/metrics returns 404 for unknown provider', async () => {
    const res = await request('GET', '/api/providers/999999/metrics');
    assert(res.status === 404, `Expected 404 got ${res.status}`);
  });

  // 7. GET /api/renters/jobs — returns all jobs for renter
  await test('GET /api/renters/jobs returns paginated job list', async () => {
    const res = await request('GET', '/api/renters/jobs', null, {
      'Authorization': `Bearer ${renterKey}`,
    });
    assert(res.status === 200, `Expected 200 got ${res.status}: ${res.text}`);
    assert(Array.isArray(res.body.jobs), 'Expected jobs array');
    assert(res.body.jobs.length === 3, `Expected 3 jobs got ${res.body.jobs.length}`);
    assert(res.body.total === 3, 'Expected total 3');
    assert(res.body.page === 1, 'Expected page 1');
    assert(typeof res.body.pages === 'number', 'Expected pages field');

    const job = res.body.jobs[0];
    assert('job_id' in job, 'Expected job_id');
    assert('template_id' in job, 'Expected template_id');
    assert('provider_id' in job, 'Expected provider_id');
    assert('status' in job, 'Expected status');
    assert('started_at' in job, 'Expected started_at');
    assert('completed_at' in job, 'Expected completed_at');
    assert('cost_halala' in job, 'Expected cost_halala');
    assert('output_tokens' in job, 'Expected output_tokens');
  });

  // 8. GET /api/renters/jobs — filter by status=completed
  await test('GET /api/renters/jobs filters by status=completed', async () => {
    const res = await request('GET', '/api/renters/jobs?status=completed', null, {
      'x-renter-key': renterKey,
    });
    assert(res.status === 200, `Expected 200 got ${res.status}`);
    assert(res.body.jobs.length === 1, `Expected 1 completed job got ${res.body.jobs.length}`);
    assert(res.body.jobs[0].status === 'completed', 'Expected completed status');
  });

  // 9. GET /api/renters/jobs — filter by status=failed
  await test('GET /api/renters/jobs filters by status=failed', async () => {
    const res = await request('GET', '/api/renters/jobs?status=failed', null, {
      'x-renter-key': renterKey,
    });
    assert(res.status === 200, `Expected 200 got ${res.status}`);
    assert(res.body.jobs.length === 1, 'Expected 1 failed job');
    assert(res.body.jobs[0].status === 'failed', 'Expected failed status');
  });

  // 10. GET /api/renters/jobs — pagination (limit=1)
  await test('GET /api/renters/jobs paginates correctly', async () => {
    const res = await request('GET', '/api/renters/jobs?page=1&limit=1', null, {
      'x-renter-key': renterKey,
    });
    assert(res.status === 200, `Expected 200 got ${res.status}`);
    assert(res.body.jobs.length === 1, 'Expected 1 job per page');
    assert(res.body.total === 3, 'Expected total 3');
    assert(res.body.pages === 3, 'Expected 3 pages');
    assert(res.body.limit === 1, 'Expected limit 1');
  });

  // 11. GET /api/renters/jobs — output_tokens populated from serve_sessions
  await test('GET /api/renters/jobs includes output_tokens from serve_sessions', async () => {
    const res = await request('GET', '/api/renters/jobs?status=completed', null, {
      'x-renter-key': renterKey,
    });
    assert(res.status === 200, `Expected 200 got ${res.status}`);
    const completedJob = res.body.jobs[0];
    assert(completedJob.output_tokens === 1200, `Expected 1200 tokens got ${completedJob.output_tokens}`);
  });

  // 12. GET /api/renters/jobs — no auth returns 401
  await test('GET /api/renters/jobs returns 401 without auth', async () => {
    const res = await request('GET', '/api/renters/jobs');
    assert(res.status === 401, `Expected 401 got ${res.status}`);
  });

  // 13. GET /api/renters/jobs — bad key returns 401
  await test('GET /api/renters/jobs returns 401 for invalid key', async () => {
    const res = await request('GET', '/api/renters/jobs', null, {
      'x-renter-key': 'bad-key-here',
    });
    assert(res.status === 401, `Expected 401 got ${res.status}`);
  });

  await teardown();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
