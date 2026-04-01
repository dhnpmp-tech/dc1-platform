'use strict';

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token';

const request = require('supertest');
const express = require('express');
const db = require('../../src/db');

jest.setTimeout(180000);

const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN;

function createApp() {
  const app = express();
  app.use(express.json());
  ['providers', 'renters', 'jobs', 'admin'].forEach((name) => {
    const resolved = require.resolve(`../../src/routes/${name}`);
    delete require.cache[resolved];
  });
  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters', require('../../src/routes/renters'));
  app.use('/api/jobs', require('../../src/routes/jobs'));
  app.use('/api/admin', require('../../src/routes/admin'));
  return app;
}

function nowIsoMinus(seconds) {
  return new Date(Date.now() - (seconds * 1000)).toISOString();
}

function providerColumns() {
  return new Set((db.all('PRAGMA table_info(providers)') || []).map((row) => String(row.name || '')));
}

function insertProvider(overrides = {}) {
  const cols = providerColumns();
  const now = new Date().toISOString();
  const payload = {
    name: overrides.name || `Provider-${Math.random().toString(36).slice(2, 8)}`,
    email: overrides.email || `provider-${Math.random().toString(36).slice(2, 8)}@dc1.test`,
    gpu_model: 'RTX 4090',
    os: 'linux',
    status: 'offline',
    approval_status: 'approved',
    api_key: `prov-${Math.random().toString(36).slice(2)}`,
    created_at: now,
    updated_at: now,
    ...overrides,
  };

  const insertCols = [];
  const insertVals = [];
  const placeholders = [];
  for (const [key, value] of Object.entries(payload)) {
    if (!cols.has(key)) continue;
    insertCols.push(key);
    insertVals.push(value);
    placeholders.push('?');
  }

  const result = db.prepare(
    `INSERT INTO providers (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`
  ).run(...insertVals);

  return Number(result.lastInsertRowid);
}

function cleanDb() {
  try { db.run('DELETE FROM jobs'); } catch (_) {}
  try { db.run('DELETE FROM providers'); } catch (_) {}
  try { db.run('DELETE FROM renters'); } catch (_) {}
  try { db.run('DELETE FROM admin_audit_log'); } catch (_) {}
}

describe('GET /api/admin/providers/reactivation-queue', () => {
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

  test('returns deterministic ordering with reason codes and stable tie-break', async () => {
    const sameAge = nowIsoMinus(8 * 60);
    const firstId = insertProvider({
      name: 'Tie A',
      email: 'tie-a@dc1.test',
      last_heartbeat: sameAge,
      daemon_version: '3.3.0',
      readiness_status: 'ready',
      status: 'offline',
    });
    const secondId = insertProvider({
      name: 'Tie B',
      email: 'tie-b@dc1.test',
      last_heartbeat: sameAge,
      daemon_version: '3.3.0',
      readiness_status: 'ready',
      status: 'offline',
    });
    insertProvider({
      name: 'Cold Lead',
      email: 'cold-lead@dc1.test',
      approval_status: 'pending',
      daemon_version: null,
      last_heartbeat: null,
      readiness_status: 'failed',
      readiness_details: JSON.stringify({ checks: [{ name: 'docker', ok: false }] }),
      status: 'pending',
    });

    const res = await request(app)
      .get('/api/admin/providers/reactivation-queue?ready_to_serve=false')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.providers)).toBe(true);
    expect(res.body.providers.length).toBe(3);
    expect(res.body.providers[0].provider_id).toBeLessThan(res.body.providers[1].provider_id);
    expect([firstId, secondId]).toContain(res.body.providers[0].provider_id);
    expect([firstId, secondId]).toContain(res.body.providers[1].provider_id);
    expect(res.body.providers[0].blocker_reason_codes).toContain('heartbeat_stale');
    expect(res.body.providers[2].blocker_reason_codes).toEqual(
      expect.arrayContaining(['approval_pending', 'daemon_not_installed', 'heartbeat_missing', 'readiness_checks_failed'])
    );
  });

  test('flags stale-heartbeat providers with critical stale reason code', async () => {
    insertProvider({
      name: 'Very Stale',
      email: 'very-stale@dc1.test',
      last_heartbeat: nowIsoMinus(31 * 60),
      daemon_version: '3.3.0',
      readiness_status: 'ready',
      status: 'offline',
    });

    const res = await request(app)
      .get('/api/admin/providers/reactivation-queue?ready_to_serve=false')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.providers[0].ready_to_serve).toBe(false);
    expect(res.body.providers[0].blocker_reason_codes).toContain('heartbeat_stale_critical');
  });

  test('shows provider moving to ready_to_serve=true after prerequisites are satisfied', async () => {
    const providerId = insertProvider({
      name: 'Recovering',
      email: 'recovering@dc1.test',
      approval_status: 'approved',
      status: 'offline',
      daemon_version: null,
      last_heartbeat: null,
      readiness_status: 'pending',
    });

    const blockedRes = await request(app)
      .get('/api/admin/providers/reactivation-queue?ready_to_serve=false')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(blockedRes.status).toBe(200);
    const blockedProvider = blockedRes.body.providers.find((row) => row.provider_id === providerId);
    expect(blockedProvider).toBeDefined();
    expect(blockedProvider.ready_to_serve).toBe(false);

    db.prepare(
      `UPDATE providers
       SET status = 'online',
           daemon_version = ?,
           readiness_status = 'ready',
           readiness_details = ?,
           last_heartbeat = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      '3.3.0',
      JSON.stringify({ checks: [{ name: 'docker', ok: true }, { name: 'gpu', ok: true }] }),
      nowIsoMinus(30),
      new Date().toISOString(),
      providerId
    );

    const readyRes = await request(app)
      .get('/api/admin/providers/reactivation-queue?ready_to_serve=true')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(readyRes.status).toBe(200);
    const readyProvider = readyRes.body.providers.find((row) => row.provider_id === providerId);
    expect(readyProvider).toBeDefined();
    expect(readyProvider.ready_to_serve).toBe(true);
    expect(readyProvider.blocker_reason_codes).toEqual([]);
  });

  test('treats approval/status values case-insensitively for ready_to_serve', async () => {
    const providerId = insertProvider({
      name: 'Case Variant',
      email: 'case-variant@dc1.test',
      approval_status: 'APPROVED',
      status: 'ONLINE',
      daemon_version: '3.3.0',
      readiness_status: 'ready',
      readiness_details: JSON.stringify({ checks: [{ name: 'docker', ok: true }] }),
      last_heartbeat: nowIsoMinus(45),
    });

    const res = await request(app)
      .get('/api/admin/providers/reactivation-queue?ready_to_serve=true')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const provider = res.body.providers.find((row) => row.provider_id === providerId);
    expect(provider).toBeDefined();
    expect(provider.approval_status).toBe('approved');
    expect(provider.status).toBe('online');
    expect(provider.blocker_reason_codes).toEqual([]);
    expect(provider.ready_to_serve).toBe(true);
  });
});
