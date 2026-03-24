'use strict';

/**
 * Unit tests for settlementService.js (DCP-745)
 *
 * Uses in-memory SQLite (better-sqlite3) so no mocks are needed for the DB.
 * Tests cover:
 *   - calcGross / splitFee pure helpers
 *   - recordSettlement — happy path, idempotency, failure/refund statuses
 *   - getProviderEarnings — totals, filtering, pagination
 *   - getRenterTransactions — totals, pagination
 */

const Database = require('better-sqlite3');
const {
  recordSettlement,
  getProviderEarnings,
  getRenterTransactions,
  calcGross,
  splitFee,
  ratePerSecond,
  PLATFORM_FEE_PERCENT,
  COST_RATES_PER_MINUTE,
} = require('../services/settlementService');

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  return db;
}

// Provide a minimal db facade that settlementService expects (db._db || db).
// Since we pass the Database instance directly it's fine.

// ── Pure helper tests ─────────────────────────────────────────────────────────

describe('ratePerSecond()', () => {
  it('returns halala/second for known job types', () => {
    expect(ratePerSecond('llm-inference')).toBeCloseTo(9 / 60, 5);
    expect(ratePerSecond('llm_inference')).toBeCloseTo(9 / 60, 5);
    expect(ratePerSecond('training')).toBeCloseTo(7 / 60, 5);
    expect(ratePerSecond('rendering')).toBeCloseTo(10 / 60, 5);
    expect(ratePerSecond('vllm_serve')).toBeCloseTo(9 / 60, 5);
  });

  it('falls back to default rate for unknown job types', () => {
    expect(ratePerSecond('unknown-type')).toBeCloseTo(COST_RATES_PER_MINUTE['default'] / 60, 5);
  });
});

describe('calcGross()', () => {
  it('calculates halala cost for a 3600-second llm-inference job', () => {
    // 9 halala/min * 60 min = 540 halala
    expect(calcGross(3600, 'llm-inference')).toBe(540);
  });

  it('calculates halala cost for a 60-second training job', () => {
    // 7 halala/min * 1 min = 7 halala
    expect(calcGross(60, 'training')).toBe(7);
  });

  it('returns minimum of 1 halala for zero-duration job', () => {
    expect(calcGross(0, 'default')).toBe(1);
  });

  it('rounds fractional halala amounts', () => {
    // 9/60 * 1 = 0.15 halala → rounds to 1 (minimum)
    expect(calcGross(1, 'llm-inference')).toBeGreaterThanOrEqual(1);
  });
});

describe('splitFee()', () => {
  it(`splits ${PLATFORM_FEE_PERCENT}% platform fee and ${100 - PLATFORM_FEE_PERCENT}% provider payout`, () => {
    const { platformFee, providerPayout } = splitFee(100);
    expect(platformFee).toBe(PLATFORM_FEE_PERCENT);
    expect(providerPayout).toBe(100 - PLATFORM_FEE_PERCENT);
  });

  it('ensures fee + payout always equals gross (no rounding loss)', () => {
    for (const gross of [1, 7, 13, 100, 540, 1337, 99999]) {
      const { platformFee, providerPayout } = splitFee(gross);
      expect(platformFee + providerPayout).toBe(gross);
    }
  });

  it('returns 0 fee and 0 payout for 0 gross', () => {
    const { platformFee, providerPayout } = splitFee(0);
    expect(platformFee).toBe(0);
    expect(providerPayout).toBe(0);
  });
});

// ── recordSettlement ──────────────────────────────────────────────────────────

