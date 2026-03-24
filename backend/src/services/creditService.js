'use strict';

/**
 * Credit Service — DCP-755
 *
 * Off-chain renter credit ledger: the payment gate before escrow is live.
 * All renters must hold a positive balance before dispatching jobs.
 *
 * Internal unit: halala (1 SAR = 100 halala).
 * USD conversions use the pegged rate SAR/USD = 3.75 (Saudi Central Bank peg).
 *
 * Public API:
 *   getRenterBalance(db, renterId)
 *   addCredits(db, renterId, amountHalala, source, opts)
 *   deductCredits(db, renterId, amountHalala, jobId)
 *   checkBalance(db, renterId, estimatedCostHalala)
 *   getLedger(db, renterId, opts)
 *
 * All functions accept a better-sqlite3 db handle so the service is
 * independently testable without requiring the global singleton.
 */

const crypto = require('crypto');

// Saudi Central Bank USD/SAR peg
const SAR_PER_USD = 3.75;

// 10% buffer enforced before job dispatch (job cannot start if balance < cost * 1.1)
const DISPATCH_BUFFER_PCT = 0.10;

// Valid ledger sources
const VALID_SOURCES = new Set([
  'topup',        // renter-initiated top-up via payment gateway
  'admin_grant',  // manual credit from admin
  'job_debit',    // pre-job balance hold
  'job_refund',   // refund when job fails or is cancelled
  'adjustment',   // manual correction
]);

// ── Helpers ────────────────────────────────────────────────────────────────────

function halalaToSar(halala) {
  return +(halala / 100).toFixed(2);
}

