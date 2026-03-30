'use strict';

const crypto = require('crypto');
const usageLedgerColumnsCache = new WeakMap();

function nowIso() {
  return new Date().toISOString();
}

function toIsoOrDefault(value, fallback) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function toInt(value, { min = null, max = null } = {}) {
  if (value == null || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num)) return null;
  if (min != null && num < min) return null;
  if (max != null && num > max) return null;
  return num;
}

function normalizeText(value, maxLen = 255) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function getUsageLedgerColumns(db) {
  const cached = usageLedgerColumnsCache.get(db);
  if (cached && cached.size > 0) return cached;

  const rows = db.prepare('PRAGMA table_info(openrouter_usage_ledger)').all();
  const cols = new Set((rows || []).map((row) => String(row.name || '')));
  usageLedgerColumnsCache.set(db, cols);
  return cols;
}

function recordOpenRouterUsage(db, {
  renterId,
  providerId = null,
  requestId = null,
  upstreamRequestId = null,
  model,
  source = 'v1',
  promptTokens = 0,
  completionTokens = 0,
  totalTokens = null,
  costHalala,
  currency = 'SAR',
  settlementStatus = 'pending',
}) {
  const cleanRenterId = toInt(renterId, { min: 1 });
  const cleanProviderId = providerId == null ? null : toInt(providerId, { min: 1 });
  const cleanModel = typeof model === 'string' ? model.trim().slice(0, 200) : '';
  const cleanSource = typeof source === 'string' ? source.trim().slice(0, 80) : 'v1';
  const cleanRequestId = normalizeText(requestId, 160);
  const cleanUpstreamRequestId = normalizeText(upstreamRequestId, 160);
  const cleanPrompt = toInt(promptTokens, { min: 0, max: 1_000_000_000 }) ?? 0;
  const cleanCompletion = toInt(completionTokens, { min: 0, max: 1_000_000_000 }) ?? 0;
  const cleanTotal = toInt(totalTokens, { min: 0, max: 1_000_000_000 }) ?? (cleanPrompt + cleanCompletion);
  const cleanCost = toInt(costHalala, { min: 0, max: 100_000_000_000 });
  const cleanSettlementStatus = settlementStatus === 'failed' ? 'failed' : (settlementStatus === 'settled' ? 'settled' : 'pending');

  if (!cleanRenterId) throw new Error('renterId must be a positive integer');
  if (!cleanModel) throw new Error('model is required');
  if (cleanCost == null) throw new Error('costHalala must be an integer >= 0');

  const id = `oru_${crypto.randomUUID()}`;
  const cols = getUsageLedgerColumns(db);
  const payload = {
    id,
    renter_id: cleanRenterId,
    provider_id: cleanProviderId,
    request_id: cleanRequestId,
    upstream_request_id: cleanUpstreamRequestId,
    model: cleanModel,
    source: cleanSource || 'v1',
    prompt_tokens: cleanPrompt,
    completion_tokens: cleanCompletion,
    total_tokens: cleanTotal,
    cost_halala: cleanCost,
    currency: currency || 'SAR',
    settlement_status: cleanSettlementStatus,
    created_at: nowIso(),
  };
  const activeKeys = Object.keys(payload).filter((key) => cols.has(key));
  const insertSql = `INSERT INTO openrouter_usage_ledger (${activeKeys.join(', ')}) VALUES (${activeKeys.map(() => '?').join(', ')})`;
  db.prepare(insertSql).run(...activeKeys.map((key) => payload[key]));

  return db.prepare('SELECT * FROM openrouter_usage_ledger WHERE id = ?').get(id);
}

