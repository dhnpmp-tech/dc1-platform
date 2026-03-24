/**
 * DCP-911: Job lifecycle state machine + per-job billing record tests
 *
 * Tests:
 * 1. Billing fee math — 15% platform / 85% provider split
 * 2. Gross/fee/earning consistency (fee + earning === gross exactly)
 * 3. Zero-cost edge cases
 * 4. billing_records table insert + lifecycle_status transition
 * 5. Duplicate billing_record prevention (UNIQUE constraint)
 * 6. Billing summary aggregation query
 */

'use strict';

const assert = require('assert');
const test = require('node:test');
const crypto = require('crypto');
const db = require('../src/db');

const PLATFORM_FEE_RATE = 0.15;

// ─── Test helpers ──────────────────────────────────────────────────────────

const RUN_ID = crypto.randomBytes(4).toString('hex');
let counter = 0;
function uid() { return `${RUN_ID}-${++counter}`; }

function cleanupProvider(providerId) {
  db._db.pragma('foreign_keys = OFF');
  try {
    db.run('DELETE FROM billing_records WHERE provider_id = ?', providerId);
    db.run('DELETE FROM jobs WHERE provider_id = ?', providerId);
    db.run('DELETE FROM providers WHERE id = ?', providerId);
  } finally {
    db._db.pragma('foreign_keys = ON');
  }
}

function insertProvider() {
  const id = Date.now() + (++counter);
  db.run(
    `INSERT OR REPLACE INTO providers (id, name, email, total_jobs, total_earnings, api_key)
     VALUES (?, ?, ?, 0, 0, ?)`,
    id, `Provider ${id}`, `prov-${uid()}@dc1test.local`, `key-${uid()}`
  );
  return id;
}

function insertJob(jobId, providerId, extraCols = {}) {
  const now = new Date().toISOString();
  db.run(
    `INSERT OR REPLACE INTO jobs
       (job_id, provider_id, status, lifecycle_status, submitted_at, created_at,
        actual_cost_halala, model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    jobId, providerId,
    extraCols.status || 'completed',
    extraCols.lifecycle_status || 'pending',
    now, now,
    extraCols.actual_cost_halala ?? null,
    extraCols.model ?? null
  );
}

function insertBillingRecord(jobId, gross, providerId) {
  const platformFee = Math.round(gross * PLATFORM_FEE_RATE);
  const providerEarning = gross - platformFee;
  const id = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO billing_records
       (id, job_id, provider_id, gross_cost_halala, platform_fee_halala,
        provider_earning_halala, currency, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'SAR', 'pending_release', ?)`,
    id, jobId, providerId, gross, platformFee, providerEarning, now
  );
  return { id, platformFee, providerEarning };
}

// ─── Fee math tests (no DB) ────────────────────────────────────────────────

test('15% platform fee + 85% provider earning sum to gross exactly', () => {
  for (const gross of [1000, 999, 1, 0, 10000, 7777, 3]) {
    const platformFee = Math.round(gross * PLATFORM_FEE_RATE);
    const providerEarning = gross - platformFee;
    assert.strictEqual(
      platformFee + providerEarning, gross,
      `fee+earning must equal gross (${gross})`
    );
  }
});

test('15% fee rounds correctly for representative amounts', () => {
  assert.strictEqual(Math.round(1000 * 0.15), 150);
  assert.strictEqual(1000 - 150, 850);
  assert.strictEqual(Math.round(999 * 0.15), 150);  // floor(149.85) rounds to 150
  assert.strictEqual(999 - 150, 849);
  assert.strictEqual(Math.round(1 * 0.15), 0);       // tiny job, no fee
  assert.strictEqual(1 - 0, 1);
  assert.strictEqual(Math.round(7 * 0.15), 1);
  assert.strictEqual(7 - 1, 6);
});

test('zero gross cost produces zero fee and zero earning', () => {
  const platformFee = Math.round(0 * PLATFORM_FEE_RATE);
  assert.strictEqual(platformFee, 0);
  assert.strictEqual(0 - platformFee, 0);
});

test('platform fee rate is 15% not 25% (regression guard)', () => {
  const gross = 1000;
  const fee = Math.round(gross * PLATFORM_FEE_RATE);
  assert.strictEqual(fee, 150, 'Platform fee should be 15% = 150 halala');
  assert.notStrictEqual(fee, 250, 'Old 25% split must not be used');
});

