-- Migration 001: Job settlements ledger
-- Records the definitive financial outcome of each completed job.
-- Populated by settlementService.js when a job reaches status completed/failed.

CREATE TABLE IF NOT EXISTS job_settlements (
  id            TEXT PRIMARY KEY,          -- UUID
  job_id        TEXT NOT NULL UNIQUE,      -- references jobs.job_id
  provider_id   INTEGER,                  -- references providers.id (NULL for failed w/ no provider)
  renter_id     INTEGER NOT NULL,         -- references renters.id
  duration_seconds     INTEGER,
  gpu_rate_per_second  REAL,             -- halala/second (computed from job type)
  gross_amount_halala  INTEGER NOT NULL, -- total charge to renter
  platform_fee_halala  INTEGER NOT NULL, -- 15% of gross
  provider_payout_halala INTEGER NOT NULL, -- 85% of gross (or 0 on failure)
  status        TEXT NOT NULL CHECK(status IN ('completed', 'failed', 'refunded')) DEFAULT 'completed',
  settled_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_job_settlements_provider ON job_settlements(provider_id, settled_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_settlements_renter   ON job_settlements(renter_id, settled_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_settlements_status   ON job_settlements(status);
