'use strict';
/**
 * jobQueue.js — Job queue with provider matching (DCP-738, DCP-798)
 *
 * Assigns compute jobs to providers using the GPU-aware scoring from jobScheduler.
 * When no provider is immediately available, jobs are queued and retried with
 * exponential backoff for up to MAX_DISPATCH_ATTEMPTS (3) before failing.
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
 *   getQueueSnapshot()               → Array<{ jobId, enqueuedAt, attempts, nextRetryAt, requirements }>
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

// Lazy-load jobEventEmitter (so unit tests can stub/reset it independently)
let _jobEventEmitter;
function getEmitter() {
  if (!_jobEventEmitter) _jobEventEmitter = require('../utils/jobEventEmitter');
  return _jobEventEmitter;
}

// Constants

/** How often the retry loop fires (ms). */
const RETRY_INTERVAL_MS = 30_000;

/** Maximum time a queued job waits for a provider before failing (ms). */
const MAX_WAIT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Maximum dispatch attempts before the job is permanently failed.
 * Attempt 1 is the initial enqueue (immediate).
 * Attempts 2 and 3 are retries with exponential backoff.
 * After attempt 3 the job is failed with 'dispatch_attempts_exhausted'.
 */
const MAX_DISPATCH_ATTEMPTS = 3;

/**
 * Delay before each retry attempt (ms), indexed by (attempt - 1).
 *   Attempt 2 waits BACKOFF_DELAYS_MS[0] = 30 s
 *   Attempt 3 waits BACKOFF_DELAYS_MS[1] = 120 s
 */
const BACKOFF_DELAYS_MS = [30_000, 120_000];

/** Job statuses that the queue may write. */
const STATUS = {
  QUEUED:   'queued',
  PENDING:  'pending',
  FAILED:   'failed',
  RUNNING:  'running',
  DONE:     'completed',
};

/**
 * Provider event to job status transitions.
 * Providers POST events to /api/webhooks/provider/event (DCP-722).
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

// In-memory retry queue

/**
 * Entry shape:
 *   {
 *     jobId:        string,
 *     enqueuedAt:   number (ms)  - when job was first enqueued
 *     attempts:     number       - total dispatch attempts so far (1 = initial)
 *     nextRetryAt:  number (ms)  - earliest wall-clock ms for the next retry
 *     requirements: object,
 *   }
 */
const _retryQueue = new Map(); // jobId to entry

let _retryTimer = null;

// Core logic

/**
 * Try to assign jobId to the best available provider right now.
 */
