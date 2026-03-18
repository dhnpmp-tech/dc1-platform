'use strict';
// Data retention cleanup service — DCP-59
// Runs daily at 2:00 AM UTC, enforces PDPL/SAMA retention policies
const db = require('../db');

let lastRunAt = null;
let lastStats = null;

// ─── Core cleanup logic ───────────────────────────────────────────────────────

function runCleanup() {
  const startedAt = new Date().toISOString();
  console.log(`[cleanup] Starting data retention cleanup at ${startedAt}`);

  const stats = { started_at: startedAt };

  // heartbeat_log: 30-day retention
  try {
    const r = db.run(`DELETE FROM heartbeat_log WHERE received_at < datetime('now', '-30 days')`);
    stats.heartbeat_log_deleted = r.changes;
  } catch (e) {
    console.warn('[cleanup] heartbeat_log error:', e.message);
    stats.heartbeat_log_deleted = 0;
  }

  // job_logs: 90-day retention
  try {
    const r = db.run(`DELETE FROM job_logs WHERE logged_at < datetime('now', '-90 days')`);
    stats.job_logs_deleted = r.changes;
  } catch (e) {
    console.warn('[cleanup] job_logs error:', e.message);
    stats.job_logs_deleted = 0;
  }

  // daemon_events: 30 days for non-critical, 180 days for critical severity
  try {
    const r1 = db.run(`
      DELETE FROM daemon_events
      WHERE severity != 'critical' AND received_at < datetime('now', '-30 days')
    `);
    const r2 = db.run(`
      DELETE FROM daemon_events
      WHERE severity = 'critical' AND received_at < datetime('now', '-180 days')
    `);
    stats.daemon_events_deleted = (r1.changes || 0) + (r2.changes || 0);
  } catch (e) {
    console.warn('[cleanup] daemon_events error:', e.message);
    stats.daemon_events_deleted = 0;
  }

  // jobs: soft-retain — null out task_spec and result payloads after 90 days
  // The job record itself is kept; only bulk payload columns are cleared
  // payments table is NEVER touched (7-year PDPL/SAMA financial requirement)
  try {
    const r = db.run(`
      UPDATE jobs
      SET task_spec = NULL, result = NULL
      WHERE status IN ('completed', 'failed')
        AND completed_at < datetime('now', '-90 days')
        AND (task_spec IS NOT NULL OR result IS NOT NULL)
    `);
    stats.jobs_purged_payload = r.changes;
  } catch (e) {
    console.warn('[cleanup] jobs payload purge error:', e.message);
    stats.jobs_purged_payload = 0;
  }

  // WAL checkpoint after deletions
  try {
    db._db.pragma('wal_checkpoint(FULL)');
    stats.wal_checkpoint = true;
    console.log('[cleanup] WAL checkpoint complete');
  } catch (e) {
    console.warn('[cleanup] WAL checkpoint failed:', e.message);
    stats.wal_checkpoint = false;
  }

  // Weekly VACUUM on Sunday (UTC) — expensive but keeps DB file size down
  const dayOfWeek = new Date().getUTCDay(); // 0 = Sunday
  if (dayOfWeek === 0) {
    try {
      db._db.exec('VACUUM');
      stats.vacuumed = true;
      console.log('[cleanup] VACUUM complete');
    } catch (e) {
      console.warn('[cleanup] VACUUM failed:', e.message);
      stats.vacuumed = false;
    }
  }

  stats.completed_at = new Date().toISOString();
  lastRunAt = stats.completed_at;
  lastStats = stats;

  console.log('[cleanup] Done:', JSON.stringify(stats));
  return stats;
}

// ─── Stats for admin endpoint ─────────────────────────────────────────────────

function getStats() {
  const TABLES = ['heartbeat_log', 'job_logs', 'daemon_events', 'jobs', 'payments', 'escrow_holds'];
  const table_sizes = {};
  for (const t of TABLES) {
    try {
      table_sizes[t] = db.get(`SELECT COUNT(*) as cnt FROM ${t}`)?.cnt ?? null;
    } catch {
      table_sizes[t] = null;
    }
  }

  const pending_deletions = {};
  try {
    pending_deletions.heartbeat_log = db.get(
      `SELECT COUNT(*) as cnt FROM heartbeat_log WHERE received_at < datetime('now', '-30 days')`
    )?.cnt ?? 0;
  } catch { pending_deletions.heartbeat_log = null; }

  try {
    pending_deletions.job_logs = db.get(
      `SELECT COUNT(*) as cnt FROM job_logs WHERE logged_at < datetime('now', '-90 days')`
    )?.cnt ?? 0;
  } catch { pending_deletions.job_logs = null; }

  try {
    const p1 = db.get(
      `SELECT COUNT(*) as cnt FROM daemon_events WHERE severity != 'critical' AND received_at < datetime('now', '-30 days')`
    )?.cnt ?? 0;
    const p2 = db.get(
      `SELECT COUNT(*) as cnt FROM daemon_events WHERE severity = 'critical' AND received_at < datetime('now', '-180 days')`
    )?.cnt ?? 0;
    pending_deletions.daemon_events = p1 + p2;
  } catch { pending_deletions.daemon_events = null; }

  try {
    pending_deletions.jobs_payload_purge = db.get(`
      SELECT COUNT(*) as cnt FROM jobs
      WHERE status IN ('completed','failed')
        AND completed_at < datetime('now', '-90 days')
        AND (task_spec IS NOT NULL OR result IS NOT NULL)
    `)?.cnt ?? 0;
  } catch { pending_deletions.jobs_payload_purge = null; }

  return {
    last_run_at: lastRunAt,
    last_run_stats: lastStats,
    table_sizes,
    pending_deletions,
    retention_policies: {
      heartbeat_log: '30 days',
      job_logs: '90 days',
      daemon_events: '30 days (critical: 180 days)',
      jobs_payload: '90 days (record retained, task_spec/result nulled)',
      payments: 'never (PDPL/SAMA 7-year requirement)',
    },
  };
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

function msUntilNext2amUTC() {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 0, 0, 0
  ));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

function schedule() {
  const delay = msUntilNext2amUTC();
  setTimeout(() => {
    runCleanup();
    // After first run, repeat every 24h (slight drift acceptable for a cleanup job)
    setInterval(runCleanup, 24 * 60 * 60 * 1000);
  }, delay);
  console.log(`[cleanup] Daily cleanup scheduled at 2:00 AM UTC (next run in ~${Math.round(delay / 3600000)}h)`);
}

module.exports = { runCleanup, schedule, getStats };
