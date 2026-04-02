'use strict';

function toFiniteInt(value, { min = null, max = null } = {}) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num)) return null;
  if (min != null && num < min) return null;
  if (max != null && num > max) return null;
  return num;
}

function normalizeIso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function reconcileOpenRouterUsageByRequest(db, {
  since = null,
  until = null,
  source = 'v1',
  includeFailed = true,
  limit = 1000,
} = {}) {
  const clauses = ['request_id IS NOT NULL', 'TRIM(request_id) <> \'\''];
  const params = [];

  if (since) {
    const normalized = normalizeIso(since);
    if (!normalized) throw new Error('Invalid `since` timestamp');
    clauses.push('created_at >= ?');
    params.push(normalized);
  }
  if (until) {
    const normalized = normalizeIso(until);
    if (!normalized) throw new Error('Invalid `until` timestamp');
    clauses.push('created_at <= ?');
    params.push(normalized);
  }
  if (source) {
    clauses.push('source = ?');
    params.push(String(source).slice(0, 80));
  }
  if (!includeFailed) clauses.push(`settlement_status != 'failed'`);

  const safeLimit = toFiniteInt(limit, { min: 1, max: 20_000 }) ?? 1000;
  const rows = db.prepare(
    `SELECT
        request_id,
        renter_id,
        provider_id,
        model,
        source,
        settlement_status,
        SUM(prompt_tokens) AS prompt_tokens,
        SUM(completion_tokens) AS completion_tokens,
        SUM(total_tokens) AS total_tokens,
        SUM(cost_halala) AS cost_halala,
        MAX(COALESCE(token_rate_halala, 0)) AS token_rate_halala,
        MIN(created_at) AS first_seen_at,
        MAX(created_at) AS last_seen_at,
        COUNT(*) AS row_count
      FROM openrouter_usage_ledger
      WHERE ${clauses.join(' AND ')}
      GROUP BY request_id, renter_id, provider_id, model, source, settlement_status
      ORDER BY last_seen_at DESC
      LIMIT ?`
  ).all(...params, safeLimit);

  const entries = rows.map((row) => {
    const totalTokens = toFiniteInt(row.total_tokens, { min: 0, max: 1_000_000_000_000 }) ?? 0;
    const tokenRateHalala = toFiniteInt(row.token_rate_halala, { min: 0, max: 100_000_000_000 }) ?? 0;
    const expectedCostHalala = totalTokens * tokenRateHalala;
    const persistedCostHalala = toFiniteInt(row.cost_halala, { min: 0, max: 100_000_000_000_000 }) ?? 0;
    return {
      request_id: row.request_id,
      renter_id: row.renter_id,
      provider_id: row.provider_id,
      model: row.model,
      source: row.source,
      settlement_status: row.settlement_status,
      prompt_tokens: toFiniteInt(row.prompt_tokens, { min: 0, max: 1_000_000_000_000 }) ?? 0,
      completion_tokens: toFiniteInt(row.completion_tokens, { min: 0, max: 1_000_000_000_000 }) ?? 0,
      total_tokens: totalTokens,
      token_rate_halala: tokenRateHalala,
      expected_cost_halala: expectedCostHalala,
      persisted_cost_halala: persistedCostHalala,
      discrepancy_halala: persistedCostHalala - expectedCostHalala,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      row_count: toFiniteInt(row.row_count, { min: 0, max: 1_000_000 }) ?? 0,
    };
  });

  return {
    since: since ? normalizeIso(since) : null,
    until: until ? normalizeIso(until) : null,
    source: source || null,
    include_failed: !!includeFailed,
    count: entries.length,
    entries,
  };
}

module.exports = {
  reconcileOpenRouterUsageByRequest,
};
