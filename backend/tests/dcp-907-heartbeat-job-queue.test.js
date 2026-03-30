/**
 * DCP-907: Provider heartbeat API + job assignment queue
 */
'use strict';

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');

process.env.DC1_DB_PATH = ':memory:';
process.env.ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT = '1';
process.env.DC1_ADMIN_TOKEN = 'test-admin-token-dcp907';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test';

const db = require('../src/db');

const providersRouter = require('../src/routes/providers');
const adminRouter = require('../src/routes/admin');
const vllmRouter = require('../src/routes/vllm');

const app = express();
app.use('/api/providers/heartbeat', express.raw({ type: 'application/json' }), (req, _res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.rawBody = req.body;
    try { req.body = JSON.parse(req.body.toString('utf8')); } catch { req.body = {}; }
  }
  next();
});
app.use(express.json());
app.use('/api/providers', providersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/vllm', vllmRouter);

function cleanDb() {
  const tables = [
    'jobs',
    'heartbeat_log',
    'provider_metrics',
    'provider_gpu_telemetry',
    'renter_api_keys',
    'renters',
    'providers',
    'model_registry',
    'serve_sessions',
  ];
  for (const table of tables) {
    try { db.run(`DELETE FROM ${table}`); } catch (_) {}
  }
}

describe('DCP-907 heartbeat + queue behavior', () => {
  let providerId;
  let providerKey;
  let renterId;
  let renterKey;

  beforeEach(() => {
    cleanDb();

    providerKey = `dcp-prov-test-${crypto.randomBytes(8).toString('hex')}`;
    const provResult = db.run(
      `INSERT INTO providers (name, email, api_key, gpu_model, vram_gb, approval_status, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'approved', 'online', datetime('now'), datetime('now'))`,
      'Test Provider', 'provider@test.com', providerKey, 'RTX 4090', 24
    );
    providerId = Number(provResult.lastInsertRowid);

    renterKey = `dcp-renter-test-${crypto.randomBytes(8).toString('hex')}`;
    const renterResult = db.run(
      `INSERT INTO renters (name, email, api_key, status, balance_halala, total_spent_halala, total_jobs, created_at)
       VALUES (?, ?, ?, 'active', 1000000, 0, 0, datetime('now'))`,
      'Test Renter', 'renter907@test.com', renterKey
    );
    renterId = Number(renterResult.lastInsertRowid);
  });

  test('POST /api/providers/:id/heartbeat with model_loaded updates cached_models', async () => {
    const res = await request(app)
      .post(`/api/providers/${providerId}/heartbeat`)
      .set('x-provider-key', providerKey)
      .send({
        gpu_utilization_pct: 45.0,
        vram_used_mb: 16000,
        model_loaded: 'ALLaM-7B-Instruct',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.model_loaded).toBe('ALLaM-7B-Instruct');

    const row = db.get('SELECT cached_models FROM providers WHERE id = ?', providerId);
    expect(row?.cached_models).toBeTruthy();
    const parsed = JSON.parse(row.cached_models);
    expect(parsed[0]).toBe('ALLaM-7B-Instruct');
  });

  test('POST /api/providers/:id/heartbeat with vram_total updates vram_mb', async () => {
    const res = await request(app)
      .post(`/api/providers/${providerId}/heartbeat`)
      .set('x-provider-key', providerKey)
      .send({
        gpu_utilization_pct: 60.0,
        vram_used_mb: 12000,
        vram_total: 24576,
        model_loaded: 'mistral-7b',
      });

    expect(res.status).toBe(200);
    const row = db.get('SELECT vram_mb FROM providers WHERE id = ?', providerId);
    expect(row.vram_mb).toBe(24576);
  });

  test('GET /api/admin/providers/status returns provider list with expected heartbeat fields', async () => {
    await request(app)
      .post(`/api/providers/${providerId}/heartbeat`)
      .set('x-provider-key', providerKey)
      .send({
        gpu_utilization_pct: 33.3,
        vram_used_mb: 8000,
        model_loaded: 'qwen2.5-7b',
      });

    const res = await request(app)
      .get('/api/admin/providers/status')
      .set('x-admin-token', process.env.DC1_ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.online).toBe('number');
    expect(Array.isArray(res.body.providers)).toBe(true);

    const p = res.body.providers.find((x) => x.id === providerId);
    expect(p).toBeTruthy();
    expect(p.is_online).toBe(true);
    expect(p.last_seen).toBeTruthy();
    expect(typeof p.heartbeat_age_seconds).toBe('number');
    expect(p.model_loaded).toBe('qwen2.5-7b');
  });

  test('GET /api/admin/providers/status requires admin token', async () => {
    const res = await request(app).get('/api/admin/providers/status');
    expect([401, 403]).toContain(res.status);
  });

  test('GET /api/admin/providers/status marks provider offline when heartbeat is stale', async () => {
    const staleKey = `dcp-prov-stale-${crypto.randomBytes(6).toString('hex')}`;
    const staleResult = db.run(
      `INSERT INTO providers (name, email, api_key, gpu_model, approval_status, status, last_heartbeat, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'approved', 'online', datetime('now', '-2 hours'), datetime('now'), datetime('now'))`,
      'Stale Provider', 'stale@test.com', staleKey, 'GTX 3080'
    );
    const staleId = Number(staleResult.lastInsertRowid);

    const res = await request(app)
      .get('/api/admin/providers/status')
      .set('x-admin-token', process.env.DC1_ADMIN_TOKEN);

    expect(res.status).toBe(200);

    const stale = res.body.providers.find((x) => x.id === staleId);
    expect(stale).toBeTruthy();
    expect(stale.is_online).toBe(false);
    expect(stale.heartbeat_age_seconds).toBeGreaterThan(90);
  });

  test('POST /api/vllm/complete returns 503 no_capacity when no providers meet VRAM requirement', async () => {
    db.run(
      `INSERT OR REPLACE INTO model_registry
       (model_id, display_name, family, vram_gb, quantization, context_window, use_cases, min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      'huge-model-dcp907-test', 'Huge Model', 'test', 999, 'fp16', 4096, '[]', 999, 100
    );

    const res = await request(app)
      .post('/api/vllm/complete')
      .set('x-renter-key', renterKey)
      .send({
        model: 'huge-model-dcp907-test',
        messages: [{ role: 'user', content: 'hello' }],
      });

    expect(res.status).toBe(503);
    expect(res.body?.error).toBe('no_capacity');
    expect(typeof res.body?.diagnostics?.capable_providers).toBe('number');
  });

  test('POST /api/providers/heartbeat capacity_report counts reserved inference jobs and exposes index-backed fields', async () => {
    db.run('UPDATE providers SET gpu_count = 2 WHERE id = ?', providerId);

    for (const [status, model] of [
      ['pending', 'qwen2.5-7b'],
      ['assigned', 'qwen2.5-7b'],
      ['pulling', 'llama3-8b'],
      ['running', 'llama3-8b'],
      ['completed', 'ignored-model'],
    ]) {
      db.run(
        `INSERT INTO jobs (job_id, renter_id, provider_id, job_type, model, status, submitted_at, created_at)
         VALUES (?, ?, ?, 'vllm', ?, ?, datetime('now'), datetime('now'))`,
        `cap-${status}-${Math.random().toString(36).slice(2, 8)}`,
        renterId,
        providerId,
        model,
        status
      );
    }

    const res = await request(app)
      .post('/api/providers/heartbeat')
      .send({
        api_key: providerKey,
        gpu_status: { gpu_name: 'RTX 4090', gpu_vram_mib: 24576, gpu_count: 2 },
        provider_ip: '127.0.0.1',
      });

    expect(res.status).toBe(200);
    expect(res.body.capacity_report).toBeTruthy();
    expect(res.body.capacity_report.active_inference_jobs).toBe(4);
    expect(res.body.capacity_report.available_gpu_slots).toBe(0);
    expect(res.body.capacity_report.estimated_wait_seconds).toBe(240);
    expect(res.body.capacity_report.queue_depth_by_model['qwen2.5-7b']).toBe(2);
    expect(res.body.capacity_report.queue_depth_by_model['llama3-8b']).toBe(2);

    const indexRow = db.get(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'index' AND name = 'idx_jobs_provider_type_status_model'`
    );
    expect(indexRow?.name).toBe('idx_jobs_provider_type_status_model');
  });
});
