'use strict';
/**
 * jobDispatchService.js — End-to-end job dispatch with credit hold (DCP-758)
 *
 * Wires together:
 *   1. Credit validation & hold (credit_holds table)
 *   2. Provider matching & queue (jobQueue)
 *   3. SSE event emission (job.dispatched)
 *   4. Settlement or release on job completion / failure
 *
 * Exported API:
 *   dispatch(renterId, jobId, estimatedCostHalala, requirements)
 *     → Promise<{ assigned: bool, queued: bool, provider?: object, holdId: string }>
 *
 *   completeJob(jobId, actualCostHalala)
 *     → Promise<{ settled: bool, actualCostHalala: number }>
 *
 *   failJob(jobId)
 *     → Promise<{ released: bool }>
 *
 *   getHold(jobId)
 *     → object|undefined  (the credit_holds row)
 */

const crypto = require('crypto');

// Lazy-load to keep unit tests injectable
let _db;
function getDb() {
  if (!_db) {
    _db = require('../db');
    // Self-contained schema init: create credit_holds if it doesn't exist.
    // This keeps the service self-contained without relying on db.js ordering.
    try {
      _db.prepare(`
        CREATE TABLE IF NOT EXISTS credit_holds (
          id TEXT PRIMARY KEY,
          renter_id INTEGER NOT NULL,
          job_id TEXT NOT NULL UNIQUE,
          amount_halala INTEGER NOT NULL,
          status TEXT DEFAULT 'held' CHECK(status IN ('held','settled','released')),
          actual_amount_halala INTEGER,
          created_at TEXT NOT NULL,
          resolved_at TEXT
        )
      `).run();
      _db.prepare(
        'CREATE INDEX IF NOT EXISTS idx_credit_holds_job_id ON credit_holds(job_id)'
      ).run();
      _db.prepare(
        'CREATE INDEX IF NOT EXISTS idx_credit_holds_renter ON credit_holds(renter_id, status)'
      ).run();
    } catch (err) {
      // Table may already exist — not an error
      if (!err.message.includes('already exists')) {
        console.warn('[jobDispatchService] schema init warning:', err.message);
      }
    }
  }
  return _db;
}

let _queue;
function getQueue() {
  if (!_queue) _queue = require('./jobQueue');
  return _queue;
}

let _emitter;
function getEmitter() {
  if (!_emitter) _emitter = require('../utils/jobEventEmitter');
  return _emitter;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

/**
 * Compute available balance for a renter:
 *   available = balance_halala − SUM(held credit_holds)
 *
 * Uses a read-within-the-same-connection so concurrent requests see consistent
 * values in the synchronous SQLite layer.
 */
function getAvailableBalance(db, renterId) {
  const renter = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterId);
  if (!renter) throw new Error(`Renter ${renterId} not found`);

  const held = db.get(
    `SELECT COALESCE(SUM(amount_halala), 0) AS total
     FROM credit_holds
     WHERE renter_id = ? AND status = 'held'`,
    renterId
  );

  return {
    balance: renter.balance_halala,
    reserved: Number(held.total),
    available: renter.balance_halala - Number(held.total),
  };
}

// ── Core API ─────────────────────────────────────────────────────────────────

/**
 * Dispatch a job end-to-end:
 *   1. Validate renter has sufficient available credits
 *   2. Place a credit hold for the estimated cost
 *   3. Route job to best matching provider via jobQueue
 *   4. Emit job.dispatched SSE event
 *   5. If no provider is available, job is queued for retry (every 30 s, up to 10 min)
 *
 * @param {number}  renterId             - renters.id
 * @param {string}  jobId                - jobs.job_id (must already exist in DB)
 * @param {number}  estimatedCostHalala  - worst-case cost to hold
 * @param {object}  requirements         - { min_vram_gb?, gpu_type?, job_type?, pricing_class? }
 * @returns {Promise<{ assigned: boolean, queued: boolean, provider?: object, holdId: string }>}
 */
