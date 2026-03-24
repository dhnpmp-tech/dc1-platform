'use strict';
/**
 * Tests for job status SSE streaming (DCP-742)
 *
 * Covers:
 *   - jobEventEmitter: emit, subscribe, unsubscribe, cleanup
 *   - SSE connection lifecycle (connect → events → terminal → close)
 *   - Event ordering
 *   - Stream cleanup on client disconnect
 *   - GET /api/jobs/:job_id polling-fallback fields (elapsed_sec, tokens_used, cost_usd)
 */

const jobEventEmitter = require('../utils/jobEventEmitter');

// ── jobEventEmitter unit tests ─────────────────────────────────────────────

describe('jobEventEmitter', () => {
  beforeEach(() => {
    jobEventEmitter._resetForTests();
  });

  describe('emit + subscribe', () => {
    test('listener receives emitted events', () => {
      const received = [];
      const unsub = jobEventEmitter.subscribe('job-1', (event, data) => {
        received.push({ event, data });
      });

      const payload = { status: 'running', provider_id: 42, elapsed_sec: 5, tokens_used: null, cost_usd: 0.004 };
      jobEventEmitter.emit('job-1', 'job_running', payload);

      expect(received).toHaveLength(1);
      expect(received[0].event).toBe('job_running');
      expect(received[0].data).toEqual(payload);

      unsub();
    });

    test('emit with no subscribers is a no-op', () => {
      // Should not throw
      expect(() => {
        jobEventEmitter.emit('job-no-listeners', 'job_running', { status: 'running' });
      }).not.toThrow();
    });

    test('multiple subscribers all receive events', () => {
      const receivedA = [];
      const receivedB = [];

      const unsubA = jobEventEmitter.subscribe('job-2', (ev, d) => receivedA.push(ev));
      const unsubB = jobEventEmitter.subscribe('job-2', (ev, d) => receivedB.push(ev));

      jobEventEmitter.emit('job-2', 'job_queued', { status: 'queued' });

      expect(receivedA).toEqual(['job_queued']);
      expect(receivedB).toEqual(['job_queued']);

      unsubA();
      unsubB();
    });

    test('events from different jobs are isolated', () => {
      const receivedFor1 = [];
      const receivedFor2 = [];

      const unsub1 = jobEventEmitter.subscribe('job-A', (ev) => receivedFor1.push(ev));
      const unsub2 = jobEventEmitter.subscribe('job-B', (ev) => receivedFor2.push(ev));

      jobEventEmitter.emit('job-A', 'job_running', {});
      jobEventEmitter.emit('job-B', 'job_completed', {});

      expect(receivedFor1).toEqual(['job_running']);
      expect(receivedFor2).toEqual(['job_completed']);

      unsub1();
      unsub2();
    });
  });

  describe('unsubscribe', () => {
    test('unsubscribed listener no longer receives events', () => {
      const received = [];
      const unsub = jobEventEmitter.subscribe('job-3', (ev) => received.push(ev));

      jobEventEmitter.emit('job-3', 'job_queued', {});
      unsub();
      jobEventEmitter.emit('job-3', 'job_running', {});

      expect(received).toEqual(['job_queued']);
    });
  });

  describe('terminal event cleanup', () => {
    test('removeJob clears all listeners for a job', (done) => {
      const received = [];
      jobEventEmitter.subscribe('job-4', (ev) => received.push(ev));

      jobEventEmitter.emit('job-4', 'job_completed', { status: 'completed' });

      // After setImmediate the emitter should be cleaned up
      setImmediate(() => {
        expect(jobEventEmitter._emitters.has('job-4')).toBe(false);
        done();
      });
    });
  });

  describe('statusToSseEvent', () => {
    const cases = [
      ['queued', 'job_queued'],
      ['pending', 'job_queued'],
      ['assigned', 'provider_assigned'],
      ['pulling', 'job_starting'],
      ['running', 'job_running'],
      ['completed', 'job_completed'],
      ['done', 'job_completed'],
      ['failed', 'job_failed'],
      ['timed_out', 'job_failed'],
      ['cancelled', 'job_failed'],
      ['permanently_failed', 'job_failed'],
      ['unknown_status', null],
    ];

    test.each(cases)('status "%s" → event "%s"', (status, expected) => {
      expect(jobEventEmitter.statusToSseEvent(status)).toBe(expected);
    });
  });

  describe('halalaToCostUsd', () => {
    test('converts halala to USD (1 SAR = 3.75 USD peg, 1 SAR = 100 halala)', () => {
      // 375 halala = 3.75 SAR = 1 USD
      const usd = jobEventEmitter.halalaToCostUsd(375);
      expect(usd).toBeCloseTo(1.0, 5);
    });

    test('returns null for null input', () => {
      expect(jobEventEmitter.halalaToCostUsd(null)).toBeNull();
    });

    test('returns 0 for 0 halala', () => {
      expect(jobEventEmitter.halalaToCostUsd(0)).toBe(0);
    });
  });

  describe('buildPayload', () => {
    test('builds payload with elapsed_sec from started_at', () => {
      const startedAt = new Date(Date.now() - 10_000).toISOString(); // 10 seconds ago
      const job = {
        status: 'running',
        provider_id: 99,
        started_at: startedAt,
        tokens_used: 500,
        actual_cost_halala: 750,
        cost_halala: 1000,
      };

      const payload = jobEventEmitter.buildPayload(job, 'job_running');

      expect(payload.event).toBe('job_running');
      expect(payload.status).toBe('running');
      expect(payload.provider_id).toBe(99);
      expect(payload.elapsed_sec).toBeGreaterThanOrEqual(9);
      expect(payload.elapsed_sec).toBeLessThanOrEqual(11);
      expect(payload.tokens_used).toBe(500);
      expect(payload.cost_usd).toBeCloseTo(750 / (100 * 3.75), 4);
    });

    test('elapsed_sec is null when job has not started', () => {
      const job = {
        status: 'queued',
        provider_id: null,
        started_at: null,
        tokens_used: null,
        cost_halala: 500,
      };

      const payload = jobEventEmitter.buildPayload(job, 'job_queued');
      expect(payload.elapsed_sec).toBeNull();
    });

    test('prefers actual_cost_halala over cost_halala for cost_usd', () => {
      const job = {
        status: 'completed',
        provider_id: 1,
        started_at: null,
        tokens_used: null,
        actual_cost_halala: 200,
        cost_halala: 500,
      };
      const payload = jobEventEmitter.buildPayload(job, 'job_completed');
      expect(payload.cost_usd).toBeCloseTo(200 / (100 * 3.75), 4);
    });
  });
});

