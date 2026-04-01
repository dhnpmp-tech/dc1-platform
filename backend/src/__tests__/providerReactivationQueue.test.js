'use strict';

const Database = require('better-sqlite3');
const {
  generateProviderReactivationQueue,
  toProviderReactivationCsv,
} = require('../services/providerReactivationQueue');

function buildDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE providers (
      id INTEGER PRIMARY KEY,
      name TEXT,
      email TEXT,
      organization TEXT,
      location TEXT,
      status TEXT,
      approval_status TEXT,
      is_paused INTEGER DEFAULT 0,
      daemon_version TEXT,
      readiness_status TEXT,
      readiness_details TEXT,
      last_heartbeat TEXT,
      created_at TEXT,
      deleted_at TEXT
    );
  `);
  return db;
}

function seedProvider(db, row) {
  db.prepare(
    `INSERT INTO providers
      (id, name, email, organization, location, status, approval_status, is_paused, daemon_version, readiness_status, readiness_details, last_heartbeat, created_at, deleted_at)
     VALUES
      (@id, @name, @email, @organization, @location, @status, @approval_status, @is_paused, @daemon_version, @readiness_status, @readiness_details, @last_heartbeat, @created_at, NULL)`
  ).run(row);
}

describe('providerReactivationQueue', () => {
  test('inactiveOnly excludes ready-to-serve providers and ranks blocked providers', () => {
    const db = buildDb();
    const now = new Date('2026-04-01T12:00:00.000Z');

    seedProvider(db, {
      id: 1,
      name: 'Ready Node',
      email: 'ready@dcp.sa',
      organization: 'Org A',
      location: 'Riyadh',
      status: 'online',
      approval_status: 'approved',
      is_paused: 0,
      daemon_version: '2.0.1',
      readiness_status: 'ready',
      readiness_details: null,
      last_heartbeat: '2026-04-01T11:58:30.000Z',
      created_at: '2026-03-01T00:00:00.000Z',
    });

    seedProvider(db, {
      id: 2,
      name: 'Stale Node',
      email: 'stale@dcp.sa',
      organization: 'Org B',
      location: 'Jeddah',
      status: 'offline',
      approval_status: 'approved',
      is_paused: 0,
      daemon_version: '2.0.1',
      readiness_status: 'ready',
      readiness_details: null,
      last_heartbeat: '2026-04-01T11:30:00.000Z',
      created_at: '2026-03-02T00:00:00.000Z',
    });

    seedProvider(db, {
      id: 3,
      name: 'No Daemon',
      email: 'nodaemon@dcp.sa',
      organization: 'Org C',
      location: 'Dammam',
      status: 'pending',
      approval_status: 'pending',
      is_paused: 0,
      daemon_version: null,
      readiness_status: 'failed',
      readiness_details: JSON.stringify({ checks: [{ key: 'gpu_probe', ok: false }] }),
      last_heartbeat: null,
      created_at: '2026-03-03T00:00:00.000Z',
    });

    const queue = generateProviderReactivationQueue(db, {
      nowMs: now.getTime(),
      inactiveOnly: true,
      limit: 50,
    });

    expect(queue.total).toBe(2);
    expect(queue.providers.map((p) => p.provider_id)).toEqual([2, 3]);
    expect(queue.summary.top_10_ids).toEqual([2, 3]);
    expect(queue.providers[0].blocker_reason_codes).toContain('heartbeat_stale_critical');
    expect(queue.providers[1].blocker_reason_codes).toContain('daemon_not_installed');
    expect(queue.providers[1].failed_readiness_checks).toContain('gpu_probe');
  });

  test('CSV export includes reason code columns and queue positions', () => {
    const payload = {
      providers: [
        {
          queue_position: 1,
          provider_id: 42,
          name: 'Provider 42',
          email: 'p42@dcp.sa',
          organization: 'Ops',
          location: 'Riyadh',
          status: 'offline',
          approval_status: 'approved',
          priority_score: 75,
          priority_band: 'high',
          suggested_action: 'heartbeat_stale_critical',
          ready_to_serve: false,
          blocker_count: 1,
          blocker_reason_codes: ['heartbeat_stale_critical'],
          failed_readiness_checks: ['gpu_probe'],
          last_heartbeat: '2026-04-01T10:00:00.000Z',
          heartbeat_age_seconds: 7200,
          install_status: 'installed',
          readiness_status: 'ready',
          created_at: '2026-03-01T00:00:00.000Z',
        },
      ],
    };

    const csv = toProviderReactivationCsv(payload);
    const lines = csv.trim().split('\n');

    expect(lines[0]).toContain('blocker_reason_codes');
    expect(lines[0]).toContain('failed_readiness_checks');
    expect(lines[1]).toContain('42');
    expect(lines[1]).toContain('heartbeat_stale_critical');
    expect(lines[1]).toContain('gpu_probe');
  });
});
