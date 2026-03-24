#!/usr/bin/env node
/**
 * weekly-settlement.mjs — DCP-818
 *
 * Provider payout simulation and weekly settlement script.
 *
 * Usage:
 *   node scripts/weekly-settlement.mjs [options]
 *
 * Options:
 *   --week <YYYY-WNN>     ISO week (e.g. 2026-W12). Default: previous complete week.
 *   --since <ISO>         Settlement window start (overrides --week).
 *   --until <ISO>         Settlement window end   (overrides --week).
 *   --execute             Write payout_batch.json and record audit trail (default: dry-run).
 *   --db <path>           Path to SQLite database (default: backend/data/providers.db).
 *   --out <dir>           Directory for output files (default: data/).
 *   --help                Show this message.
 *
 * Outputs (dry-run):
 *   - Human-readable summary printed to stdout
 *   - settlement_report_<date>.json written to --out dir
 *
 * Outputs (--execute):
 *   - settlement_report_<date>.json
 *   - payout_batch.json (founder reviews before authorising payment)
 *   - Appends one line to data/settlement-history.jsonl (immutable audit trail)
 */

import { createRequire }  from 'module';
import { fileURLToPath }  from 'url';
import path               from 'path';
import fs                 from 'fs';
import process            from 'process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Change to backend dir so better-sqlite3 resolves from backend/node_modules
process.chdir(path.join(__dirname, '..', 'backend'));
const require = createRequire(path.join(__dirname, '..', 'backend', 'package.json'));
const Database = require('better-sqlite3');

// ── Constants ──────────────────────────────────────────────────────────────────
const PLATFORM_FEE_PCT = 15; // matches settlementService.js
const REPO_ROOT = path.resolve(__dirname, '..');

// ── CLI parsing ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { week: null, since: null, until: null, execute: false, db: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    if (a === '--execute')            { args.execute = true; continue; }
    if (a === '--week')  { args.week  = argv[++i]; continue; }
    if (a === '--since') { args.since = argv[++i]; continue; }
    if (a === '--until') { args.until = argv[++i]; continue; }
    if (a === '--db')    { args.db    = argv[++i]; continue; }
    if (a === '--out')   { args.out   = argv[++i]; continue; }
    console.error(`Unknown argument: ${a}`);
    process.exit(1);
  }
  return args;
}

function printHelp() {
  console.log(`
DCP Weekly Settlement Script — DCP-818

Usage:
  node scripts/weekly-settlement.mjs [options]

Options:
  --week <YYYY-WNN>   ISO week (e.g. 2026-W12). Default: previous complete week.
  --since <ISO>       Settlement window start (overrides --week).
  --until <ISO>       Settlement window end   (overrides --week).
  --execute           Write payout_batch.json and audit trail (default: dry-run).
  --db <path>         Path to SQLite database.
  --out <dir>         Directory for output files (default: data/).
  --help              Show this message.

Examples:
  # Dry-run for previous week
  node scripts/weekly-settlement.mjs

  # Dry-run for a specific week
  node scripts/weekly-settlement.mjs --week 2026-W12

  # Execute (write payout batch + audit trail)
  node scripts/weekly-settlement.mjs --week 2026-W12 --execute

  # Custom date range
  node scripts/weekly-settlement.mjs --since 2026-03-01 --until 2026-03-07 --execute
`);
}

// ── Date helpers ───────────────────────────────────────────────────────────────

/**
 * Return { since, until } ISO strings for the given ISO week string "YYYY-WNN".
 * Week starts Monday 00:00:00 UTC, ends Sunday 23:59:59.999 UTC.
 */
function isoWeekRange(weekStr) {
  const m = weekStr.match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) throw new Error(`Invalid week format: ${weekStr}. Expected YYYY-WNN.`);
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);

  // Find Jan 4 (always in week 1), get that week's Monday
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // 1=Mon .. 7=Sun
  const week1Mon = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  const since = new Date(week1Mon.getTime() + (week - 1) * 7 * 86400000);
  const until = new Date(since.getTime() + 7 * 86400000 - 1); // Sun 23:59:59.999

  return {
    since: since.toISOString(),
    until: until.toISOString(),
    label: weekStr,
  };
}

