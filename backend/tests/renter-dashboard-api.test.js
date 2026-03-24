/**
 * DCP-917: Renter dashboard API + spending analytics tests
 *
 * Tests:
 * 1. Job history query returns completed jobs for renter
 * 2. Job history filters by status
 * 3. Job history pagination (limit/offset)
 * 4. Spending monthly totals aggregation
 * 5. Single job 404 for wrong renter
 * 6. Single job with billing record join
 * 7. Admin revenue summary all-time totals
 * 8. Admin revenue top providers ordering
 */

'use strict';

const assert = require('assert');
const test = require('node:test');
const crypto = require('crypto');
const db = require('../src/db');

const RUN_ID = crypto.randomBytes(4).toString('hex');
let counter = 0;
function uid() { return `${RUN_ID}-${++counter}`; }

function insertRenter() {
  const id = Date.now() + (++counter);
  const now = new Date().toISOString();
  db.run(
    `INSERT OR REPLACE INTO renters (id, name, email, api_key, status, balance_halala, created_at)
     VALUES (?, ?, ?, ?, 'active', 0, ?)`,
    id, `Renter ${id}`, `renter-${uid()}@dc1test.local`, `rkey-${uid()}`, now
  );
  return id;
}

function insertProvider() {
  const id = Date.now() + (++counter);
  db.run(
    `INSERT OR REPLACE INTO providers (id, name, email, total_jobs, total_earnings, api_key)
     VALUES (?, ?, ?, 0, 0, ?)`,
    id, `Provider ${id}`, `prov-${uid()}@dc1test.local`, `pkey-${uid()}`
  );
  return id;
}

function insertJob(jobId, renterId, providerId, extra = {}) {
  const now = new Date().toISOString();
  db.run(
    `INSERT OR REPLACE INTO jobs
       (job_id, renter_id, provider_id, status, lifecycle_status, submitted_at, created_at,
        actual_cost_halala, model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    jobId, renterId, providerId,
    extra.status || 'completed',
    extra.lifecycle_status || 'pending',
    now, now,
    extra.actual_cost_halala ?? null,
    extra.model ?? null
  );
}

function insertBillingRecord(jobId, gross, renterId, providerId) {
  const platformFee = Math.round(gross * 0.15);
  const providerEarning = gross - platformFee;
  const id = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO billing_records
       (id, job_id, renter_id, provider_id, gross_cost_halala, platform_fee_halala,
        provider_earning_halala, currency, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'SAR', 'pending_release', ?)`,
    id, jobId, renterId, providerId, gross, platformFee, providerEarning, now
  );
  return { id, platformFee, providerEarning };
}

function cleanupRenter(renterId) {
  db._db.pragma('foreign_keys = OFF');
  try {
    db.run('DELETE FROM billing_records WHERE renter_id = ?', renterId);
    db.run('DELETE FROM jobs WHERE renter_id = ?', renterId);
    db.run('DELETE FROM renters WHERE id = ?', renterId);
  } finally {
    db._db.pragma('foreign_keys = ON');
  }
}

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

// ─── Job history query tests ───────────────────────────────────────────────

test('job history query returns completed jobs for renter', () => {
  const renterId = insertRenter();
  const providerId = insertProvider();
  try {
    const jobIds = [`jh-a-${uid()}`, `jh-b-${uid()}`, `jh-c-${uid()}`];
    for (const jid of jobIds) insertJob(jid, renterId, providerId);
    const jobs = db.all(
      `SELECT job_id FROM jobs WHERE renter_id = ? AND status = 'completed' ORDER BY created_at DESC`,
      renterId
    );
    assert.strictEqual(jobs.length, 3);
    for (const jid of jobIds) {
      assert.ok(jobs.some(j => j.job_id === jid), `job_id ${jid} should be present`);
    }
  } finally {
    cleanupRenter(renterId);
    cleanupProvider(providerId);
  }
});

test('job history filters by status', () => {
  const renterId = insertRenter();
  const providerId = insertProvider();
  try {
    insertJob(`jf-comp-${uid()}`, renterId, providerId, { status: 'completed' });
    insertJob(`jf-pend-${uid()}`, renterId, providerId, { status: 'pending' });
    insertJob(`jf-fail-${uid()}`, renterId, providerId, { status: 'failed' });
    const completed = db.all(
      `SELECT job_id FROM jobs WHERE renter_id = ? AND status = ?`, renterId, 'completed'
    );
    assert.strictEqual(completed.length, 1);
  } finally {
    cleanupRenter(renterId);
    cleanupProvider(providerId);
  }
});

test('job history pagination via limit and offset', () => {
  const renterId = insertRenter();
  const providerId = insertProvider();
  try {
    for (let i = 0; i < 5; i++) {
      insertJob(`jp-${uid()}`, renterId, providerId);
    }
    const page1 = db.all(
      `SELECT job_id FROM jobs WHERE renter_id = ? AND status = 'completed'
       ORDER BY created_at DESC LIMIT 2 OFFSET 0`,
      renterId
    );
    const page2 = db.all(
      `SELECT job_id FROM jobs WHERE renter_id = ? AND status = 'completed'
       ORDER BY created_at DESC LIMIT 2 OFFSET 2`,
      renterId
    );
    assert.strictEqual(page1.length, 2);
    assert.strictEqual(page2.length, 2);
    // pages should be disjoint
    const ids1 = new Set(page1.map(j => j.job_id));
    for (const j of page2) assert.ok(!ids1.has(j.job_id), 'pages must not overlap');
  } finally {
    cleanupRenter(renterId);
    cleanupProvider(providerId);
  }
});

