'use strict';
/**
 * jobQueue-retry.test.js — DCP-798
 *
 * Unit tests for the exponential-backoff retry logic in jobQueue.js.
 * Verifies:
 *   1. Immediate assignment skips the retry queue entirely
 *   2. Failed attempts are queued with nextRetryAt = now + BACKOFF_DELAYS_MS[0]
 *   3. Retries are skipped while inside the backoff window
 *   4. MAX_DISPATCH_ATTEMPTS (3) causes permanent failure
 *   5. MAX_WAIT_MS timeout causes permanent failure
 *   6. Successful retry removes entry from queue
 *   7. getQueueSnapshot exposes nextRetryAt and nextRetryInMs
 *
 * All DB and scheduler calls are stubbed — no SQLite dependency.
 */

const Module = require('module');

// We need to intercept requires BEFORE the first require of jobQueue so the
// lazy loaders see our stubs. Keep a reference to the original _load.
const origLoad = Module._load;

let _dbStub = null;
let _schedulerStub = null;
const _emitterStub = { emit: jest.fn(), buildPayload: jest.fn(), statusToSseEvent: jest.fn(() => null) };

Module._load = function (request, parent, isMain) {
  const base = request.split('/').pop();
  if (base === 'db' && _dbStub) return _dbStub;
  if (base === 'jobScheduler' && _schedulerStub) return _schedulerStub;
  if (base === 'jobEventEmitter') return _emitterStub;
  return origLoad.apply(this, arguments);
};

// Now it is safe to require jobQueue — its lazy loaders will see our stubs.
const jq = require('../backend/src/services/jobQueue');
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
} = jq;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDb() {
  const rows = {};
  const prepared = { run: jest.fn() };
  return {
    get: jest.fn((sql, id) => rows[id] || null),
    prepare: jest.fn(() => prepared),
    _prepared: prepared,
    _setRow(id, row) { rows[id] = row; },
  };
}

function makeScheduler(providerOrNull) {
  return {
    findBestProvider: jest.fn(() =>
      providerOrNull ? { provider: providerOrNull, score: 9000 } : null
    ),
  };
}

function setStubs(db, scheduler) {
  _dbStub = db;
  _schedulerStub = scheduler;
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

afterAll(() => {
  Module._load = origLoad;
});

beforeEach(() => {
  _resetForTests();
  jest.clearAllMocks();
});

afterEach(() => {
  stopRetryLoop();
  _resetForTests();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('jobQueue retry logic', () => {
  test('immediate assignment bypasses retry queue', async () => {
    const provider = { id: 1, name: 'p1', gpu_model: 'RTX4090' };
    const db = makeDb();
    db._setRow('job-1', { id: 1, job_id: 'job-1', provider_id: null });
    setStubs(db, makeScheduler(provider));

    const result = await enqueueJob('job-1', {});

    expect(result.assigned).toBe(true);
    expect(result.queued).toBe(false);
    expect(getQueueSnapshot()).toHaveLength(0);
  });

  test('queued entry has nextRetryAt = now + BACKOFF_DELAYS_MS[0]', async () => {
    const db = makeDb();
    db._setRow('job-2', { id: 2, job_id: 'job-2', provider_id: null });
    setStubs(db, makeScheduler(null));

    const before = Date.now();
    await enqueueJob('job-2', {});
    const after = Date.now();

    const snap = getQueueSnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0].attempts).toBe(1);
    expect(snap[0].nextRetryAt).toBeGreaterThanOrEqual(before + BACKOFF_DELAYS_MS[0]);
    expect(snap[0].nextRetryAt).toBeLessThanOrEqual(after  + BACKOFF_DELAYS_MS[0]);
  });

  test('processRetryQueue skips entry before backoff window elapses', async () => {
    const db = makeDb();
    db._setRow('job-3', { id: 3, job_id: 'job-3', provider_id: null });
    setStubs(db, makeScheduler(null));

    await enqueueJob('job-3', {});
    const result = processRetryQueue(); // called immediately

    expect(result.skipped).toBe(1);
    expect(result.assigned).toBe(0);
    expect(result.expired).toBe(0);
    expect(getQueueSnapshot()[0].attempts).toBe(1); // no increment
  });

  test('retry assigns successfully after backoff window', async () => {
    const provider = { id: 2, name: 'p2', gpu_model: 'RTX4080' };
    const db = makeDb();
    db._setRow('job-4', { id: 4, job_id: 'job-4', provider_id: null });
    // No provider on attempt 1, provider available on attempt 2
    setStubs(db, {
      findBestProvider: jest.fn()
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ provider, score: 8000 }),
    });

    await enqueueJob('job-4', {});

    // Advance past nextRetryAt
    const snap = getQueueSnapshot();
    const fakeNow = snap[0].nextRetryAt + 1;
    const origNow = Date.now;
    Date.now = () => fakeNow;

    const result = processRetryQueue();
    Date.now = origNow;

    expect(result.assigned).toBe(1);
    expect(getQueueSnapshot()).toHaveLength(0);
  });

  test(`permanently fails after ${MAX_DISPATCH_ATTEMPTS} attempts`, async () => {
    const db = makeDb();
    db._setRow('job-5', { id: 5, job_id: 'job-5', provider_id: null });
    setStubs(db, makeScheduler(null));

    await enqueueJob('job-5', {}); // attempt 1

    // Drive attempts 2 and 3 by advancing time past each nextRetryAt
    for (let i = 0; i < MAX_DISPATCH_ATTEMPTS - 1; i++) {
      const snap = getQueueSnapshot();
      if (snap.length === 0) break;
      const fakeNow = snap[0].nextRetryAt + 1;
      const origNow = Date.now;
      Date.now = () => fakeNow;
      processRetryQueue();
      Date.now = origNow;
    }

    expect(getQueueSnapshot()).toHaveLength(0); // removed from queue
    // A FAILED status update must have been prepared
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('status'));
    expect(db._prepared.run).toHaveBeenCalledWith(
      STATUS.FAILED,
      expect.stringContaining('dispatch_attempts_exhausted'),
      expect.any(String),
      'job-5'
    );
  });

  test('permanently fails after MAX_WAIT_MS regardless of attempts', async () => {
    const db = makeDb();
    db._setRow('job-6', { id: 6, job_id: 'job-6', provider_id: null });
    setStubs(db, makeScheduler(null));

    await enqueueJob('job-6', {});

    const snap = getQueueSnapshot();
    // Advance past both nextRetryAt and MAX_WAIT_MS
    const fakeNow = snap[0].enqueuedAt + MAX_WAIT_MS + 1;
    const origNow = Date.now;
    Date.now = () => fakeNow;
    const result = processRetryQueue();
    Date.now = origNow;

    expect(result.expired).toBe(1);
    expect(getQueueSnapshot()).toHaveLength(0);
  });

  test('getQueueSnapshot includes nextRetryAt and nextRetryInMs', async () => {
    const db = makeDb();
    db._setRow('job-7', { id: 7, job_id: 'job-7', provider_id: null });
    setStubs(db, makeScheduler(null));

    await enqueueJob('job-7', {});

    const snap = getQueueSnapshot();
    expect(snap[0]).toHaveProperty('nextRetryAt');
    expect(snap[0]).toHaveProperty('nextRetryInMs');
    expect(snap[0].nextRetryInMs).toBeGreaterThan(0);
  });

  test('startRetryLoop is idempotent', () => {
    setStubs(makeDb(), makeScheduler(null));
    startRetryLoop();
    expect(() => startRetryLoop()).not.toThrow();
    stopRetryLoop();
  });
});
