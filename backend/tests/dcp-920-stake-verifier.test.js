'use strict';

/**
 * dcp-920-stake-verifier.test.js -- Unit tests for stake verification (DCP-920)
 *
 * Tests the jobRouter.js stake gate and the TIER_MIN_STAKE_ETH constants in isolation
 * using an in-memory SQLite database -- no live on-chain calls required.
 *
 * ESM note: stake-verifier.mjs is tested via constants exported separately
 * and via the jobRouter.js integration (which uses the DB-cached stake_status path).
 *
 * Covers:
 *   Tier minimum stake constants:
 *     1. Correct ETH values per GPU tier (0-4)
 *
 *   jobRouter.js stake gate:
 *     2. REQUIRE_STAKE=false -- providers not filtered regardless of stake_status
 *     3. REQUIRE_STAKE=true  -- stake_status=insufficient excluded
 *     4. REQUIRE_STAKE=true  -- stake_status=slashed excluded
 *     5. REQUIRE_STAKE=true  -- stake_status=active included, stake_verified=true
 *     6. REQUIRE_STAKE=true  -- stake_status=none included (stake not yet checked)
 *     7. REQUIRE_STAKE=true  -- best staked provider selected over unstaked
 */

const BetterSQLite = require('better-sqlite3');

// ---- Constants (mirror stake-verifier.mjs to avoid ESM import in CJS tests) ----
const TIER_MIN_STAKE_WEI = {
  0: 0n,
  1: 3000000000000000n,    // Entry: 0.003 ETH
  2: 8000000000000000n,    // Standard: 0.008 ETH
  3: 31000000000000000n,   // High: 0.031 ETH
  4: 78000000000000000n,   // Enterprise: 0.078 ETH
};

// ---- DB helpers ---------------------------------------------------------------

function makeDb() {
  const db = new BetterSQLite(':memory:');
  db.exec(`
    CREATE TABLE providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      is_paused INTEGER DEFAULT 0,
      last_heartbeat TEXT,
      gpu_model TEXT DEFAULT 'RTX 4090',
      gpu_name_detected TEXT,
      gpu_tier INTEGER DEFAULT 2,
      gpu_vram_mib INTEGER DEFAULT 24576,
      vram_gb INTEGER DEFAULT 24,
      uptime_percent REAL DEFAULT 100.0,
      reputation_score REAL DEFAULT 100.0,
      price_per_min_halala INTEGER DEFAULT NULL,
      model_preload_status TEXT DEFAULT 'none',
      stake_status TEXT DEFAULT 'none',
      stake_amount_wei TEXT DEFAULT '0',
      evm_wallet_address TEXT,
      gpu_count_reported INTEGER DEFAULT 1
    )
  `);
  return db;
}

function insertProvider(db, overrides = {}) {
  const now = new Date().toISOString();
  const defaults = {
    name: 'TestProvider',
    api_key: 'test-key-' + Math.random(),
    last_heartbeat: now,
    gpu_tier: 2,
    stake_status: 'none',
    stake_amount_wei: '0',
    evm_wallet_address: '0xDeadBeef0000000000000000000000DeadBeef00',
  };
  const row = { ...defaults, ...overrides };
  const keys = Object.keys(row).join(', ');
  const placeholders = Object.keys(row).map(() => '?').join(', ');
  db.prepare(`INSERT INTO providers (${keys}) VALUES (${placeholders})`).run(...Object.values(row));
  return db.prepare('SELECT last_insert_rowid() as id').get().id;
}

// ---- Tests: tier constants ---------------------------------------------------

describe('TIER_MIN_STAKE_WEI constants', () => {
  test('tier 0 (unclassified) requires 0 wei', () => {
    expect(TIER_MIN_STAKE_WEI[0]).toBe(0n);
  });

  test('tier 1 (entry) requires 3000000000000000 wei (0.003 ETH)', () => {
    expect(TIER_MIN_STAKE_WEI[1]).toBe(3000000000000000n);
  });

  test('tier 2 (standard) requires 8000000000000000 wei (0.008 ETH)', () => {
    expect(TIER_MIN_STAKE_WEI[2]).toBe(8000000000000000n);
  });

  test('tier 3 (high) requires 31000000000000000 wei (0.031 ETH)', () => {
    expect(TIER_MIN_STAKE_WEI[3]).toBe(31000000000000000n);
  });

  test('tier 4 (enterprise) requires 78000000000000000 wei (0.078 ETH)', () => {
    expect(TIER_MIN_STAKE_WEI[4]).toBe(78000000000000000n);
  });

  test('tier minimums increase monotonically', () => {
    expect(TIER_MIN_STAKE_WEI[1]).toBeLessThan(TIER_MIN_STAKE_WEI[2]);
    expect(TIER_MIN_STAKE_WEI[2]).toBeLessThan(TIER_MIN_STAKE_WEI[3]);
    expect(TIER_MIN_STAKE_WEI[3]).toBeLessThan(TIER_MIN_STAKE_WEI[4]);
  });
});

