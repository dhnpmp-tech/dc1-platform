'use strict';
/**
 * jobQueue.js — Job queue with provider matching (DCP-738)
 *
 * Assigns compute jobs to providers using the GPU-aware scoring from jobScheduler.
 * When no provider is immediately available, jobs are queued and retried every 30s
 * for up to 10 minutes, after which they fail with status 'failed'.
 *
 * Architecture note:
 *   Providers POLL for work via GET /api/providers/:api_key/jobs — this service
 *   does not push to provider endpoints. Assigning a provider_id + setting status
 *   to 'queued' or 'pending' is enough: the daemon picks it up on its next poll cycle.
 *
 * Exported API:
 *   enqueueJob(jobId, requirements)  → Promise<{ assigned: bool, provider?, reason }>
 *   handleProviderEvent(event)       → { updated: bool, jobId?, newStatus?, reason }
 *   startRetryLoop()                 → void (idempotent)
 *   stopRetryLoop()                  → void
 *   getQueueSnapshot()               → Array<{ jobId, enqueuedAt, attempts, requirements }>
 */

// Lazy-load db to allow pure unit testing
let _db;
function getDb() {
  if (!_db) _db = require('../db');
  return _db;
}

// Lazy-load jobScheduler (so unit tests can inject their own provider list)
let _scheduler;
function getScheduler() {
  if (!_scheduler) _scheduler = require('./jobScheduler');
  return _scheduler;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** How often the retry loop fires (ms). */
const RETRY_INTERVAL_MS = 30_000;

/** Maximum time a queued job waits for a provider before failing (ms). */
const MAX_WAIT_MS = 10 * 60 * 1000; // 10 minutes

/** Job statuses that the queue may write. */
const STATUS = {
  QUEUED:   'queued',
  PENDING:  'pending',
  FAILED:   'failed',
  RUNNING:  'running',
  DONE:     'completed',
};

/**
 * Provider event → job status transitions.
 * Providers POST events to /api/webhooks/provider/event (DCP-722).
 * Keys are event names; values are the resulting job status.
 */
const EVENT_STATUS_MAP = {
  job_started:    STATUS.RUNNING,
  job_running:    STATUS.RUNNING,
  job_done:       STATUS.DONE,
  job_completed:  STATUS.DONE,
  container_exit: STATUS.DONE,
  job_failed:     STATUS.FAILED,
  error_report:   STATUS.FAILED,
};

// ── In-memory retry queue ────────────────────────────────────────────────────

/**
 * Entry shape:
 *   { jobId: string, enqueuedAt: number (ms), attempts: number, requirements: object }
 */
const _retryQueue = new Map(); // jobId → entry

let _retryTimer = null;

// ── Core logic ───────────────────────────────────────────────────────────────

/**
 * Try to assign `jobId` to the best available provider right now.
 *
 * @param {string} jobId
 * @param {object} requirements - { min_vram_gb?, gpu_type?, job_type?, pricing_class? }
 * @returns {{ assigned: boolean, provider?: object, reason: string }}
 */
function tryAssign(jobId, requirements) {
  const {
    min_vram_gb = 0,
    gpu_type = null,
    job_type = 'inference',
    pricing_class = 'standard',
  } = requirements;

  // Use jobScheduler to find the best provider that:
  //   1. Has a recent heartbeat (online/degraded)
  //   2. Has sufficient VRAM
  //   3. Has matching GPU model (or any, if not specified)
  //   4. Scores highest on uptime + price + VRAM headroom
  const scheduler = getScheduler();
  const match = scheduler.findBestProvider(
    { min_vram_gb, gpu_type, pricing_class, priority: 2 },
    10 // globalRateHalala fallback
  );

  if (!match) {
    return { assigned: false, reason: 'no_matching_provider' };
  }

  const db = getDb();
  const now = new Date().toISOString();

  // Confirm provider isn't already running the same job (race-condition guard)
  const existing = db.get(
    `SELECT provider_id FROM jobs WHERE job_id = ?`,
    jobId
  );
  if (existing && existing.provider_id) {
    return { assigned: true, provider: match.provider, reason: 'already_assigned' };
  }

  // Assign provider and set status to 'pending' so daemon picks it up on next poll
  db.prepare(
    `UPDATE jobs
        SET provider_id = ?,
            status      = ?,
            updated_at  = ?
      WHERE job_id = ?`
  ).run(match.provider.id, STATUS.PENDING, now, jobId);

  console.info(
    `[jobQueue] assigned job=${jobId} → provider=${match.provider.id} ` +
    `(${match.provider.name}) score=${match.score} ` +
    `gpu=${match.provider.gpu_model || 'unknown'} ` +
    `pricing_class=${pricing_class}`
  );

  return { assigned: true, provider: match.provider, reason: 'assigned' };
}

/**
 * Enqueue a job for immediate assignment, with automatic retry on failure.
 *
 * Call this immediately after creating a job record in the DB.
 *
 * @param {string} jobId - The jobs.job_id value
 * @param {object} requirements - { min_vram_gb?, gpu_type?, job_type?, pricing_class? }
 * @returns {Promise<{ assigned: boolean, provider?: object, queued: boolean, reason: string }>}
 */
async function enqueueJob(jobId, requirements = {}) {
  // Attempt immediate assignment
  const result = tryAssign(jobId, requirements);

  if (result.assigned) {
    return { assigned: true, provider: result.provider, queued: false, reason: result.reason };
  }

  // No provider available — add to retry queue and mark job 'queued'
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE jobs SET status = ?, updated_at = ? WHERE job_id = ?`
  ).run(STATUS.QUEUED, now, jobId);

  _retryQueue.set(jobId, {
    jobId,
    enqueuedAt: Date.now(),
    attempts: 1,
    requirements,
  });

  console.info(`[jobQueue] no provider for job=${jobId}; queued for retry`);
  return { assigned: false, queued: true, reason: 'queued_for_retry' };
}

/**
 * Process all entries in the retry queue.
 * Called by the retry loop and available for direct invocation in tests.
 *
 * @returns {{ processed: number, assigned: number, expired: number }}
 */
function processRetryQueue() {
  const now = Date.now();
  let processed = 0;
  let assigned = 0;
  let expired = 0;

  for (const [jobId, entry] of _retryQueue) {
    processed++;
    const waitMs = now - entry.enqueuedAt;

    if (waitMs >= MAX_WAIT_MS) {
      // Exceeded maximum wait — fail the job
      _retryQueue.delete(jobId);
      expired++;

      try {
        const db = getDb();
        const ts = new Date().toISOString();
        db.prepare(
          `UPDATE jobs
              SET status     = ?,
                  notes      = 'no provider available after 10 minutes; job timed out',
                  updated_at = ?
            WHERE job_id = ?`
        ).run(STATUS.FAILED, ts, jobId);
        console.warn(`[jobQueue] job=${jobId} expired after ${Math.round(waitMs / 1000)}s — marked failed`);
      } catch (err) {
        console.error(`[jobQueue] failed to mark expired job=${jobId}:`, err.message);
      }
      continue;
    }

    // Re-attempt assignment
    entry.attempts++;
    const result = tryAssign(jobId, entry.requirements);

    if (result.assigned) {
      _retryQueue.delete(jobId);
      assigned++;
    }
  }

  if (processed > 0) {
    console.info(
      `[jobQueue] retry tick: processed=${processed} assigned=${assigned} expired=${expired} remaining=${_retryQueue.size}`
    );
  }

  return { processed, assigned, expired };
}

/**
 * Start the background retry loop (idempotent — safe to call multiple times).
 */
function startRetryLoop() {
  if (_retryTimer !== null) return;
  _retryTimer = setInterval(processRetryQueue, RETRY_INTERVAL_MS);
  // Allow Node.js to exit even if the timer is still running
  if (_retryTimer.unref) _retryTimer.unref();
  console.info(`[jobQueue] retry loop started (interval=${RETRY_INTERVAL_MS}ms, maxWait=${MAX_WAIT_MS}ms)`);
}

/**
 * Stop the background retry loop.
 */
function stopRetryLoop() {
  if (_retryTimer !== null) {
    clearInterval(_retryTimer);
    _retryTimer = null;
    console.info('[jobQueue] retry loop stopped');
  }
}

/**
 * Handle an inbound provider event (from /api/webhooks/provider/event).
 *
 * Updates the job status in the DB based on the event type.
 * Returns a summary of the action taken.
 *
 * @param {{ event: string, job_id?: string, provider_id?: number|string, payload?: object }} eventData
 * @returns {{ updated: boolean, jobId?: string, newStatus?: string, reason: string }}
 */
function handleProviderEvent(eventData) {
  const { event, job_id: jobId, provider_id: rawProviderId, payload } = eventData || {};

  if (!event || typeof event !== 'string') {
    return { updated: false, reason: 'missing_event_field' };
  }

  const newStatus = EVENT_STATUS_MAP[event.toLowerCase()] || null;

  if (!newStatus) {
    // Unknown event — acknowledge but don't mutate job state
    return { updated: false, reason: `unrecognized_event:${event}` };
  }

  if (!jobId || typeof jobId !== 'string') {
    return { updated: false, reason: 'missing_job_id' };
  }

  try {
    const db = getDb();
    const now = new Date().toISOString();

    const job = db.get(`SELECT id, status, provider_id FROM jobs WHERE job_id = ?`, jobId);
    if (!job) {
      return { updated: false, jobId, reason: 'job_not_found' };
    }

    // Avoid downgrading a terminal status
    const terminalStatuses = new Set([STATUS.FAILED, STATUS.DONE]);
    if (terminalStatuses.has(job.status) && !terminalStatuses.has(newStatus)) {
      return { updated: false, jobId, reason: `skipped_terminal_downgrade:${job.status}` };
    }

    // Extract optional fields from payload
    const errorMessage = (payload && typeof payload.error === 'string') ? payload.error : null;
    const completedAt = newStatus === STATUS.DONE ? now : null;
    const startedAt   = newStatus === STATUS.RUNNING ? now : null;

    db.prepare(
      `UPDATE jobs
          SET status       = ?,
              updated_at   = ?,
              ${completedAt ? 'completed_at = ?,' : ''}
              ${startedAt   ? 'started_at   = ?,' : ''}
              notes        = COALESCE(?, notes)
        WHERE job_id = ?`
    ).run(
      ...[
        newStatus,
        now,
        ...(completedAt ? [completedAt] : []),
        ...(startedAt   ? [startedAt]   : []),
        errorMessage,
        jobId,
      ]
    );

    // Remove from retry queue if it was waiting
    _retryQueue.delete(jobId);

    console.info(`[jobQueue] event=${event} job=${jobId} → status=${newStatus}`);
    return { updated: true, jobId, newStatus, reason: 'status_updated' };

  } catch (err) {
    console.error(`[jobQueue] handleProviderEvent error for job=${jobId}:`, err.message);
    return { updated: false, jobId, reason: `error:${err.message}` };
  }
}

/**
 * Return a snapshot of the current retry queue (useful for admin dashboards).
 *
 * @returns {Array<{ jobId: string, enqueuedAt: number, waitMs: number, attempts: number }>}
 */
function getQueueSnapshot() {
  const now = Date.now();
  return Array.from(_retryQueue.values()).map(entry => ({
    jobId:      entry.jobId,
    enqueuedAt: entry.enqueuedAt,
    waitMs:     now - entry.enqueuedAt,
    attempts:   entry.attempts,
  }));
}

// ── Exported API ─────────────────────────────────────────────────────────────

module.exports = {
  enqueueJob,
  handleProviderEvent,
  processRetryQueue,
  startRetryLoop,
  stopRetryLoop,
  getQueueSnapshot,

  // Exported for testing
  tryAssign,
  STATUS,
  EVENT_STATUS_MAP,
  RETRY_INTERVAL_MS,
  MAX_WAIT_MS,

  // Allow tests to reset internal state
  _resetForTests() {
    _retryQueue.clear();
    _db = null;
    _scheduler = null;
    if (_retryTimer !== null) {
      clearInterval(_retryTimer);
      _retryTimer = null;
    }
  },
};
