#!/usr/bin/env node
/**
 * platform-fee-reconciliation.mjs — DCP-811
 *
 * Queries all completed job_settlements, verifies the 15% platform fee
 * was applied correctly, and prints a revenue summary report.
 *
 * This is the founder's daily revenue report.
 *
 * Usage:
 *   node scripts/platform-fee-reconciliation.mjs
 *   node scripts/platform-fee-reconciliation.mjs --since 2026-03-01
 *   node scripts/platform-fee-reconciliation.mjs --since 2026-03-01 --until 2026-03-31
 *   node scripts/platform-fee-reconciliation.mjs --json
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — discrepancies found or script error
 */

import { resolve, dirname } from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

// Resolve better-sqlite3 from the backend where it is installed
const __filename  = fileURLToPath(import.meta.url);
const __dirname   = dirname(__filename);
const backendDir  = resolve(__dirname, '../backend');
const requireBack = createRequire(resolve(backendDir, 'package.json'));
const Database    = requireBack('better-sqlite3');

const DB_PATH = process.env.DC1_DB_PATH
  || process.env.DB_PATH
  || resolve(__dirname, '..', 'backend', 'data', 'providers.db');

const SAR_PER_HALALA   = 0.01;
const USD_PER_SAR      = 1 / 3.75;
const PLATFORM_FEE_PCT = 15;

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const jsonMode   = args.includes('--json');
const sinceIdx   = args.indexOf('--since');
const untilIdx   = args.indexOf('--until');
const since      = sinceIdx !== -1  ? args[sinceIdx + 1]  : null;
const until      = untilIdx !== -1  ? args[untilIdx + 1]  : null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSar(halala)  { return (halala * SAR_PER_HALALA).toFixed(2); }
function toUsd(halala)  { return (halala * SAR_PER_HALALA * USD_PER_SAR).toFixed(4); }
function pct(a, b)      { return b === 0 ? '—' : ((a / b) * 100).toFixed(2) + '%'; }

function buildWhere(extra = []) {
  const clauses  = ['status = ?'];
  const params   = ['completed'];
  if (since) { clauses.push('settled_at >= ?'); params.push(since); }
  if (until) { clauses.push('settled_at <= ?'); params.push(until); }
  clauses.push(...extra);
  return { where: 'WHERE ' + clauses.join(' AND '), params };
}

// ── Main ──────────────────────────────────────────────────────────────────────

let db;
try {
  db = new Database(DB_PATH, { readonly: true });
} catch (err) {
  console.error(`ERROR: Cannot open database at ${DB_PATH}`);
  console.error(err.message);
  process.exit(1);
}

// Check table exists
const tableExists = db.prepare(
  `SELECT name FROM sqlite_master WHERE type='table' AND name='job_settlements'`
).get();

if (!tableExists) {
  console.error('ERROR: job_settlements table does not exist. No settlements recorded yet.');
  process.exit(1);
}

const { where, params } = buildWhere();

// ── Aggregate summary ─────────────────────────────────────────────────────────

const summary = db.prepare(`
  SELECT
    COUNT(*)                                   AS job_count,
    COALESCE(SUM(gross_amount_halala),    0)   AS total_gross,
    COALESCE(SUM(platform_fee_halala),    0)   AS total_platform_fee,
    COALESCE(SUM(provider_payout_halala), 0)   AS total_provider_payout
  FROM job_settlements
  ${where}
`).get(...params);

// ── Per-job fee verification ──────────────────────────────────────────────────

const rows = db.prepare(`
  SELECT
    id,
    job_id,
    provider_id,
    renter_id,
    gross_amount_halala,
    platform_fee_halala,
    provider_payout_halala,
    settled_at
  FROM job_settlements
  ${where}
  ORDER BY settled_at ASC
`).all(...params);

const discrepancies = [];

for (const row of rows) {
  const expectedFee    = Math.floor((row.gross_amount_halala * PLATFORM_FEE_PCT) / 100);
  const expectedPayout = row.gross_amount_halala - expectedFee;
  const sumCheck       = row.platform_fee_halala + row.provider_payout_halala;

  const feeMismatch    = row.platform_fee_halala    !== expectedFee;
  const payoutMismatch = row.provider_payout_halala !== expectedPayout;
  const sumMismatch    = sumCheck                   !== row.gross_amount_halala;

  if (feeMismatch || payoutMismatch || sumMismatch) {
    discrepancies.push({
      jobId:               row.job_id,
      settledAt:           row.settled_at,
      grossHalala:         row.gross_amount_halala,
      recordedFee:         row.platform_fee_halala,
      expectedFee,
      feeDiff:             row.platform_fee_halala - expectedFee,
      recordedPayout:      row.provider_payout_halala,
      expectedPayout,
      payoutDiff:          row.provider_payout_halala - expectedPayout,
      sumCheck,
      issues: [
        feeMismatch    ? 'fee_mismatch'    : null,
        payoutMismatch ? 'payout_mismatch' : null,
        sumMismatch    ? 'sum_mismatch'    : null,
      ].filter(Boolean),
    });
  }
}

// ── Non-completed stats (failed / refunded) ───────────────────────────────────

