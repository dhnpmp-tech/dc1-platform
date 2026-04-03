const WINDOW_DEFS = [
  { key: '24h', hours: 24 },
  { key: '7d', hours: 24 * 7 },
];

const HEARTBEAT_INTERVAL_SECONDS = 30;
const ONLINE_HEARTBEAT_WINDOW_SECONDS = 5 * 60;

function percentileFromSorted(values, percentile) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const p = Math.min(Math.max(Number(percentile) || 0, 0), 100);
  const idx = Math.ceil((p / 100) * values.length) - 1;
  const boundedIdx = Math.min(Math.max(idx, 0), values.length - 1);
  const selected = Number(values[boundedIdx]);
  return Number.isFinite(selected) ? selected : null;
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function computeExpectedHeartbeatSamples(providers, sinceMs, nowMs) {
  let total = 0;
  for (const provider of providers) {
    const createdMs = Date.parse(provider?.created_at || '');
    if (!Number.isFinite(createdMs)) continue;
    const activeFrom = Math.max(createdMs, sinceMs);
    const activeSeconds = Math.floor((nowMs - activeFrom) / 1000);
    if (activeSeconds <= 0) continue;
    total += Math.floor(activeSeconds / HEARTBEAT_INTERVAL_SECONDS);
  }
  return total;
}

function summarizeLatency(db, sinceIso) {
  const rows = db.all(
    `SELECT duration_ms
       FROM inference_stream_events
      WHERE created_at >= ?
        AND duration_ms IS NOT NULL
        AND duration_ms >= 0
      ORDER BY duration_ms ASC`,
    sinceIso
  );
  const values = rows
    .map((row) => Number(row?.duration_ms))
    .filter((value) => Number.isFinite(value) && value >= 0);

  return {
    sample_count: values.length,
    p50_ms: percentileFromSorted(values, 50),
    p95_ms: percentileFromSorted(values, 95),
  };
}

function summarizeCapacity(db, sinceIso, nowIso) {
  const buckets = db.all(
    `SELECT strftime('%Y-%m-%dT%H:%M:00Z', received_at) AS minute_bucket,
            COUNT(DISTINCT provider_id) AS online_provider_count
       FROM heartbeat_log
      WHERE received_at >= ?
      GROUP BY minute_bucket
      ORDER BY minute_bucket ASC`,
    sinceIso
  );
  const onlineCounts = buckets
    .map((row) => Number(row?.online_provider_count))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  const providersSeen = db.get(
    `SELECT COUNT(DISTINCT provider_id) AS count
       FROM heartbeat_log
      WHERE received_at >= ?`,
    sinceIso
  )?.count || 0;
  const onlineNow = db.get(
    `SELECT COUNT(*) AS count
       FROM providers
      WHERE last_heartbeat IS NOT NULL
        AND last_heartbeat >= datetime(?, '-${ONLINE_HEARTBEAT_WINDOW_SECONDS} seconds')`,
    nowIso
  )?.count || 0;

  return {
    bucket_count: onlineCounts.length,
    sample_count: onlineCounts.length,
    providers_seen: Number(providersSeen),
    online_now: Number(onlineNow),
    online_capacity_p50: percentileFromSorted(onlineCounts, 50),
    online_capacity_p95: percentileFromSorted(onlineCounts, 95),
    online_capacity_max: onlineCounts.length > 0 ? onlineCounts[onlineCounts.length - 1] : null,
  };
}

function buildWindowSummary(db, providers, nowMs, nowIso, windowDef) {
  const sinceMs = nowMs - (windowDef.hours * 60 * 60 * 1000);
  const sinceIso = toIso(sinceMs);
  const heartbeatSampleCount = db.get(
    `SELECT COUNT(*) AS count FROM heartbeat_log WHERE received_at >= ?`,
    sinceIso
  )?.count || 0;
  const expectedHeartbeatSamples = computeExpectedHeartbeatSamples(providers, sinceMs, nowMs);
  const uptimePct = expectedHeartbeatSamples > 0
    ? Math.min(100, Number(((heartbeatSampleCount / expectedHeartbeatSamples) * 100).toFixed(2)))
    : null;

  return {
    window_hours: windowDef.hours,
    generated_at: nowIso,
    uptime: {
      sample_count: Number(heartbeatSampleCount),
      expected_sample_count: Number(expectedHeartbeatSamples),
      pct: uptimePct,
    },
    latency_ms: summarizeLatency(db, sinceIso),
    online_capacity: summarizeCapacity(db, sinceIso, nowIso),
  };
}

function buildDaemonHealthSummary(db, { now = new Date() } = {}) {
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const providers = db.all('SELECT id, created_at FROM providers');
  const windows = {};
  for (const windowDef of WINDOW_DEFS) {
    windows[windowDef.key] = buildWindowSummary(db, providers, nowMs, nowIso, windowDef);
  }

  return {
    generated_at: nowIso,
    data_sources: {
      uptime: 'heartbeat_log',
      latency_ms: 'inference_stream_events.duration_ms',
      online_capacity: 'heartbeat_log',
    },
    windows,
  };
}

module.exports = {
  buildDaemonHealthSummary,
};