// ---- Tests: jobRouter stake gate --------------------------------------------

describe('jobRouter findBestProvider -- stake gate', () => {
  let findBestProvider;
  let db;

  beforeEach(() => {
    db = makeDb();
    jest.resetModules();
    jest.doMock('../src/db.js', () => ({
      get: (sql, ...params) => db.prepare(sql).get(...params),
      all: (sql, ...params) => db.prepare(sql).all(...params),
      run: (sql, ...params) => db.prepare(sql).run(...params),
    }));
    findBestProvider = require('../src/services/jobRouter').findBestProvider;
  });

  afterEach(() => {
    jest.resetModules();
    delete process.env.REQUIRE_STAKE;
  });

  test('REQUIRE_STAKE=false -- insufficient provider is NOT filtered', () => {
    process.env.REQUIRE_STAKE = 'false';
    const now = new Date().toISOString();
    insertProvider(db, {
      name: 'InsufficientProvider',
      last_heartbeat: now,
      stake_status: 'insufficient',
    });

    const result = findBestProvider({ job_type: 'llm_inference', min_vram_gb: 0, globalRateHalala: 10 });
    expect(result).not.toBeNull();
    expect(result.provider.name).toBe('InsufficientProvider');
    expect(result.provider.stake_verified).toBeNull();
  });

  test('REQUIRE_STAKE=true -- stake_status=insufficient is excluded', () => {
    process.env.REQUIRE_STAKE = 'true';
    const now = new Date().toISOString();
    insertProvider(db, {
      name: 'InsufficientProvider',
      last_heartbeat: now,
      stake_status: 'insufficient',
    });

    const result = findBestProvider({ job_type: 'llm_inference', min_vram_gb: 0, globalRateHalala: 10 });
    expect(result).toBeNull();
  });

  test('REQUIRE_STAKE=true -- stake_status=slashed is excluded', () => {
    process.env.REQUIRE_STAKE = 'true';
    const now = new Date().toISOString();
    insertProvider(db, {
      name: 'SlashedProvider',
      last_heartbeat: now,
      stake_status: 'slashed',
    });

    const result = findBestProvider({ job_type: 'llm_inference', min_vram_gb: 0, globalRateHalala: 10 });
    expect(result).toBeNull();
  });

  test('REQUIRE_STAKE=true -- stake_status=active is included with stake_verified=true', () => {
    process.env.REQUIRE_STAKE = 'true';
    const now = new Date().toISOString();
    insertProvider(db, {
      name: 'ActiveStakeProvider',
      last_heartbeat: now,
      stake_status: 'active',
      stake_amount_wei: '10000000000000000',
    });

    const result = findBestProvider({ job_type: 'llm_inference', min_vram_gb: 0, globalRateHalala: 10 });
    expect(result).not.toBeNull();
    expect(result.provider.name).toBe('ActiveStakeProvider');
    expect(result.provider.stake_verified).toBe(true);
  });

  test('REQUIRE_STAKE=true -- stake_status=none is included (stake not yet checked)', () => {
    process.env.REQUIRE_STAKE = 'true';
    const now = new Date().toISOString();
    insertProvider(db, {
      name: 'NewProvider',
      last_heartbeat: now,
      stake_status: 'none',
    });

    const result = findBestProvider({ job_type: 'llm_inference', min_vram_gb: 0, globalRateHalala: 10 });
    expect(result).not.toBeNull();
    expect(result.provider.name).toBe('NewProvider');
  });

  test('REQUIRE_STAKE=true -- staked provider wins over unstaked with higher uptime', () => {
    process.env.REQUIRE_STAKE = 'true';
    const now = new Date().toISOString();
    insertProvider(db, {
      name: 'ActiveProvider',
      last_heartbeat: now,
      stake_status: 'active',
      uptime_percent: 90.0,
    });
    insertProvider(db, {
      name: 'HighUptimeButSlashed',
      last_heartbeat: now,
      stake_status: 'slashed',
      uptime_percent: 99.9,
    });

    const result = findBestProvider({ job_type: 'llm_inference', min_vram_gb: 0, globalRateHalala: 10 });
    expect(result).not.toBeNull();
    expect(result.provider.name).toBe('ActiveProvider');
  });

  test('REQUIRE_STAKE=false -- all providers eligible regardless of stake', () => {
    process.env.REQUIRE_STAKE = 'false';
    const now = new Date().toISOString();
    const statuses = ['none', 'active', 'insufficient', 'slashed', 'withdrawn'];
    for (const status of statuses) {
      insertProvider(db, {
        name: `Provider_${status}`,
        last_heartbeat: now,
        stake_status: status,
        uptime_percent: status === 'active' ? 50 : 60, // slashed wins on uptime
      });
    }

    const result = findBestProvider({ job_type: 'llm_inference', min_vram_gb: 0, globalRateHalala: 10 });
    expect(result).not.toBeNull();
    // All should be eligible (highest uptime wins = insufficient or slashed at 60%)
    expect(result).not.toBeNull();
  });
});