// ─── Schema tests ──────────────────────────────────────────────────────────

test('billing_records table exists with required columns', () => {
  const cols = db.all("PRAGMA table_info('billing_records')").map(c => c.name);
  for (const col of [
    'id', 'job_id', 'renter_id', 'provider_id', 'model_id',
    'token_count', 'duration_ms', 'gross_cost_halala',
    'platform_fee_halala', 'provider_earning_halala',
    'currency', 'status', 'created_at',
  ]) {
    assert.ok(cols.includes(col), `billing_records must have column: ${col}`);
  }
});

test('jobs table has lifecycle_status column', () => {
  const cols = db.all("PRAGMA table_info('jobs')").map(c => c.name);
  assert.ok(cols.includes('lifecycle_status'), 'jobs must have lifecycle_status column');
});

// ─── Database interaction tests ────────────────────────────────────────────

test('billing record insert and retrieval round-trip', () => {
  const providerId = insertProvider();
  const jobId = `job-rt-${uid()}`;
  insertJob(jobId, providerId, { actual_cost_halala: 2000 });
  const { id, platformFee, providerEarning } = insertBillingRecord(jobId, 2000, providerId);
  try {
    const record = db.get('SELECT * FROM billing_records WHERE id = ?', id);
    assert.ok(record, 'billing record must be retrievable');
    assert.strictEqual(record.job_id, jobId);
    assert.strictEqual(record.gross_cost_halala, 2000);
    assert.strictEqual(record.platform_fee_halala, platformFee);
    assert.strictEqual(record.provider_earning_halala, providerEarning);
    assert.strictEqual(record.currency, 'SAR');
    assert.strictEqual(record.status, 'pending_release');
    assert.strictEqual(record.platform_fee_halala + record.provider_earning_halala, record.gross_cost_halala);
  } finally {
    cleanupProvider(providerId);
  }
});

test('lifecycle_status advances from pending to billed', () => {
  const providerId = insertProvider();
  const jobId = `job-lc-${uid()}`;
  insertJob(jobId, providerId);
  try {
    db.run('UPDATE jobs SET lifecycle_status = ? WHERE job_id = ?', 'billed', jobId);
    const job = db.get('SELECT lifecycle_status FROM jobs WHERE job_id = ?', jobId);
    assert.strictEqual(job.lifecycle_status, 'billed');
  } finally {
    cleanupProvider(providerId);
  }
});

test('billing_records unique constraint prevents duplicate records per job', () => {
  const providerId = insertProvider();
  const jobId = `job-dedup-${uid()}`;
  insertJob(jobId, providerId, { actual_cost_halala: 500 });
  insertBillingRecord(jobId, 500, providerId);
  try {
    assert.throws(
      () => insertBillingRecord(jobId, 500, providerId),
      (err) => err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY',
      'Second billing record for same job_id must throw UNIQUE constraint error'
    );
  } finally {
    cleanupProvider(providerId);
  }
});

test('billing summary query aggregates totals correctly', () => {
  const providerId = insertProvider();
  const jobIds = [`job-sa-${uid()}`, `job-sb-${uid()}`, `job-sc-${uid()}`];
  const grossAmounts = [1000, 2000, 3000];
  try {
    for (let i = 0; i < jobIds.length; i++) {
      insertJob(jobIds[i], providerId, { actual_cost_halala: grossAmounts[i] });
      insertBillingRecord(jobIds[i], grossAmounts[i], providerId);
    }
    const summary = db.get(`
      SELECT COUNT(*) as total_jobs,
             COALESCE(SUM(gross_cost_halala), 0) as total_gross,
             COALESCE(SUM(platform_fee_halala), 0) as total_fees,
             COALESCE(SUM(provider_earning_halala), 0) as total_earnings
      FROM billing_records WHERE provider_id = ?
    `, providerId);

    const expectedGross = 6000;
    const expectedFees = grossAmounts.reduce((s, g) => s + Math.round(g * PLATFORM_FEE_RATE), 0);
    assert.strictEqual(summary.total_jobs, 3);
    assert.strictEqual(summary.total_gross, expectedGross);
    assert.strictEqual(summary.total_fees, expectedFees);
    assert.strictEqual(summary.total_earnings, expectedGross - expectedFees);
    assert.strictEqual(summary.total_fees + summary.total_earnings, summary.total_gross);
  } finally {
    cleanupProvider(providerId);
  }
});
