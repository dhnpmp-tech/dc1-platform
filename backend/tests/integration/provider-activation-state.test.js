'use strict';

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token';
if (!process.env.DISABLE_RATE_LIMIT) process.env.DISABLE_RATE_LIMIT = '1';

const request = require('supertest');
const { createApp } = require('./test-app');
const { cleanDb, registerProvider, db } = require('./helpers');

const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN;

function nowIsoMinus(seconds) {
  return new Date(Date.now() - (seconds * 1000)).toISOString();
}

describe('GET /api/providers/activation-state', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    cleanDb();
  });

  afterAll(() => {
    cleanDb();
  });

  test('returns error contract when provider key is missing', async () => {
    const res = await request(app).get('/api/providers/activation-state');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Provider API key required');
    expect(res.body.code).toBe('PROVIDER_AUTH_REQUIRED');
    expect(res.body.statusCode).toBe(401);
    expect(res.body.details?.remediation_hint?.hint_key).toBe('install_daemon');
  });

  test('returns not_started when daemon and heartbeat were never seen', async () => {
    const { apiKey, providerId, status } = await registerProvider(request, app, {
      name: 'Not Started Provider',
      email: 'not-started@dc1.test',
      gpu_model: 'RTX 4090',
    });
    expect(status).toBe(200);

    db.prepare(
      `UPDATE providers
       SET approval_status = 'approved',
           status = 'pending',
           daemon_version = NULL,
           gpu_status = NULL,
           last_heartbeat = NULL,
           readiness_status = 'pending',
           is_paused = 0
       WHERE id = ?`
    ).run(providerId);

    const res = await request(app)
      .get('/api/providers/activation-state')
      .set('x-provider-key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.activation_state).toBe('not_started');
    expect(res.body.blocker_codes).toEqual(expect.arrayContaining(['daemon_not_detected', 'heartbeat_missing']));
  });

  test('returns install_started when daemon is seen but first heartbeat is missing', async () => {
    const { apiKey, providerId } = await registerProvider(request, app, {
      name: 'Install Started Provider',
      email: 'install-started@dc1.test',
      gpu_model: 'RTX 4090',
    });

    db.prepare(
      `UPDATE providers
       SET approval_status = 'approved',
           status = 'pending',
           daemon_version = '3.3.0',
           last_heartbeat = NULL,
           readiness_status = 'pending',
           is_paused = 0
       WHERE id = ?`
    ).run(providerId);

    const res = await request(app)
      .get('/api/providers/activation-state')
      .set('x-provider-key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.activation_state).toBe('install_started');
    expect(res.body.blocker_codes).toContain('heartbeat_missing');
  });

  test('returns heartbeat_received when heartbeat is fresh but onboarding is still pending', async () => {
    const { apiKey, providerId } = await registerProvider(request, app, {
      name: 'Heartbeat Provider',
      email: 'heartbeat@dc1.test',
      gpu_model: 'RTX 4090',
    });

    db.prepare(
      `UPDATE providers
       SET approval_status = 'pending',
           status = 'offline',
           daemon_version = '3.3.0',
           last_heartbeat = ?,
           readiness_status = 'pending',
           is_paused = 0
       WHERE id = ?`
    ).run(nowIsoMinus(30), providerId);

    const res = await request(app)
      .get('/api/providers/activation-state')
      .set('x-provider-key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.activation_state).toBe('heartbeat_received');
    expect(res.body.blocker_codes).toEqual(expect.arrayContaining(['approval_pending', 'readiness_pending']));
    expect(res.body.next_action?.hint_key).toBeTruthy();
  });

  test('returns ready_for_jobs when provider passes all activation checks', async () => {
    const { apiKey, providerId } = await registerProvider(request, app, {
      name: 'Ready Provider',
      email: 'ready@dc1.test',
      gpu_model: 'RTX 4090',
    });

    db.prepare(
      `UPDATE providers
       SET approval_status = 'approved',
           status = 'online',
           daemon_version = '3.3.0',
           last_heartbeat = ?,
           readiness_status = 'ready',
           is_paused = 0,
           vram_mb = 24576
       WHERE id = ?`
    ).run(nowIsoMinus(10), providerId);

    const res = await request(app)
      .get('/api/providers/activation-state')
      .set('x-provider-key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.activation_state).toBe('ready_for_jobs');
    expect(res.body.blocker_codes).toEqual([]);
    expect(res.body.next_action?.hint_key).toBe('ready_for_jobs');
  });

  test('returns blocked when heartbeat is stale', async () => {
    const { apiKey, providerId } = await registerProvider(request, app, {
      name: 'Blocked Provider',
      email: 'blocked@dc1.test',
      gpu_model: 'RTX 4090',
    });

    db.prepare(
      `UPDATE providers
       SET approval_status = 'approved',
           status = 'online',
           daemon_version = '3.3.0',
           last_heartbeat = ?,
           readiness_status = 'ready',
           is_paused = 0,
           vram_mb = 24576
       WHERE id = ?`
    ).run(nowIsoMinus(20 * 60), providerId);

    const res = await request(app)
      .get('/api/providers/activation-state')
      .set('x-provider-key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.activation_state).toBe('blocked');
    expect(res.body.blocker_codes).toContain('heartbeat_stale');
    expect(res.body.next_action?.hint_key).toBe('refresh_heartbeat');
  });

  test('supports admin lookup with provider_id', async () => {
    const { providerId } = await registerProvider(request, app, {
      name: 'Admin Lookup Provider',
      email: 'admin-lookup@dc1.test',
      gpu_model: 'RTX 4090',
    });

    const res = await request(app)
      .get(`/api/providers/activation-state?provider_id=${providerId}`)
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.provider_id).toBe(providerId);
    expect(typeof res.body.activation_state).toBe('string');
  });
});