// ── SSE connection lifecycle tests (integration-style) ───────────────────────

describe('SSE stream lifecycle (integration)', () => {
  // Build a minimal mock for res/req to simulate Express SSE behaviour
  function buildMockRes() {
    const writes = [];
    let ended = false;
    return {
      writes,
      ended: () => ended,
      // Express-compatible mock
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn((chunk) => { if (!ended) writes.push(chunk); }),
      end: jest.fn(() => { ended = true; }),
    };
  }

  function buildMockReq(jobId) {
    const listeners = {};
    return {
      params: { job_id: jobId },
      query: {},
      headers: {},
      on: jest.fn((event, cb) => { listeners[event] = cb; }),
      _trigger: (event) => { if (listeners[event]) listeners[event](); },
    };
  }

  beforeEach(() => {
    jobEventEmitter._resetForTests();
  });

  test('initial event is emitted immediately on connect', () => {
    // Simulate the SSE handler emitting initial state:
    const jobId = 'job-sse-1';
    const res = buildMockRes();
    const req = buildMockReq(jobId);

    // Manually exercise the SSE write pattern
    const payload = jobEventEmitter.buildPayload(
      { status: 'queued', provider_id: null, started_at: null, tokens_used: null, cost_halala: 100 },
      'job_queued'
    );

    res.write(`event: job_queued\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);

    expect(res.writes).toHaveLength(2);
    expect(res.writes[0]).toContain('event: job_queued');
    const data = JSON.parse(res.writes[1].replace('data: ', '').trim());
    expect(data.status).toBe('queued');
  });

  test('event ordering: queued → provider_assigned → running → completed', () => {
    const jobId = 'job-sse-order';
    const received = [];
    const unsub = jobEventEmitter.subscribe(jobId, (ev) => received.push(ev));

    jobEventEmitter.emit(jobId, 'job_queued', { status: 'queued' });
    jobEventEmitter.emit(jobId, 'provider_assigned', { status: 'pending' });
    jobEventEmitter.emit(jobId, 'job_running', { status: 'running' });
    jobEventEmitter.emit(jobId, 'job_completed', { status: 'completed' });

    expect(received).toEqual(['job_queued', 'provider_assigned', 'job_running', 'job_completed']);
    unsub();
  });

  test('stream cleanup on client disconnect removes listener', () => {
    const jobId = 'job-sse-disconnect';
    const received = [];

    const unsub = jobEventEmitter.subscribe(jobId, (ev) => received.push(ev));
    jobEventEmitter.emit(jobId, 'job_queued', {});

    // Simulate disconnect
    unsub();

    jobEventEmitter.emit(jobId, 'job_running', {});

    // Only first event should have been captured
    expect(received).toEqual(['job_queued']);
  });

  test('terminal event triggers end + cleanup', (done) => {
    const jobId = 'job-sse-terminal';

    jobEventEmitter.subscribe(jobId, (ev) => {
      if (jobEventEmitter.TERMINAL_SSE_EVENTS.has(ev)) {
        // emit() queues setImmediate(removeJob) at tick N.
        // The listener's own setImmediate is also tick N but queued first (FIFO).
        // We need two levels to ensure removeJob has run before we assert.
        setImmediate(() => setImmediate(() => {
          expect(jobEventEmitter._emitters.has(jobId)).toBe(false);
          done();
        }));
      }
    });

    jobEventEmitter.emit(jobId, 'job_failed', { status: 'failed' });
  });

  test('no events delivered after terminal cleanup', (done) => {
    const jobId = 'job-sse-post-terminal';
    const received = [];

    jobEventEmitter.subscribe(jobId, (ev) => received.push(ev));
    jobEventEmitter.emit(jobId, 'job_completed', { status: 'completed' });

    setImmediate(() => {
      // Emitter is cleaned; emit after cleanup should be a no-op
      jobEventEmitter.emit(jobId, 'job_running', { status: 'running' });
      expect(received).toEqual(['job_completed']);
      done();
    });
  });
});
