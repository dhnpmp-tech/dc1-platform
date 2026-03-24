'use strict';
/**
 * Unit tests for jobQueue.js (DCP-738)
 *
 * Tests the provider selection algorithm, no-provider edge case,
 * retry queue behaviour, and provider event handling.
 *
 * Uses in-memory SQLite and mocked jobScheduler to avoid network/disk I/O.
 */

const Database = require('better-sqlite3');

// ── In-memory DB mock ────────────────────────────────────────────────────────
// Uses global.__testDb (set in beforeEach) so the mock factory can reference it.

jest.mock('../db', () => {
  return {
    get get()     { return (sql, ...params) => global.__testDb.prepare(sql).get(...flatParams(params)); },
    get all()     { return (sql, ...params) => global.__testDb.prepare(sql).all(...flatParams(params)); },
    get prepare() { return (sql) => global.__testDb.prepare(sql); },
    get run()     { return (sql, ...params) => global.__testDb.prepare(sql).run(...flatParams(params)); },
    get _db()     { return global.__testDb; },
  };

  // eslint-disable-next-line no-unreachable
  function flatParams(params) {
    if (params.length === 1 && Array.isArray(params[0])) return params[0];
    return params.reduce((acc, p) => (Array.isArray(p) ? acc.concat(p) : acc.concat([p])), []);
  }
});

function flatParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params.reduce((acc, p) => (Array.isArray(p) ? acc.concat(p) : acc.concat([p])), []);
}

// ── Scheduler mock ───────────────────────────────────────────────────────────

const mockFindBestProvider = jest.fn();

