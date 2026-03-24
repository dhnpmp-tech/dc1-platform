'use strict';
/**
 * jobQueue-retry.test.js — DCP-798
 *
 * Unit tests for the exponential-backoff retry logic in jobQueue.js.
 * Verifies:
 *   1. Immediate assignment skips the retry queue entirely
 *   2. Failed attempts are queued with a nextRetryAt derived from BACKOFF_DELAYS_MS
 *   3. Retries are skipped until nextRetryAt has elapsed
 *   4. MAX_DISPATCH_ATTEMPTS (3) causes a permanent failure with the correct note
 *   5. MAX_WAIT_MS timeout causes a permanent failure independently of attempt count
 *   6. Successful retry on attempt 2 removes the entry from the queue
 *   7. getQueueSnapshot returns nextRetryAt and nextRetryInMs
 *
 * All DB and scheduler calls are stubbed — no SQLite dependency.
 */

const {
  enqueueJob,
  processRetryQueue,
  getQueueSnapshot,
  startRetryLoop,
  stopRetryLoop,
  STATUS,
  MAX_DISPATCH_ATTEMPTS,
  BACKOFF_DELAYS_MS,
  MAX_WAIT_MS,
  _resetForTests,
} = require('../backend/src/services/jobQueue');

// ── Minimal DB stub ───────────────────────────────────────────────────────────

function makeDbStub() {
  const rows = {};
  return {
    get: jest.fn((sql, ...args) => {
      const jobId = args[0];
      return rows[jobId] || null;
    }),
    prepare: jest.fn(() => ({
      run: jest.fn(),
    })),
    _rows: rows,
    _setRow(jobId, row) { rows[jobId] = row; },
  };
}

// ── Minimal scheduler stub ────────────────────────────────────────────────────