/**
 * Return { since, until } for the previous complete calendar week (Mon–Sun UTC).
 */
function previousWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay() || 7; // 1=Mon
  // Monday of current week
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (dayOfWeek - 1) * 86400000);
  // Monday of previous week
  const prevMonday = new Date(thisMonday.getTime() - 7 * 86400000);
  const prevSunday = new Date(thisMonday.getTime() - 1);

  // Derive ISO week label
  const jan4 = new Date(Date.UTC(prevMonday.getUTCFullYear(), 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  const weekNum = Math.round((prevMonday.getTime() - week1Mon.getTime()) / (7 * 86400000)) + 1;
  const label = `${prevMonday.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  return {
    since: prevMonday.toISOString(),
    until: prevSunday.toISOString(),
    label,
  };
}

/**
 * Parse --since/--until shorthand dates (YYYY-MM-DD → full ISO).
 */
function normaliseDate(d, isEnd) {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return isEnd ? `${d}T23:59:59.999Z` : `${d}T00:00:00.000Z`;
  }
  return d; // already ISO
}

// ── Database helpers ───────────────────────────────────────────────────────────

function openDb(dbPath) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found: ${dbPath}\nSet DC1_DB_PATH env var or pass --db <path>.`);
  }
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

/**
 * Ensure job_settlements table exists (creates schema if first run against fresh db).
 * Uses a writable connection for this check only.
 */
