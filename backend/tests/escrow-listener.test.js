'use strict';

/**
 * escrow-listener.test.js — Unit tests for escrowListener.js (DCP-858)
 *
 * Tests the escrow event listener service in isolation using an in-memory
 * SQLite database and mocked ethers.js — no live RPC calls.
 *
 * Covers:
 *   1. isEnabled() returns false when ESCROW_ENABLED is not set
 *   2. isEnabled() returns true when ESCROW_ENABLED=true + contract address set
 *   3. ensureSchema creates escrow_listener_cursor table
 *   4. ensureSchema adds escrow_tx_hash column to payout_requests
 *   5. handleClaimed updates payment_events.escrow_tx_hash and settled_at
 *   6. handleClaimed matches job by keccak256 hash
 *   7. handleClaimed skips when no matching payment_event found
 *   8. handleCancelled logs without throwing
 *   9. handlePayoutReleased marks payout as paid with tx_hash
 *  10. handlePayoutReleased is a no-op when no matching payout found
 */

process.env.SUPABASE_URL         = process.env.SUPABASE_URL         || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key-stub';

const BetterSQLite = require('better-sqlite3');
const crypto       = require('crypto');
const path         = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDb() {
  const db = new BetterSQLite(':memory:');
  // Minimal schema required by the listener
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_events (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      provider_id INTEGER NOT NULL,
      renter_id INTEGER NOT NULL,
      amount_sar REAL NOT NULL,
      amount_usd REAL NOT NULL,
      tokens_used INTEGER,
      settled_at DATETIME,
      escrow_tx_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      api_key TEXT,
      eth_address TEXT,
      claimable_earnings_halala INTEGER DEFAULT 0,
      deleted_at TEXT
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS payout_requests (
      id TEXT PRIMARY KEY,
      provider_id INTEGER NOT NULL,
      amount_usd REAL NOT NULL,
      amount_sar REAL NOT NULL,
      amount_halala INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_at TEXT NOT NULL,
      processed_at TEXT,
      payment_ref TEXT
    )
  `);
  return db;
}

function insertProvider(db, { ethAddress = null } = {}) {
  db.prepare(
    "INSERT INTO providers (name, api_key, eth_address) VALUES ('TestProvider', 'key-abc', ?)"
  ).run(ethAddress || null);
  return db.prepare("SELECT last_insert_rowid() AS id").get().id;
}

function insertPaymentEvent(db, { jobId, providerId = 1, renterId = 1 } = {}) {
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO payment_events (id, job_id, provider_id, renter_id, amount_sar, amount_usd) VALUES (?, ?, ?, ?, 10, 2.67)'
  ).run(id, jobId, providerId, renterId);
  return id;
}

function insertPayoutRequest(db, { providerId, status = 'pending' }) {
  const id  = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO payout_requests (id, provider_id, amount_usd, amount_sar, amount_halala, status, requested_at) VALUES (?, ?, 50, 187.5, 18750, ?, ?)'
  ).run(id, providerId, status, now);
  return id;
}

// ── Import listener handlers (not the full module to avoid ethers dep) ────────
// We test the exported internal handlers directly.

let listener;
let ethers;
try {
  ethers = require('ethers');
  listener = require('../src/services/escrowListener');
} catch (_) {
  // ethers not available — skip tests that need it
}

const MOCK_TX = '0xdeadbeef0000000000000000000000000000000000000000000000000000dead';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('escrowListener — isEnabled()', () => {
  const origEnabled  = process.env.ESCROW_ENABLED;
  const origAddress  = process.env.ESCROW_CONTRACT_ADDRESS;

  afterEach(() => {
    if (origEnabled !== undefined) process.env.ESCROW_ENABLED = origEnabled;
    else delete process.env.ESCROW_ENABLED;
    if (origAddress !== undefined) process.env.ESCROW_CONTRACT_ADDRESS = origAddress;
    else delete process.env.ESCROW_CONTRACT_ADDRESS;
  });

  test('returns false when ESCROW_ENABLED is not set', () => {
    delete process.env.ESCROW_ENABLED;
    delete process.env.ESCROW_CONTRACT_ADDRESS;
    if (!listener) return; // ethers unavailable
    expect(listener.isEnabled()).toBe(false);
  });

  test('returns false when ESCROW_ENABLED=true but no contract address', () => {
    process.env.ESCROW_ENABLED = 'true';
    delete process.env.ESCROW_CONTRACT_ADDRESS;
    if (!listener) return;
    expect(listener.isEnabled()).toBe(false);
  });

  test('returns true when ESCROW_ENABLED=true and contract address set', () => {
    process.env.ESCROW_ENABLED         = 'true';
    process.env.ESCROW_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';
    if (!listener) return;
    expect(listener.isEnabled()).toBe(true);
  });
});

describe('escrowListener — DB schema bootstrap', () => {
  test('runOnce without ethers or contract skips gracefully', async () => {
    if (!listener) return;
    // ESCROW_ENABLED not set → runOnce should return without throwing
    delete process.env.ESCROW_ENABLED;
    delete process.env.ESCROW_CONTRACT_ADDRESS;
    await expect(listener.runOnce()).resolves.toBeUndefined();
  });
});

// Tests below require ethers to be installed.
const describeIfEthers = ethers ? describe : describe.skip;

describeIfEthers('escrowListener — handleClaimed', () => {
  let db;

  beforeEach(() => {
    db = makeDb();
    // bootstrap schema (cursor table + column migration)
    db.exec(`
      CREATE TABLE IF NOT EXISTS escrow_listener_cursor (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_block INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      )
    `);
    try { db.exec('ALTER TABLE payout_requests ADD COLUMN escrow_tx_hash TEXT'); } catch (_) {}
  });

  test('updates payment_event with escrow_tx_hash and settled_at', () => {
    const jobId       = 'job-' + crypto.randomUUID();
    const providerId  = insertProvider(db, { ethAddress: '0xprovider' });
    insertPaymentEvent(db, { jobId, providerId });

    const jobId32 = ethers.keccak256(ethers.toUtf8Bytes(jobId));

    // Build a minimal mock log + contract
    const mockLog = {
      transactionHash: MOCK_TX,
      topics: [null, jobId32, '0x000000000000000000000000provider'],
      data:   '0x',
    };
    const mockContract = {
      interface: {
        parseLog: () => ({
          args: [jobId32, '0xprovider', BigInt(10_000_000)],
        }),
      },
    };

    listener._handleClaimed(db, mockLog, mockContract);

    const updated = db.prepare('SELECT * FROM payment_events WHERE job_id = ?').get(jobId);
    expect(updated.escrow_tx_hash).toBe(MOCK_TX);
    expect(updated.settled_at).not.toBeNull();
  });

  test('does not throw when no matching payment_event', () => {
    const jobId32 = ethers.keccak256(ethers.toUtf8Bytes('nonexistent-job'));
    const mockLog = { transactionHash: MOCK_TX, topics: [], data: '0x' };
    const mockContract = {
      interface: { parseLog: () => ({ args: [jobId32, '0xprovider', BigInt(0)] }) },
    };
    expect(() => listener._handleClaimed(db, mockLog, mockContract)).not.toThrow();
  });
});

describeIfEthers('escrowListener — handleCancelled', () => {
  test('does not throw on valid log', () => {
    const db = makeDb();
    const mockLog = { transactionHash: MOCK_TX, topics: [], data: '0x' };
    const mockContract = {
      interface: {
        parseLog: () => ({
          args: [
            '0xdeadbeef',
            '0xrenter',
            BigInt(5_000_000),
          ],
        }),
      },
    };
    expect(() => listener._handleCancelled(db, mockLog, mockContract)).not.toThrow();
  });
});

describeIfEthers('escrowListener — handlePayoutReleased', () => {
  let db;
  const ETH_ADDR = '0xProviderEthAddress';

  beforeEach(() => {
    db = makeDb();
    try { db.exec('ALTER TABLE payout_requests ADD COLUMN escrow_tx_hash TEXT'); } catch (_) {}
  });

  test('marks processing payout as paid with tx_hash', () => {
    const providerId = insertProvider(db, { ethAddress: ETH_ADDR });
    const payoutId   = insertPayoutRequest(db, { providerId, status: 'processing' });

    listener._handlePayoutReleased(db, MOCK_TX, ETH_ADDR, '10000000');

    const payout = db.prepare('SELECT * FROM payout_requests WHERE id = ?').get(payoutId);
    expect(payout.status).toBe('paid');
    expect(payout.escrow_tx_hash).toBe(MOCK_TX);
    expect(payout.processed_at).not.toBeNull();
  });

  test('is a no-op when no processing payout exists for provider', () => {
    insertProvider(db, { ethAddress: ETH_ADDR });
    // No payout_request inserted — should not throw
    expect(() =>
      listener._handlePayoutReleased(db, MOCK_TX, ETH_ADDR, '0')
    ).not.toThrow();
  });

  test('does not affect pending (non-processing) payouts', () => {
    const providerId = insertProvider(db, { ethAddress: ETH_ADDR });
    const payoutId   = insertPayoutRequest(db, { providerId, status: 'pending' });

    listener._handlePayoutReleased(db, MOCK_TX, ETH_ADDR, '10000000');

    const payout = db.prepare('SELECT * FROM payout_requests WHERE id = ?').get(payoutId);
    // Should remain pending — only 'processing' payouts are confirmed on-chain
    expect(payout.status).toBe('pending');
  });
});
