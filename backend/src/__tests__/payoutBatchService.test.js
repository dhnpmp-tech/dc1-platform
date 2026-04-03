'use strict';

const Database = require('better-sqlite3');
const {
  buildProviderSettlementPreview,
  generateProviderPayoutBatch,
  toBankCsv,
} = require('../services/payoutBatchService');

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE job_settlements (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE,
      provider_id INTEGER,
      renter_id INTEGER NOT NULL,
      duration_seconds INTEGER,
      gpu_rate_per_second REAL,
      gross_amount_halala INTEGER NOT NULL,
      platform_fee_halala INTEGER NOT NULL,
      provider_payout_halala INTEGER NOT NULL,
      status TEXT NOT NULL,
      settled_at TEXT NOT NULL
    );
    CREATE TABLE withdrawal_requests (
      id TEXT PRIMARY KEY,
      provider_id INTEGER NOT NULL,
      amount_halala INTEGER NOT NULL,
      is_amount_reserved INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL,
      iban TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function seedIban(db, providerId, iban, createdAt = '2026-03-31T00:00:00.000Z') {
  db.prepare(`
    INSERT INTO withdrawal_requests (id, provider_id, amount_halala, status, iban, created_at)
    VALUES (?, ?, 0, 'paid', ?, ?)
  `).run(`wr-${providerId}-${createdAt}`, providerId, iban, createdAt);
}

function seedSettlement(db, { id, jobId, providerId, payoutHalala, settledAt }) {
  db.prepare(`
    INSERT INTO job_settlements
      (id, job_id, provider_id, renter_id, duration_seconds, gpu_rate_per_second, gross_amount_halala, platform_fee_halala, provider_payout_halala, status, settled_at)
    VALUES (?, ?, ?, 1, 300, 0.5, ?, 0, ?, 'completed', ?)
  `).run(id, jobId, providerId, payoutHalala, payoutHalala, settledAt);
}

describe('payoutBatchService', () => {
  test('builds deterministic batch and aggregates duplicate provider rows', () => {
    const db = makeDb();
    seedIban(db, 11, 'SA0380000000608010167519');
    seedIban(db, 22, 'SA4420000001234567891234');
    seedSettlement(db, { id: 's1', jobId: 'j1', providerId: 11, payoutHalala: 105, settledAt: '2026-03-31T01:00:00.000Z' });
    seedSettlement(db, { id: 's2', jobId: 'j2', providerId: 11, payoutHalala: 95, settledAt: '2026-03-31T01:10:00.000Z' });
    seedSettlement(db, { id: 's3', jobId: 'j3', providerId: 22, payoutHalala: 200, settledAt: '2026-03-31T01:30:00.000Z' });

    const batch = generateProviderPayoutBatch(db, {
      windowStart: '2026-03-31T00:00:00.000Z',
      windowEnd: '2026-03-31T23:59:59.000Z',
      signingKey: 'test-signing-key',
    });

    expect(batch.counts.providers_total).toBe(2);
    expect(batch.counts.providers_exported).toBe(2);
    expect(batch.entries).toHaveLength(2);
    expect(batch.entries[0].provider_id).toBe(11);
    expect(batch.entries[0].amount_halala).toBe(200);
    expect(batch.entries[0].amount_sar).toBe('2.00');
    expect(batch.entries[1].provider_id).toBe(22);
    expect(batch.entries[1].amount_halala).toBe(200);
    expect(batch.totals.exported_halala).toBe(400);
    expect(batch.signature.algorithm).toBe('hmac-sha256');

    const secondRun = generateProviderPayoutBatch(db, {
      windowStart: '2026-03-31T00:00:00.000Z',
      windowEnd: '2026-03-31T23:59:59.000Z',
      signingKey: 'test-signing-key',
    });
    expect(secondRun.checksum).toBe(batch.checksum);
    expect(secondRun.signature.value).toBe(batch.signature.value);
  });

  test('returns an empty batch when no completed settlements exist in window', () => {
    const db = makeDb();
    const batch = generateProviderPayoutBatch(db, {
      windowStart: '2026-03-01T00:00:00.000Z',
      windowEnd: '2026-03-01T23:59:59.000Z',
    });
    expect(batch.entries).toHaveLength(0);
    expect(batch.totals.exported_halala).toBe(0);
    expect(batch.totals.exported_sar).toBe('0.00');
    expect(batch.counts.providers_skipped).toBe(0);
  });

  test('skips providers missing IBAN and keeps totals consistent', () => {
    const db = makeDb();
    seedIban(db, 11, 'SA0380000000608010167519');
    seedSettlement(db, { id: 's1', jobId: 'j1', providerId: 11, payoutHalala: 101, settledAt: '2026-03-31T02:00:00.000Z' });
    seedSettlement(db, { id: 's2', jobId: 'j2', providerId: 33, payoutHalala: 499, settledAt: '2026-03-31T02:30:00.000Z' });

    const batch = generateProviderPayoutBatch(db, {
      windowStart: '2026-03-31T00:00:00.000Z',
      windowEnd: '2026-03-31T23:59:59.000Z',
    });

    expect(batch.entries).toHaveLength(1);
    expect(batch.entries[0].amount_sar).toBe('1.01');
    expect(batch.counts.providers_skipped).toBe(1);
    expect(batch.totals.ledger_halala).toBe(600);
    expect(batch.totals.exported_halala).toBe(101);
    expect(batch.totals.skipped_halala).toBe(499);

    const csv = toBankCsv(batch);
    expect(csv).toContain('provider_id,iban,amount_sar,amount_halala,currency');
    expect(csv).toContain('11,SA0380000000608010167519,1.01,101,SAR');
  });
});

describe('buildProviderSettlementPreview', () => {
  test('returns per-provider gross/platform/net totals and deterministic 2dp SAR strings', () => {
    const db = makeDb();
    db.prepare(`
      INSERT INTO job_settlements
        (id, job_id, provider_id, renter_id, duration_seconds, gpu_rate_per_second, gross_amount_halala, platform_fee_halala, provider_payout_halala, status, settled_at)
      VALUES (?, ?, ?, 1, 120, 0.1, ?, ?, ?, 'completed', ?)
    `).run('px-1', 'job-1', 11, 101, 15, 86, '2026-03-31T01:00:00.000Z');
    db.prepare(`
      INSERT INTO job_settlements
        (id, job_id, provider_id, renter_id, duration_seconds, gpu_rate_per_second, gross_amount_halala, platform_fee_halala, provider_payout_halala, status, settled_at)
      VALUES (?, ?, ?, 1, 120, 0.1, ?, ?, ?, 'completed', ?)
    `).run('px-2', 'job-2', 11, 99, 14, 85, '2026-03-31T01:10:00.000Z');
    db.prepare(`
      INSERT INTO job_settlements
        (id, job_id, provider_id, renter_id, duration_seconds, gpu_rate_per_second, gross_amount_halala, platform_fee_halala, provider_payout_halala, status, settled_at)
      VALUES (?, ?, ?, 2, 240, 0.2, ?, ?, ?, 'completed', ?)
    `).run('px-3', 'job-3', 22, 205, 30, 175, '2026-03-31T02:00:00.000Z');

    const preview = buildProviderSettlementPreview(db, {
      windowStart: '2026-03-31T00:00:00.000Z',
      windowEnd: '2026-03-31T23:59:59.999Z',
    });

    expect(preview.providers).toHaveLength(2);
    expect(preview.providers[0]).toMatchObject({
      provider_id: 11,
      settled_jobs: 2,
      gross_halala: 200,
      gross_sar: '2.00',
      platform_fee_halala: 29,
      platform_fee_sar: '0.29',
      provider_net_halala: 171,
      provider_net_sar: '1.71',
      reconciliation_ok: true,
    });
    expect(preview.providers[1]).toMatchObject({
      provider_id: 22,
      settled_jobs: 1,
      gross_halala: 205,
      gross_sar: '2.05',
      platform_fee_halala: 30,
      platform_fee_sar: '0.30',
      provider_net_halala: 175,
      provider_net_sar: '1.75',
      reconciliation_ok: true,
    });
    expect(preview.totals).toMatchObject({
      providers_count: 2,
      settled_jobs: 3,
      gross_halala: 405,
      gross_sar: '4.05',
      platform_fee_halala: 59,
      platform_fee_sar: '0.59',
      provider_net_halala: 346,
      provider_net_sar: '3.46',
    });
    expect(preview.reconciliation).toEqual({
      gross_equals_split: true,
      delta_halala: 0,
    });
  });

  test('supports provider_id filter and validates window bounds', () => {
    const db = makeDb();
    seedSettlement(db, { id: 'p-only-1', jobId: 'po-1', providerId: 11, payoutHalala: 100, settledAt: '2026-03-31T01:00:00.000Z' });
    seedSettlement(db, { id: 'p-only-2', jobId: 'po-2', providerId: 22, payoutHalala: 200, settledAt: '2026-03-31T01:30:00.000Z' });

    const preview = buildProviderSettlementPreview(db, {
      windowStart: '2026-03-31T00:00:00.000Z',
      windowEnd: '2026-03-31T23:59:59.999Z',
      providerId: 11,
    });

    expect(preview.providers).toHaveLength(1);
    expect(preview.providers[0].provider_id).toBe(11);
    expect(() => buildProviderSettlementPreview(db, {
      windowStart: '2026-04-01T00:00:00.000Z',
      windowEnd: '2026-03-31T00:00:00.000Z',
    })).toThrow('windowStart must be <= windowEnd');
  });
});
