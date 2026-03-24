-- Migration 004: Invoice records (DCP-780)
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id      TEXT PRIMARY KEY,
  job_id          TEXT NOT NULL UNIQUE,
  renter_id       INTEGER NOT NULL,
  provider_id     INTEGER,
  amount_usd      REAL NOT NULL,
  sar_equivalent  REAL NOT NULL,
  settlement_hash TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_invoices_renter   ON invoices(renter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_job      ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_provider ON invoices(provider_id, created_at DESC);