function computeDryRunSummary(db, {
  periodStart,
  periodEnd,
  expectedTotalHalala = null,
}) {
  const since = toIsoOrDefault(periodStart, new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  const until = toIsoOrDefault(periodEnd, nowIso());

  const usageRows = db.prepare(
    `SELECT id, renter_id, provider_id, cost_halala, model, prompt_tokens, completion_tokens, total_tokens, created_at
       FROM openrouter_usage_ledger
      WHERE settlement_status = 'pending'
        AND created_at >= ?
        AND created_at <= ?
      ORDER BY created_at ASC`
  ).all(since, until);

  const reconciledHalala = usageRows.reduce((sum, row) => sum + Number(row.cost_halala || 0), 0);
  const expectedHalala = toInt(expectedTotalHalala, { min: 0 }) ?? reconciledHalala;
  const discrepancyHalala = expectedHalala - reconciledHalala;

  const byRenter = db.prepare(
    `SELECT renter_id, SUM(cost_halala) AS total_halala, COUNT(*) AS usage_count
       FROM openrouter_usage_ledger
      WHERE settlement_status = 'pending'
        AND created_at >= ?
        AND created_at <= ?
      GROUP BY renter_id
      ORDER BY total_halala DESC`
  ).all(since, until);

  return {
    period_start: since,
    period_end: until,
    usage_count: usageRows.length,
    expected_total_halala: expectedHalala,
    reconciled_halala: reconciledHalala,
    discrepancy_halala: discrepancyHalala,
    expected_total_sar: Number((expectedHalala / 100).toFixed(2)),
    reconciled_sar: Number((reconciledHalala / 100).toFixed(2)),
    discrepancy_sar: Number((discrepancyHalala / 100).toFixed(2)),
    top_renters: byRenter.map((row) => ({
      renter_id: row.renter_id,
      usage_count: Number(row.usage_count || 0),
      total_halala: Number(row.total_halala || 0),
      total_sar: Number((Number(row.total_halala || 0) / 100).toFixed(2)),
    })),
    usage_ids: usageRows.map((row) => row.id),
  };
}

function createAlert(txDb, { settlementId = null, severity = 'warning', code, message }) {
  txDb.prepare(
    `INSERT INTO openrouter_settlement_alerts
      (id, settlement_id, severity, code, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    `oralert_${crypto.randomUUID()}`,
    settlementId,
    severity === 'critical' ? 'critical' : 'warning',
    code,
    message.slice(0, 500),
    nowIso()
  );
}

function executeOpenRouterSettlement(db, {
  periodStart,
  periodEnd,
  mode = 'invoice',
  cadence = 'daily',
  expectedTotalHalala = null,
}) {
  const cleanMode = mode === 'auto_topup' ? 'auto_topup' : 'invoice';
  const cleanCadence = typeof cadence === 'string' ? cadence.slice(0, 24) : 'daily';
  const summary = computeDryRunSummary(db, { periodStart, periodEnd, expectedTotalHalala });
  const usageIds = summary.usage_ids;
  const createdAt = nowIso();

  if (usageIds.length === 0) {
    return {
      settlement: null,
      summary,
      invoice: null,
      topup: null,
      alerts: [],
      message: 'No pending OpenRouter usage records for the selected period',
    };
  }

  const settlementId = `orset_${crypto.randomUUID()}`;
  let invoice = null;
  let topup = null;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO openrouter_settlements
        (id, period_start, period_end, cadence, settlement_mode, expected_total_halala, reconciled_halala, discrepancy_halala, usage_count, currency, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SAR', 'processing', ?)`
    ).run(
      settlementId,
      summary.period_start,
      summary.period_end,
      cleanCadence,
      cleanMode,
      summary.expected_total_halala,
      summary.reconciled_halala,
      summary.discrepancy_halala,
      summary.usage_count,
      createdAt
    );

    const markUsageStmt = db.prepare(
      `UPDATE openrouter_usage_ledger
          SET settlement_status = 'settled',
              settlement_id = ?
        WHERE id = ?
          AND settlement_status = 'pending'`
    );
    const usageFetchStmt = db.prepare(
      'SELECT id, renter_id, provider_id, cost_halala FROM openrouter_usage_ledger WHERE id = ?'
    );
    const itemInsertStmt = db.prepare(
      `INSERT INTO openrouter_settlement_items
        (id, settlement_id, usage_id, renter_id, provider_id, cost_halala, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    for (const usageId of usageIds) {
      const updated = markUsageStmt.run(settlementId, usageId);
      if (!updated.changes) {
        throw new Error(`usage row became unavailable during settlement: ${usageId}`);
      }
      const usage = usageFetchStmt.get(usageId);
      itemInsertStmt.run(
        `oritem_${crypto.randomUUID()}`,
        settlementId,
        usage.id,
        usage.renter_id,
        usage.provider_id || null,
        usage.cost_halala,
        createdAt
      );
    }

    if (cleanMode === 'invoice') {
      const invoiceId = `orinv_${crypto.randomUUID()}`;
      const dueAt = new Date(Date.now() + (7 * 24 * 3600 * 1000)).toISOString();
      db.prepare(
        `INSERT INTO openrouter_settlement_invoices
          (id, settlement_id, amount_halala, currency, due_at, status, created_at)
         VALUES (?, ?, ?, 'SAR', ?, 'issued', ?)`
      ).run(invoiceId, settlementId, summary.reconciled_halala, dueAt, createdAt);
      invoice = db.prepare('SELECT * FROM openrouter_settlement_invoices WHERE id = ?').get(invoiceId);
    } else {
      const topupId = `ortopup_${crypto.randomUUID()}`;
      db.prepare(
        `INSERT INTO openrouter_settlement_topups
          (id, settlement_id, amount_halala, currency, status, created_at)
         VALUES (?, ?, ?, 'SAR', 'queued', ?)`
      ).run(topupId, settlementId, summary.reconciled_halala, createdAt);
      topup = db.prepare('SELECT * FROM openrouter_settlement_topups WHERE id = ?').get(topupId);
    }

    const finalStatus = summary.discrepancy_halala === 0 ? 'completed' : 'partial';
    db.prepare(
      `UPDATE openrouter_settlements
          SET status = ?, completed_at = ?, failure_reason = ?
        WHERE id = ?`
    ).run(
      finalStatus,
      nowIso(),
      summary.discrepancy_halala === 0 ? null : 'Discrepancy between expected and reconciled totals',
      settlementId
    );

    if (summary.discrepancy_halala !== 0) {
      createAlert(db, {
        settlementId,
        severity: 'critical',
        code: 'SETTLEMENT_DISCREPANCY',
        message: `Expected ${summary.expected_total_halala} halala but reconciled ${summary.reconciled_halala} halala`,
      });
    }
  });

  try {
    tx();
  } catch (error) {
    try {
      db.prepare(
        `INSERT OR REPLACE INTO openrouter_settlements
          (id, period_start, period_end, cadence, settlement_mode, expected_total_halala, reconciled_halala, discrepancy_halala, usage_count, currency, status, failure_reason, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SAR', 'failed', ?, ?, ?)`
      ).run(
        settlementId,
        summary.period_start,
        summary.period_end,
        cleanCadence,
        cleanMode,
        summary.expected_total_halala,
        summary.reconciled_halala,
        summary.discrepancy_halala,
        summary.usage_count,
        error.message.slice(0, 500),
        createdAt,
        nowIso()
      );
      createAlert(db, {
        settlementId,
        severity: 'critical',
        code: 'SETTLEMENT_EXECUTION_FAILED',
        message: error.message,
      });
    } catch (_) {}

    return {
      settlement: db.prepare('SELECT * FROM openrouter_settlements WHERE id = ?').get(settlementId),
      summary,
      invoice: null,
      topup: null,
      alerts: db.prepare('SELECT * FROM openrouter_settlement_alerts WHERE settlement_id = ? ORDER BY created_at ASC').all(settlementId),
      error: error.message,
    };
  }

  return {
    settlement: db.prepare('SELECT * FROM openrouter_settlements WHERE id = ?').get(settlementId),
    summary,
    invoice,
    topup,
    alerts: db.prepare('SELECT * FROM openrouter_settlement_alerts WHERE settlement_id = ? ORDER BY created_at ASC').all(settlementId),
  };
}

module.exports = {
  recordOpenRouterUsage,
  computeDryRunSummary,
  executeOpenRouterSettlement,
};
