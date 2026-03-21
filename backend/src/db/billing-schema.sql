-- DC1 Billing Engine Schema — Gate 0
-- Run against Supabase project: fvvxqp-qqjszv6vweybvjfpc

CREATE TABLE IF NOT EXISTS billing_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
  amount_halala INTEGER NOT NULL CHECK (amount_halala > 0),
  reason TEXT NOT NULL,
  job_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_reservations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  amount_halala INTEGER NOT NULL CHECK (amount_halala > 0),
  job_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('held', 'settled', 'released')) DEFAULT 'held',
  actual_amount_halala INTEGER,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_sessions (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL,
  renter_id UUID NOT NULL REFERENCES users(id),
  provider_id UUID NOT NULL REFERENCES users(id),
  rate_per_hour_halala INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  reservation_id UUID NOT NULL REFERENCES billing_reservations(id),
  reserved_amount_halala INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'closing', 'closed')) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS billing_ticks (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES billing_sessions(id),
  tick_number INTEGER NOT NULL,
  elapsed_minutes INTEGER NOT NULL,
  increment_minutes INTEGER NOT NULL,
  renter_charge_halala INTEGER NOT NULL,
  provider_credit_halala INTEGER NOT NULL,
  dc1_revenue_halala INTEGER NOT NULL,
  proof_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  UNIQUE(session_id, tick_number)
);

CREATE TABLE IF NOT EXISTS billing_receipts (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES billing_sessions(id) UNIQUE,
  job_id UUID NOT NULL,
  total_minutes INTEGER NOT NULL,
  renter_charged_total_halala INTEGER NOT NULL,
  provider_payout_total_halala INTEGER NOT NULL,
  dc1_revenue_total_halala INTEGER NOT NULL,
  receipt_hash TEXT NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_payouts (
  id UUID PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES users(id),
  session_id UUID NOT NULL REFERENCES billing_sessions(id),
  amount_halala INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider_id, session_id)
);

-- ── Atomic Debit RPC (C3 fix: prevents TOCTOU race on concurrent debits) ─────
-- Uses SELECT FOR UPDATE to lock the user's rows before balance check + insert.
-- Called from wallet.ts debit() function via supabase.rpc('debit_wallet_atomic').
CREATE OR REPLACE FUNCTION debit_wallet_atomic(
  p_user_id        UUID,
  p_amount_halala  INTEGER,
  p_reason         TEXT,
  p_job_id         UUID DEFAULT NULL,
  p_idempotency_key UUID DEFAULT gen_random_uuid()
) RETURNS billing_transactions AS $$
DECLARE
  v_total_credits   BIGINT;
  v_total_debits    BIGINT;
  v_total_reserved  BIGINT;
  v_available       BIGINT;
  v_result          billing_transactions;
BEGIN
  -- Idempotency: return existing row if already processed
  SELECT * INTO v_result FROM billing_transactions WHERE id = p_idempotency_key;
  IF FOUND THEN RETURN v_result; END IF;

  -- Lock user's transaction and reservation rows (prevents concurrent double-spend)
  PERFORM 1 FROM billing_transactions WHERE user_id = p_user_id FOR UPDATE;
  PERFORM 1 FROM billing_reservations WHERE user_id = p_user_id AND status = 'held' FOR UPDATE;

  -- Compute available balance atomically
  SELECT COALESCE(SUM(amount_halala), 0) INTO v_total_credits
    FROM billing_transactions WHERE user_id = p_user_id AND type = 'credit';
  SELECT COALESCE(SUM(amount_halala), 0) INTO v_total_debits
    FROM billing_transactions WHERE user_id = p_user_id AND type = 'debit';
  SELECT COALESCE(SUM(amount_halala), 0) INTO v_total_reserved
    FROM billing_reservations WHERE user_id = p_user_id AND status = 'held';

  v_available := (v_total_credits - v_total_debits) - v_total_reserved;

  IF v_available < p_amount_halala THEN
    RAISE EXCEPTION 'Insufficient balance: available % halala, need % halala',
      v_available, p_amount_halala;
  END IF;

  -- Insert debit transaction
  INSERT INTO billing_transactions (id, user_id, type, amount_halala, reason, job_id, created_at)
    VALUES (p_idempotency_key, p_user_id, 'debit', p_amount_halala, p_reason, p_job_id, now())
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_tx_user ON billing_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_tx_job ON billing_transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_billing_res_user ON billing_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_ticks_session ON billing_ticks(session_id);
CREATE INDEX IF NOT EXISTS idx_billing_sessions_job ON billing_sessions(job_id);
