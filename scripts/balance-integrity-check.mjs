#!/usr/bin/env node
/**
 * Balance Integrity Check — DCP-799
 *
 * Verifies the fundamental halala accounting invariant:
 *
 *   sum(current renter balances)
 *   + sum(job debits from renter_credit_ledger)
 *   + sum(payment refunds)
 *   = sum(paid topup amounts)
 *   + sum(admin credit grants)
 *
 * Equivalently (per renter):
 *   balance_halala = credits - debits  (from renter_credit_ledger)
 *
 * Also checks the provider side:
 *   sum(claimable_earnings_halala across all providers)
 *   ≈ sum(provider_earned_halala from completed jobs)
 *   - sum(paid/processing withdrawal_requests)
 *
 * Usage:
 *   node scripts/balance-integrity-check.mjs [--db /path/to/dc1.db] [--verbose]
 *
 * Exit codes:
 *   0 = all checks pass
 *   1 = discrepancies found
 *   2 = fatal error (db not found, etc.)
 */

import { existsSync, realpathSync } from 'fs';
import { resolve, dirname } from 'path';
import { parseArgs } from 'util';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

// Resolve better-sqlite3 from the backend where it is installed
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const backendDir = resolve(__dirname, '../backend');
const requireBackend = createRequire(resolve(backendDir, 'package.json'));
const Database = requireBackend('better-sqlite3');

// ── CLI args ──────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    db:      { type: 'string', default: '' },
    verbose: { type: 'boolean', default: false },
    json:    { type: 'boolean', default: false },
  },
});

const DB_CANDIDATES = [
  args.db,
  process.env.DB_PATH,
  resolve(__dirname, '../backend/data/providers.db'),
  resolve(__dirname, '../backend/providers.db'),
  resolve(__dirname, '../backend/data/dc1.db'),
  resolve(__dirname, '../backend/dc1.db'),
  '/home/node/dc1-platform/backend/data/providers.db',
  '/home/node/dc1-platform/backend/data/dc1.db',
].filter(Boolean);

const dbPath = DB_CANDIDATES.find(p => existsSync(p));
if (!dbPath) {
  console.error('ERROR: Could not find dc1.db. Tried:\n  ' + DB_CANDIDATES.join('\n  '));
  console.error('Provide path with --db /path/to/dc1.db');
  process.exit(2);
}

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const verbose = args.verbose;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sar(halala) {
  return (Number(halala || 0) / 100).toFixed(2);
}

function pass(label, detail = '') {
  console.log(`  ✅ PASS  ${label}${detail ? ' — ' + detail : ''}`);
}

function fail(label, detail = '') {
  console.error(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`);
}

function warn(label, detail = '') {
  console.warn(`  ⚠️  WARN  ${label}${detail ? ' — ' + detail : ''}`);
}

function info(label) {
  console.log(`  ℹ️       ${label}`);
}

// ── Checks ────────────────────────────────────────────────────────────────────

const discrepancies = [];
const warnings = [];

/**
 * Check 1: Ledger vs balance for every renter.
 *
 * For each renter:
 *   balance_halala = SUM(credits) - SUM(debits)  from renter_credit_ledger
 */
function checkRenterLedgerBalance() {
  console.log('\n── Check 1: Renter balance vs credit ledger ──');

  const renters = db.prepare(`SELECT id, name, email, balance_halala FROM renters WHERE status != 'deleted'`).all();

  let checked = 0;
  let mismatches = 0;

  for (const renter of renters) {
    const ledger = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_halala ELSE 0 END), 0) AS total_credits,
        COALESCE(SUM(CASE WHEN direction = 'debit'  THEN amount_halala ELSE 0 END), 0) AS total_debits
      FROM renter_credit_ledger
      WHERE renter_id = ?
    `).get(renter.id);

    const ledgerBalance = Number(ledger.total_credits) - Number(ledger.total_debits);
    const actualBalance = Number(renter.balance_halala || 0);
    const delta = actualBalance - ledgerBalance;

    checked++;

    if (Math.abs(delta) > 0) {
      mismatches++;
      const msg = `Renter #${renter.id} (${renter.email}): balance=${sar(actualBalance)} SAR, ledger=${sar(ledgerBalance)} SAR, delta=${sar(delta)} SAR`;
      fail('Balance mismatch', msg);
      discrepancies.push({ check: 'renter_ledger_balance', renter_id: renter.id, email: renter.email, delta_halala: delta });
    } else if (verbose) {
      pass(`Renter #${renter.id} (${renter.email})`, `balance=${sar(actualBalance)} SAR`);
    }
  }

  if (mismatches === 0) {
    pass(`All ${checked} renters`, 'balance matches ledger exactly');
  } else {
    fail(`${mismatches} of ${checked} renters have balance/ledger mismatches`);
  }

  return mismatches === 0;
}

