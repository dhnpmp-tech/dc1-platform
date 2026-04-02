#!/usr/bin/env node
'use strict';

const db = require('../db');
const { reconcileOpenRouterUsageByRequest } = require('../services/openrouterMeteringReconciliation');

function parseArgs(argv) {
  const args = {
    since: null,
    until: null,
    source: 'v1',
    includeFailed: true,
    json: false,
    limit: 1000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--since') args.since = argv[++i] || null;
    else if (arg === '--until') args.until = argv[++i] || null;
    else if (arg === '--source') args.source = argv[++i] || 'v1';
    else if (arg === '--limit') args.limit = Number(argv[++i] || 1000);
    else if (arg === '--exclude-failed') args.includeFailed = false;
    else if (arg === '--json') args.json = true;
  }

  return args;
}

function printTable(report) {
  process.stdout.write(`# OpenRouter per-request metering reconciliation\n`);
  process.stdout.write(`- source: ${report.source || 'all'}\n`);
  process.stdout.write(`- include_failed: ${String(report.include_failed)}\n`);
  process.stdout.write(`- rows: ${report.count}\n\n`);
  if (!report.entries.length) {
    process.stdout.write('No matching usage rows found.\n');
    return;
  }

  for (const row of report.entries) {
    process.stdout.write(
      [
        `request_id=${row.request_id}`,
        `status=${row.settlement_status}`,
        `model=${row.model}`,
        `tokens=${row.total_tokens}`,
        `rate_halala=${row.token_rate_halala}`,
        `expected_halala=${row.expected_cost_halala}`,
        `persisted_halala=${row.persisted_cost_halala}`,
        `delta_halala=${row.discrepancy_halala}`,
        `rows=${row.row_count}`,
      ].join(' | ') + '\n'
    );
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = reconcileOpenRouterUsageByRequest(db._db || db, {
    since: args.since,
    until: args.until,
    source: args.source,
    includeFailed: args.includeFailed,
    limit: args.limit,
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  printTable(report);
}

try {
  main();
} catch (error) {
  process.stderr.write(`reconcile-openrouter-metering failed: ${error?.message || String(error)}\n`);
  process.exit(1);
}
