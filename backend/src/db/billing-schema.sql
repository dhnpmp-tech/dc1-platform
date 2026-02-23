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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_tx_user ON billing_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_tx_job ON billing_transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_billing_res_user ON billing_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_ticks_session ON billing_ticks(session_id);
CREATE INDEX IF NOT EXISTS idx_billing_sessions_job ON billing_sessions(job_id);