jest.mock('../services/jobScheduler', () => ({
  findBestProvider: (...args) => mockFindBestProvider(...args),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gpu_model TEXT,
      vram_gb INTEGER DEFAULT 0,
      gpu_vram_mib INTEGER,
      status TEXT DEFAULT 'active',
      last_heartbeat TEXT,
      uptime_percent REAL DEFAULT 100,
      price_per_min_halala INTEGER,
      is_paused INTEGER DEFAULT 0,
      model_preload_status TEXT DEFAULT 'none'
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT UNIQUE NOT NULL,
      provider_id INTEGER,
      job_type TEXT DEFAULT 'inference',
      status TEXT DEFAULT 'pending',
      cost_halala INTEGER DEFAULT 0,
      duration_minutes INTEGER DEFAULT 60,
      notes TEXT,
      submitted_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      updated_at TEXT,
      created_at TEXT
    )
  `);

  return db;
}

function insertProvider(overrides = {}) {
  const db = global.__testDb;
  const now = new Date().toISOString();
  const defaults = {
    name: 'test-provider',
    gpu_model: 'RTX4090',
    vram_gb: 24,
    gpu_vram_mib: 24576,
    status: 'active',
    last_heartbeat: now,
    uptime_percent: 99,
    price_per_min_halala: 9,
    is_paused: 0,
    model_preload_status: 'none',
  };
  const row = { ...defaults, ...overrides };
  const result = db.prepare(`
    INSERT INTO providers
      (name, gpu_model, vram_gb, gpu_vram_mib, status, last_heartbeat, uptime_percent,
       price_per_min_halala, is_paused, model_preload_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.name, row.gpu_model, row.vram_gb, row.gpu_vram_mib, row.status,
    row.last_heartbeat, row.uptime_percent, row.price_per_min_halala,
    row.is_paused, row.model_preload_status
  );
  return { id: result.lastInsertRowid, ...row };
}

function insertJob(jobId, overrides = {}) {
  const db = global.__testDb;
  const now = new Date().toISOString();
  const defaults = {
    status: 'pending', provider_id: null, job_type: 'inference',
    submitted_at: now, created_at: now, updated_at: now,
  };
  const row = { ...defaults, ...overrides };
  db.prepare(`
    INSERT INTO jobs (job_id, provider_id, job_type, status, submitted_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(jobId, row.provider_id, row.job_type, row.status, row.submitted_at, row.created_at, row.updated_at);
}

function getJob(jobId) {
  return global.__testDb.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId);
}

// ── Test setup ───────────────────────────────────────────────────────────────

let jobQueue;

beforeEach(() => {
  global.__testDb = buildDb();
  jest.resetModules();
  mockFindBestProvider.mockReset();
  jobQueue = require('../services/jobQueue');
  jobQueue._resetForTests();
});

afterEach(() => {
  jobQueue.stopRetryLoop();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('enqueueJob — immediate assignment', () => {
  test('assigns job to best provider when one is available', async () => {
    const provider = insertProvider();
    insertJob('job-001');

    mockFindBestProvider.mockReturnValue({ provider, score: 5000, matchDetails: {} });

    const result = await jobQueue.enqueueJob('job-001', { min_vram_gb: 16 });

    expect(result.assigned).toBe(true);
    expect(result.queued).toBe(false);
    expect(result.provider.id).toBe(provider.id);

    const row = getJob('job-001');
    expect(row.status).toBe('pending');
    expect(row.provider_id).toBe(provider.id);
  });

  test('passes requirements to findBestProvider', async () => {
    const provider = insertProvider();
    insertJob('job-002');

    mockFindBestProvider.mockReturnValue({ provider, score: 4500, matchDetails: {} });

    await jobQueue.enqueueJob('job-002', {
      min_vram_gb: 20,
      gpu_type: 'RTX4090',
      pricing_class: 'priority',
      job_type: 'llm-inference',
    });

    expect(mockFindBestProvider).toHaveBeenCalledWith(
      expect.objectContaining({ min_vram_gb: 20, gpu_type: 'RTX4090', pricing_class: 'priority' }),
      10
    );
  });
});

describe('enqueueJob — no provider available', () => {
  test('queues job and returns queued=true when no provider matches', async () => {
    insertJob('job-003');
    mockFindBestProvider.mockReturnValue(null);

    const result = await jobQueue.enqueueJob('job-003', { min_vram_gb: 80 });

    expect(result.assigned).toBe(false);
    expect(result.queued).toBe(true);
    expect(result.reason).toBe('queued_for_retry');

    expect(getJob('job-003').status).toBe('queued');
  });

  test('adds job to internal retry queue', async () => {
    insertJob('job-004');
    mockFindBestProvider.mockReturnValue(null);

    await jobQueue.enqueueJob('job-004', {});

    const snapshot = jobQueue.getQueueSnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].jobId).toBe('job-004');
    expect(snapshot[0].attempts).toBe(1);
  });
});

describe('processRetryQueue', () => {
  test('assigns queued jobs when a provider becomes available', async () => {
    const provider = insertProvider();
    insertJob('job-005', { status: 'queued' });

    mockFindBestProvider.mockReturnValueOnce(null);
    await jobQueue.enqueueJob('job-005', { min_vram_gb: 8 });

    mockFindBestProvider.mockReturnValue({ provider, score: 3000, matchDetails: {} });

    const stats = jobQueue.processRetryQueue();
    expect(stats.assigned).toBe(1);
    expect(stats.expired).toBe(0);

    const row = getJob('job-005');
    expect(row.status).toBe('pending');
    expect(row.provider_id).toBe(provider.id);

    expect(jobQueue.getQueueSnapshot()).toHaveLength(0);
  });

  test('does nothing when queue is empty', () => {
    const stats = jobQueue.processRetryQueue();
    expect(stats.processed).toBe(0);
    expect(stats.assigned).toBe(0);
    expect(stats.expired).toBe(0);
  });

  test('handles multiple queued jobs independently', async () => {
    const provider = insertProvider({ name: 'gpu-1', vram_gb: 24 });
    insertJob('job-multi-a', { status: 'queued' });
    insertJob('job-multi-b', { status: 'queued' });

    mockFindBestProvider.mockReturnValue(null);
    await jobQueue.enqueueJob('job-multi-a', { min_vram_gb: 8 });
    await jobQueue.enqueueJob('job-multi-b', { min_vram_gb: 8 });

    expect(jobQueue.getQueueSnapshot()).toHaveLength(2);

    // Only first job finds a provider on this tick
    mockFindBestProvider
      .mockReturnValueOnce({ provider, score: 2000, matchDetails: {} })
      .mockReturnValueOnce(null);

    const stats = jobQueue.processRetryQueue();
    expect(stats.assigned).toBe(1);
    expect(jobQueue.getQueueSnapshot()).toHaveLength(1);
  });

  test('MAX_WAIT_MS constant is 10 minutes', () => {
    expect(jobQueue.MAX_WAIT_MS).toBe(10 * 60 * 1000);
  });

  test('RETRY_INTERVAL_MS constant is 30 seconds', () => {
    expect(jobQueue.RETRY_INTERVAL_MS).toBe(30_000);
  });
});

describe('handleProviderEvent', () => {
  test('updates job to running on job_started event', () => {
    insertJob('job-evt-001', { status: 'pending' });

    const result = jobQueue.handleProviderEvent({
      event: 'job_started',
      job_id: 'job-evt-001',
      provider_id: 1,
    });

    expect(result.updated).toBe(true);
    expect(result.newStatus).toBe('running');
    expect(getJob('job-evt-001').status).toBe('running');
  });

  test('updates job to completed on job_done event', () => {
    insertJob('job-evt-002', { status: 'running' });

    const result = jobQueue.handleProviderEvent({
      event: 'job_done',
      job_id: 'job-evt-002',
    });

    expect(result.updated).toBe(true);
    expect(result.newStatus).toBe('completed');

    const row = getJob('job-evt-002');
    expect(row.status).toBe('completed');
    expect(row.completed_at).toBeTruthy();
  });

  test('updates job to completed on container_exit event', () => {
    insertJob('job-evt-003', { status: 'running' });

    const result = jobQueue.handleProviderEvent({
      event: 'container_exit',
      job_id: 'job-evt-003',
    });

    expect(result.updated).toBe(true);
    expect(result.newStatus).toBe('completed');
  });

  test('updates job to failed on error_report event and stores error message', () => {
    insertJob('job-evt-004', { status: 'running' });

    const result = jobQueue.handleProviderEvent({
      event: 'error_report',
      job_id: 'job-evt-004',
      payload: { error: 'CUDA out of memory' },
    });

    expect(result.updated).toBe(true);
    expect(result.newStatus).toBe('failed');

    const row = getJob('job-evt-004');
    expect(row.status).toBe('failed');
    expect(row.notes).toContain('CUDA out of memory');
  });

  test('rejects event with no event field', () => {
    const result = jobQueue.handleProviderEvent({ job_id: 'job-x' });
    expect(result.updated).toBe(false);
    expect(result.reason).toBe('missing_event_field');
  });

  test('rejects event with no job_id', () => {
    const result = jobQueue.handleProviderEvent({ event: 'job_done' });
    expect(result.updated).toBe(false);
    expect(result.reason).toBe('missing_job_id');
  });

  test('returns job_not_found for unknown job_id', () => {
    const result = jobQueue.handleProviderEvent({ event: 'job_done', job_id: 'nonexistent-abc' });
    expect(result.updated).toBe(false);
    expect(result.reason).toBe('job_not_found');
  });

  test('does not downgrade a completed job to running', () => {
    insertJob('job-evt-005', { status: 'completed' });

    const result = jobQueue.handleProviderEvent({
      event: 'job_started',
      job_id: 'job-evt-005',
    });

    expect(result.updated).toBe(false);
    expect(result.reason).toContain('skipped_terminal_downgrade');
    expect(getJob('job-evt-005').status).toBe('completed');
  });

  test('ignores unrecognized events without mutating job', () => {
    insertJob('job-evt-006', { status: 'pending' });

    const result = jobQueue.handleProviderEvent({
      event: 'metrics_report',
      job_id: 'job-evt-006',
    });

    expect(result.updated).toBe(false);
    expect(result.reason).toContain('unrecognized_event');
    expect(getJob('job-evt-006').status).toBe('pending');
  });

  test('removes job from retry queue after terminal event', async () => {
    insertJob('job-evt-007', { status: 'queued' });
    mockFindBestProvider.mockReturnValue(null);
    await jobQueue.enqueueJob('job-evt-007', {});

    expect(jobQueue.getQueueSnapshot()).toHaveLength(1);

    jobQueue.handleProviderEvent({ event: 'job_done', job_id: 'job-evt-007' });

    expect(jobQueue.getQueueSnapshot()).toHaveLength(0);
  });
});

describe('provider selection — tryAssign', () => {
  test('selects provider that scores highest', async () => {
    const provider = insertProvider({ name: 'high-score-provider', vram_gb: 48 });
    insertJob('job-select-001');

    mockFindBestProvider.mockReturnValue({ provider, score: 9000, matchDetails: {} });

    const result = await jobQueue.enqueueJob('job-select-001', {
      min_vram_gb: 40,
      gpu_type: 'H100',
      pricing_class: 'economy',
    });

    expect(result.assigned).toBe(true);
    expect(result.provider.name).toBe('high-score-provider');
    expect(mockFindBestProvider).toHaveBeenCalledWith(
      expect.objectContaining({ min_vram_gb: 40, gpu_type: 'H100', pricing_class: 'economy' }),
      10
    );
  });

  test('tryAssign skips update when job already has a provider (idempotent)', () => {
    const provider = insertProvider();
    insertJob('job-already-assigned', { provider_id: provider.id, status: 'pending' });

    mockFindBestProvider.mockReturnValue({ provider, score: 5000, matchDetails: {} });

    const result = jobQueue.tryAssign('job-already-assigned', { min_vram_gb: 8 });
    expect(result.assigned).toBe(true);
    expect(result.reason).toBe('already_assigned');

    const row = getJob('job-already-assigned');
    expect(row.provider_id).toBe(provider.id);
  });
});

describe('startRetryLoop / stopRetryLoop', () => {
  test('startRetryLoop is idempotent', () => {
    jobQueue.startRetryLoop();
    jobQueue.startRetryLoop(); // second call should not throw
    jobQueue.stopRetryLoop();
  });

  test('stopRetryLoop can be called multiple times safely', () => {
    jobQueue.startRetryLoop();
    jobQueue.stopRetryLoop();
    jobQueue.stopRetryLoop(); // second stop should not throw
  });
});

describe('getQueueSnapshot', () => {
  test('returns empty array when queue is empty', () => {
    expect(jobQueue.getQueueSnapshot()).toEqual([]);
  });

  test('includes waitMs in snapshot entries', async () => {
    insertJob('job-snap-001', { status: 'queued' });
    mockFindBestProvider.mockReturnValue(null);
    await jobQueue.enqueueJob('job-snap-001', {});

    const snap = jobQueue.getQueueSnapshot();
    expect(snap).toHaveLength(1);
    expect(typeof snap[0].waitMs).toBe('number');
    expect(snap[0].attempts).toBe(1);
    expect(snap[0].jobId).toBe('job-snap-001');
  });
});