const nonCompleted = db.prepare(`
  SELECT
    status,
    COUNT(*) AS count,
    COALESCE(SUM(gross_amount_halala), 0) AS gross
  FROM job_settlements
  WHERE status != 'completed'
  GROUP BY status
`).all();

// ── Date range of data ────────────────────────────────────────────────────────

const dateRange = db.prepare(`
  SELECT
    MIN(settled_at) AS earliest,
    MAX(settled_at) AS latest
  FROM job_settlements
  ${where}
`).get(...params);

db.close();

// ── Output ────────────────────────────────────────────────────────────────────

const report = {
  generatedAt:       new Date().toISOString(),
  filter: {
    since:           since || 'all time',
    until:           until || 'now',
  },
  dataRange: {
    earliest:        dateRange.earliest || 'none',
    latest:          dateRange.latest   || 'none',
  },
  summary: {
    completedJobs:       summary.job_count,
    totalGrossHalala:    summary.total_gross,
    totalGrossSar:       toSar(summary.total_gross),
    totalGrossUsd:       toUsd(summary.total_gross),
    platformRevenueHalala:  summary.total_platform_fee,
    platformRevenueSar:     toSar(summary.total_platform_fee),
    platformRevenueUsd:     toUsd(summary.total_platform_fee),
    platformFeeActualPct:   pct(summary.total_platform_fee, summary.total_gross),
    providerPayoutsHalala:  summary.total_provider_payout,
    providerPayoutsSar:     toSar(summary.total_provider_payout),
    providerPayoutsUsd:     toUsd(summary.total_provider_payout),
    providerShareActualPct: pct(summary.total_provider_payout, summary.total_gross),
    balanceCheck:        summary.total_platform_fee + summary.total_provider_payout === summary.total_gross
                           ? 'PASS' : 'FAIL',
  },
  discrepancies: {
    count:           discrepancies.length,
    totalLeakageHalala: discrepancies.reduce((s, d) => s + Math.abs(d.feeDiff), 0),
    details:         discrepancies,
  },
  nonCompletedJobs: nonCompleted,
  checks: {
    feeRateCorrect:   discrepancies.length === 0,
    sumIntact:        discrepancies.filter(d => d.issues.includes('sum_mismatch')).length === 0,
    allPass:          discrepancies.length === 0,
  },
};

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.checks.allPass ? 0 : 1);
}

// ── Human-readable output ─────────────────────────────────────────────────────

const sep = '─'.repeat(60);

console.log('\n' + sep);
console.log('  DCP Platform Fee Reconciliation Report');
console.log('  Generated: ' + report.generatedAt);
console.log('  Filter: ' + report.filter.since + ' → ' + report.filter.until);
console.log(sep);

const s = report.summary;
console.log('\n📊 REVENUE SUMMARY');
console.log(`  Completed jobs:       ${s.completedJobs}`);
console.log(`  Total gross:          ${s.totalGrossHalala} halala  (${s.totalGrossSar} SAR / $${s.totalGrossUsd})`);
console.log(`  Platform revenue:     ${s.platformRevenueHalala} halala  (${s.platformRevenueSar} SAR / $${s.platformRevenueUsd})  [${s.platformFeeActualPct}]`);
console.log(`  Provider payouts:     ${s.providerPayoutsHalala} halala  (${s.providerPayoutsSar} SAR / $${s.providerPayoutsUsd})  [${s.providerShareActualPct}]`);
console.log(`  Balance check:        ${s.balanceCheck === 'PASS' ? '✅ PASS' : '❌ FAIL'} (fee + payout = gross)`);

if (nonCompleted.length > 0) {
  console.log('\n📋 NON-COMPLETED JOBS (excluded from revenue)');
  for (const nc of nonCompleted) {
    console.log(`  ${nc.status.padEnd(12)} ${nc.count} jobs  (${nc.gross} halala gross, all $0 billed)`);
  }
}

console.log('\n🔍 FEE VERIFICATION');
const d = report.discrepancies;
if (d.count === 0) {
  console.log(`  ✅ All ${s.completedJobs} settlements pass the 15% fee check.`);
} else {
  console.log(`  ❌ ${d.count} discrepancies found (${d.totalLeakageHalala} halala total leakage)`);
  for (const disc of d.details.slice(0, 10)) {
    console.log(`\n  Job: ${disc.jobId}  (${disc.settledAt})`);
    console.log(`    Gross:          ${disc.grossHalala} halala`);
    console.log(`    Expected fee:   ${disc.expectedFee} halala`);
    console.log(`    Recorded fee:   ${disc.recordedFee} halala  (diff: ${disc.feeDiff > 0 ? '+' : ''}${disc.feeDiff})`);
    console.log(`    Issues:         ${disc.issues.join(', ')}`);
  }
  if (d.details.length > 10) {
    console.log(`  ... and ${d.details.length - 10} more. Run with --json for full list.`);
  }
}

console.log('\n' + sep);
const overallPass = report.checks.allPass && s.balanceCheck === 'PASS';
if (overallPass) {
  console.log('  ✅ RECONCILIATION PASSED — all checks green');
} else {
  console.log('  ❌ RECONCILIATION FAILED — review discrepancies above');
}
console.log(sep + '\n');

process.exit(overallPass ? 0 : 1);