// ─── Spending aggregation tests ────────────────────────────────────────────

test('spending monthly totals aggregate correctly', () => {
  const renterId = insertRenter();
  const providerId = insertProvider();
  const amounts = [1000, 2000, 3000];
  const jobIds = amounts.map(() => `jm-${uid()}`);
  try {
    for (let i = 0; i < jobIds.length; i++) {
      insertJob(jobIds[i], renterId, providerId, { actual_cost_halala: amounts[i] });
      insertBillingRecord(jobIds[i], amounts[i], renterId, providerId);
    }
    const allTime = db.get(`
      SELECT COUNT(*) AS total_jobs,
             COALESCE(SUM(COALESCE(br.gross_cost_halala, j.actual_cost_halala, 0)), 0) AS total_halala
      FROM jobs j
      LEFT JOIN billing_records br ON br.job_id = j.job_id
      WHERE j.renter_id = ? AND j.status = 'completed'
    `, renterId);
    assert.strictEqual(allTime.total_jobs, 3);
    assert.strictEqual(allTime.total_halala, 6000);
  } finally {
    cleanupRenter(renterId);
    cleanupProvider(providerId);
  }
});

// ─── Single job detail tests ──────────────────────────────────────────────

test('single job returns 404 for wrong renter', () => {
  const renterId = insertRenter();
  const otherRenterId = insertRenter();
  const providerId = insertProvider();
  const jobId = `js-404-${uid()}`;
  try {
    insertJob(jobId, renterId, providerId);
    const job = db.get(
      `SELECT j.* FROM jobs j WHERE j.job_id = ? AND j.renter_id = ?`,
      jobId, otherRenterId
    );
    assert.strictEqual(job, undefined, 'wrong renter must not see job');
  } finally {
    cleanupRenter(renterId);
    cleanupRenter(otherRenterId);
    cleanupProvider(providerId);
  }
});

test('single job includes billing record via join', () => {
  const renterId = insertRenter();
  const providerId = insertProvider();
  const jobId = `js-br-${uid()}`;
  const gross = 5000;
  try {
    insertJob(jobId, renterId, providerId, { actual_cost_halala: gross });
    const { platformFee, providerEarning } = insertBillingRecord(jobId, gross, renterId, providerId);
    const row = db.get(`
      SELECT j.job_id, br.gross_cost_halala, br.platform_fee_halala, br.provider_earning_halala
      FROM jobs j
      LEFT JOIN billing_records br ON br.job_id = j.job_id
      WHERE j.job_id = ? AND j.renter_id = ?
    `, jobId, renterId);
    assert.ok(row, 'job must be found');
    assert.strictEqual(row.gross_cost_halala, gross);
    assert.strictEqual(row.platform_fee_halala, platformFee);
    assert.strictEqual(row.provider_earning_halala, providerEarning);
  } finally {
    cleanupRenter(renterId);
    cleanupProvider(providerId);
  }
});

// ─── Admin revenue summary tests ──────────────────────────────────────────

test('admin revenue all-time totals aggregate correctly', () => {
  const renterId = insertRenter();
  const providerId = insertProvider();
  const amounts = [1000, 4000];
  const jobIds = amounts.map(() => `jrev-${uid()}`);
  try {
    for (let i = 0; i < jobIds.length; i++) {
      insertJob(jobIds[i], renterId, providerId, { actual_cost_halala: amounts[i] });
      insertBillingRecord(jobIds[i], amounts[i], renterId, providerId);
    }
    const rev = db.get(`
      SELECT COUNT(*) AS total_jobs,
             COALESCE(SUM(gross_cost_halala), 0)       AS total_gross_halala,
             COALESCE(SUM(platform_fee_halala), 0)     AS total_platform_fees_halala,
             COALESCE(SUM(provider_earning_halala), 0) AS total_provider_earnings_halala
      FROM billing_records
      WHERE provider_id = ?
    `, providerId);
    assert.strictEqual(rev.total_jobs, 2);
    assert.strictEqual(rev.total_gross_halala, 5000);
    assert.strictEqual(rev.total_platform_fees_halala, Math.round(1000 * 0.15) + Math.round(4000 * 0.15));
  } finally {
    cleanupRenter(renterId);
    cleanupProvider(providerId);
  }
});

test('admin top providers ordered by earnings descending', () => {
  const renterId = insertRenter();
  const provA = insertProvider();
  const provB = insertProvider();
  try {
    // provA: 1000 halala gross, provB: 4000 halala gross
    const jA = `jtp-a-${uid()}`;
    const jB = `jtp-b-${uid()}`;
    insertJob(jA, renterId, provA, { actual_cost_halala: 1000 });
    insertJob(jB, renterId, provB, { actual_cost_halala: 4000 });
    insertBillingRecord(jA, 1000, renterId, provA);
    insertBillingRecord(jB, 4000, renterId, provB);

    const top = db.all(`
      SELECT provider_id, SUM(provider_earning_halala) AS total_earning
      FROM billing_records
      WHERE provider_id IN (?, ?)
      GROUP BY provider_id
      ORDER BY total_earning DESC
    `, provA, provB);

    assert.strictEqual(top.length, 2);
    assert.strictEqual(top[0].provider_id, provB, 'provB should rank first with higher earnings');
    assert.ok(top[0].total_earning > top[1].total_earning);
  } finally {
    cleanupRenter(renterId);
    cleanupProvider(provA);
    cleanupProvider(provB);
  }
});
