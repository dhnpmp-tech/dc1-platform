const request = require('supertest');
const express = require('express');
const db = require('../src/db');
const providersRouter = require('../src/routes/providers');

describe('Provider Activation Scorecard API (DCP-219)', () => {
  let app;
  const adminToken = 'test-admin-token-scorecard';

  beforeAll(() => {
    process.env.DC1_ADMIN_TOKEN = adminToken;
    app = express();
    app.use(express.json());
    app.use('/api/providers', providersRouter);
  });

  beforeEach(() => {
    db.run('DELETE FROM providers');
  });

  afterAll(() => {
    delete process.env.DC1_ADMIN_TOKEN;
  });

  function insertProvider(overrides = {}) {
    const apiKey = overrides.api_key || `prov-key-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const res = db.run(
      `INSERT INTO providers
       (name, email, gpu_model, api_key, status, last_heartbeat, daemon_version, cached_models,
        model_preload_status, model_preload_model, gpu_compute_capability, gpu_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      overrides.name || 'Scorecard Provider',
      overrides.email || `scorecard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      overrides.gpu_model || 'RTX 4090',
      apiKey,
      overrides.status || 'registered',
      Object.prototype.hasOwnProperty.call(overrides, 'last_heartbeat') ? overrides.last_heartbeat : new Date().toISOString(),
      Object.prototype.hasOwnProperty.call(overrides, 'daemon_version') ? overrides.daemon_version : '3.4.0',
      Object.prototype.hasOwnProperty.call(overrides, 'cached_models') ? overrides.cached_models : JSON.stringify(['meta-llama/Meta-Llama-3-8B-Instruct']),
      Object.prototype.hasOwnProperty.call(overrides, 'model_preload_status') ? overrides.model_preload_status : 'ready',
      Object.prototype.hasOwnProperty.call(overrides, 'model_preload_model') ? overrides.model_preload_model : 'meta-llama/Meta-Llama-3-8B-Instruct',
      Object.prototype.hasOwnProperty.call(overrides, 'gpu_compute_capability') ? overrides.gpu_compute_capability : '8.9',
      Object.prototype.hasOwnProperty.call(overrides, 'gpu_status') ? overrides.gpu_status : JSON.stringify({ gpu_name: 'RTX 4090' })
    );
    return { id: res.lastInsertRowid, apiKey };
  }

  test('requires provider key for non-admin requests', async () => {
    const res = await request(app)
      .get('/api/providers/activation-scorecard')
      .expect(401);

    expect(res.body.ready_to_serve).toBe(false);
    expect(res.body.blockers[0].reason_code).toBe('KEY_AUTH_MISMATCH');
  });

  test('returns ready_to_serve=true for healthy provider', async () => {
    const provider = insertProvider();

    const res = await request(app)
      .get('/api/providers/activation-scorecard')
      .set('x-provider-key', provider.apiKey)
      .expect(200);

    expect(res.body.provider_id).toBe(provider.id);
    expect(res.body.ready_to_serve).toBe(true);
    expect(res.body.blockers).toEqual([]);
    expect(res.body.admission?.latest_rejection_code).toBe(null);
    expect(Array.isArray(res.body.admission?.code_enum)).toBe(true);
  });

  test('returns blocked scorecard for stale heartbeat', async () => {
    const stale = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const provider = insertProvider({ last_heartbeat: stale });

    const res = await request(app)
      .get('/api/providers/activation-scorecard')
      .set('x-provider-key', provider.apiKey)
      .expect(200);

    expect(res.body.ready_to_serve).toBe(false);
    expect(res.body.blockers.map((b) => b.reason_code)).toContain('STALE_HEARTBEAT');
  });

  test('returns deterministic blocker ordering', async () => {
    const provider = insertProvider({
      daemon_version: null,
      last_heartbeat: null,
      cached_models: JSON.stringify([]),
      model_preload_status: 'downloading',
      model_preload_model: 'meta-llama/Meta-Llama-3-8B-Instruct',
      gpu_compute_capability: '5.0',
      gpu_status: null,
    });

    const res = await request(app)
      .get(`/api/providers/activation-scorecard?provider_id=${provider.id}`)
      .set('x-admin-token', adminToken)
      .expect(200);

    expect(res.body.ready_to_serve).toBe(false);
    expect(res.body.blockers.map((b) => b.reason_code)).toEqual([
      'DAEMON_NOT_SEEN',
      'STALE_HEARTBEAT',
      'MISSING_TIER_IMAGE',
      'INVALID_GPU_CAPABILITY',
    ]);
  });

  test('transitions blocked provider to ready_to_serve=true after prerequisites', async () => {
    const provider = insertProvider({
      daemon_version: null,
      last_heartbeat: null,
      cached_models: JSON.stringify([]),
      model_preload_status: 'downloading',
      model_preload_model: 'meta-llama/Meta-Llama-3-8B-Instruct',
      gpu_compute_capability: '5.0',
      gpu_status: null,
    });

    const before = await request(app)
      .get(`/api/providers/activation-scorecard?provider_id=${provider.id}`)
      .set('x-admin-token', adminToken)
      .expect(200);
    expect(before.body.ready_to_serve).toBe(false);

    db.run(
      `UPDATE providers
       SET daemon_version = ?, last_heartbeat = ?, cached_models = ?, model_preload_status = ?,
           gpu_compute_capability = ?, gpu_status = ?
       WHERE id = ?`,
      '3.4.0',
      new Date().toISOString(),
      JSON.stringify(['meta-llama/Meta-Llama-3-8B-Instruct']),
      'ready',
      '8.9',
      JSON.stringify({ gpu_name: 'RTX 4090' }),
      provider.id
    );

    const after = await request(app)
      .get(`/api/providers/activation-scorecard?provider_id=${provider.id}`)
      .set('x-admin-token', adminToken)
      .expect(200);

    expect(after.body.ready_to_serve).toBe(true);
    expect(after.body.blockers).toEqual([]);
  });

  test('includes latest tier-admission rejection code for provider-facing scorecard', async () => {
    const provider = insertProvider();
    db.run(
      `INSERT INTO provider_activation_events (provider_id, event_code, occurred_at, metadata_json, created_at)
       VALUES (?, 'tier_admission_rejected', ?, ?, ?)`,
      provider.id,
      new Date(Date.now() - 30 * 1000).toISOString(),
      JSON.stringify({ rejection_code: 'INSUFFICIENT_GPU_COUNT' }),
      new Date(Date.now() - 30 * 1000).toISOString()
    );

    const res = await request(app)
      .get('/api/providers/activation-scorecard')
      .set('x-provider-key', provider.apiKey)
      .expect(200);

    expect(res.body.admission?.latest_rejection_code).toBe('INSUFFICIENT_GPU_COUNT');
    expect(res.body.admission?.code_enum).toContain('INSUFFICIENT_GPU_COUNT');
  });
});