/**
 * Check 2: Paid top-ups + credit grants + admin direct topups = total credits in ledger.
 *
 * Sources of ledger credits:
 *   1. payments (status='paid'): Moyasar-confirmed topups
 *   2. credit_grants: admin-issued credits (immutable audit table)
 *   3. admin direct topups: POST /api/renters/:id/topup calls addCredits('topup') directly
 *      — these produce ledger entries with source='topup' but NO payments record
 *      — this is Gap 2 from wallet-topup-audit.md: admin topups bypass the payments table
 *
 * The check passes if all ledger credits are traceable to one of these three sources.
 * Residual delta (credits not traceable) = potential billing leak.
 */
function checkTopupCreditsMatchLedger() {
  console.log('\n── Check 2: Paid topups + credit grants + admin direct topups vs ledger credits ──');

  const paidTopups = db.prepare(`
    SELECT COALESCE(SUM(amount_halala), 0) AS total
    FROM payments WHERE status = 'paid'
  `).get().total;

  const creditGrants = db.prepare(`
    SELECT COALESCE(SUM(amount_halala), 0) AS total
    FROM credit_grants
  `).get().total;

  // Admin direct topups: ledger entries with source='topup' but no payment_ref
  // These are from POST /api/renters/:id/topup (admin route) that bypasses payments table.
  // We track them as a SEPARATE source so founder can see the full picture.
  const adminDirectTopups = db.prepare(`
    SELECT COALESCE(SUM(amount_halala), 0) AS total
    FROM renter_credit_ledger
    WHERE direction = 'credit' AND source = 'topup' AND payment_ref IS NULL
  `).get().total;

  // Job refunds go through ledger (source='job_refund') but are also debits in the ledger.
  // Payment refunds (Moyasar refunds) bypass the ledger — direct balance mutation only.
  const paymentRefunds = db.prepare(`
    SELECT COALESCE(SUM(refund_amount_halala), 0) AS total
    FROM payments WHERE status = 'refunded' AND refund_amount_halala IS NOT NULL
  `).get().total;

  const ledgerCredits = db.prepare(`
    SELECT COALESCE(SUM(amount_halala), 0) AS total
    FROM renter_credit_ledger WHERE direction = 'credit'
  `).get().total;

  const expectedCredits = Number(paidTopups) + Number(creditGrants) + Number(adminDirectTopups);
  const actualCredits   = Number(ledgerCredits);
  const delta = actualCredits - expectedCredits;

  info(`Paid topups (Moyasar): ${sar(paidTopups)} SAR`);
  info(`Admin grants:          ${sar(creditGrants)} SAR`);
  info(`Admin direct topups:   ${sar(adminDirectTopups)} SAR (POST /api/renters/:id/topup — bypasses payments table)`);
  info(`Ledger credits total:  ${sar(actualCredits)} SAR`);
  info(`Payment refunds:       ${sar(paymentRefunds)} SAR (direct balance mutation, not in ledger)`);

  if (Number(adminDirectTopups) > 0) {
    warn(`Admin direct topups (${sar(adminDirectTopups)} SAR) bypass payments table — no Moyasar record for these credits`);
    warnings.push({ check: 'admin_direct_topups', total_halala: adminDirectTopups, note: 'Admin topups via /api/renters/:id/topup are not recorded in payments table' });
  }

  if (Math.abs(delta) > 0) {
    fail('Topup/grant credits vs ledger', `unexplained delta=${sar(delta)} SAR`);
    discrepancies.push({ check: 'topup_credits_vs_ledger', delta_halala: delta, note: 'Credits in ledger not traceable to payments, grants, or admin topups' });
    return false;
  } else {
    pass('All ledger credits are traceable to payments, grants, or admin topups');
    return true;
  }
}

/**
 * Check 3: Global balance invariant across all renters.
 *
 *   sum(balances) + sum(job_debits) - sum(job_refunds) + sum(payment_refunds)
 *   = sum(paid_payments) + sum(credit_grants)
 */
