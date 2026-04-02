#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../db');
const { generateProviderPayoutBatch, toBankCsv } = require('../services/payoutBatchService');

function argValue(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

function usageAndExit() {
  console.error(
    'Usage: node src/scripts/generate-provider-payout-batch.js --window-start <ISO> --window-end <ISO> [--out-dir <path>]'
  );
  process.exit(1);
}

const windowStart = argValue('--window-start');
const windowEnd = argValue('--window-end');
const outDirArg = argValue('--out-dir');

if (!windowStart || !windowEnd) usageAndExit();

const outDir = outDirArg
  ? path.resolve(process.cwd(), outDirArg)
  : path.resolve(__dirname, '..', '..', '..', 'docs', 'reports', 'finops', 'payout-batches');

const batch = generateProviderPayoutBatch(db, { windowStart, windowEnd });
const csv = toBankCsv(batch);

fs.mkdirSync(outDir, { recursive: true });
const jsonPath = path.join(outDir, `${batch.batchId}.json`);
const csvPath = path.join(outDir, `${batch.batchId}.csv`);
fs.writeFileSync(jsonPath, JSON.stringify(batch, null, 2) + '\n', 'utf8');
fs.writeFileSync(csvPath, csv, 'utf8');

console.log(JSON.stringify({
  batch_id: batch.batchId,
  entries: batch.counts.providers_exported,
  skipped: batch.counts.providers_skipped,
  exported_halala: batch.totals.exported_halala,
  exported_sar: batch.totals.exported_sar,
  checksum: batch.checksum,
  signature_algorithm: batch.signature.algorithm,
  signature: batch.signature.value,
  json_artifact: jsonPath,
  csv_artifact: csvPath,
}, null, 2));

