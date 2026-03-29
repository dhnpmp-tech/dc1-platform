'use strict';

/**
 * Payout Service — DCP-763
 *
 * Off-chain payout request queue for provider earnings withdrawal.
 * Providers accumulate earnings in claimable_earnings_halala (halala = 1/100 SAR).
 * Payout requests are queued and processed manually by DCP admin via bank transfer.
 *
 * Minimum payout: $50 USD
 * USD/SAR: 3.75 (SAR is pegged to USD)
 *
 * Lifecycle:
 *   requestPayout  → pending    (amount reserved from claimable balance)
 *   markPayoutPaid → paid       (no further balance change — already reserved)
 *   rejectPayout   → rejected   (reserved amount returned to claimable balance)
 */

const crypto = require('crypto');

const MIN_PAYOUT_USD = 50;
const USD_TO_SAR = 3.75;
const HALALA_PER_SAR = 100;

function hasTableColumn(db, tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return how many halala are currently on hold in pending/processing requests.
 */
function pendingHoldsHalala(db, providerId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(amount_halala), 0) AS on_hold
    FROM payout_requests
    WHERE provider_id = ? AND status IN ('pending', 'processing')
  `).get(providerId);
  return row ? Number(row.on_hold) : 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Request a payout.
 *
 * Validates the amount, checks available balance, and creates a payout_requests
 * record. The amount is deducted from claimable_earnings_halala immediately as
 * a hold so the provider cannot double-spend.
 *
 * @param {object} db          - better-sqlite3 db handle (or the dc1 db wrapper)
 * @param {number} providerId
 * @param {number} amountUsd   - requested payout in USD
 * @returns {object} result — on success: { requestId, status, amountUsd, amountSar }
 *                          — on failure: { error: ERROR_CODE, message, ...details }
 */
function requestPayout(db, providerId, amountUsd) {
  if (typeof amountUsd !== 'number' || !isFinite(amountUsd) || amountUsd <= 0) {
    return { error: 'INVALID_AMOUNT', message: 'amount_usd must be a positive number' };
  }

  if (amountUsd < MIN_PAYOUT_USD) {
    return {
      error: 'BELOW_MINIMUM',
      message: `Minimum payout is $${MIN_PAYOUT_USD} USD (${(MIN_PAYOUT_USD * USD_TO_SAR).toFixed(2)} SAR)`,
      minimumUsd: MIN_PAYOUT_USD,
      minimumSar: MIN_PAYOUT_USD * USD_TO_SAR,
    };
  }

  const amountSar = Number((amountUsd * USD_TO_SAR).toFixed(2));
  const amountHalala = Math.round(amountUsd * USD_TO_SAR * HALALA_PER_SAR);

  const provider = db.prepare(
    'SELECT id, claimable_earnings_halala FROM providers WHERE id = ? AND deleted_at IS NULL'
  ).get(providerId);
  if (!provider) {
    return { error: 'PROVIDER_NOT_FOUND', message: 'Provider not found' };
  }

  const claimableHalala = Number(provider.claimable_earnings_halala || 0);
  const onHoldHalala = pendingHoldsHalala(db, providerId);
  const availableHalala = Math.max(0, claimableHalala - onHoldHalala);

  if (amountHalala > availableHalala) {
    return {
      error: 'INSUFFICIENT_BALANCE',
      message: 'Requested amount exceeds available balance',
      availableHalala,
      availableSar: Number((availableHalala / HALALA_PER_SAR).toFixed(2)),
      availableUsd: Number((availableHalala / (HALALA_PER_SAR * USD_TO_SAR)).toFixed(2)),
      requestedHalala: amountHalala,
    };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Reserve amount from claimable balance
  db.prepare(
    'UPDATE providers SET claimable_earnings_halala = claimable_earnings_halala - ? WHERE id = ?'
  ).run(amountHalala, providerId);

  db.prepare(`
    INSERT INTO payout_requests
      (id, provider_id, amount_usd, amount_sar, amount_halala, status, requested_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, providerId, amountUsd, amountSar, amountHalala, now);

  // Email notification hook — log only, no actual email sending yet
  console.log(`[payout] requested provider_id=${providerId} amount_usd=${amountUsd} timestamp=${now}`);

  const row = db.prepare('SELECT * FROM payout_requests WHERE id = ?').get(id);
  return {
    requestId: row.id,
    status: row.status,
    amountUsd: row.amount_usd,
    amountSar: row.amount_sar,
    amountHalala: row.amount_halala,
    requestedAt: row.requested_at,
  };
}

/**
 * Get paginated payout history for a provider.
 *
 * @param {object} db
 * @param {number} providerId
 * @param {object} [opts]
 * @param {number} [opts.limit]   default 20, max 100
 * @param {number} [opts.offset]  default 0
 */
