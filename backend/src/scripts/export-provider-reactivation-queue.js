#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../db');
const {
  generateProviderReactivationQueue,
  toProviderReactivationCsv,
} = require('../services/providerReactivationQueue');

function parseArgs(argv) {
  const args = {
    outDir: null,
    limit: 500,
    includeReady: false,
    format: 'both',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = String(argv[i] || '');
    if (arg === '--out-dir') {
      args.outDir = String(argv[i + 1] || '').trim() || null;
      i += 1;
    } else if (arg === '--limit') {
      const value = Number(argv[i + 1]);
      if (Number.isFinite(value) && value > 0) args.limit = Math.floor(value);
      i += 1;
    } else if (arg === '--include-ready') {
      args.includeReady = true;
    } else if (arg === '--format') {
      const value = String(argv[i + 1] || '').trim().toLowerCase();
      if (['json', 'csv', 'both'].includes(value)) args.format = value;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

function usage() {
  console.log([
    'Usage: node src/scripts/export-provider-reactivation-queue.js [--out-dir <path>] [--limit <n>] [--include-ready] [--format json|csv|both]',
    '',
    'Defaults:',
    '  --out-dir backend/artifacts/provider-reactivation',
    '  --limit 500',
    '  --format both',
    '  inactive providers only unless --include-ready is set',
  ].join('\n'));
}

function dateStamp(now) {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function resolveOutDir(outDirArg) {
  if (outDirArg) return path.resolve(process.cwd(), outDirArg);
  return path.resolve(__dirname, '..', '..', '..', 'backend', 'artifacts', 'provider-reactivation');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }

  const now = new Date();
  const queue = generateProviderReactivationQueue(db, {
    inactiveOnly: !args.includeReady,
    limit: args.limit,
    nowMs: now.getTime(),
  });

  const outDir = resolveOutDir(args.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const stamp = dateStamp(now);
  const basename = `provider-reactivation-queue-${stamp}`;
  const jsonPath = path.join(outDir, `${basename}.json`);
  const csvPath = path.join(outDir, `${basename}.csv`);

  if (args.format === 'json' || args.format === 'both') {
    fs.writeFileSync(jsonPath, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
  }
  if (args.format === 'csv' || args.format === 'both') {
    fs.writeFileSync(csvPath, toProviderReactivationCsv(queue), 'utf8');
  }

  const top10 = (queue.providers || []).slice(0, 10).map((entry) => ({
    queue_position: entry.queue_position,
    provider_id: entry.provider_id,
    name: entry.name,
    email: entry.email,
    priority_score: entry.priority_score,
    blocker_reason_codes: entry.blocker_reason_codes,
    suggested_action: entry.suggested_action,
  }));

  console.log(JSON.stringify({
    generated_at: queue.generated_at,
    total_ranked: queue.total,
    returned: queue.returned,
    inactive_only: !args.includeReady,
    output: {
      json_artifact: (args.format === 'json' || args.format === 'both') ? jsonPath : null,
      csv_artifact: (args.format === 'csv' || args.format === 'both') ? csvPath : null,
    },
    top_10: top10,
  }, null, 2));
}

main();
