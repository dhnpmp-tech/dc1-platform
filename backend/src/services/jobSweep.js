let sweepTimer = null;
let loggedRetryMigrationHint = false;

function assertDb(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('startJobSweep/getQueueDepth requires a better-sqlite3 database instance');
  }
}

function getJobColumns(db) {
  const rows = db.prepare("PRAGMA table_info('jobs')").all();
  return new Set(rows.map((row) => row.name));
}

function pickQueueTimestampColumn(columns) {
  if (columns.has('queued_at')) return 'queued_at';
  if (columns.has('submitted_at')) return 'submitted_at';
  if (columns.has('created_at')) return 'created_at';
  return null;
}

function buildSweepStatements(db) {
  const columns = getJobColumns(db);
  const hasStartedAt = columns.has('started_at');
  const hasDuration = columns.has('duration_minutes');
  const queueTsCol = pickQueueTimestampColumn(columns);
  const hasRetryCount = columns.has('retry_count');
  const hasMaxRetries = columns.has('max_retries');
  const hasRetryReason = columns.has('retry_reason');
  const hasError = columns.has('error');
  const hasProviderId = columns.has('provider_id');
  const hasCompletedAt = columns.has('completed_at');
  const hasStartedAtCol = columns.has('started_at');
  const hasAssignedAt = columns.has('assigned_at');
  const hasPickedUpAt = columns.has('picked_up_at');
  const hasTimeoutAt = columns.has('timeout_at');
  const hasStatusUpdatedAt = columns.has('status_updated_at');
  const hasUpdatedAt = columns.has('updated_at');

  const runningCandidatesSql = hasStartedAt && hasDuration
    ? `
      SELECT * FROM jobs
      WHERE status = 'running'
        AND started_at IS NOT NULL
        AND COALESCE(duration_minutes, 0) > 0
        AND datetime(started_at, '+' || duration_minutes || ' minutes') <= datetime('now')
    `
    : null;

  const queuedCandidatesSql = queueTsCol
    ? `
      SELECT * FROM jobs
      WHERE status = 'queued'
        AND ${queueTsCol} IS NOT NULL
        AND datetime(${queueTsCol}) <= datetime('now', '-30 minutes')
    `
    : null;

  const failedCandidatesSql = `
    SELECT * FROM jobs
    WHERE status = 'failed'
  `;

  const queueDepthSql = `
    SELECT
      SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running
    FROM jobs
  `;

  return {
    columns,
    hasRetryColumns: hasRetryCount && hasMaxRetries,
    hasRetryReason,
    hasError,
    hasProviderId,
    hasCompletedAt,
    hasStartedAtCol,
    hasAssignedAt,
    hasPickedUpAt,
    hasTimeoutAt,
    touchColumn: hasStatusUpdatedAt ? 'status_updated_at' : (hasUpdatedAt ? 'updated_at' : null),
    runningCandidatesStmt: runningCandidatesSql ? db.prepare(runningCandidatesSql) : null,
    queuedCandidatesStmt: queuedCandidatesSql ? db.prepare(queuedCandidatesSql) : null,
    failedCandidatesStmt: db.prepare(failedCandidatesSql),
    queueDepthStmt: db.prepare(queueDepthSql),
  };
}

function normalizeRetryReason(reason) {
  if (reason === 'provider_timeout') return 'provider_timeout';
  if (reason === 'queue_timeout') return 'queue_timeout';
  return 'execution_failed';
}

function logRetryMigrationHintOnce() {
  if (loggedRetryMigrationHint) return;
  loggedRetryMigrationHint = true;
  console.warn('[jobSweep] jobs.retry_count/max_retries columns missing. Apply migration on VPS:');
  console.warn('ALTER TABLE jobs ADD COLUMN retry_count INTEGER DEFAULT 0;');
  console.warn('ALTER TABLE jobs ADD COLUMN max_retries INTEGER DEFAULT 2;');
}