function ensureSchema(dbPath) {
  const db = new Database(dbPath, { fileMustExist: true });
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_settlements (
      id                     TEXT PRIMARY KEY,
      job_id                 TEXT NOT NULL UNIQUE,
      provider_id            INTEGER,
      renter_id              INTEGER NOT NULL,
      duration_seconds       INTEGER,
      gpu_rate_per_second    REAL,
      gross_amount_halala    INTEGER NOT NULL,
      platform_fee_halala    INTEGER NOT NULL,
      provider_payout_halala INTEGER NOT NULL,
      status                 TEXT NOT NULL DEFAULT 'completed',
      settled_at             TEXT NOT NULL,
      created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_job_settlements_provider ON job_settlements(provider_id, settled_at DESC);
    CREATE INDEX IF NOT EXISTS idx_job_settlements_renter   ON job_settlements(renter_id,   settled_at DESC);
  `);
  db.close();
}

// ── Core query ─────────────────────────────────────────────────────────────────

/**
 * Return per-provider settlement summary for the given window.
 */
function querySettlements(db, since, until) {
  return db.prepare(`
    SELECT
      js.provider_id,
      p.name             AS provider_name,
      p.email            AS provider_email,
      p.wallet_address   AS wallet_address,
      COUNT(*)           AS job_count,
      COALESCE(SUM(js.duration_seconds), 0)       AS total_duration_seconds,
      COALESCE(SUM(js.gross_amount_halala),    0)  AS gross_halala,
      COALESCE(SUM(js.platform_fee_halala),    0)  AS platform_fee_halala,
      COALESCE(SUM(js.provider_payout_halala), 0)  AS net_payout_halala
    FROM job_settlements js
    LEFT JOIN providers p ON js.provider_id = p.id
    WHERE js.status = 'completed'
      AND js.settled_at >= ?
      AND js.settled_at <= ?
      AND js.provider_id IS NOT NULL
    GROUP BY js.provider_id
    ORDER BY js.provider_id
  `).all(since, until);
}

/**
 * Return aggregate platform totals for the given window.
 */
function queryTotals(db, since, until) {
  return db.prepare(`
    SELECT
      COUNT(*)                                         AS total_jobs,
      COUNT(DISTINCT provider_id)                      AS provider_count,
      COALESCE(SUM(gross_amount_halala),    0)         AS total_gross_halala,
      COALESCE(SUM(platform_fee_halala),    0)         AS total_platform_fee_halala,
      COALESCE(SUM(provider_payout_halala), 0)         AS total_payout_halala
    FROM job_settlements
    WHERE status = 'completed'
      AND settled_at >= ?
      AND settled_at <= ?
      AND provider_id IS NOT NULL
  `).get(since, until);
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

function sar(halala) {
  return `SAR ${(halala / 100).toFixed(2)}`;
}

function fmtDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(2)}h`;
}

function shortId(providerId) {
  return String(providerId).slice(0, 8);
}

// ── Report builders ────────────────────────────────────────────────────────────

function buildReport({ since, until, label, rows, totals, dryRun, generatedAt }) {
  return {
    meta: {
      weekLabel: label,
      since,
      until,
      generatedAt,
      dryRun,
      platformFeePercent: PLATFORM_FEE_PCT,
    },
    summary: {
      totalJobs:             totals.total_jobs,
      providerCount:         totals.provider_count,
      totalGrossHalala:      totals.total_gross_halala,
      totalGrossSar:         Number((totals.total_gross_halala / 100).toFixed(2)),
      platformFeeHalala:     totals.total_platform_fee_halala,
      platformFeeSar:        Number((totals.total_platform_fee_halala / 100).toFixed(2)),
      totalPayoutHalala:     totals.total_payout_halala,
      totalPayoutSar:        Number((totals.total_payout_halala / 100).toFixed(2)),
    },
    providers: rows.map(r => ({
      providerId:       r.provider_id,
      providerName:     r.provider_name || `provider-${r.provider_id}`,
      providerEmail:    r.provider_email || null,
      walletAddress:    r.wallet_address || null,
      jobCount:         r.job_count,
      durationSeconds:  r.total_duration_seconds,
      grossHalala:      r.gross_halala,
      grossSar:         Number((r.gross_halala / 100).toFixed(2)),
      platformFeeHalala: r.platform_fee_halala,
      platformFeeSar:   Number((r.platform_fee_halala / 100).toFixed(2)),
      netPayoutHalala:  r.net_payout_halala,
      netPayoutSar:     Number((r.net_payout_halala / 100).toFixed(2)),
    })),
  };
}

function buildPayoutBatch(report) {
  return report.providers
    .filter(p => p.netPayoutHalala > 0)
    .map(p => ({
      provider_id:     p.providerId,
      provider_name:   p.providerName,
      provider_email:  p.providerEmail,
      wallet_address:  p.walletAddress,
      amount_halala:   p.netPayoutHalala,
      amount_sar:      p.netPayoutSar,
      job_count:       p.jobCount,
    }));
}

// ── Human-readable output ──────────────────────────────────────────────────────

function printSummary(report, dryRun) {
  const { meta, summary, providers } = report;
  const mode = dryRun ? '[DRY RUN — no payments made]' : '[EXECUTE MODE]';

  console.log('\n' + '═'.repeat(66));
  console.log(`  DCP Weekly Settlement Report — ${meta.weekLabel}`);
  console.log(`  ${meta.since.slice(0, 10)} → ${meta.until.slice(0, 10)}   ${mode}`);
  console.log('═'.repeat(66));

  if (providers.length === 0) {
    console.log('\n  No completed settlements found for this period.\n');
  } else {
    console.log('\n  Provider breakdown:\n');
    for (const p of providers) {
      const id = p.providerName || shortId(p.providerId);
      const dur = fmtDuration(p.durationSeconds);
      console.log(`  ${id.padEnd(30)} ${String(p.jobCount).padStart(4)} jobs  ${dur.padStart(8)}  ${sar(p.grossHalala)} gross → ${sar(p.netPayoutHalala)} net`);
      if (p.walletAddress) {
        console.log(`    Wallet: ${p.walletAddress}`);
      } else {
        console.log(`    Wallet: ⚠ not set — cannot batch payout`);
      }
    }
  }

  console.log('\n' + '─'.repeat(66));
  console.log(`  Total jobs        : ${summary.totalJobs}`);
  console.log(`  Active providers  : ${summary.providerCount}`);
  console.log(`  Gross revenue     : ${sar(summary.totalGrossHalala)}`);
  console.log(`  Platform fee (${PLATFORM_FEE_PCT}%): ${sar(summary.platformFeeHalala)}`);
  console.log(`  Total payout batch: ${sar(summary.totalPayoutHalala)}`);
  console.log('═'.repeat(66) + '\n');
}

// ── Audit trail ────────────────────────────────────────────────────────────────

function appendAuditTrail(auditPath, report) {
  const entry = {
    ts:                    report.meta.generatedAt,
    week:                  report.meta.weekLabel,
    since:                 report.meta.since,
    until:                 report.meta.until,
    total_jobs:            report.summary.totalJobs,
    provider_count:        report.summary.providerCount,
    total_gross_halala:    report.summary.totalGrossHalala,
    platform_fee_halala:   report.summary.platformFeeHalala,
    total_payout_halala:   report.summary.totalPayoutHalala,
  };
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.appendFileSync(auditPath, JSON.stringify(entry) + '\n', 'utf8');
  console.log(`  ✔ Audit trail appended: ${auditPath}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  // Resolve database path
  const dbPath = args.db
    || process.env.DC1_DB_PATH
    || path.join(REPO_ROOT, 'backend', 'data', 'providers.db');

  // Resolve output directory
  const outDir = args.out || path.join(REPO_ROOT, 'data');
  fs.mkdirSync(outDir, { recursive: true });

  // Ensure schema exists (safe no-op if tables already present)
  ensureSchema(dbPath);

  // Determine settlement window
  let since, until, label;
  if (args.since || args.until) {
    since = normaliseDate(args.since, false) || new Date(Date.UTC(2020, 0, 1)).toISOString();
    until = normaliseDate(args.until, true)  || new Date().toISOString();
    label = `custom (${since.slice(0, 10)} → ${until.slice(0, 10)})`;
  } else {
    const range = args.week ? isoWeekRange(args.week) : previousWeekRange();
    since = range.since;
    until = range.until;
    label = range.label;
  }

  const dryRun      = !args.execute;
  const generatedAt = new Date().toISOString();
  const dateTag     = generatedAt.slice(0, 10);

  console.log(`\n  Opening database: ${dbPath}`);
  const db = openDb(dbPath);

  // Query
  const rows   = querySettlements(db, since, until);
  const totals = queryTotals(db, since, until);
  db.close();

  // Build report
  const report = buildReport({ since, until, label, rows, totals, dryRun, generatedAt });

  // Print
  printSummary(report, dryRun);

  // Write settlement report JSON
  const reportFile = path.join(outDir, `settlement_report_${dateTag}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
  console.log(`  ✔ Settlement report: ${reportFile}`);

  if (!dryRun) {
    // Write payout batch
    const batch     = buildPayoutBatch(report);
    const batchFile = path.join(outDir, 'payout_batch.json');
    fs.writeFileSync(batchFile, JSON.stringify(batch, null, 2), 'utf8');
    console.log(`  ✔ Payout batch (${batch.length} entries): ${batchFile}`);
    console.log('\n  ⚠  FOUNDER REVIEW REQUIRED before authorising any payment.\n');

    // Append to immutable audit trail
    const auditFile = path.join(outDir, 'settlement-history.jsonl');
    appendAuditTrail(auditFile, report);
  } else {
    console.log(`  ℹ  Dry-run complete. Pass --execute to write payout_batch.json and audit trail.\n`);
  }
}

main().catch(err => {
  console.error('\n  ERROR:', err.message);
  process.exit(1);
});