function halalaToUsd(halala) {
  return +(halala / 100 / SAR_PER_USD).toFixed(4);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Return renter balance with SAR and USD conversions.
 *
 * @param {object} db       - better-sqlite3 database handle
 * @param {number} renterId - renter primary key
 * @returns {{ balance_halala, balance_sar, balance_usd, last_topup_at, total_spent_halala, total_spent_sar }}
 */
function getRenterBalance(db, renterId) {
  const renter = db.prepare(
    `SELECT balance_halala, total_spent_halala FROM renters WHERE id = ? AND status != 'deleted'`
  ).get(renterId);

  if (!renter) return null;

  const lastTopup = db.prepare(
    `SELECT created_at FROM renter_credit_ledger
     WHERE renter_id = ? AND direction = 'credit' AND source IN ('topup', 'admin_grant')
     ORDER BY created_at DESC LIMIT 1`
  ).get(renterId);

  const bal = renter.balance_halala || 0;
  const spent = renter.total_spent_halala || 0;

  return {
    balance_halala: bal,
    balance_sar: halalaToSar(bal),
    balance_usd: halalaToUsd(bal),
    last_topup_at: lastTopup ? lastTopup.created_at : null,
    total_spent_halala: spent,
    total_spent_sar: halalaToSar(spent),
    total_spent_usd: halalaToUsd(spent),
  };
}

/**
 * Add credits to a renter's balance and write an immutable ledger entry.
 *
 * @param {object} db           - better-sqlite3 database handle
 * @param {number} renterId     - renter primary key
 * @param {number} amountHalala - positive integer halala to credit
 * @param {string} source       - ledger source tag (see VALID_SOURCES)
 * @param {object} [opts]
 * @param {string} [opts.jobId]       - job ID for job_refund entries
 * @param {string} [opts.paymentRef]  - payment gateway reference
 * @param {string} [opts.note]        - free-text annotation
 * @returns {{ success: true, new_balance_halala, new_balance_sar, new_balance_usd, ledger_id }}
 */
function addCredits(db, renterId, amountHalala, source, opts = {}) {
  if (!Number.isInteger(amountHalala) || amountHalala <= 0) {
    throw new Error('amountHalala must be a positive integer');
  }
  if (!VALID_SOURCES.has(source)) {
    throw new Error(`Invalid source "${source}". Must be one of: ${[...VALID_SOURCES].join(', ')}`);
  }

  const ledgerId = crypto.randomUUID();
  const now = new Date().toISOString();

  const addTxn = db.transaction(() => {
    db.prepare(
      `INSERT INTO renter_credit_ledger
         (id, renter_id, amount_halala, direction, source, job_id, payment_ref, note, created_at)
       VALUES (?, ?, ?, 'credit', ?, ?, ?, ?, ?)`
    ).run(ledgerId, renterId, amountHalala, source, opts.jobId || null, opts.paymentRef || null, opts.note || null, now);

    db.prepare(
      `UPDATE renters SET balance_halala = balance_halala + ?, updated_at = ? WHERE id = ?`
    ).run(amountHalala, now, renterId);

    return db.prepare(`SELECT balance_halala FROM renters WHERE id = ?`).get(renterId);
  });

  const updated = addTxn();
  const newBal = updated.balance_halala;

  return {
    success: true,
    ledger_id: ledgerId,
    new_balance_halala: newBal,
    new_balance_sar: halalaToSar(newBal),
    new_balance_usd: halalaToUsd(newBal),
  };
}

/**
 * Deduct credits from a renter's balance atomically and write a ledger entry.
 * Called by the job dispatcher immediately before a job starts.
 *
 * Enforces: balance must be >= amountHalala before deduction.
 * The 10% dispatch buffer is checked separately in checkBalance(); this
 * function only performs the actual deduction once the guard has passed.
 *
 * @param {object} db           - better-sqlite3 database handle
 * @param {number} renterId     - renter primary key
 * @param {number} amountHalala - positive integer halala to debit
 * @param {string} jobId        - job identifier (required for audit trail)
 * @returns {{ success: true, new_balance_halala } | { success: false, reason, balance_halala }}
 */
function deductCredits(db, renterId, amountHalala, jobId) {
  if (!Number.isInteger(amountHalala) || amountHalala <= 0) {
    throw new Error('amountHalala must be a positive integer');
  }
  if (!jobId) {
    throw new Error('jobId is required for debit ledger entries');
  }

  const ledgerId = crypto.randomUUID();
  const now = new Date().toISOString();

  let result;

  const deductTxn = db.transaction(() => {
    const renter = db.prepare(
      `SELECT balance_halala FROM renters WHERE id = ? AND status != 'deleted'`
    ).get(renterId);

    if (!renter) {
      result = { success: false, reason: 'renter_not_found', balance_halala: 0 };
      return;
    }

    if (renter.balance_halala < amountHalala) {
      result = {
        success: false,
        reason: 'insufficient_balance',
        balance_halala: renter.balance_halala,
        shortfall_halala: amountHalala - renter.balance_halala,
      };
      return;
    }

    db.prepare(
      `INSERT INTO renter_credit_ledger
         (id, renter_id, amount_halala, direction, source, job_id, created_at)
       VALUES (?, ?, ?, 'debit', 'job_debit', ?, ?)`
    ).run(ledgerId, renterId, amountHalala, jobId, now);

    db.prepare(
      `UPDATE renters
         SET balance_halala = balance_halala - ?,
             total_spent_halala = total_spent_halala + ?,
             total_jobs = total_jobs + 1,
             updated_at = ?
       WHERE id = ?`
    ).run(amountHalala, amountHalala, now, renterId);

    const updated = db.prepare(`SELECT balance_halala FROM renters WHERE id = ?`).get(renterId);
    result = {
      success: true,
      ledger_id: ledgerId,
      new_balance_halala: updated.balance_halala,
      new_balance_sar: halalaToSar(updated.balance_halala),
    };
  });

  deductTxn();
  return result;
}

/**
 * Pre-flight balance check with 10% dispatch buffer.
 * Called before job submission; does NOT mutate any state.
 *
 * A job can only start if: balance >= estimatedCostHalala * 1.1
 *
 * @param {object} db                    - better-sqlite3 database handle
 * @param {number} renterId              - renter primary key
 * @param {number} estimatedCostHalala   - estimated job cost in halala
 * @returns {{ allowed, balance_halala, required_halala, shortfall_halala }}
 */
function checkBalance(db, renterId, estimatedCostHalala) {
  const renter = db.prepare(
    `SELECT balance_halala FROM renters WHERE id = ? AND status = 'active'`
  ).get(renterId);

  if (!renter) {
    return { allowed: false, reason: 'renter_not_found', balance_halala: 0, required_halala: estimatedCostHalala };
  }

  // 10% buffer: renter must hold 110% of estimated cost
  const requiredHalala = Math.ceil(estimatedCostHalala * (1 + DISPATCH_BUFFER_PCT));
  const allowed = renter.balance_halala >= requiredHalala;

  return {
    allowed,
    balance_halala: renter.balance_halala,
    balance_sar: halalaToSar(renter.balance_halala),
    required_halala: requiredHalala,
    shortfall_halala: allowed ? 0 : requiredHalala - renter.balance_halala,
    shortfall_sar: allowed ? 0 : halalaToSar(requiredHalala - renter.balance_halala),
  };
}

/**
 * Paginated ledger query for a renter.
 *
 * @param {object} db       - better-sqlite3 database handle
 * @param {number} renterId - renter primary key
 * @param {object} [opts]
 * @param {number} [opts.limit=50]  - max rows
 * @param {number} [opts.offset=0] - pagination offset
 * @param {string} [opts.direction] - 'credit' | 'debit' filter
 * @returns {{ entries, total, limit, offset }}
 */
function getLedger(db, renterId, opts = {}) {
  const limit = Math.min(Number.isInteger(opts.limit) ? opts.limit : 50, 200);
  const offset = Number.isInteger(opts.offset) && opts.offset >= 0 ? opts.offset : 0;

  let dirFilter = '';
  const params = [renterId];
  if (opts.direction === 'credit' || opts.direction === 'debit') {
    dirFilter = `AND direction = ?`;
    params.push(opts.direction);
  }

  const total = db.prepare(
    `SELECT COUNT(*) as n FROM renter_credit_ledger WHERE renter_id = ? ${dirFilter}`
  ).get(...params).n;

  const entries = db.prepare(
    `SELECT id, amount_halala, direction, source, job_id, payment_ref, note, created_at
       FROM renter_credit_ledger
      WHERE renter_id = ? ${dirFilter}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return {
    entries: entries.map(e => ({
      ...e,
      amount_sar: halalaToSar(e.amount_halala),
      amount_usd: halalaToUsd(e.amount_halala),
    })),
    total,
    limit,
    offset,
  };
}

module.exports = { getRenterBalance, addCredits, deductCredits, checkBalance, getLedger, DISPATCH_BUFFER_PCT, SAR_PER_USD };
