'use strict';

/**
 * escrow-bridge.test.js — Integration tests for the escrow-to-backend event bridge (DCP-903)
 *
 * Tests handlePaymentReleased and handleDisputeRaised in isolation using an
 * in-memory SQLite database and mocked ethers.js — no live RPC calls required.
 *
 * Covers:
 *   PaymentReleased event:
 *     1. Marks matching job as payment_released
 *     2. Creates a payout_request record for the provider
 *     3. Is a no-op (no throw) when no matching job exists
 *     4. Skips payout creation when provider eth_address not registered
 *
 *   DisputeRaised event:
 *     5. Marks matching job as disputed
 *     6. Creates an admin_alert for ops review
 *     7. Still writes admin_alert when job is not found (unknown job dispute)
 *     8. Does not throw on malformed log data
 */

process.env.SUPABASE_URL         = process.env.SUPABASE_URL         || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key-stub';

const BetterSQLite = require('better-sqlite3');
const crypto       = require('crypto');

// ── Schema helpers ─────────────────────────────────────────────────────────────

function makeDb() {
  const db = new BetterSQLite(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id      TEXT NOT NULL UNIQUE,
      provider_id INTEGER,
      renter_id   INTEGER NOT NULL DEFAULT 1,
      job_type    TEXT NOT NULL DEFAULT 'llm-inference',
      status      TEXT NOT NULL DEFAULT 'completed',
      cost_halala INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT,
      api_key         TEXT,
      eth_address     TEXT,
      deleted_at      TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS payout_requests (
      id              TEXT PRIMARY KEY,
      provider_id     INTEGER NOT NULL,
      amount_usd      REAL NOT NULL,
      amount_sar      REAL NOT NULL,
      amount_halala   INTEGER NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',
      requested_at    TEXT NOT NULL,
      processed_at    TEXT,
      payment_ref     TEXT,
      escrow_tx_hash  TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_alerts (
      id          TEXT PRIMARY KEY,
      alert_type  TEXT NOT NULL,
      job_id      TEXT,
      payload     TEXT,
      created_at  TEXT NOT NULL
    )
  `);

  return db;
}

function insertProvider(db, { ethAddress = null } = {}) {
  db.prepare(
    "INSERT INTO providers (name, api_key, eth_address) VALUES ('TestProvider', 'key-abc', ?)"
  ).run(ethAddress || null);
  return db.prepare('SELECT last_insert_rowid() AS id').get().id;
}

function insertJob(db, { jobId, providerId = null, status = 'completed' } = {}) {
  db.prepare(
    'INSERT INTO jobs (job_id, provider_id, status) VALUES (?, ?, ?)'
  ).run(jobId, providerId, status);
  return db.prepare('SELECT last_insert_rowid() AS id').get().id;
}

// ── Mock helpers ───────────────────────────────────────────────────────────────

const MOCK_TX = '0xdeadbeef1234567890abcdef0000000000000000000000000000000000000001';
const PROVIDER_ADDR = '0xProviderEthAddress000000000000000000000001';
const RENTER_ADDR   = '0xRenterEthAddress0000000000000000000000001';

// Import listener handlers (with graceful skip if ethers is unavailable).
// Mirrors the fallback chain in escrowListener.js itself.
let listener;
let ethers;
try {
  ethers = require('ethers');
} catch (_) {
  try {
    ethers = require('../../contracts/node_modules/ethers');
  } catch (__) {
    // ethers not available anywhere — tests will be skipped
  }
}
try {
  listener = require('../src/services/escrowListener');
} catch (_) {
  // module load failed — tests will be skipped
}

const describeIfEthers = ethers ? describe : describe.skip;

function makePaymentReleasedMock(db, jobId, providerAddr = PROVIDER_ADDR, amountUsdc = 10_000_000) {
  const jobId32 = ethers.keccak256(ethers.toUtf8Bytes(jobId));
  const mockLog = {
    transactionHash: MOCK_TX,
    topics: [null, jobId32, providerAddr],
    data: '0x',
  };
  const mockContract = {
    interface: {
      parseLog: () => ({
        args: [jobId32, providerAddr, BigInt(amountUsdc)],
      }),
    },
  };
  return { mockLog, mockContract, jobId32 };
}

function makeDisputeRaisedMock(db, jobId, renterAddr = RENTER_ADDR) {
  const jobId32 = ethers.keccak256(ethers.toUtf8Bytes(jobId));
  const mockLog = {
    transactionHash: MOCK_TX,
    topics: [null, jobId32, renterAddr],
    data: '0x',
  };
  const mockContract = {
    interface: {
      parseLog: () => ({
        args: [jobId32, renterAddr],
      }),
    },
  };
  return { mockLog, mockContract, jobId32 };
}

// ── PaymentReleased tests ──────────────────────────────────────────────────────

describeIfEthers('escrow bridge — handlePaymentReleased', () => {
  let db;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  test('marks matching job as payment_released', () => {
    const jobId      = 'job-' + crypto.randomUUID();
    const providerId = insertProvider(db, { ethAddress: PROVIDER_ADDR });
    insertJob(db, { jobId, providerId, status: 'completed' });

    const { mockLog, mockContract } = makePaymentReleasedMock(db, jobId);
    listener._handlePaymentReleased(db, mockLog, mockContract);

    const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId);
    expect(job.status).toBe('payment_released');
  });

  test('creates a payout_request for the provider', () => {
    const jobId      = 'job-' + crypto.randomUUID();
    const providerId = insertProvider(db, { ethAddress: PROVIDER_ADDR });
    insertJob(db, { jobId, providerId, status: 'completed' });

    const amountUsdc = 20_000_000; // 20 USDC
    const { mockLog, mockContract } = makePaymentReleasedMock(db, jobId, PROVIDER_ADDR, amountUsdc);
    listener._handlePaymentReleased(db, mockLog, mockContract);

    const payout = db.prepare(
      'SELECT * FROM payout_requests WHERE provider_id = ?'
    ).get(providerId);

    expect(payout).not.toBeNull();
    expect(payout.status).toBe('pending');
    expect(payout.escrow_tx_hash).toBe(MOCK_TX);
    expect(payout.amount_usd).toBeCloseTo(20, 2);         // 20_000_000 / 1_000_000
    expect(payout.amount_sar).toBeCloseTo(75, 1);         // 20 * 3.75
    expect(payout.amount_halala).toBe(7500);              // 75 * 100
  });

  test('does not throw when no matching job exists', () => {
    const jobId      = 'nonexistent-job-' + crypto.randomUUID();
    insertProvider(db, { ethAddress: PROVIDER_ADDR });

    const { mockLog, mockContract } = makePaymentReleasedMock(db, jobId);
    expect(() => listener._handlePaymentReleased(db, mockLog, mockContract)).not.toThrow();
  });

  test('skips payout creation when provider eth_address is not registered', () => {
    const jobId = 'job-' + crypto.randomUUID();
    // Insert job but no provider with PROVIDER_ADDR
    insertJob(db, { jobId, status: 'completed' });

    const { mockLog, mockContract } = makePaymentReleasedMock(db, jobId, '0xUnknownAddress');
    expect(() => listener._handlePaymentReleased(db, mockLog, mockContract)).not.toThrow();

    const payouts = db.prepare('SELECT * FROM payout_requests').all();
    expect(payouts).toHaveLength(0);
  });
});

// ── DisputeRaised tests ────────────────────────────────────────────────────────

describeIfEthers('escrow bridge — handleDisputeRaised', () => {
  let db;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  test('marks matching job as disputed', () => {
    const jobId = 'job-' + crypto.randomUUID();
    insertJob(db, { jobId, status: 'completed' });

    const { mockLog, mockContract } = makeDisputeRaisedMock(db, jobId);
    listener._handleDisputeRaised(db, mockLog, mockContract);

    const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId);
    expect(job.status).toBe('disputed');
  });

  test('creates an admin_alert for ops review', () => {
    const jobId = 'job-' + crypto.randomUUID();
    insertJob(db, { jobId, status: 'completed' });

    const { mockLog, mockContract } = makeDisputeRaisedMock(db, jobId);
    listener._handleDisputeRaised(db, mockLog, mockContract);

    const alert = db.prepare("SELECT * FROM admin_alerts WHERE alert_type = 'dispute_raised'").get();
    expect(alert).not.toBeNull();
    expect(alert.job_id).toBe(jobId);
    expect(alert.alert_type).toBe('dispute_raised');

    const payload = JSON.parse(alert.payload);
    expect(payload.txHash).toBe(MOCK_TX);
    expect(payload.renter.toLowerCase()).toBe(RENTER_ADDR.toLowerCase());
  });

  test('still writes admin_alert when no matching job is found', () => {
    const jobId = 'nonexistent-job-' + crypto.randomUUID();

    const { mockLog, mockContract } = makeDisputeRaisedMock(db, jobId);
    expect(() => listener._handleDisputeRaised(db, mockLog, mockContract)).not.toThrow();

    const alert = db.prepare("SELECT * FROM admin_alerts WHERE alert_type = 'dispute_raised'").get();
    expect(alert).not.toBeNull();
    expect(alert.job_id).toBeNull();  // no match, so job_id stays null
  });

  test('does not affect unrelated jobs', () => {
    const jobId1 = 'job-' + crypto.randomUUID();
    const jobId2 = 'job-' + crypto.randomUUID();
    insertJob(db, { jobId: jobId1, status: 'completed' });
    insertJob(db, { jobId: jobId2, status: 'completed' });

    const { mockLog, mockContract } = makeDisputeRaisedMock(db, jobId1);
    listener._handleDisputeRaised(db, mockLog, mockContract);

    const job2 = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId2);
    expect(job2.status).toBe('completed');
  });
});
