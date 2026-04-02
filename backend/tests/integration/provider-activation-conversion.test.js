'use strict';

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token';
if (!process.env.DISABLE_RATE_LIMIT) process.env.DISABLE_RATE_LIMIT = '1';

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const { cleanDb, registerProvider, db } = require('./helpers');

const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN;

function minusHours(hours) {
  return new Date(Date.now() - (hours * 3600 * 1000)).toISOString();
}

describe('GET /api/admin/providers/activation-conversion', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/providers', require('../../src/routes/providers'));
    app.use('/api/admin', require('../../src/routes/admin'));
  });

  beforeEach(() => {
    cleanDb();
  });

  afterAll(() => {
    cleanDb();
  });

  test('returns deterministic empty windows without synthetic blocker rows', async () => {
    const res = await request(app)
      .get('/api/admin/providers/activation-conversion')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.generated_at).toBeTruthy();
    expect(res.body.windows?.last_24h).toBeTruthy();
    expect(res.body.windows?.last_7d).toBeTruthy();

    for (const windowKey of ['last_24h', 'last_7d']) {
      const report = res.body.windows[windowKey];
      expect(report.stage_counts).toEqual({
        registered: 0,
        installer_downloaded: 0,
        first_heartbeat: 0,
        online_within_24h: 0,
      });
      expect(report.conversion_rates).toEqual({
        installer_download_rate: null,
        first_heartbeat_rate: null,
        online_within_24h_rate: null,
      });
      expect(report.blocker_taxonomy).toEqual([]);
      expect(report.admission_rejection_counts).toEqual([]);
      expect(report.sample_size).toBe(0);
    }
  });

  test('reports stage conversion counts and blocker taxonomy from lifecycle + daemon logs', async () => {
    const providerA = await registerProvider(request, app, {
      name: 'Provider A',
      email: 'provider-a@dc1.test',
      gpu_model: 'RTX 4090',
    });
    const providerB = await registerProvider(request, app, {
      name: 'Provider B',
      email: 'provider-b@dc1.test',
      gpu_model: 'RTX 3090',
    });
    const providerC = await registerProvider(request, app, {
      name: 'Provider C',
      email: 'provider-c@dc1.test',
      gpu_model: 'RTX 4070',
    });

    const providerAId = Number(providerA.providerId);
    const providerBId = Number(providerB.providerId);
    const providerCId = Number(providerC.providerId);

    db.prepare(`UPDATE providers SET created_at = ?, approval_status = 'approved' WHERE id = ?`).run(minusHours(2), providerAId);
    db.prepare(`UPDATE providers SET created_at = ?, approval_status = 'approved' WHERE id = ?`).run(minusHours(3), providerBId);
    db.prepare(`UPDATE providers SET created_at = ?, approval_status = 'pending' WHERE id = ?`).run(minusHours(4), providerCId);

    await request(app).get(`/api/providers/download/setup?key=${encodeURIComponent(providerA.apiKey)}`);
    await request(app).get(`/api/providers/download/daemon?key=${encodeURIComponent(providerC.apiKey)}`);

    db.prepare(
      `INSERT INTO heartbeat_log (provider_id, received_at, daemon_version, provider_hostname)
       VALUES (?, ?, ?, ?)`
    ).run(providerAId, minusHours(1), '3.3.0', 'provider-a-node');

    db.prepare(
      `UPDATE providers
          SET status = 'online',
              daemon_version = '3.3.0',
              last_heartbeat = ?,
              is_paused = 0
        WHERE id = ?`
    ).run(minusHours(1), providerAId);

    db.prepare(
      `INSERT INTO daemon_events (provider_id, event_type, severity, details, event_timestamp, received_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      providerCId,
      'daemon_crash',
      'critical',
      'watchdog restart loop',
      minusHours(2),
      minusHours(2)
    );

    db.prepare(
      `INSERT INTO provider_activation_events (provider_id, event_code, occurred_at, metadata_json, created_at)
       VALUES (?, 'tier_admission_rejected', ?, ?, ?)`
    ).run(
      providerCId,
      minusHours(1),
      JSON.stringify({ rejection_code: 'INSUFFICIENT_VRAM', reason: 'Provider VRAM too low' }),
      minusHours(1)
    );

    // Null-safe contract: malformed/empty metadata must not produce synthetic "unknown" reason codes.
    db.prepare(
      `INSERT INTO provider_activation_events (provider_id, event_code, occurred_at, metadata_json, created_at)
       VALUES (?, 'tier_admission_rejected', ?, ?, ?)`
    ).run(
      providerBId,
      minusHours(1),
      JSON.stringify({ reason: 'missing code field' }),
      minusHours(1)
    );

    const res = await request(app)
      .get('/api/admin/providers/activation-conversion')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const report = res.body.windows.last_24h;
    expect(report.stage_counts).toEqual({
      registered: 3,
      installer_downloaded: 2,
      first_heartbeat: 1,
      online_within_24h: 1,
    });
    expect(report.conversion_rates).toEqual({
      installer_download_rate: 66.67,
      first_heartbeat_rate: 33.33,
      online_within_24h_rate: 33.33,
    });

    const blockerByCode = new Map(report.blocker_taxonomy.map((entry) => [entry.code, entry]));
    expect(blockerByCode.get('installer_not_downloaded')?.count).toBe(1);
    expect(blockerByCode.get('heartbeat_missing')?.count).toBe(2);
    expect(blockerByCode.get('daemon_event_daemon_crash')?.count).toBe(1);
    expect(blockerByCode.get('approval_pending')?.count).toBe(1);
    expect(blockerByCode.get('provider_not_online')?.count).toBe(2);

    expect(report.admission_rejection_counts).toEqual([
      {
        rejection_code: 'INSUFFICIENT_VRAM',
        count: 1,
        sample_provider_ids: [providerCId],
      },
    ]);
  });
});