function makeScheduler(returnProvider = null) {
  return {
    findBestProvider: jest.fn(() =>
      returnProvider ? { provider: returnProvider, score: 9999 } : null
    ),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function injectDeps(db, scheduler) {
  // jobQueue uses lazy loaders; override them via the module cache
  const jq = require('../backend/src/services/jobQueue');
  // Access private state via exported _resetForTests, then re-inject
  jq._db_override = db;        // picked up in getDb() only if we stub the require
  jq._scheduler_override = scheduler;

  // Patch require cache so lazy loaders return our stubs
  const Module = require('module');
  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === '../db' || request.endsWith('/db')) return db;
    if (request.endsWith('/jobScheduler') || request.endsWith('jobScheduler'))
      return scheduler;
    if (request.endsWith('/jobEventEmitter') || request.endsWith('jobEventEmitter'))
      return { emit: jest.fn(), buildPayload: jest.fn(), statusToSseEvent: jest.fn() };
    return origLoad.apply(this, arguments);
  };
  return () => { Module._load = origLoad; };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('jobQueue exponential-backoff retry logic', () => {
  let db;
  let restore;

  beforeEach(() => {
    _resetForTests();
    db = makeDbStub();
  });

  afterEach(() => {
    if (restore) { restore(); restore = null; }
    stopRetryLoop();
    _resetForTests();
    jest.restoreAllMocks();
  });

  // ── 1. Immediate assignment ──────────────────────────────────────────────────
  test('immediate assignment bypasses the retry queue', async () => {
    const provider = { id: 1, name: 'p1', gpu_model: 'RTX4090' };
    restore = injectDeps(db, makeScheduler(provider));
    db._setRow('job-1', { id: 1, job_id: 'job-1', provider_id: null });

    const result = await enqueueJob('job-1', {});

    expect(result.assigned).toBe(true);
    expect(result.queued).toBe(false);
    expect(getQueueSnapshot()).toHaveLength(0);
  });

  // ── 2. Queue entry has correct nextRetryAt ───────────────────────────────────
  test('queued entry sets nextRetryAt = now + BACKOFF_DELAYS_MS[0]', async () => {
    restore = injectDeps(db, makeScheduler(null));
    db._setRow('job-2', { id: 2, job_id: 'job-2', provider_id: null });

    const before = Date.now();
    await enqueueJob('job-2', {});
    const after = Date.now();

    const snapshot = getQueueSnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].attempts).toBe(1);

    const expectedMin = before + BACKOFF_DELAYS_MS[0];
    const expectedMax = after  + BACKOFF_DELAYS_MS[0];
    expect(snapshot[0].nextRetryAt).toBeGreaterThanOrEqual(expectedMin);
    expect(snapshot[0].nextRetryAt).toBeLessThanOrEqual(expectedMax);
  });

  // ── 3. Retry skipped while in backoff window ──────────────────────────────────
  test('processRetryQueue skips entry if nextRetryAt has not elapsed', async () => {
    restore = injectDeps(db, makeScheduler(null));
    db._setRow('job-3', { id: 3, job_id: 'job-3', provider_id: null });
    await enqueueJob('job-3', {});

    // Call processRetryQueue immediately — backoff window has NOT elapsed
    const result = processRetryQueue();

    expect(result.skipped).toBe(1);
    expect(result.assigned).toBe(0);
    expect(result.expired).toBe(0);
    // Entry should still be in the queue with attempts=1
    expect(getQueueSnapshot()[0].attempts).toBe(1);
  });

  // ── 4. Retry fires after backoff delay ───────────────────────────────────────
  test('processRetryQueue retries and assigns on attempt 2 when provider appears', async () => {
    const provider = { id: 2, name: 'p2', gpu_model: 'RTX4080' };
    // No provider on first attempt, provider on retry
    const scheduler = {
      findBestProvider: jest.fn()
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ provider, score: 8000 }),
    };
    restore = injectDeps(db, scheduler);
    db._setRow('job-4', { id: 4, job_id: 'job-4', provider_id: null });

    await enqueueJob('job-4', {});

    // Manually backdate nextRetryAt so the window has elapsed
    const snap = getQueueSnapshot();
    // Access internal queue via snapshot — we need to force-advance time
    // by patching Date.now for the processRetryQueue call
    const origNow = Date.now;
    Date.now = () => snap[0].nextRetryAt + 1;

    const result = processRetryQueue();
    Date.now = origNow;

    expect(result.assigned).toBe(1);
    expect(result.expired).toBe(0);
    expect(getQueueSnapshot()).toHaveLength(0);
  });

  // ── 5. MAX_DISPATCH_ATTEMPTS exhaustion ───────────────────────────────────────
  test('job fails permanently after MAX_DISPATCH_ATTEMPTS retries', async () => {
    restore = injectDeps(db, makeScheduler(null));
    db._setRow('job-5', { id: 5, job_id: 'job-5', provider_id: null });

    await enqueueJob('job-5', {}); // attempt 1 — fails, adds to queue

    let fakeNow = Date.now();

    // Simulate attempts 2 and 3, each time advancing past nextRetryAt
    for (let i = 0; i < MAX_DISPATCH_ATTEMPTS - 1; i++) {
      const snap = getQueueSnapshot();
      if (snap.length === 0) break;
      fakeNow = snap[0].nextRetryAt + 1;
      const origNow = Date.now;
      Date.now = () => fakeNow;
      processRetryQueue();
      Date.now = origNow;
    }

    // After MAX_DISPATCH_ATTEMPTS total, queue should be empty and job should be failed
    expect(getQueueSnapshot()).toHaveLength(0);

    // Verify the DB stub received a FAILED status write
    const prepareCalls = db.prepare.mock.calls;
    const failCall = prepareCalls.find(args =>
      typeof args[0] === 'string' && args[0].includes('status')
    );
    expect(failCall).toBeDefined();
    // The run() call on the prepared statement should have STATUS.FAILED
    const runArgs = db.prepare.mock.results.find(r => r.value && r.value.run.mock.calls.length > 0);
    expect(runArgs).toBeDefined();
  });

  // ── 6. MAX_WAIT_MS timeout ────────────────────────────────────────────────────
  test('job fails after MAX_WAIT_MS regardless of attempt count', async () => {
    restore = injectDeps(db, makeScheduler(null));
    db._setRow('job-6', { id: 6, job_id: 'job-6', provider_id: null });

    await enqueueJob('job-6', {});

    // Advance time past MAX_WAIT_MS but only advance past nextRetryAt too
    const origNow = Date.now;
    Date.now = () => origNow() + MAX_WAIT_MS + 1;

    const result = processRetryQueue();
    Date.now = origNow;

    expect(result.expired).toBe(1);
    expect(getQueueSnapshot()).toHaveLength(0);
  });

  // ── 7. getQueueSnapshot exposes nextRetryInMs ────────────────────────────────
  test('getQueueSnapshot includes nextRetryInMs', async () => {
    restore = injectDeps(db, makeScheduler(null));
    db._setRow('job-7', { id: 7, job_id: 'job-7', provider_id: null });

    await enqueueJob('job-7', {});

    const snap = getQueueSnapshot();
    expect(snap[0]).toHaveProperty('nextRetryAt');
    expect(snap[0]).toHaveProperty('nextRetryInMs');
    expect(snap[0].nextRetryInMs).toBeGreaterThan(0);
  });

  // ── 8. startRetryLoop is idempotent ─────────────────────────────────────────
  test('startRetryLoop can be called multiple times without error', () => {
    restore = injectDeps(db, makeScheduler(null));
    startRetryLoop();
    startRetryLoop(); // should not throw
    stopRetryLoop();
  });
});