function writeSweepLog(state, job, fromStatus, toStatus, reason) {
  try {
    state.db.prepare(
      `INSERT INTO job_sweep_log (job_id, old_status, new_status, reason, swept_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(job.job_id || String(job.id), fromStatus, toStatus, reason);
  } catch (_) {
    // best-effort audit only
  }
}

function updateJobForRetry(state, job, reason) {
  const retryReason = normalizeRetryReason(reason);
  const retryCount = Number(job.retry_count || 0);
  const maxRetries = Number(job.max_retries || 2);
  const nextRetryCount = retryCount + 1;

  if (retryCount < maxRetries) {
    const clauses = ["status = 'queued'", 'retry_count = ?'];
    const params = [nextRetryCount];
    if (state.hasProviderId) clauses.push('provider_id = NULL');
    if (state.hasCompletedAt) clauses.push('completed_at = NULL');
    if (state.hasStartedAtCol) clauses.push('started_at = NULL');
    if (state.hasAssignedAt) clauses.push('assigned_at = NULL');
    if (state.hasPickedUpAt) clauses.push('picked_up_at = NULL');
    if (state.hasTimeoutAt) clauses.push('timeout_at = NULL');
    if (state.hasRetryReason) {
      clauses.push('retry_reason = ?');
      params.push(retryReason);
    }
    if (state.hasError) {
      clauses.push('error = ?');
      params.push(`[retry ${nextRetryCount}/${maxRetries}] ${retryReason}`);
    }
    if (state.touchColumn) clauses.push(`${state.touchColumn} = datetime('now')`);

    params.push(job.id);
    state.db.prepare(`UPDATE jobs SET ${clauses.join(', ')} WHERE id = ?`).run(...params);
    writeSweepLog(state, job, job.status, 'queued', retryReason);
    return;
  }

  const clauses = ["status = 'permanently_failed'"];
  const params = [];
  if (state.hasRetryReason) {
    clauses.push('retry_reason = ?');
    params.push(retryReason);
  }
  if (state.hasError) {
    clauses.push('error = ?');
    params.push(`[permanent] retries exhausted: ${retryReason}`);
  }
  if (state.hasCompletedAt) clauses.push("completed_at = datetime('now')");
  if (state.touchColumn) clauses.push(`${state.touchColumn} = datetime('now')`);
  params.push(job.id);

  state.db.prepare(`UPDATE jobs SET ${clauses.join(', ')} WHERE id = ?`).run(...params);
  writeSweepLog(state, job, job.status, 'permanently_failed', retryReason);
}

function runSweep(state) {
  try {
    if (!state.hasRetryColumns) {
      logRetryMigrationHintOnce();
      return;
    }

    const candidates = [];
    if (state.runningCandidatesStmt) {
      candidates.push(...state.runningCandidatesStmt.all().map((j) => ({ job: j, reason: 'provider_timeout' })));
    }
    if (state.queuedCandidatesStmt) {
      candidates.push(...state.queuedCandidatesStmt.all().map((j) => ({ job: j, reason: 'queue_timeout' })));
    }
    candidates.push(...state.failedCandidatesStmt.all().map((j) => ({ job: j, reason: 'execution_failed' })));

    const seen = new Set();
    for (const item of candidates) {
      if (!item.job || seen.has(item.job.id)) continue;
      seen.add(item.job.id);
      updateJobForRetry(state, item.job, item.reason);
    }
  } catch (error) {
    console.error('[jobSweep] sweep tick failed:', error.message);
  }
}

function startJobSweep(db, intervalMs = 30000) {
  assertDb(db);
  stopJobSweep();

  const safeIntervalMs = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 30000;
  const state = { ...buildSweepStatements(db), db: db._db || db };

  runSweep(state);
  sweepTimer = setInterval(() => runSweep(state), safeIntervalMs);
  if (typeof sweepTimer.unref === 'function') {
    sweepTimer.unref();
  }

  return sweepTimer;
}

function stopJobSweep() {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

function getQueueDepth(db) {
  assertDb(db);
  const { queueDepthStmt } = buildSweepStatements(db);
  const row = queueDepthStmt.get() || {};
  return {
    queued: Number(row.queued || 0),
    running: Number(row.running || 0),
  };
}

module.exports = { startJobSweep, stopJobSweep, getQueueDepth };
