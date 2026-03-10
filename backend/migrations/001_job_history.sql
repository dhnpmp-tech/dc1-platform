-- DC1 Job History Table — wallet-bridge migration
-- Run against Supabase project: rwxqcqgjszvbwcyjfpc.supabase.co
-- Purpose: Receives completed job billing data synced from VPS SQLite → Supabase

-- ── Job History Table ─────────────────────────────────────────────────────────
-- Stores every completed job with full billing breakdown.
-- job_id is the SQLite text key (e.g. "job-1735000000-abc123") — stored as TEXT
-- because it is NOT a UUID; do not cast.

CREATE TABLE IF NOT EXISTS job_history (
  id              BIGSERIAL    PRIMARY KEY,
  job_id          TEXT         UNIQUE NOT NULL,           -- SQLite job_id (text)
  provider_sqlite_id INTEGER,                             -- SQLite providers.id (for tracing)
  provider_user_id   UUID      REFERENCES users(id),     -- Supabase user id (provider)
  renter_user_id     UUID      REFERENCES users(id),     -- Supabase user id (renter, nullable)
  job_type           TEXT,
  status             TEXT      NOT NULL DEFAULT 'completed',
  cost_halala        INTEGER   NOT NULL DEFAULT 0,        -- estimated cost at submit
  actual_cost_halala INTEGER   NOT NULL DEFAULT 0,        -- metered cost at completion
  provider_earned_halala INTEGER NOT NULL DEFAULT 0,      -- 75% of actual_cost_halala
  dc1_fee_halala     INTEGER   NOT NULL DEFAULT 0,        -- 25% of actual_cost_halala
  duration_minutes   INTEGER   NOT NULL DEFAULT 0,        -- estimated duration
  actual_duration_minutes INTEGER NOT NULL DEFAULT 0,     -- metered duration
  submitted_at       TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  wallet_debited     BOOLEAN   NOT NULL DEFAULT FALSE,    -- TRUE once renter debit applied
  provider_credited  BOOLEAN   NOT NULL DEFAULT FALSE,    -- TRUE once provider credit applied
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_history_job_id        ON job_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_history_provider      ON job_history(provider_user_id);
CREATE INDEX IF NOT EXISTS idx_job_history_renter        ON job_history(renter_user_id);
CREATE INDEX IF NOT EXISTS idx_job_history_completed_at  ON job_history(completed_at);
CREATE INDEX IF NOT EXISTS idx_job_history_synced_at     ON job_history(synced_at);

-- ── credit_wallet_atomic RPC ──────────────────────────────────────────────────
-- Idempotent credit for provider earnings (mirrors debit_wallet_atomic pattern).
-- Called from VPS job completion and from sync bridge.

CREATE OR REPLACE FUNCTION credit_wallet_atomic(
  p_user_id          UUID,
  p_amount_halala    INTEGER,
  p_reason           TEXT,
  p_idempotency_key  UUID DEFAULT gen_random_uuid()
) RETURNS billing_transactions AS $$
DECLARE
  v_result billing_transactions;
BEGIN
  -- Idempotency: return existing row if already processed
  SELECT * INTO v_result FROM billing_transactions WHERE id = p_idempotency_key;
  IF FOUND THEN RETURN v_result; END IF;

  INSERT INTO billing_transactions (id, user_id, type, amount_halala, reason, job_id, created_at)
    VALUES (p_idempotency_key, p_user_id, 'credit', p_amount_halala, p_reason, NULL, now())
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