async function dispatch(renterId, jobId, estimatedCostHalala, requirements = {}) {
  const db = getDb();

  // ── 1. Credit check ───────────────────────────────────────────────────────
  const balance = getAvailableBalance(db, renterId);
  if (balance.available < estimatedCostHalala) {
    throw Object.assign(
      new Error('Insufficient credits'),
      {
        code: 'INSUFFICIENT_CREDITS',
        available: balance.available,
        required: estimatedCostHalala,
        shortfall: estimatedCostHalala - balance.available,
      }
    );
  }

  // ── 2. Place credit hold ──────────────────────────────────────────────────
  // Idempotent: if a hold already exists for this job, reuse it.
  const existingHold = db.get(
    `SELECT * FROM credit_holds WHERE job_id = ? AND status = 'held'`,
    jobId
  );

  let holdId;
  if (existingHold) {
    holdId = existingHold.id;
  } else {
    holdId = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO credit_holds (id, renter_id, job_id, amount_halala, status, created_at)
       VALUES (?, ?, ?, ?, 'held', ?)`
    ).run(holdId, renterId, jobId, estimatedCostHalala, now);
  }

  // ── 3. Provider matching & queue ──────────────────────────────────────────
  const queueResult = await getQueue().enqueueJob(jobId, requirements);

  // ── 4. Emit SSE event ─────────────────────────────────────────────────────
  try {
    const job = db.get('SELECT * FROM jobs WHERE job_id = ?', jobId);
    if (job) {
      const emitter = getEmitter();
      const eventName = queueResult.assigned ? 'provider_assigned' : 'job_queued';
      emitter.emit(jobId, eventName, emitter.buildPayload(job, eventName));
    }
  } catch (emitErr) {
    // SSE failure must never block dispatch
    console.warn(`[jobDispatch] SSE emit failed for job=${jobId}:`, emitErr.message);
  }

  return {
    assigned: queueResult.assigned,
    queued: queueResult.queued,
    provider: queueResult.provider ?? null,
    holdId,
  };
}

/**
 * Settle a credit hold on job completion.
 * Deducts the actual (not estimated) cost from the renter's balance and
 * releases any over-reserved amount.
 *
 * @param {string} jobId
 * @param {number} actualCostHalala  - The real cost charged (≤ estimated hold amount)
 * @returns {Promise<{ settled: boolean, actualCostHalala: number, refundedHalala: number }>}
 */
async function completeJob(jobId, actualCostHalala) {
  const db = getDb();
  const hold = db.get(
    `SELECT * FROM credit_holds WHERE job_id = ? AND status = 'held'`,
    jobId
  );

  if (!hold) {
    // No hold — job may have been submitted via legacy /submit endpoint; no-op
    return { settled: false, actualCostHalala, refundedHalala: 0 };
  }

  const cost = Math.max(0, actualCostHalala);
  const refundedHalala = Math.max(0, hold.amount_halala - cost);
  const now = new Date().toISOString();

  // Debit actual cost from renter balance (hold only reserved — never deducted)
  if (cost > 0) {
    db.prepare(
      `UPDATE renters
       SET balance_halala = balance_halala - ?,
           updated_at = ?
       WHERE id = ?`
    ).run(cost, now, hold.renter_id);
  }

  // Mark hold settled
  db.prepare(
    `UPDATE credit_holds
     SET status = 'settled',
         actual_amount_halala = ?,
         resolved_at = ?
     WHERE id = ?`
  ).run(cost, now, hold.id);

  console.info(
    `[jobDispatch] settled job=${jobId} ` +
    `cost=${cost} refund=${refundedHalala} renter=${hold.renter_id}`
  );

  return { settled: true, actualCostHalala: cost, refundedHalala };
}

/**
 * Release a credit hold on job failure.
 * The held amount is freed back into the renter's available balance
 * without any deduction — the renter is not charged for failed jobs.
 *
 * @param {string} jobId
 * @returns {Promise<{ released: boolean, releasedHalala: number }>}
 */
async function failJob(jobId) {
  const db = getDb();
  const hold = db.get(
    `SELECT * FROM credit_holds WHERE job_id = ? AND status = 'held'`,
    jobId
  );

  if (!hold) {
    return { released: false, releasedHalala: 0 };
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE credit_holds
     SET status = 'released',
         actual_amount_halala = 0,
         resolved_at = ?
     WHERE id = ?`
  ).run(now, hold.id);

  console.info(
    `[jobDispatch] released hold for failed job=${jobId} ` +
    `freed=${hold.amount_halala} renter=${hold.renter_id}`
  );

  return { released: true, releasedHalala: hold.amount_halala };
}

/**
 * Retrieve the current credit hold record for a job (or undefined if none).
 *
 * @param {string} jobId
 * @returns {object|undefined}
 */
function getHold(jobId) {
  return getDb().get('SELECT * FROM credit_holds WHERE job_id = ?', jobId);
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  dispatch,
  completeJob,
  failJob,
  getHold,
  // Exposed for testing
  getAvailableBalance,
};
