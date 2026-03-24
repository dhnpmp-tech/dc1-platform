'use strict';

/**
 * Tests for EB-M01 idempotency fix — DCP-912 / DCP-906
 *
 * Verifies that replaying the same on-chain event twice (simulating a cursor
 * reset or listener restart) produces exactly ONE record in the target table,
 * not two.
 *
 * Affected handlers:
 *   handlePaymentReleased → payout_requests table
 *   handleDisputeRaised   → admin_alerts table
 *
 * The fix: INSERT OR IGNORE + unique index on escrow_tx_hash / (alert_type, tx_hash).
 */

const Database = require('better-sqlite3');
const path     = require('path');

// ── Ethers (needed for keccak256 hashing inside the handlers) ─────────────────
let ethers;
try {
  ethers = require('ethers');
} catch (_) {
  ethers = require(path.resolve(__dirname, '../../../contracts/node_modules/ethers'));
}

// ── Module under test ─────────────────────────────────────────────────────────
// We import the internal handlers via the test-only exports.
const {
  _handlePaymentReleased,
  _handleDisputeRaised,
} = require('../services/escrowListener');

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROVIDER_ADDR = '0xaabbccddeeff001122334455667788990011aabb';
const TX_HASH       = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const JOB_ID        = 'test-job-eb-m01-001';

/** Build a minimal in-memory SQLite db with the tables escrowListener writes to. */
function buildDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE providers (
      id           TEXT PRIMARY KEY,
      eth_address  TEXT,
      deleted_at   TEXT
    )
  `);
  db.exec(`
    CREATE TABLE jobs (
      id      TEXT PRIMARY KEY,
      job_id  TEXT NOT NULL,
      status  TEXT NOT NULL DEFAULT 'running',
      provider_id TEXT
    )
  `);
  db.exec(`
    CREATE TABLE payout_requests (
      id            TEXT    PRIMARY KEY,
      provider_id   TEXT    NOT NULL,
      amount_usd    REAL    NOT NULL,
      amount_sar    REAL    NOT NULL,
      amount_halala INTEGER NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'pending',
      requested_at  TEXT    NOT NULL,
      escrow_tx_hash TEXT
    )
  `);
  db.exec(`
    CREATE TABLE admin_alerts (
      id          TEXT PRIMARY KEY,
      alert_type  TEXT NOT NULL,
      job_id      TEXT,
      payload     TEXT,
      created_at  TEXT NOT NULL,
      tx_hash     TEXT
    )
  `);

  // EB-M01 unique indexes (applied by ensureSchema in production;
  // replicated here so the handlers behave identically to production).
  db.exec(`
    CREATE UNIQUE INDEX idx_payout_tx
    ON payout_requests(escrow_tx_hash)
    WHERE escrow_tx_hash IS NOT NULL
  `);
  db.exec(`
    CREATE UNIQUE INDEX idx_admin_alert_tx
    ON admin_alerts(alert_type, tx_hash)
    WHERE tx_hash IS NOT NULL
  `);

  // Seed a provider
  db.prepare(
    "INSERT INTO providers (id, eth_address) VALUES ('provider-1', ?)"
  ).run(PROVIDER_ADDR.toLowerCase());

  // Seed a job
  db.prepare(
    "INSERT INTO jobs (id, job_id, status) VALUES ('job-row-1', ?, 'running')"
  ).run(JOB_ID);

  return db;
}

/**
 * Build a minimal fake contract interface that can parse a PaymentReleased or
 * DisputeRaised log.  The handlers call contract.interface.parseLog(log) to
 * decode args.
 */
function makeFakeContract(args) {
  return {
    interface: {
      parseLog: () => ({ args }),
    },
  };
}

/** Compute the keccak256 bytes32 that the handler compares against. */
function jobId32(jobId) {
  return ethers.keccak256(ethers.toUtf8Bytes(jobId)).toLowerCase();
}

// ── PaymentReleased idempotency ───────────────────────────────────────────────

describe('EB-M01: handlePaymentReleased idempotency (DCP-912)', () => {
  let db;

  beforeEach(() => { db = buildDb(); });
  afterEach(() => { try { db.close(); } catch {} });

  test('first replay creates exactly 1 payout_request', () => {
    const log = { transactionHash: TX_HASH };
    const contract = makeFakeContract([
      jobId32(JOB_ID),
      PROVIDER_ADDR,
      BigInt(5_000_000),  // 5 USDC in 6-decimal units
    ]);

    _handlePaymentReleased(db, log, contract);

    const rows = db.prepare('SELECT * FROM payout_requests').all();
    expect(rows).toHaveLength(1);
    expect(rows[0].escrow_tx_hash).toBe(TX_HASH);
    expect(rows[0].status).toBe('pending');
  });

  test('second replay of same txHash does NOT create a duplicate record', () => {
    const log = { transactionHash: TX_HASH };
    const contract = makeFakeContract([
      jobId32(JOB_ID),
      PROVIDER_ADDR,
      BigInt(5_000_000),
    ]);

    // Simulate cursor reset: same event replayed twice
    _handlePaymentReleased(db, log, contract);
    _handlePaymentReleased(db, log, contract);

    const rows = db.prepare('SELECT * FROM payout_requests').all();
    expect(rows).toHaveLength(1);
  });

  test('different txHash creates a second record (distinct events)', () => {
    const log1 = { transactionHash: TX_HASH };
    const log2 = { transactionHash: TX_HASH.replace('dead', 'cafe') };
    const contract = makeFakeContract([
      jobId32(JOB_ID),
      PROVIDER_ADDR,
      BigInt(3_000_000),
    ]);

    _handlePaymentReleased(db, log1, contract);
    _handlePaymentReleased(db, log2, contract);

    const rows = db.prepare('SELECT * FROM payout_requests').all();
    expect(rows).toHaveLength(2);
  });
});

// ── DisputeRaised idempotency ─────────────────────────────────────────────────

describe('EB-M01: handleDisputeRaised idempotency (DCP-912)', () => {
  let db;

  beforeEach(() => { db = buildDb(); });
  afterEach(() => { try { db.close(); } catch {} });

  test('first replay creates exactly 1 admin_alert', () => {
    const log = { transactionHash: TX_HASH };
    const contract = makeFakeContract([
      jobId32(JOB_ID),
      '0xrenter001',
    ]);

    _handleDisputeRaised(db, log, contract);

    const rows = db.prepare('SELECT * FROM admin_alerts').all();
    expect(rows).toHaveLength(1);
    expect(rows[0].alert_type).toBe('dispute_raised');
    expect(rows[0].tx_hash).toBe(TX_HASH);
  });

  test('second replay of same txHash does NOT create a duplicate alert', () => {
    const log = { transactionHash: TX_HASH };
    const contract = makeFakeContract([
      jobId32(JOB_ID),
      '0xrenter001',
    ]);

    // Simulate cursor reset: same event replayed twice
    _handleDisputeRaised(db, log, contract);
    _handleDisputeRaised(db, log, contract);

    const rows = db.prepare('SELECT * FROM admin_alerts').all();
    expect(rows).toHaveLength(1);
  });

  test('different txHash for same job creates a second alert (distinct events)', () => {
    const log1 = { transactionHash: TX_HASH };
    const log2 = { transactionHash: TX_HASH.replace('dead', 'babe') };
    const contract = makeFakeContract([
      jobId32(JOB_ID),
      '0xrenter001',
    ]);

    _handleDisputeRaised(db, log1, contract);
    _handleDisputeRaised(db, log2, contract);

    const rows = db.prepare('SELECT * FROM admin_alerts').all();
    expect(rows).toHaveLength(2);
  });
});
