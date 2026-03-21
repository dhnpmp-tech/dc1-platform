const db = require('../db');

function getColumnSet(tableName) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return new Set(rows.map((row) => row.name));
}

function buildRequeueSql(jobColumns) {
  const set = [
    "status = 'queued'",
    'provider_id = NULL',
  ];
  const params = [];

  if (jobColumns.has('error')) {
    set.push('error = ?');
    params.push('Provider marked offline by stale heartbeat sweep');
  }
  if (jobColumns.has('last_error')) {
    set.push('last_error = ?');
    params.push('Provider marked offline by stale heartbeat sweep');
  }
  if (jobColumns.has('retry_count')) {
    set.push('retry_count = COALESCE(retry_count, 0) + 1');
  }
  if (jobColumns.has('picked_up_at')) {
    set.push('picked_up_at = NULL');
  }
  if (jobColumns.has('assigned_at')) {
    set.push('assigned_at = NULL');
  }
  if (jobColumns.has('started_at')) {
    set.push('started_at = NULL');
  }
  if (jobColumns.has('progress_phase')) {
    set.push('progress_phase = NULL');
  }
  if (jobColumns.has('progress_updated_at')) {
    set.push('progress_updated_at = NULL');
  }
  if (jobColumns.has('updated_at')) {
    set.push('updated_at = ?');
    params.push(new Date().toISOString());
  }
  if (jobColumns.has('timeout_at')) {
    set.push("timeout_at = datetime('now', '+' || COALESCE(max_duration_seconds, 600) || ' seconds')");
  }

  const sql = `
    UPDATE jobs
    SET ${set.join(',\n        ')}
    WHERE provider_id = ?
      AND status IN ('running', 'pending', 'assigned', 'pulling')
  `;
  return { sql, params };
}

function runSweep() {
  const startedAt = new Date().toISOString();
  const staleProviders = db.prepare(
    `SELECT id, name, last_heartbeat
     FROM providers
     WHERE last_heartbeat IS NULL
        OR datetime(last_heartbeat) <= datetime('now', '-15 minutes')`
  ).all();

  if (staleProviders.length === 0) {
    console.log('[sweep-stale-providers] No stale providers found.');
    return;
  }

  const providerColumns = getColumnSet('providers');
  const jobColumns = getColumnSet('jobs');
  const { sql: requeueSql, params: requeueParams } = buildRequeueSql(jobColumns);
  const requeueStmt = db.prepare(requeueSql);

  const providerSet = ["status = 'offline'"];
  if (providerColumns.has('current_job_id')) providerSet.push('current_job_id = NULL');
  if (providerColumns.has('updated_at')) providerSet.push("updated_at = datetime('now')");
  const markProviderOfflineStmt = db.prepare(
    `UPDATE providers
     SET ${providerSet.join(', ')}
     WHERE id = ?`
  );

  const tx = db.transaction(() => {
    let providersMarkedOffline = 0;
    let jobsRequeued = 0;

    for (const provider of staleProviders) {
      const providerResult = markProviderOfflineStmt.run(provider.id);
      providersMarkedOffline += providerResult.changes || 0;

      const jobResult = requeueStmt.run(...requeueParams, provider.id);
      jobsRequeued += jobResult.changes || 0;
    }

    const telemetryCleanupResult = db.prepare(
      `DELETE FROM provider_gpu_telemetry
       WHERE datetime(recorded_at) < datetime('now', '-7 days')`
    ).run();
    const telemetryRowsPurged = telemetryCleanupResult.changes || 0;

    return { providersMarkedOffline, jobsRequeued, telemetryRowsPurged };
  });

  const result = tx();
  console.log(
    `[sweep-stale-providers] Completed at ${startedAt}. Providers offline: ${result.providersMarkedOffline}, jobs requeued: ${result.jobsRequeued}, telemetry rows purged: ${result.telemetryRowsPurged}`
  );
}

try {
  runSweep();
  process.exit(0);
} catch (error) {
  console.error('[sweep-stale-providers] Failed:', error.message);
  process.exit(1);
}