function checkGlobalBalanceInvariant() {
  console.log('\n── Check 3: Global balance invariant ──');

  const totalBalances = db.prepare(`
    SELECT COALESCE(SUM(balance_halala), 0) AS total FROM renters WHERE status != 'deleted'
  `).get().total;

  const totalSpent = db.prepare(`
    SELECT COALESCE(SUM(total_spent_halala), 0) AS total FROM renters WHERE status != 'deleted'
  `).get().total;

  const paidPayments = db.prepare(`
    SELECT COALESCE(SUM(amount_halala), 0) AS total FROM payments WHERE status = 'paid'
  `).get().total;

  const creditGrants = db.prepare(`
    SELECT COALESCE(SUM(amount_halala), 0) AS total FROM credit_grants
  `).get().total;

  // Admin direct topups: credits via POST /api/renters/:id/topup (no payments record)
  const adminDirectTopups = db.prepare(`
    SELECT COALESCE(SUM(amount_halala), 0) AS total
    FROM renter_credit_ledger
    WHERE direction = 'credit' AND source = 'topup' AND payment_ref IS NULL
  `).get().total;

  const paymentRefunds = db.prepare(`
    SELECT COALESCE(SUM(refund_amount_halala), 0) AS total
    FROM payments WHERE status = 'refunded' AND refund_amount_halala IS NOT NULL
  `).get().total;

  // sum(balances) + sum(spent) + sum(refunds_out) = sum(paid_payments) + sum(grants) + sum(admin_direct_topups)
  const lhs = Number(totalBalances) + Number(totalSpent) + Number(paymentRefunds);
  const rhs = Number(paidPayments) + Number(creditGrants) + Number(adminDirectTopups);
  const delta = lhs - rhs;

  info(`Total renter balances:    ${sar(totalBalances)} SAR`);
  info(`Total spent (debited):    ${sar(totalSpent)} SAR`);
  info(`Payment refunds issued:   ${sar(paymentRefunds)} SAR`);
  info(`LHS (bal+spent+refunds):  ${sar(lhs)} SAR`);
  info(`Paid payments (Moyasar):  ${sar(paidPayments)} SAR`);
  info(`Admin credit grants:      ${sar(creditGrants)} SAR`);
  info(`Admin direct topups:      ${sar(adminDirectTopups)} SAR`);
  info(`RHS (paid+grants+admin):  ${sar(rhs)} SAR`);
  info(`Delta:                    ${sar(delta)} SAR`);

  if (Math.abs(delta) > 0) {
    fail('Global invariant violated', `delta=${sar(delta)} SAR — potential billing leak`);
    discrepancies.push({ check: 'global_balance_invariant', delta_halala: delta });
    return false;
  } else {
    pass('Global balance invariant holds');
    return true;
  }
}

/**
 * Check 4: Provider earnings integrity.
 *
 * sum(claimable_earnings_halala) across active providers
 * ≈ sum(provider_earned_halala from completed jobs) - sum(paid withdrawal_requests)
 *
 * Note: "≈" because legacy providers use total_earnings (SAR float) not the
 * claimable_earnings_halala column (set to NULL for pre-DCP-32 providers).
 */
function checkProviderEarningsIntegrity() {
  console.log('\n── Check 4: Provider earnings integrity ──');

  const providerEarnings = db.prepare(`
    SELECT
      COUNT(*) AS provider_count,
      COALESCE(SUM(claimable_earnings_halala), 0) AS total_claimable,
      COUNT(CASE WHEN claimable_earnings_halala IS NULL THEN 1 END) AS legacy_provider_count
    FROM providers WHERE status = 'active'
  `).get();

  const jobEarnings = db.prepare(`
    SELECT COALESCE(SUM(provider_earned_halala), 0) AS total
    FROM jobs
    WHERE status = 'completed' AND provider_earned_halala IS NOT NULL
  `).get().total;

  const paidWithdrawals = db.prepare(`
    SELECT COALESCE(SUM(amount_halala), 0) AS total
    FROM withdrawal_requests WHERE status = 'paid'
  `).get().total;

  const pendingWithdrawals = db.prepare(`
    SELECT COALESCE(SUM(amount_halala), 0) AS total
    FROM withdrawal_requests WHERE status IN ('pending', 'processing')
  `).get().total;

  info(`Active providers:          ${providerEarnings.provider_count}`);
  info(`Legacy providers (no halala ledger): ${providerEarnings.legacy_provider_count}`);
  info(`Total claimable halala:    ${sar(providerEarnings.total_claimable)} SAR`);
  info(`Earned from jobs:          ${sar(jobEarnings)} SAR`);
  info(`Paid withdrawals:          ${sar(paidWithdrawals)} SAR`);
  info(`Pending withdrawals:       ${sar(pendingWithdrawals)} SAR`);

  if (providerEarnings.legacy_provider_count > 0) {
    warn(
      `${providerEarnings.legacy_provider_count} provider(s) use legacy SAR total_earnings — ` +
      'claimable_earnings_halala check skipped for those providers'
    );
    warnings.push({ check: 'provider_earnings', note: `${providerEarnings.legacy_provider_count} legacy providers` });
  }

  // For providers with claimable_earnings_halala set:
  // expected = job_earnings - paid_withdrawals
  const expectedClaimable = Number(jobEarnings) - Number(paidWithdrawals);
  const actualClaimable   = Number(providerEarnings.total_claimable);
  const delta = actualClaimable - expectedClaimable;

  if (providerEarnings.legacy_provider_count === 0 && Math.abs(delta) > 0) {
    fail('Provider claimable vs job earnings', `delta=${sar(delta)} SAR`);
    discrepancies.push({ check: 'provider_earnings_integrity', delta_halala: delta });
    return false;
  } else if (providerEarnings.legacy_provider_count > 0) {
    warn('Provider earnings check skipped for legacy providers — migrate to claimable_earnings_halala');
    return true; // Not a hard failure due to legacy data
  } else {
    pass('Provider claimable earnings matches job earnings minus paid withdrawals');
    return true;
  }
}

