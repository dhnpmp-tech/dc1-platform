'use strict';

/**
 * Unit tests for payoutService.js (DCP-763)
 *
 * Uses an in-memory SQLite database so no mocks are needed.
 * Tests cover:
 *   - requestPayout validation (invalid amount, below minimum, insufficient balance)
 *   - requestPayout happy path (balance deduction, record creation)
 *   - getPayoutHistory pagination
 *   - getEarningsSummary balance breakdown
 *   - markPayoutPaid happy path and guard cases
 *   - rejectPayout (balance restored)
 */

const Database = require('better-sqlite3');
const {
  requestPayout,
  getPayoutHistory,
  getEarningsSummary,
  markPayoutPaid,
  rejectPayout,
  MIN_PAYOUT_USD,
  USD_TO_SAR,
} = require('../services/payoutService');

// ── Test helpers ──────────────────────────────────────────────────────────────

function buildDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');

  // Minimal providers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      claimable_earnings_halala INTEGER DEFAULT 0,
      deleted_at TEXT
    )
  `);

  // payout_requests table (mirrors db.js definition)
  db.exec(`
    CREATE TABLE IF NOT EXISTS payout_requests (
      id            TEXT    PRIMARY KEY,
      provider_id   INTEGER NOT NULL,
      amount_usd    REAL    NOT NULL,
      amount_sar    REAL    NOT NULL,
      amount_halala INTEGER NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','processing','paid','rejected')),
      requested_at  TEXT    NOT NULL,
      processed_at  TEXT,
      payment_ref   TEXT,
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    )
  `);

  return db;
}

function insertProvider(db, { claimableHalala = 0 } = {}) {
  db.prepare(
    'INSERT INTO providers (name, claimable_earnings_halala) VALUES (?, ?)'
  ).run('Test Provider', claimableHalala);
  return db.prepare('SELECT last_insert_rowid() AS id').get().id;
}

// ── requestPayout validation ──────────────────────────────────────────────────

describe('requestPayout() — validation', () => {
  let db;
  let providerId;
  const BALANCE_HALALA = 100_000; // 1000 SAR ≈ $266.67

  beforeEach(() => {
    db = buildDb();
    providerId = insertProvider(db, { claimableHalala: BALANCE_HALALA });
  });

  it('returns INVALID_AMOUNT for non-numeric input', () => {
    const result = requestPayout(db, providerId, 'abc');
    expect(result.error).toBe('INVALID_AMOUNT');
  });

  it('returns INVALID_AMOUNT for zero', () => {
    const result = requestPayout(db, providerId, 0);
    expect(result.error).toBe('INVALID_AMOUNT');
  });

  it('returns BELOW_MINIMUM for amounts under $50', () => {
    const result = requestPayout(db, providerId, 49.99);
    expect(result.error).toBe('BELOW_MINIMUM');
    expect(result.minimumUsd).toBe(MIN_PAYOUT_USD);
  });

  it('returns INSUFFICIENT_BALANCE when requested amount exceeds available', () => {
    // Balance = 100,000 halala = 1000 SAR = ~$266.67
    // Request $300 > $266.67
    const result = requestPayout(db, providerId, 300);
    expect(result.error).toBe('INSUFFICIENT_BALANCE');
    expect(result.availableHalala).toBe(BALANCE_HALALA);
  });

  it('returns PROVIDER_NOT_FOUND for unknown provider', () => {
    const result = requestPayout(db, 99999, 50);
    expect(result.error).toBe('PROVIDER_NOT_FOUND');
  });
});

// ── requestPayout happy path ──────────────────────────────────────────────────

describe('requestPayout() — happy path', () => {
  let db;
  let providerId;
  const BALANCE_HALALA = 50_000; // 500 SAR = $133.33

  beforeEach(() => {
    db = buildDb();
    providerId = insertProvider(db, { claimableHalala: BALANCE_HALALA });
  });

  it('creates a payout_requests record with status pending', () => {
    const result = requestPayout(db, providerId, 50);
    expect(result.error).toBeUndefined();
    expect(result.requestId).toBeTruthy();
    expect(result.status).toBe('pending');
    expect(result.amountUsd).toBe(50);
    expect(result.amountSar).toBeCloseTo(50 * USD_TO_SAR, 2);
    expect(result.amountHalala).toBe(Math.round(50 * USD_TO_SAR * 100));
  });

  it('deducts the amount from claimable_earnings_halala', () => {
    const expectedDeduction = Math.round(50 * USD_TO_SAR * 100); // 18750 halala
    requestPayout(db, providerId, 50);
    const provider = db.prepare('SELECT claimable_earnings_halala FROM providers WHERE id = ?').get(providerId);
    expect(provider.claimable_earnings_halala).toBe(BALANCE_HALALA - expectedDeduction);
  });

  it('rejects a second payout when pending holds exceed available balance', () => {
    // First payout: $50
    requestPayout(db, providerId, 50);
    // Balance 500 SAR, reserved 187.5 SAR → available ~312.5 SAR → $83.33
    // Second payout of $100 (375 SAR) should fail
    const result = requestPayout(db, providerId, 100);
    expect(result.error).toBe('INSUFFICIENT_BALANCE');
  });

  it('allows exact balance withdrawal', () => {
    // 50000 halala = 500 SAR = $133.33...
    // Let's use a cleaner number: set balance to 18750 = exactly $50
    db.prepare('UPDATE providers SET claimable_earnings_halala = 18750 WHERE id = ?').run(providerId);
    const result = requestPayout(db, providerId, 50);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe('pending');
  });
});

// ── getPayoutHistory ──────────────────────────────────────────────────────────

describe('getPayoutHistory()', () => {
  let db;
  let providerId;

  beforeEach(() => {
    db = buildDb();
    providerId = insertProvider(db, { claimableHalala: 500_000 });
    // Create 3 payout requests
    requestPayout(db, providerId, 50);
    requestPayout(db, providerId, 60);
    requestPayout(db, providerId, 70);
  });

  it('returns all payouts for the provider', () => {
    const { payouts, pagination } = getPayoutHistory(db, providerId);
    expect(payouts).toHaveLength(3);
    expect(pagination.total).toBe(3);
    expect(payouts[0]).toHaveProperty('escrow_tx_hash', null);
  });

  it('respects limit and offset', () => {
    const { payouts, pagination } = getPayoutHistory(db, providerId, { limit: 2, offset: 0 });
    expect(payouts).toHaveLength(2);
    expect(pagination.limit).toBe(2);

    const { payouts: page2 } = getPayoutHistory(db, providerId, { limit: 2, offset: 2 });
    expect(page2).toHaveLength(1);
  });

  it('returns most recent payouts first', () => {
    const { payouts } = getPayoutHistory(db, providerId);
    // Most recently requested (70) should be first
    expect(payouts[0].amount_usd).toBe(70);
  });

  it('returns empty list for unknown provider', () => {
    const { payouts } = getPayoutHistory(db, 99999);
    expect(payouts).toHaveLength(0);
  });

  it('returns escrow_tx_hash when schema includes it', () => {
    db.exec('ALTER TABLE payout_requests ADD COLUMN escrow_tx_hash TEXT');
    const latest = db.prepare(`
      SELECT id FROM payout_requests
      WHERE provider_id = ?
      ORDER BY requested_at DESC
      LIMIT 1
    `).get(providerId);
    db.prepare('UPDATE payout_requests SET escrow_tx_hash = ? WHERE id = ?').run('0xabc123', latest.id);

    const { payouts } = getPayoutHistory(db, providerId);
    expect(payouts[0].escrow_tx_hash).toBe('0xabc123');
  });
});

// ── getEarningsSummary ────────────────────────────────────────────────────────

describe('getEarningsSummary()', () => {
  let db;
  let providerId;

  beforeEach(() => {
    db = buildDb();
    // 1000 SAR = $266.67
    providerId = insertProvider(db, { claimableHalala: 100_000 });
  });

  it('returns null for unknown provider', () => {
    expect(getEarningsSummary(db, 99999)).toBeNull();
  });

  it('shows full balance as available when no pending payouts', () => {
    const summary = getEarningsSummary(db, providerId);
    expect(summary.availableHalala).toBe(100_000);
    expect(summary.pendingHalala).toBe(0);
    expect(summary.paidHalala).toBe(0);
  });

  it('reduces available by pending payout hold', () => {
    requestPayout(db, providerId, 50); // 18750 halala reserved
    const summary = getEarningsSummary(db, providerId);
    // claimable after deduction = 100000 - 18750 = 81250
    // pendingHalala = 18750
    // available = claimable - pending = 81250 - 18750 = 62500
    expect(summary.pendingHalala).toBe(18750);
    expect(summary.availableHalala).toBe(81250 - 18750);
  });

  it('includes minimumPayoutUsd and minimumPayoutSar', () => {
    const summary = getEarningsSummary(db, providerId);
    expect(summary.minimumPayoutUsd).toBe(MIN_PAYOUT_USD);
    expect(summary.minimumPayoutSar).toBe(MIN_PAYOUT_USD * USD_TO_SAR);
  });
});

// ── markPayoutPaid ────────────────────────────────────────────────────────────

describe('markPayoutPaid()', () => {
  let db;
  let providerId;
  let requestId;

  beforeEach(() => {
    db = buildDb();
    providerId = insertProvider(db, { claimableHalala: 100_000 });
    const req = requestPayout(db, providerId, 50);
    requestId = req.requestId;
  });

  it('marks the payout as paid', () => {
    const result = markPayoutPaid(db, requestId, 'WIRE-12345');
    expect(result.status).toBe('paid');
    expect(result.payment_ref).toBe('WIRE-12345');
    expect(result.processed_at).toBeTruthy();
  });

  it('returns ALREADY_PAID if called twice', () => {
    markPayoutPaid(db, requestId, 'REF-1');
    const result = markPayoutPaid(db, requestId, 'REF-2');
    expect(result.error).toBe('ALREADY_PAID');
  });

  it('returns NOT_FOUND for unknown payout id', () => {
    const result = markPayoutPaid(db, 'nonexistent-id');
    expect(result.error).toBe('NOT_FOUND');
  });

  it('does not alter claimable balance (already deducted at request time)', () => {
    const before = db.prepare('SELECT claimable_earnings_halala FROM providers WHERE id = ?').get(providerId);
    markPayoutPaid(db, requestId, 'REF-X');
    const after = db.prepare('SELECT claimable_earnings_halala FROM providers WHERE id = ?').get(providerId);
    expect(after.claimable_earnings_halala).toBe(before.claimable_earnings_halala);
  });
});

// ── rejectPayout ─────────────────────────────────────────────────────────────

describe('rejectPayout()', () => {
  let db;
  let providerId;
  let requestId;
  const BALANCE_HALALA = 100_000;
  const PAYOUT_USD = 50;
  const PAYOUT_HALALA = Math.round(PAYOUT_USD * USD_TO_SAR * 100); // 18750

  beforeEach(() => {
    db = buildDb();
    providerId = insertProvider(db, { claimableHalala: BALANCE_HALALA });
    const req = requestPayout(db, providerId, PAYOUT_USD);
    requestId = req.requestId;
  });

  it('marks payout as rejected', () => {
    const result = rejectPayout(db, requestId, 'Bank details invalid');
    expect(result.status).toBe('rejected');
    expect(result.processed_at).toBeTruthy();
  });

  it('returns held funds to claimable_earnings_halala', () => {
    // After requestPayout, claimable = BALANCE - PAYOUT_HALALA
    rejectPayout(db, requestId, 'test');
    const provider = db.prepare('SELECT claimable_earnings_halala FROM providers WHERE id = ?').get(providerId);
    expect(provider.claimable_earnings_halala).toBe(BALANCE_HALALA);
  });

  it('returns NOT_FOUND for unknown payout id', () => {
    const result = rejectPayout(db, 'bad-id');
    expect(result.error).toBe('NOT_FOUND');
  });

  it('returns NOT_REJECTABLE for already-paid payout', () => {
    markPayoutPaid(db, requestId, 'REF');
    const result = rejectPayout(db, requestId);
    expect(result.error).toBe('NOT_REJECTABLE');
  });

  it('returns REJECTED error when trying to mark a rejected payout as paid', () => {
    rejectPayout(db, requestId, 'reason');
    const result = markPayoutPaid(db, requestId, 'REF');
    expect(result.error).toBe('REJECTED');
  });
});
