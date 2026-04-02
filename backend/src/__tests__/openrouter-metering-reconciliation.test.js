const Database = require('better-sqlite3');
const { reconcileOpenRouterUsageByRequest } = require('../services/openrouterMeteringReconciliation');

function seed(db, row) {
  db.prepare(
    `INSERT INTO openrouter_usage_ledger
      (id, request_id, renter_id, provider_id, model, source, prompt_tokens, completion_tokens, total_tokens, cost_halala, token_rate_halala, currency, settlement_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.request_id,
    row.renter_id,
    row.provider_id,
    row.model,
    row.source || 'v1',
    row.prompt_tokens,
    row.completion_tokens,
    row.total_tokens,
    row.cost_halala,
    row.token_rate_halala,
    row.currency || 'SAR',
    row.settlement_status || 'pending',
    row.created_at || new Date().toISOString()
  );
}

describe('openrouter metering reconciliation', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE openrouter_usage_ledger (
        id TEXT PRIMARY KEY,
        request_id TEXT,
        renter_id INTEGER NOT NULL,
        provider_id INTEGER,
        model TEXT NOT NULL,
        source TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL,
        completion_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        cost_halala INTEGER NOT NULL,
        token_rate_halala INTEGER,
        currency TEXT NOT NULL DEFAULT 'SAR',
        settlement_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  test('reproduces per-request expected totals and discrepancy', () => {
    seed(db, {
      id: 'oru-1',
      request_id: 'req-1',
      renter_id: 1,
      provider_id: 7,
      model: 'model-a',
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
      token_rate_halala: 2,
      cost_halala: 30,
      settlement_status: 'pending',
    });
    seed(db, {
      id: 'oru-2',
      request_id: 'req-2',
      renter_id: 1,
      provider_id: 8,
      model: 'model-a',
      prompt_tokens: 6,
      completion_tokens: 4,
      total_tokens: 10,
      token_rate_halala: 2,
      cost_halala: 25,
      settlement_status: 'pending',
    });

    const report = reconcileOpenRouterUsageByRequest(db, { source: 'v1' });
    expect(report.count).toBe(2);

    const byRequestId = new Map(report.entries.map((row) => [row.request_id, row]));
    expect(byRequestId.get('req-1')).toMatchObject({
      expected_cost_halala: 30,
      persisted_cost_halala: 30,
      discrepancy_halala: 0,
      total_tokens: 15,
      token_rate_halala: 2,
    });
    expect(byRequestId.get('req-2')).toMatchObject({
      expected_cost_halala: 20,
      persisted_cost_halala: 25,
      discrepancy_halala: 5,
      total_tokens: 10,
      token_rate_halala: 2,
    });
  });

  test('can exclude failed rows from reconciliation output', () => {
    seed(db, {
      id: 'oru-failed',
      request_id: 'req-failed',
      renter_id: 1,
      provider_id: 9,
      model: 'model-f',
      prompt_tokens: 4,
      completion_tokens: 0,
      total_tokens: 4,
      token_rate_halala: 2,
      cost_halala: 8,
      settlement_status: 'failed',
    });
    seed(db, {
      id: 'oru-ok',
      request_id: 'req-ok',
      renter_id: 1,
      provider_id: 9,
      model: 'model-f',
      prompt_tokens: 4,
      completion_tokens: 1,
      total_tokens: 5,
      token_rate_halala: 2,
      cost_halala: 10,
      settlement_status: 'pending',
    });

    const included = reconcileOpenRouterUsageByRequest(db, { source: 'v1', includeFailed: true });
    expect(included.count).toBe(2);

    const excluded = reconcileOpenRouterUsageByRequest(db, { source: 'v1', includeFailed: false });
    expect(excluded.count).toBe(1);
    expect(excluded.entries[0].request_id).toBe('req-ok');
  });
});
