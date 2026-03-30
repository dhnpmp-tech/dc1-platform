const Database = require('better-sqlite3');
const { buildEvidenceBundle } = require('../services/finopsEvidenceService');

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT UNIQUE,
      renter_id INTEGER,
      provider_id INTEGER,
      model TEXT,
      job_type TEXT,
      status TEXT,
      cost_halala INTEGER,
      duration_minutes INTEGER,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT
    );
    CREATE TABLE billing_records (
      id TEXT PRIMARY KEY,
      job_id TEXT UNIQUE,
      renter_id INTEGER,
      provider_id INTEGER,
      model_id TEXT,
      token_count INTEGER,
      duration_ms INTEGER,
      gross_cost_halala INTEGER,
      platform_fee_halala INTEGER,
      provider_earning_halala INTEGER,
      currency TEXT,
      status TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE renter_credit_ledger (
      id TEXT PRIMARY KEY,
      renter_id INTEGER NOT NULL,
      amount_halala INTEGER NOT NULL,
      direction TEXT NOT NULL,
      source TEXT NOT NULL,
      job_id TEXT,
      payment_ref TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id TEXT UNIQUE,
      moyasar_id TEXT UNIQUE,
      renter_id INTEGER NOT NULL,
      amount_sar REAL NOT NULL,
      amount_halala INTEGER NOT NULL,
      status TEXT,
      source_type TEXT,
      payment_method TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      confirmed_at TEXT,
      refunded_at TEXT
    );
    CREATE TABLE job_settlements (
      id TEXT PRIMARY KEY,
      job_id TEXT UNIQUE,
      provider_id INTEGER,
      renter_id INTEGER,
      duration_seconds INTEGER,
      gpu_rate_per_second REAL,
      gross_amount_halala INTEGER,
      platform_fee_halala INTEGER,
      provider_payout_halala INTEGER,
      status TEXT,
      settled_at TEXT
    );
  `);
  return db;
}

describe('finopsEvidenceService', () => {
  test('builds full evidence chain when payment + ledger + metering are linked', () => {
    const db = createDb();

    db.prepare(`
      INSERT INTO jobs (job_id, renter_id, provider_id, model, job_type, status, cost_halala, duration_minutes, started_at, completed_at, created_at)
      VALUES ('job-001', 10, 20, 'meta-llama/Meta-Llama-3-8B-Instruct', 'llm-inference', 'completed', 720, 8,
              '2026-03-30T08:00:00.000Z', '2026-03-30T08:08:00.000Z', '2026-03-30T08:00:00.000Z')
    `).run();

    db.prepare(`
      INSERT INTO billing_records (id, job_id, renter_id, provider_id, model_id, token_count, duration_ms, gross_cost_halala, platform_fee_halala, provider_earning_halala, currency, status, created_at, updated_at)
      VALUES ('bill-001', 'job-001', 10, 20, 'meta-llama/Meta-Llama-3-8B-Instruct', 2000, 480000, 720, 180, 540, 'SAR', 'released',
              '2026-03-30T08:08:05.000Z', '2026-03-30T08:08:06.000Z')
    `).run();

    db.prepare(`
      INSERT INTO renter_credit_ledger (id, renter_id, amount_halala, direction, source, job_id, payment_ref, created_at)
      VALUES ('led-credit', 10, 2500, 'credit', 'topup', NULL, 'pay-123', '2026-03-30T07:59:00.000Z')
    `).run();
    db.prepare(`
      INSERT INTO renter_credit_ledger (id, renter_id, amount_halala, direction, source, job_id, payment_ref, created_at)
      VALUES ('led-debit', 10, 720, 'debit', 'job_run', 'job-001', NULL, '2026-03-30T08:08:10.000Z')
    `).run();

    db.prepare(`
      INSERT INTO payments (payment_id, moyasar_id, renter_id, amount_sar, amount_halala, status, source_type, payment_method, description, created_at, confirmed_at)
      VALUES ('pay-123', 'moy-123', 10, 25.00, 2500, 'paid', 'creditcard', 'creditcard', 'Top-up', '2026-03-30T07:58:59.000Z', '2026-03-30T07:59:01.000Z')
    `).run();

    const bundle = buildEvidenceBundle(db, { nowIso: '2026-03-30T09:00:00.000Z' });

    expect(bundle.transaction_path.request_id).toBe('job-001');
    expect(bundle.payment_charge_row.charge_id).toBe('pay-123');
    expect(bundle.metering_record.source_table).toBe('billing_records');
    expect(bundle.ledger_postings).toHaveLength(2);
    expect(bundle.missing_linkage_fields).toHaveLength(0);
  });

  test('reports payment linkage gaps when payment row is missing', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO jobs (job_id, renter_id, provider_id, model, job_type, status, cost_halala, duration_minutes, started_at, completed_at, created_at)
      VALUES ('job-002', 11, 22, 'mistralai/Mistral-7B-Instruct-v0.2', 'llm-inference', 'completed', 300, 4,
              '2026-03-30T10:00:00.000Z', '2026-03-30T10:04:00.000Z', '2026-03-30T10:00:00.000Z')
    `).run();
    db.prepare(`
      INSERT INTO renter_credit_ledger (id, renter_id, amount_halala, direction, source, job_id, payment_ref, created_at)
      VALUES ('led-credit-2', 11, 1000, 'credit', 'topup', NULL, NULL, '2026-03-30T09:59:00.000Z')
    `).run();
    db.prepare(`
      INSERT INTO renter_credit_ledger (id, renter_id, amount_halala, direction, source, job_id, payment_ref, created_at)
      VALUES ('led-debit-2', 11, 300, 'debit', 'job_run', 'job-002', NULL, '2026-03-30T10:04:10.000Z')
    `).run();

    const bundle = buildEvidenceBundle(db, { nowIso: '2026-03-30T10:10:00.000Z' });
    const fields = bundle.missing_linkage_fields.map((item) => `${item.table}.${item.field}`);

    expect(bundle.transaction_path.request_id).toBe('job-002');
    expect(bundle.payment_charge_row).toBeNull();
    expect(fields).toContain('renter_credit_ledger.payment_ref');
    expect(fields).toContain('payments.payment_id/moyasar_id');
  });
});
