'use strict';
/**
 * jobEventEmitter.js — Internal event bus for job status SSE streaming (DCP-742)
 *
 * Decouples the SSE endpoint from the provider webhook handler.
 * When a provider fires a webhook event (DCP-722) or the job queue
 * changes job state, the emitter broadcasts to any connected SSE clients.
 *
 * Usage:
 *   const jobEventEmitter = require('../utils/jobEventEmitter');
 *
 *   // Publish a job status change
 *   jobEventEmitter.emit('job-123', 'job_running', {
 *     status: 'running',
 *     provider_id: 42,
 *     elapsed_sec: 5,
 *     tokens_used: null,
 *     cost_usd: 0.004,
 *   });
 *
 *   // Subscribe (in SSE handler)
 *   const listener = (event, data) => { ... };
 *   jobEventEmitter.subscribe('job-123', listener);
 *
 *   // Cleanup (on disconnect)
 *   jobEventEmitter.unsubscribe('job-123', listener);
 */

const EventEmitter = require('events');

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Known SSE event names emitted for job lifecycle transitions.
 * Must match the event names documented in DCP-742.
 */
const JOB_SSE_EVENTS = Object.freeze([
  'job_queued',
  'provider_assigned',
  'job_starting',
  'job_running',
  'job_completed',
  'job_failed',
]);

/**
 * Terminal SSE events — after one of these the stream is closed.
 */
const TERMINAL_SSE_EVENTS = new Set(['job_completed', 'job_failed']);

/**
 * Conversion: 1 SAR = 100 halala; 1 USD = 3.75 SAR (fixed peg).
 * cost_usd = cost_halala / (100 * 3.75)
 */
const HALALA_TO_USD = 1 / (100 * 3.75);

// ── Internal emitter ──────────────────────────────────────────────────────────

/**
 * Per-job EventEmitter map.
 * Each job_id maps to a Node.js EventEmitter instance.
 * Cleaned up automatically once no listeners remain (via 'removeListener').
 */
const _emitters = new Map(); // job_id → EventEmitter

function _getOrCreate(jobId) {
  if (!_emitters.has(jobId)) {
    const ee = new EventEmitter();
    ee.setMaxListeners(100); // Allow many concurrent SSE clients per job
    _emitters.set(jobId, ee);
  }
  return _emitters.get(jobId);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Emit a job status event to all connected SSE clients for this job.
 *
 * @param {string} jobId     - The jobs.job_id value
 * @param {string} eventName - One of JOB_SSE_EVENTS
 * @param {object} data      - { status, provider_id, elapsed_sec, tokens_used, cost_usd }
 */
function emit(jobId, eventName, data) {
  if (!jobId || !eventName) return;
  const ee = _emitters.get(jobId);
  if (!ee) return; // No connected clients — nothing to do
  ee.emit(eventName, data);

  // After a terminal event, clean up the emitter for this job
  if (TERMINAL_SSE_EVENTS.has(eventName)) {
    setImmediate(() => removeJob(jobId));
  }
}

/**
 * Subscribe to job events for one SSE client.
 *
 * The listener is called as: listener(eventName, data)
 * A single wrapper function is registered for each named event.
 *
 * @param {string}   jobId    - The jobs.job_id value
 * @param {Function} listener - Called with (eventName, data) for each event
 * @returns {Function} unsubscribe - Call to remove this listener
 */
function subscribe(jobId, listener) {
  const ee = _getOrCreate(jobId);
  const wrappers = {};

  for (const eventName of JOB_SSE_EVENTS) {
    const wrapper = (data) => listener(eventName, data);
    wrappers[eventName] = wrapper;
    ee.on(eventName, wrapper);
  }

  // Return a cleanup function that removes all wrappers at once
  return function unsubscribe() {
    for (const eventName of JOB_SSE_EVENTS) {
      ee.off(eventName, wrappers[eventName]);
    }
    // If no more listeners remain, drop the emitter to avoid memory leaks
    if (ee.listenerCount(JOB_SSE_EVENTS[0]) === 0) {
      _emitters.delete(jobId);
    }
  };
}

/**
 * Remove all listeners for a job (called after terminal event).
 *
 * @param {string} jobId
 */
function removeJob(jobId) {
  const ee = _emitters.get(jobId);
  if (ee) {
    ee.removeAllListeners();
    _emitters.delete(jobId);
  }
}

/**
 * Convert cost_halala to cost_usd.
 * Returns null if cost is falsy.
 *
 * @param {number|null} costHalala
 * @returns {number|null}
 */
function halalaToCostUsd(costHalala) {
  if (!costHalala && costHalala !== 0) return null;
  return Math.round(costHalala * HALALA_TO_USD * 1e6) / 1e6; // 6 decimal places
}

/**
 * Build a standard SSE data payload from a DB job row.
 *
 * @param {object} job    - Row from jobs table
 * @param {string} event  - SSE event name to emit
 * @returns {object}
 */
function buildPayload(job, event) {
  const startedAt = job.started_at ? new Date(job.started_at) : null;
  const elapsedSec = startedAt ? Math.round((Date.now() - startedAt.getTime()) / 1000) : null;
  const costHalala = job.actual_cost_halala ?? job.cost_halala ?? null;

  return {
    event,
    status: job.status,
    provider_id: job.provider_id ?? null,
    elapsed_sec: elapsedSec,
    tokens_used: job.tokens_used ?? null,
    cost_usd: halalaToCostUsd(costHalala),
  };
}

/**
 * Map a DB job status string to the canonical SSE event name.
 *
 * @param {string} status
 * @returns {string|null}
 */
function statusToSseEvent(status) {
  const map = {
    queued:    'job_queued',
    pending:   'job_queued',
    assigned:  'provider_assigned',
    pulling:   'job_starting',
    starting:  'job_starting',
    running:   'job_running',
    completed: 'job_completed',
    done:      'job_completed',
    failed:    'job_failed',
    timed_out: 'job_failed',
    cancelled: 'job_failed',
    permanently_failed: 'job_failed',
  };
  return map[String(status || '').toLowerCase()] || null;
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  emit,
  subscribe,
  removeJob,
  buildPayload,
  statusToSseEvent,
  halalaToCostUsd,
  JOB_SSE_EVENTS,
  TERMINAL_SSE_EVENTS,

  // For testing: inspect internal state
  _emitters,
  _resetForTests() {
    for (const ee of _emitters.values()) ee.removeAllListeners();
    _emitters.clear();
  },
};
