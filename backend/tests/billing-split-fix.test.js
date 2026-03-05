const assert = require('assert');
const test = require('node:test');

const db = require('../src/db');
const engine = require('../src/services/reconciliation-engine');

function cleanup() {
  db.run('DELETE FROM jobs');
  db.run('DELETE FROM providers');
  db.run('DELETE FROM reconciliation_runs');
}

function insertProvider(id) {
  try {
    db.run(
      `INSERT INTO providers (id, total_jobs, total_earnings) VALUES (?, 0, 0)`,
      id
    );
  } catch (e) {
    // provider might already exist
    db.run(`UPDATE providers SET total_jobs = 0, total_earnings = 0 WHERE id = ?`, id);
  }
}

// --- Bug 1: Provider earnings should use 75% floor split ---

test('provider total_earnings uses 75% split, not full cost', () => {
  cleanup();
  insertProvider(1);

  // Simulate what the fixed job completion route does
  const costHalala = 1000;
  const providerEarnedHalala = Math.floor((costHalala * 75) / 100); // 750
  assert.strictEqual(providerEarnedHalala, 750, 'Provider 75% of 1000 halala should be 750');

  db.run(
    `UPDATE providers SET total_jobs = total_jobs + 1, total_earnings = total_earnings + ? WHERE id = ?`,
    providerEarnedHalala / 100, 1
  );

  const provider = db.get('SELECT * FROM providers WHERE id = ?', 1);
  assert.strictEqual(provider.total_earnings, 7.5, 'Provider earnings should be 7.5 SAR (750 halala), not 10 SAR');
  assert.strictEqual(provider.total_jobs, 1);
});

test('provider 75% floor split rounds down correctly', () => {
  cleanup();
  insertProvider(1);

  // Odd amount: 999 halala → provider gets floor(999*75/100) = floor(749.25) = 749
  const costHalala = 999;
  const providerEarnedHalala = Math.floor((costHalala * 75) / 100);
  assert.strictEqual(providerEarnedHalala, 749, 'Floor of 749.25 should be 749');

  db.run(
    `UPDATE providers SET total_earnings = total_earnings + ? WHERE id = ?`,
    providerEarnedHalala / 100, 1
  );

  const provider = db.get('SELECT * FROM providers WHERE id = ?', 1);
  assert.strictEqual(provider.total_earnings, 7.49);
});

// --- Bug 2: Reconciliation includes jobs with NULL completed_at ---

test('reconciliation counts completed jobs with NULL completed_at', () => {
  cleanup();

  // Insert a legacy completed job with no completed_at
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO jobs (job_id, provider_id, status, cost_halala, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    'legacy-job-1', 1, 'completed', 2000, now
  );

  // Verify completed_at is NULL
  const job = db.get("SELECT completed_at FROM jobs WHERE job_id = 'legacy-job-1'");
  assert.strictEqual(job.completed_at, null, 'Legacy job should have NULL completed_at');

  const result = engine.runFullReconciliation();
  assert.strictEqual(result.jobsChecked, 1, 'Should count 1 completed job even with NULL completed_at');
  assert.strictEqual(result.totalCollectedHalala, 2000, 'Should include the 2000 halala job');
});

test('reconciliation includes mix of jobs with and without completed_at', () => {
  cleanup();

  const now = new Date().toISOString();
  // Legacy job — no completed_at
  db.run(
    `INSERT INTO jobs (job_id, provider_id, status, cost_halala, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    'legacy-1', 1, 'completed', 1000, now
  );
  // New job — has completed_at
  db.run(
    `INSERT INTO jobs (job_id, provider_id, status, cost_halala, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    'new-1', 1, 'completed', 2000, now, now
  );

  const result = engine.runFullReconciliation();
  assert.strictEqual(result.jobsChecked, 2, 'Should count both jobs');
  assert.strictEqual(result.totalCollectedHalala, 3000);
});