function tryAssign(jobId, requirements) {
  const {
    min_vram_gb = 0,
    gpu_type = null,
    job_type = 'inference',
    pricing_class = 'standard',
  } = requirements;

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

  db.prepare(
    `UPDATE jobs
        SET provider_id = ?,
            status      = ?,
            updated_at  = ?
      WHERE job_id = ?`
  ).run(match.provider.id, STATUS.PENDING, now, jobId);

  console.info(
    `[jobQueue] assigned job=${jobId} to provider=${match.provider.id} ` +
    `(${match.provider.name}) score=${match.score} ` +
    `gpu=${match.provider.gpu_model || 'unknown'} ` +
    `pricing_class=${pricing_class}`
  );

  try {
    const job = getDb().get(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
    if (job) {
      const emitter = getEmitter();
      emitter.emit(jobId, 'provider_assigned', emitter.buildPayload(job, 'provider_assigned'));
    }
  } catch (emitErr) {
    console.warn(`[jobQueue] SSE emit failed for provider_assigned job=${jobId}:`, emitErr.message);
  }

  return { assigned: true, provider: match.provider, reason: 'assigned' };
}

/**
 * Enqueue a job for immediate assignment, with exponential-backoff retry on failure.
 * Attempt 1 is immediate; up to MAX_DISPATCH_ATTEMPTS total before permanent failure.
 */
async function enqueueJob(jobId, requirements = {}) {
  const result = tryAssign(jobId, requirements);

  if (result.assigned) {
    return { assigned: true, provider: result.provider, queued: false, reason: result.reason };
  }

  const db = getDb();
  const nowIso = new Date().toISOString();
  db.prepare(
    `UPDATE jobs SET status = ?, updated_at = ? WHERE job_id = ?`
  ).run(STATUS.QUEUED, nowIso, jobId);

  const enqueuedAt = Date.now();
  const nextRetryAt = enqueuedAt + BACKOFF_DELAYS_MS[0];

  _retryQueue.set(jobId, {
    jobId,
    enqueuedAt,
    attempts: 1,
    nextRetryAt,
    requirements,
  });

  console.info(
    `[jobQueue] no provider for job=${jobId}; queued ` +
    `(attempt 1/${MAX_DISPATCH_ATTEMPTS}, next retry in ${BACKOFF_DELAYS_MS[0] / 1000}s)`
  );
  return { assigned: false, queued: true, reason: 'queued_for_retry' };
}

/**
 * Process all entries in the retry queue with exponential backoff.
 * Permanently fails a job after MAX_DISPATCH_ATTEMPTS or MAX_WAIT_MS.
 */
function processRetryQueue() {
  const now = Date.now();
  let processed = 0;
  let assigned = 0;
  let expired = 0;
  let skipped = 0;

  for (const [jobId, entry] of _retryQueue) {
    processed++;
    const waitMs = now - entry.enqueuedAt;

    const attemptsExhausted = entry.attempts >= MAX_DISPATCH_ATTEMPTS;
    const waitExceeded = waitMs >= MAX_WAIT_MS;

    if (attemptsExhausted || waitExceeded) {
      _retryQueue.delete(jobId);
      expired++;

      const reason = attemptsExhausted
        ? `dispatch_attempts_exhausted:${entry.attempts}/${MAX_DISPATCH_ATTEMPTS}`
        : `dispatch_timeout:waited_${Math.round(waitMs / 1000)}s`;

      try {
        const db = getDb();
        const ts = new Date().toISOString();
        db.prepare(
          `UPDATE jobs
              SET status     = ?,
                  notes      = ?,
                  updated_at = ?
            WHERE job_id = ?`
        ).run(STATUS.FAILED, reason, ts, jobId);
        console.warn(`[jobQueue] job=${jobId} permanently failed - ${reason}`);
      } catch (err) {
        console.error(`[jobQueue] failed to mark expired job=${jobId}:`, err.message);
      }
      continue;
    }

    if (now < entry.nextRetryAt) {
      skipped++;
      continue;
    }

    entry.attempts++;
    const result = tryAssign(jobId, entry.requirements);

    if (result.assigned) {
      _retryQueue.delete(jobId);
      assigned++;
    } else if (entry.attempts >= MAX_DISPATCH_ATTEMPTS) {
      // All attempts exhausted after this retry — immediately fail
      _retryQueue.delete(jobId);
      expired++;
      const reason = `dispatch_attempts_exhausted:${entry.attempts}/${MAX_DISPATCH_ATTEMPTS}`;
      try {
        const db = getDb();
        const ts = new Date().toISOString();
        db.prepare(
          `UPDATE jobs SET status = ?, notes = ?, updated_at = ? WHERE job_id = ?`
        ).run(STATUS.FAILED, reason, ts, jobId);
        console.warn(`[jobQueue] job=${jobId} permanently failed - ${reason}`);
      } catch (err) {
        console.error(`[jobQueue] failed to mark exhausted job=${jobId}:`, err.message);
      }
    } else {
      const delayIndex = Math.min(entry.attempts - 1, BACKOFF_DELAYS_MS.length - 1);
      entry.nextRetryAt = now + BACKOFF_DELAYS_MS[delayIndex];
      console.info(
        `[jobQueue] retry attempt=${entry.attempts}/${MAX_DISPATCH_ATTEMPTS} job=${jobId} - ` +
        `no provider; next retry in ${BACKOFF_DELAYS_MS[delayIndex] / 1000}s`
      );
    }
  }

  if (processed > 0) {
    console.info(
      `[jobQueue] retry tick: processed=${processed} assigned=${assigned} ` +
      `expired=${expired} skipped=${skipped} remaining=${_retryQueue.size}`
    );
  }

  return { processed, assigned, expired, skipped };
}

/**
 * Start the background retry loop (idempotent).
 */
function startRetryLoop() {
  if (_retryTimer !== null) return;
  _retryTimer = setInterval(processRetryQueue, RETRY_INTERVAL_MS);
  if (_retryTimer.unref) _retryTimer.unref();
  console.info(
    `[jobQueue] retry loop started ` +
    `(interval=${RETRY_INTERVAL_MS}ms, maxAttempts=${MAX_DISPATCH_ATTEMPTS}, maxWait=${MAX_WAIT_MS}ms)`
  );
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
 */
function handleProviderEvent(eventData) {
  const { event, job_id: jobId, provider_id: rawProviderId, payload } = eventData || {};

  if (!event || typeof event !== 'string') {
    return { updated: false, reason: 'missing_event_field' };
  }

  const newStatus = EVENT_STATUS_MAP[event.toLowerCase()] || null;

  if (!newStatus) {
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

    const terminalStatuses = new Set([STATUS.FAILED, STATUS.DONE]);
    if (terminalStatuses.has(job.status) && !terminalStatuses.has(newStatus)) {
      return { updated: false, jobId, reason: `skipped_terminal_downgrade:${job.status}` };
    }

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

    _retryQueue.delete(jobId);

    console.info(`[jobQueue] event=${event} job=${jobId} -> status=${newStatus}`);

    try {
      const emitter = getEmitter();
      const sseEvent = emitter.statusToSseEvent(newStatus);
      if (sseEvent) {
        const updatedJob = db.get(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
        if (updatedJob) {
          emitter.emit(jobId, sseEvent, emitter.buildPayload(updatedJob, sseEvent));
        }
      }
    } catch (emitErr) {
      console.warn(`[jobQueue] SSE emit failed for event=${event} job=${jobId}:`, emitErr.message);
    }

    return { updated: true, jobId, newStatus, reason: 'status_updated' };

  } catch (err) {
    console.error(`[jobQueue] handleProviderEvent error for job=${jobId}:`, err.message);
    return { updated: false, jobId, reason: `error:${err.message}` };
  }
}

/**
 * Return a snapshot of the current retry queue.
 */
function getQueueSnapshot() {
  const now = Date.now();
  return Array.from(_retryQueue.values()).map(entry => ({
    jobId:         entry.jobId,
    enqueuedAt:    entry.enqueuedAt,
    waitMs:        now - entry.enqueuedAt,
    attempts:      entry.attempts,
    nextRetryAt:   entry.nextRetryAt,
    nextRetryInMs: Math.max(0, entry.nextRetryAt - now),
  }));
}

// Exported API

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
  MAX_DISPATCH_ATTEMPTS,
  BACKOFF_DELAYS_MS,

  // Allow tests to reset internal state
  _resetForTests() {
    _retryQueue.clear();
    _db = null;
    _scheduler = null;
    _jobEventEmitter = null;
    if (_retryTimer !== null) {
      clearInterval(_retryTimer);
      _retryTimer = null;
    }
  },
};
