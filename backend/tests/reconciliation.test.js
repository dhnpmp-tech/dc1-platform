const assert = require('assert');
const test = require('node:test');

const db = require('../src/db');
const engine = require('../src/services/reconciliation-engine');

// Helpers
function cleanup() {
  db.run('DELETE FROM jobs');
  db.run('DELETE FROM reconciliation_runs');
}

function insertJob(overrides = {}) {
  const now = new Date().toISOString();
  const defaults = {
    job_id: 'job-' + Math.random().toString(36).substr(2, 8),
    provider_id: 1,
    status: 'completed',
    cost_halala: 1000,
    created_at: now,
  };
  const j = { ...defaults, ...overrides };
  db.run(
    `INSERT INTO jobs (job_id, provider_id, status, cost_halala, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    j.job_id, j.provider_id, j.status, j.cost_halala, j.created_at
  );
  return j;
}

// ── Tests ──

test('reconciliation_runs table exists', () => {
  const row = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='reconciliation_runs'");
  assert.ok(row, 'reconciliation_runs table should exist');
});

test('verifyJobBilling identifies clean job (renter_paid = provider + dc1)', () => {
  cleanup();
  const job = insertJob({ cost_halala: 1000 });
  const result = engine.verifyJobBilling(job.job_id);
  // 75% of 1000 = 750 provider, 250 dc1
  assert.strictEqual(result.clean, true);
  assert.strictEqual(result.renterPaid, 1000);
  assert.strictEqual(result.providerEarned, 750);
  assert.strictEqual(result.dc1Fee, 250);
  assert.strictEqual(result.providerEarned + result.dc1Fee, result.renterPaid);
});

test('verifyJobBilling flags non-existent job', () => {
  cleanup();
  const result = engine.verifyJobBilling('nonexistent-job-id');
  assert.strictEqual(result.clean, false);
  assert.ok(result.discrepancies.length > 0 || result.error);
});

test('75/25 split math is correct in halala (integer, no floats)', () => {
  // Test various amounts including odd numbers
  const testCases = [
    { total: 100, provider: 75, dc1: 25 },
    { total: 1000, provider: 750, dc1: 250 },
    { total: 1, provider: 0, dc1: 1 },      // edge: remainder to DC1
    { total: 3, provider: 2, dc1: 1 },       // floor(3*75/100)=2, remainder=1
    { total: 999, provider: 749, dc1: 250 }, // floor(999*75/100)=749
    { total: 0, provider: 0, dc1: 0 },
  ];

  for (const tc of testCases) {
    const { provider, dc1 } = engine.splitCost(tc.total);
    assert.strictEqual(provider, tc.provider, `provider for ${tc.total}`);
    assert.strictEqual(dc1, tc.dc1, `dc1 for ${tc.total}`);
    assert.strictEqual(provider + dc1, tc.total, `sum for ${tc.total}`);
  }
});

test('runFullReconciliation returns correct aggregate totals', () => {
  cleanup();
  insertJob({ job_id: 'j1', cost_halala: 1000 });
  insertJob({ job_id: 'j2', cost_halala: 2000 });
  insertJob({ job_id: 'j3', cost_halala: 500 });

  const result = engine.runFullReconciliation();
  assert.strictEqual(result.jobsChecked, 3);
  assert.strictEqual(result.jobsClean, 3);
  assert.strictEqual(result.jobsFlagged, 0);
  assert.strictEqual(result.totalCollectedHalala, 3500);
  // 750+1500+375 = 2625
  assert.strictEqual(result.totalPaidHalala, 2625);
  // 250+500+125 = 875
  assert.strictEqual(result.dc1MarginHalala, 875);
  assert.strictEqual(result.totalPaidHalala + result.dc1MarginHalala, result.totalCollectedHalala);
});

test('discrepancies: pending jobs are excluded from reconciliation', () => {
  cleanup();
  insertJob({ job_id: 'completed-1', status: 'completed', cost_halala: 500 });
  insertJob({ job_id: 'pending-1', status: 'pending', cost_halala: 300 });

  const result = engine.runFullReconciliation();
  assert.strictEqual(result.jobsChecked, 1);
  assert.strictEqual(result.flaggedJobs.length, 0);
});

test('generateReport returns structured report with CLEAN status', () => {
  cleanup();
  insertJob({ cost_halala: 400 });

  const report = engine.generateReport();
  assert.strictEqual(report.reportType, 'billing_reconciliation');
  assert.strictEqual(report.status, 'CLEAN');
  assert.ok(report.generatedAt);
  assert.strictEqual(report.summary.jobsChecked, 1);
  assert.strictEqual(report.summary.totalCollectedHalala, 400);
});
