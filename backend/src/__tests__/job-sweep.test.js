const Database = require('better-sqlite3');
const { startJobSweep, stopJobSweep } = require('../services/jobSweep');

function buildDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE renters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key TEXT,
      webhook_url TEXT,
      email TEXT,
      name TEXT,
      status TEXT
    );

    CREATE TABLE jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 2,
      retry_reason TEXT,
      error TEXT,
      started_at TEXT,
      duration_minutes INTEGER,
      submitted_at TEXT,
      provider_id INTEGER,
      completed_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE job_sweep_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      old_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      reason TEXT,
      swept_at TEXT
    );
  `);
  return db;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('jobSweep terminal status handling', () => {
  afterEach(() => {
    stopJobSweep();
  });

  test('marks retries-exhausted timeout candidates as failed (not permanently_failed)', async () => {
    const db = buildDb();
    db.prepare(`
      INSERT INTO jobs (job_id, status, retry_count, max_retries, started_at, duration_minutes, submitted_at)
      VALUES (?, ?, ?, ?, datetime('now', '-2 hours'), 30, datetime('now', '-2 hours'))
    `).run('job-timeout-exhausted', 'running', 2, 2);

    startJobSweep(db, 60000);
    await sleep(25);
    stopJobSweep();

    const row = db.prepare('SELECT status, retry_reason FROM jobs WHERE job_id = ?').get('job-timeout-exhausted');
    expect(row.status).toBe('failed');
    expect(row.retry_reason).toBe('provider_timeout');

    const log = db.prepare('SELECT old_status, new_status FROM job_sweep_log WHERE job_id = ?').get('job-timeout-exhausted');
    expect(log.old_status).toBe('running');
    expect(log.new_status).toBe('failed');
  });

  test('does not reprocess jobs already in failed terminal state', async () => {
    const db = buildDb();
    db.prepare(`
      INSERT INTO jobs (job_id, status, retry_count, max_retries, submitted_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now', '-3 hours'), datetime('now', '-2 hours'))
    `).run('job-already-failed', 'failed', 1, 2);

    startJobSweep(db, 60000);
    await sleep(25);
    stopJobSweep();

    const row = db.prepare('SELECT status, retry_count, retry_reason FROM jobs WHERE job_id = ?').get('job-already-failed');
    expect(row.status).toBe('failed');
    expect(row.retry_count).toBe(1);
    expect(row.retry_reason).toBeNull();

    const logCount = db.prepare('SELECT COUNT(*) AS c FROM job_sweep_log WHERE job_id = ?').get('job-already-failed');
    expect(logCount.c).toBe(0);
  });
});