/**
 * Check 5: Jobs with no renter_id on completed/billed records.
 * These are orphan costs that cannot be attributed to any balance.
 */
function checkOrphanJobs() {
  console.log('\n── Check 5: Orphan job costs ──');

  const orphans = db.prepare(`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(cost_halala), 0) AS total_cost
    FROM jobs
    WHERE renter_id IS NULL
      AND status IN ('completed', 'running')
      AND cost_halala > 0
  `).get();

  if (orphans.cnt > 0) {
    warn(`${orphans.cnt} completed/running jobs with no renter_id`, `total=${sar(orphans.total_cost)} SAR`);
    warnings.push({ check: 'orphan_jobs', count: orphans.cnt, total_halala: orphans.total_cost });
  } else {
    pass('No orphan job costs (all completed/running jobs have renter_id)');
  }

  return true; // Warning only — not a hard failure
}

/**
 * Check 6: Negative balances.
 */
function checkNegativeBalances() {
  console.log('\n── Check 6: Negative renter balances ──');

  const negative = db.prepare(`
    SELECT id, email, balance_halala
    FROM renters
    WHERE balance_halala < 0 AND status != 'deleted'
  `).all();

  if (negative.length > 0) {
    for (const r of negative) {
      fail(`Negative balance: renter #${r.id} (${r.email})`, `balance=${sar(r.balance_halala)} SAR`);
      discrepancies.push({ check: 'negative_balance', renter_id: r.id, email: r.email, balance_halala: r.balance_halala });
    }
    return false;
  } else {
    pass('No negative renter balances');
    return true;
  }
}

// ── Run all checks ────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════');
console.log('  DCP Balance Integrity Check');
console.log(`  DB: ${dbPath}`);
console.log(`  Time: ${new Date().toISOString()}`);
console.log('═══════════════════════════════════════════════════════════');

const results = {
  check1_renter_ledger:     checkRenterLedgerBalance(),
  check2_topup_vs_ledger:   checkTopupCreditsMatchLedger(),
  check3_global_invariant:  checkGlobalBalanceInvariant(),
  check4_provider_earnings: checkProviderEarningsIntegrity(),
  check5_orphan_jobs:       checkOrphanJobs(),
  check6_negative_balances: checkNegativeBalances(),
};

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  SUMMARY');
console.log('═══════════════════════════════════════════════════════════');

const failed = Object.entries(results).filter(([, v]) => !v).map(([k]) => k);

if (discrepancies.length === 0 && failed.length === 0) {
  console.log('\n✅ ALL CHECKS PASSED — no billing leaks detected\n');
} else {
  console.log(`\n❌ ${failed.length} check(s) FAILED | ${discrepancies.length} discrepancy(ies) found\n`);
  for (const d of discrepancies) {
    console.error('  Discrepancy:', JSON.stringify(d));
  }
}

if (warnings.length > 0) {
  console.warn(`\n⚠️  ${warnings.length} warning(s):`);
  for (const w of warnings) {
    console.warn('  Warning:', JSON.stringify(w));
  }
}

if (args.json) {
  process.stdout.write(JSON.stringify({ passed: failed.length === 0, discrepancies, warnings, results }, null, 2) + '\n');
}

process.exit(discrepancies.length > 0 ? 1 : 0);
