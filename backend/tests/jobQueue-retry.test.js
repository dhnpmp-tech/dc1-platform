'use strict';
/**
 * jobQueue-retry.test.js — DCP-798
 *
 * Unit tests for the exponential-backoff retry logic in jobQueue.js.
 * Uses jest.mock() for proper module isolation (Module._load override
 * does not work with Jest's own module system).
 *
 * Verifies:
 *   1. Immediate assignment skips the retry queue entirely
 *   2. Failed attempts are queued with nextRetryAt = now + BACKOFF_DELAYS_MS[0]
 *   3. Retries are skipped while inside the backoff window
 *   4. MAX_DISPATCH_ATTEMPTS (3) causes permanent failure
 *   5. MAX_WAIT_MS timeout causes permanent failure
 *   6. Successful retry removes entry from queue
 *   7. getQueueSnapshot exposes nextRetryAt and nextRetryInMs
 *
 * All DB and scheduler calls are mocked — no SQLite dependency.
 */

jest.mock('../src/services/jobScheduler');
jest.mock('../src/db');
jest.mock('../src/utils/jobEventEmitter');

const jobScheduler = require('../src/services/jobScheduler');
const db = require('../src/db');
const jobEventEmitter = require('../src/utils/jobEventEmitter');

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
} = require('../src/services/jobQueue');

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupDbMock(rowOrNull) {
  const mockRun = jest.fn();
  const mockPrepare = jest.fn(() => ({ run: mockRun }));
  db.get.mockReturnValue(rowOrNull);
  db.prepare.mockImplementation(mockPrepare);
  return { mockRun, mockPrepare };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  _resetForTests();
  // Default emitter stubs
  jobEventEmitter.emit = jest.fn();
  jobEventEmitter.buildPayload = jest.fn();
  jobEventEmitter.statusToSseEvent = jest.fn(() => null);
});

afterEach(() => {
  stopRetryLoop();
  _resetForTests();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('jobQueue retry logic', () => {
  test('immediate assignment bypasses retry queue', async () => {
    const provider = { id: 1, name: 'p1', gpu_model: 'RTX4090' };
    jobScheduler.findBestProvider = jest.fn(() => ({ provider, score: 9000 }));
    setupDbMock({ id: 1, job_id: 'job-1', provider_id: null });

    const result = await enqueueJob('job-1', {});

    expect(result.assigned).toBe(true);
    expect(result.queued).toBe(false);
    expect(getQueueSnapshot()).toHaveLength(0);
  });

  test('queued entry has nextRetryAt = now + BACKOFF_DELAYS_MS[0]', async () => {
    jobScheduler.findBestProvider = jest.fn(() => null);
    setupDbMock({ id: 2, job_id: 'job-2', provider_id: null });

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
    jobScheduler.findBestProvider = jest.fn(() => null);
    setupDbMock({ id: 3, job_id: 'job-3', provider_id: null });

    await enqueueJob('job-3', {});
    const result = processRetryQueue(); // called immediately — inside backoff window

    expect(result.skipped).toBe(1);
    expect(result.assigned).toBe(0);
    expect(result.expired).toBe(0);
    expect(getQueueSnapshot()[0].attempts).toBe(1); // no increment
  });

  test('retry assigns successfully after backoff window', async () => {
    const provider = { id: 2, name: 'p2', gpu_model: 'RTX4080' };
    // No provider on attempt 1, provider available on attempt 2
    jobScheduler.findBestProvider = jest.fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ provider, score: 8000 });
    setupDbMock({ id: 4, job_id: 'job-4', provider_id: null });

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
    jobScheduler.findBestProvider = jest.fn(() => null);
    const { mockRun } = setupDbMock({ id: 5, job_id: 'job-5', provider_id: null });

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
    // A FAILED status update must have been written
    expect(mockRun).toHaveBeenCalledWith(
      STATUS.FAILED,
      expect.stringContaining('dispatch_attempts_exhausted'),
      expect.any(String),
      'job-5'
    );
  });

  test('permanently fails after MAX_WAIT_MS regardless of attempts', async () => {
    jobScheduler.findBestProvider = jest.fn(() => null);
    setupDbMock({ id: 6, job_id: 'job-6', provider_id: null });

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
    jobScheduler.findBestProvider = jest.fn(() => null);
    setupDbMock({ id: 7, job_id: 'job-7', provider_id: null });

    await enqueueJob('job-7', {});

    const snap = getQueueSnapshot();
    expect(snap[0]).toHaveProperty('nextRetryAt');
    expect(snap[0]).toHaveProperty('nextRetryInMs');
    expect(snap[0].nextRetryInMs).toBeGreaterThan(0);
  });

  test('startRetryLoop is idempotent', () => {
    startRetryLoop();
    expect(() => startRetryLoop()).not.toThrow();
    stopRetryLoop();
  });
});
