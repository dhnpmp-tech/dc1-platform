'use strict';

const crypto = require('crypto');

const HALALA_PER_SAR = 100;

function assertIso(value, name) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new Error(`${name} must be a valid ISO timestamp`);
  }
  return date.toISOString();
}

function toSarString(amountHalala) {
  return (Number(amountHalala) / HALALA_PER_SAR).toFixed(2);
}

function buildBatchChecksum(entries, windowStart, windowEnd, currency) {
  const digest = crypto.createHash('sha256');
  for (const entry of entries) {
    digest.update(
      `${entry.provider_id}|${entry.iban}|${entry.amount_halala}|${currency}|${windowStart}|${windowEnd}\n`
    );
  }
  return digest.digest('hex');
}

function buildBatchSignature(checksum, signingKey) {
  if (!signingKey) {
    return { algorithm: 'sha256', value: checksum };
  }
  const value = crypto.createHmac('sha256', signingKey).update(checksum).digest('hex');
  return { algorithm: 'hmac-sha256', value };
}

function resolveSqlDb(db) {
  return db && db._db ? db._db : db;
}

function ensureBatchSourceTables(db) {
  const sqlDb = resolveSqlDb(db);
  sqlDb.exec(`
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
      status                 TEXT NOT NULL CHECK(status IN ('completed','failed','refunded')) DEFAULT 'completed',
      settled_at             TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_job_settlements_provider ON job_settlements(provider_id, settled_at DESC);

    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id TEXT PRIMARY KEY,
      provider_id INTEGER NOT NULL,
      amount_halala INTEGER NOT NULL,
      is_amount_reserved INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','paid','failed')),
      iban TEXT NOT NULL,
      admin_note TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_provider ON withdrawal_requests(provider_id, created_at DESC);
  `);
}

function generateProviderPayoutBatch(db, {
  windowStart,
  windowEnd,
  currency = 'SAR',
  signingKey = process.env.PAYOUT_BATCH_SIGNING_KEY || '',
}) {
  const startIso = assertIso(windowStart, 'windowStart');
  const endIso = assertIso(windowEnd, 'windowEnd');
  if (new Date(startIso).getTime() > new Date(endIso).getTime()) {
    throw new Error('windowStart must be <= windowEnd');
  }
  ensureBatchSourceTables(db);
  const sqlDb = resolveSqlDb(db);

  const sourceRows = sqlDb.prepare(`
    SELECT
      js.provider_id AS provider_id,
      SUM(js.provider_payout_halala) AS payout_halala,
      COUNT(*) AS settled_jobs
    FROM job_settlements js
    WHERE js.status = 'completed'
      AND js.provider_id IS NOT NULL
      AND js.settled_at >= ?
      AND js.settled_at <= ?
    GROUP BY js.provider_id
    ORDER BY js.provider_id ASC
  `).all(startIso, endIso);

  const ibanLookup = sqlDb.prepare(`
    SELECT wr.iban
    FROM withdrawal_requests wr
    WHERE wr.provider_id = ?
      AND wr.iban IS NOT NULL
      AND TRIM(wr.iban) <> ''
    ORDER BY wr.created_at DESC
    LIMIT 1
  `);

  const entries = [];
  const skipped = [];
  let ledgerTotalHalala = 0;
  let coveredTotalHalala = 0;

  for (const row of sourceRows) {
    const payoutHalala = Number(row.payout_halala || 0);
    if (!Number.isFinite(payoutHalala) || payoutHalala <= 0) continue;
    ledgerTotalHalala += payoutHalala;

    const ibanRow = ibanLookup.get(row.provider_id);
    if (!ibanRow || !ibanRow.iban) {
      skipped.push({
        provider_id: row.provider_id,
        amount_halala: payoutHalala,
        reason: 'missing_iban',
      });
      continue;
    }

    coveredTotalHalala += payoutHalala;
    entries.push({
      provider_id: row.provider_id,
      iban: String(ibanRow.iban).trim(),
      amount_halala: payoutHalala,
      amount_sar: toSarString(payoutHalala),
      currency,
      settled_jobs: Number(row.settled_jobs || 0),
    });
  }

  entries.sort((a, b) => a.provider_id - b.provider_id);
  const entriesTotalHalala = entries.reduce((sum, row) => sum + Number(row.amount_halala || 0), 0);

  // Guardrail: exported amounts must exactly match covered ledger totals.
  if (entriesTotalHalala !== coveredTotalHalala) {
    throw new Error(
      `payout batch mismatch: entries=${entriesTotalHalala} covered=${coveredTotalHalala}`
    );
  }

  const checksum = buildBatchChecksum(entries, startIso, endIso, currency);
  const signature = buildBatchSignature(checksum, signingKey);
  const batchId = `payout-${startIso.slice(0, 10)}-${endIso.slice(0, 10)}-${checksum.slice(0, 12)}`;

  return {
    batchId,
    createdAt: new Date().toISOString(),
    settlementWindow: { start: startIso, end: endIso },
    currency,
    totals: {
      ledger_halala: ledgerTotalHalala,
      covered_halala: coveredTotalHalala,
      exported_halala: entriesTotalHalala,
      skipped_halala: skipped.reduce((sum, row) => sum + Number(row.amount_halala || 0), 0),
      exported_sar: toSarString(entriesTotalHalala),
    },
    counts: {
      providers_total: sourceRows.length,
      providers_exported: entries.length,
      providers_skipped: skipped.length,
    },
    checksum,
    signature,
    entries,
    skipped,
  };
}

function toBankCsv(batch) {
  const header = [
    'provider_id',
    'iban',
    'amount_sar',
    'amount_halala',
    'currency',
    'settlement_window_start',
    'settlement_window_end',
    'batch_id',
  ];
  const rows = batch.entries.map((row) => ([
    row.provider_id,
    row.iban,
    row.amount_sar,
    row.amount_halala,
    row.currency,
    batch.settlementWindow.start,
    batch.settlementWindow.end,
    batch.batchId,
  ]));
  return [header, ...rows].map((cells) => cells.join(',')).join('\n') + '\n';
}

module.exports = {
  generateProviderPayoutBatch,
  toBankCsv,
  toSarString,
};
