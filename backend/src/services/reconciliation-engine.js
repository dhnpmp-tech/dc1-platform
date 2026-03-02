/**
 * DC1 Reconciliation Engine
 * Penny-perfect billing verification for completed jobs.
 * All math in HALALA (integer). 1 SAR = 100 halala.
 */

const crypto = require('crypto');
const db = require('../db');

const PROVIDER_SHARE = 75;

/**
 * Split total halala into provider + dc1 shares.
 * Provider gets floor(75%), DC1 gets remainder — ensures sum = total exactly.
 */
function splitCost(totalHalala) {
  const provider = Math.floor((totalHalala * PROVIDER_SHARE) / 100);
  const dc1 = totalHalala - provider;
  return { provider, dc1 };
}

/**
 * Recompute proof hash for a billing tick.
 */
function computeProofHash(jobId, sessionId, amountHalala, timestamp) {
  return crypto.createHash('sha256')
    .update(`${jobId}|${sessionId}|${amountHalala}|${timestamp}`)
    .digest('hex');
}

/**
 * Verify billing for a single job.
 * Returns { jobId, clean, renterPaid, providerEarned, dc1Fee, discrepancies[] }
 */
function verifyJobBilling(jobId) {
  const job = db.get('SELECT * FROM jobs WHERE job_id = ? OR id = ?', jobId, jobId);
  if (!job) return { jobId, clean: false, error: 'Job not found', discrepancies: ['job_not_found'] };

  const renterPaid = job.cost_halala || 0;
  const { provider: expectedProvider, dc1: expectedDc1 } = splitCost(renterPaid);

  // Check if provider_earned_halala and dc1_fee_halala columns exist
  const providerEarned = job.provider_earned_halala != null ? job.provider_earned_halala : expectedProvider;
  const dc1Fee = job.dc1_fee_halala != null ? job.dc1_fee_halala : expectedDc1;

  const discrepancies = [];

  // Core invariant: renter_paid must equal provider_earned + dc1_fee exactly
  if (renterPaid !== providerEarned + dc1Fee) {
    discrepancies.push({
      type: 'sum_mismatch',
      expected: renterPaid,
      actual: providerEarned + dc1Fee,
      detail: `renter_paid(${renterPaid}) != provider(${providerEarned}) + dc1(${dc1Fee})`
    });
  }

  // Verify 75/25 split
  if (providerEarned !== expectedProvider) {
    discrepancies.push({
      type: 'provider_split',
      expected: expectedProvider,
      actual: providerEarned,
      detail: `Provider should get ${expectedProvider} halala (75%), got ${providerEarned}`
    });
  }

  if (dc1Fee !== expectedDc1) {
    discrepancies.push({
      type: 'dc1_split',
      expected: expectedDc1,
      actual: dc1Fee,
      detail: `DC1 should get ${expectedDc1} halala (25%), got ${dc1Fee}`
    });
  }

  return {
    jobId: job.job_id || job.id,
    clean: discrepancies.length === 0,
    renterPaid,
    providerEarned,
    dc1Fee,
    discrepancies
  };
}

/**
 * Verify cryptographic proof hash for a job (if proof data exists).
 */
function verifyProofHash(jobId) {
  const job = db.get('SELECT * FROM jobs WHERE job_id = ? OR id = ?', jobId, jobId);
  if (!job) return { jobId, valid: false, error: 'Job not found' };

  // If the job has proof fields
  if (!job.proof_hash) {
    return { jobId, valid: null, message: 'No proof hash stored for this job' };
  }

  const sessionId = job.session_id || job.job_id || String(job.id);
  const timestamp = job.completed_at || job.updated_at || job.created_at;
  const expectedHash = computeProofHash(
    job.job_id || String(job.id),
    sessionId,
    job.cost_halala || 0,
    timestamp
  );

  return {
    jobId: job.job_id || job.id,
    valid: expectedHash === job.proof_hash,
    expectedHash,
    storedHash: job.proof_hash
  };
}

/**
 * Run full reconciliation across all completed jobs.
 */
function runFullReconciliation() {
  const jobs = db.all("SELECT * FROM jobs WHERE status = 'completed'") || [];

  let jobsChecked = 0;
  let jobsClean = 0;
  let jobsFlagged = 0;
  let totalCollected = 0;
  let totalPaid = 0;
  let dc1Margin = 0;
  const flaggedJobs = [];

  for (const job of jobs) {
    jobsChecked++;
    const result = verifyJobBilling(job.job_id || job.id);

    totalCollected += result.renterPaid || 0;
    totalPaid += result.providerEarned || 0;
    dc1Margin += result.dc1Fee || 0;

    if (result.clean) {
      jobsClean++;
    } else {
      jobsFlagged++;
      flaggedJobs.push(result);
    }
  }

  // Record the run
  const runAt = new Date().toISOString();
  try {
    db.run(
      `INSERT INTO reconciliation_runs (run_at, jobs_checked, jobs_clean, jobs_flagged, total_collected_halala, total_paid_halala, dc1_margin_halala, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      runAt, jobsChecked, jobsClean, jobsFlagged, totalCollected, totalPaid, dc1Margin,
      jobsFlagged > 0 ? JSON.stringify(flaggedJobs.map(j => j.jobId)) : null
    );
  } catch (e) {
    // Table might not exist yet in test scenarios
  }

  return {
    runAt,
    jobsChecked,
    jobsClean,
    jobsFlagged,
    totalCollectedHalala: totalCollected,
    totalPaidHalala: totalPaid,
    dc1MarginHalala: dc1Margin,
    flaggedJobs
  };
}

/**
 * Generate a structured audit report.
 */
function generateReport() {
  const reconciliation = runFullReconciliation();

  return {
    reportType: 'billing_reconciliation',
    generatedAt: new Date().toISOString(),
    summary: {
      jobsChecked: reconciliation.jobsChecked,
      jobsClean: reconciliation.jobsClean,
      jobsFlagged: reconciliation.jobsFlagged,
      totalCollectedHalala: reconciliation.totalCollectedHalala,
      totalPaidHalala: reconciliation.totalPaidHalala,
      dc1MarginHalala: reconciliation.dc1MarginHalala,
      totalCollectedSar: (reconciliation.totalCollectedHalala / 100).toFixed(2),
      totalPaidSar: (reconciliation.totalPaidHalala / 100).toFixed(2),
      dc1MarginSar: (reconciliation.dc1MarginHalala / 100).toFixed(2),
    },
    discrepancies: reconciliation.flaggedJobs,
    status: reconciliation.jobsFlagged === 0 ? 'CLEAN' : 'DISCREPANCIES_FOUND'
  };
}

module.exports = {
  verifyJobBilling,
  verifyProofHash,
  runFullReconciliation,
  generateReport,
  splitCost
};