describe('recordSettlement()', () => {
  let db;

  beforeEach(() => { db = buildDb(); });
  afterEach(() => { db.close(); });

  it('records a completed settlement with correct amounts', () => {
    const s = recordSettlement(db, {
      jobId: 'job-001',
      providerId: 1,
      renterId: 2,
      durationSeconds: 3600,
      jobType: 'llm-inference',
      status: 'completed',
    });

    expect(s.job_id).toBe('job-001');
    expect(s.status).toBe('completed');
    // 9 halala/min × 60 min = 540 halala gross
    expect(s.gross_amount_halala).toBe(540);
    // 15% of 540 = 81 (floor)
    expect(s.platform_fee_halala).toBe(81);
    // 85% of 540 = 459
    expect(s.provider_payout_halala).toBe(459);
    expect(s.platform_fee_halala + s.provider_payout_halala).toBe(s.gross_amount_halala);
  });

  it('records a failed settlement with zero amounts', () => {
    const s = recordSettlement(db, {
      jobId: 'job-002',
      providerId: 1,
      renterId: 2,
      durationSeconds: 120,
      jobType: 'default',
      status: 'failed',
    });

    expect(s.status).toBe('failed');
    expect(s.gross_amount_halala).toBe(0);
    expect(s.platform_fee_halala).toBe(0);
    expect(s.provider_payout_halala).toBe(0);
  });

  it('records a refunded settlement with zero amounts', () => {
    const s = recordSettlement(db, {
      jobId: 'job-003',
      providerId: null,
      renterId: 2,
      durationSeconds: 60,
      jobType: 'rendering',
      status: 'refunded',
    });

    expect(s.status).toBe('refunded');
    expect(s.provider_id).toBeNull();
    expect(s.gross_amount_halala).toBe(0);
  });

  it('is idempotent — returns the same row on duplicate calls', () => {
    const opts = {
      jobId: 'job-004',
      providerId: 1,
      renterId: 2,
      durationSeconds: 600,
      jobType: 'training',
      status: 'completed',
    };

    const s1 = recordSettlement(db, opts);
    const s2 = recordSettlement(db, opts);

    expect(s1.id).toBe(s2.id);
    expect(s1.gross_amount_halala).toBe(s2.gross_amount_halala);

    const count = db.prepare('SELECT COUNT(*) as c FROM job_settlements WHERE job_id = ?').get('job-004').c;
    expect(count).toBe(1);
  });

  it('stores a valid UUID as the settlement id', () => {
    const s = recordSettlement(db, {
      jobId: 'job-005',
      providerId: 1,
      renterId: 3,
      durationSeconds: 120,
      jobType: 'default',
      status: 'completed',
    });

    expect(s.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

// ── getProviderEarnings ───────────────────────────────────────────────────────

describe('getProviderEarnings()', () => {
  let db;

  beforeEach(() => {
    db = buildDb();

    // Seed: 3 completed jobs for provider 1, 1 failed, 1 job for provider 2
    const jobs = [
      { jobId: 'job-p1-a', providerId: 1, renterId: 10, dur: 3600, type: 'llm-inference', status: 'completed' },
      { jobId: 'job-p1-b', providerId: 1, renterId: 10, dur: 600,  type: 'training',      status: 'completed' },
      { jobId: 'job-p1-c', providerId: 1, renterId: 11, dur: 1800, type: 'rendering',      status: 'failed'    },
      { jobId: 'job-p2-a', providerId: 2, renterId: 20, dur: 3600, type: 'default',        status: 'completed' },
    ];

    for (const j of jobs) {
      recordSettlement(db, {
        jobId: j.jobId, providerId: j.providerId, renterId: j.renterId,
        durationSeconds: j.dur, jobType: j.type, status: j.status,
      });
    }
  });

  afterEach(() => { db.close(); });

  it('returns only completed settlements for the provider', () => {
    const result = getProviderEarnings(db, 1);
    expect(result.settlements).toHaveLength(2);
    expect(result.settlements.every(s => s.status === 'completed')).toBe(true);
  });

  it('computes correct summary totals', () => {
    const result = getProviderEarnings(db, 1);
    // job-p1-a: 9 halala/min × 60 min = 540 halala gross
    // job-p1-b: 7 halala/min × 10 min = 70 halala gross
    const expectedGross = 540 + 70;
    expect(result.summary.totalGrossHalala).toBe(expectedGross);
    // Provider payout = gross − floor(gross × 0.15)
    const { platformFee: feeA, providerPayout: payA } = splitFee(540);
    const { platformFee: feeB, providerPayout: payB } = splitFee(70);
    expect(result.summary.totalPayoutHalala).toBe(payA + payB);
    expect(result.summary.jobCount).toBe(2);
  });

  it('does not return settlements for other providers', () => {
    const result = getProviderEarnings(db, 2);
    expect(result.settlements).toHaveLength(1);
    expect(result.settlements[0].job_id).toBe('job-p2-a');
  });

  it('respects limit/offset pagination', () => {
    const page1 = getProviderEarnings(db, 1, { limit: 1, offset: 0 });
    const page2 = getProviderEarnings(db, 1, { limit: 1, offset: 1 });

    expect(page1.settlements).toHaveLength(1);
    expect(page2.settlements).toHaveLength(1);
    expect(page1.settlements[0].job_id).not.toBe(page2.settlements[0].job_id);
  });

  it('caps limit at 200', () => {
    const result = getProviderEarnings(db, 1, { limit: 9999 });
    expect(result.pagination.limit).toBe(200);
  });
});

// ── getRenterTransactions ─────────────────────────────────────────────────────

describe('getRenterTransactions()', () => {
  let db;

  beforeEach(() => {
    db = buildDb();

    const jobs = [
      { jobId: 'job-r10-a', providerId: 1, renterId: 10, dur: 3600, type: 'llm-inference', status: 'completed' },
      { jobId: 'job-r10-b', providerId: 1, renterId: 10, dur: 600,  type: 'default',       status: 'refunded'  },
      { jobId: 'job-r11-a', providerId: 2, renterId: 11, dur: 1800, type: 'rendering',      status: 'completed' },
    ];

    for (const j of jobs) {
      recordSettlement(db, {
        jobId: j.jobId, providerId: j.providerId, renterId: j.renterId,
        durationSeconds: j.dur, jobType: j.type, status: j.status,
      });
    }
  });

  afterEach(() => { db.close(); });

  it('returns all settlements for the renter regardless of status', () => {
    const result = getRenterTransactions(db, 10);
    expect(result.transactions).toHaveLength(2);
  });

  it('does not return settlements from other renters', () => {
    const result = getRenterTransactions(db, 11);
    expect(result.transactions).toHaveLength(1);
  });

  it('computes correct summary: charged vs refunded', () => {
    const result = getRenterTransactions(db, 10);
    // completed job: 540 halala; refunded job: gross = 0 (failed status path)
    expect(result.summary.totalChargedHalala).toBe(540);
    expect(result.summary.totalRefundedHalala).toBe(0);
  });

  it('paginates correctly', () => {
    const first = getRenterTransactions(db, 10, { limit: 1, offset: 0 });
    expect(first.transactions).toHaveLength(1);
    expect(first.pagination.limit).toBe(1);
    expect(first.pagination.offset).toBe(0);
  });
});