function getPayoutHistory(db, providerId, { limit = 20, offset = 0 } = {}) {
  const safeLimit  = Math.min(Number(limit)  || 20, 100);
  const safeOffset = Math.max(Number(offset) || 0,  0);
  const hasEscrowTxHash = hasTableColumn(db, 'payout_requests', 'escrow_tx_hash');
  const escrowSelectExpr = hasEscrowTxHash ? 'escrow_tx_hash' : 'NULL AS escrow_tx_hash';

  const rows = db.prepare(`
    SELECT id, provider_id, amount_usd, amount_sar, amount_halala,
           status, requested_at, processed_at, payment_ref, ${escrowSelectExpr}
    FROM payout_requests
    WHERE provider_id = ?
    ORDER BY requested_at DESC, rowid DESC
    LIMIT ? OFFSET ?
  `).all(providerId, safeLimit, safeOffset);

  const count = db.prepare(
    'SELECT COUNT(*) AS total FROM payout_requests WHERE provider_id = ?'
  ).get(providerId);

  return {
    payouts: rows,
    pagination: { limit: safeLimit, offset: safeOffset, total: count ? count.total : 0 },
  };
}

/**
 * Get earnings summary: available balance, pending payouts, total paid.
 *
 * @param {object} db
 * @param {number} providerId
 * @returns {object|null} summary or null if provider not found
 */
function getEarningsSummary(db, providerId) {
  const provider = db.prepare(
    'SELECT id, claimable_earnings_halala FROM providers WHERE id = ? AND deleted_at IS NULL'
  ).get(providerId);
  if (!provider) return null;

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status IN ('pending','processing') THEN amount_halala ELSE 0 END), 0) AS pending_halala,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_halala ELSE 0 END), 0)                   AS paid_halala
    FROM payout_requests WHERE provider_id = ?
  `).get(providerId);

  const claimableHalala = Number(provider.claimable_earnings_halala || 0);
  const pendingHalala   = totals ? Number(totals.pending_halala) : 0;
  const paidHalala      = totals ? Number(totals.paid_halala)    : 0;
  // Available = claimable minus currently on hold (not yet processed)
  const availableHalala = Math.max(0, claimableHalala - pendingHalala);

  function toSar(halala) { return Number((halala / HALALA_PER_SAR).toFixed(2)); }
  function toUsd(halala) { return Number((halala / (HALALA_PER_SAR * USD_TO_SAR)).toFixed(2)); }

  return {
    providerId,
    availableHalala,
    availableSar: toSar(availableHalala),
    availableUsd: toUsd(availableHalala),
    pendingHalala,
    pendingSar: toSar(pendingHalala),
    pendingUsd: toUsd(pendingHalala),
    paidHalala,
    paidSar: toSar(paidHalala),
    paidUsd: toUsd(paidHalala),
    minimumPayoutUsd: MIN_PAYOUT_USD,
    minimumPayoutSar: MIN_PAYOUT_USD * USD_TO_SAR,
  };
}

/**
 * Admin: mark a payout request as paid.
 *
 * @param {object} db
 * @param {string} payoutId
 * @param {string} [paymentRef]  - reference ID from bank / transfer system
 * @returns {object} updated row or error object
 */
function markPayoutPaid(db, payoutId, paymentRef = null) {
  const row = db.prepare('SELECT * FROM payout_requests WHERE id = ?').get(payoutId);
  if (!row) return { error: 'NOT_FOUND', message: 'Payout request not found' };
  if (row.status === 'paid')     return { error: 'ALREADY_PAID', message: 'Payout already marked as paid' };
  if (row.status === 'rejected') return { error: 'REJECTED',     message: 'Cannot mark a rejected payout as paid' };

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE payout_requests
    SET status = 'paid', processed_at = ?, payment_ref = ?
    WHERE id = ?
  `).run(now, paymentRef || null, payoutId);

  // Email notification hook — log only, no actual email sending yet
  console.log(`[payout] processed payout_id=${payoutId} provider_id=${row.provider_id} payment_ref=${paymentRef} timestamp=${now}`);

  return db.prepare('SELECT * FROM payout_requests WHERE id = ?').get(payoutId);
}

/**
 * Admin: reject a payout request.
 *
 * Returns the held funds to the provider's claimable balance.
 *
 * @param {object} db
 * @param {string} payoutId
 * @param {string} [reason]
 * @returns {object} updated row or error object
 */
function rejectPayout(db, payoutId, reason = null) {
  const row = db.prepare('SELECT * FROM payout_requests WHERE id = ?').get(payoutId);
  if (!row) return { error: 'NOT_FOUND', message: 'Payout request not found' };
  if (row.status !== 'pending' && row.status !== 'processing') {
    return { error: 'NOT_REJECTABLE', message: `Cannot reject a payout with status '${row.status}'` };
  }

  const now = new Date().toISOString();

  // Return held funds to claimable balance
  db.prepare(
    'UPDATE providers SET claimable_earnings_halala = claimable_earnings_halala + ? WHERE id = ?'
  ).run(row.amount_halala, row.provider_id);

  db.prepare(`
    UPDATE payout_requests
    SET status = 'rejected', processed_at = ?, payment_ref = ?
    WHERE id = ?
  `).run(now, reason ? `REJECTED: ${reason}` : 'REJECTED', payoutId);

  return db.prepare('SELECT * FROM payout_requests WHERE id = ?').get(payoutId);
}

module.exports = {
  requestPayout,
  getPayoutHistory,
  getEarningsSummary,
  markPayoutPaid,
  rejectPayout,
  MIN_PAYOUT_USD,
  USD_TO_SAR,
};
