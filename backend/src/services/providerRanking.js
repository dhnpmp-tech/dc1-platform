'use strict';

const ROLLING_WINDOW_DAYS = 7;
const MAX_ROLLING_SAMPLES = 500;

function toFiniteNumber(value) {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percentileFromSorted(sortedValues, percentile) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
  const rank = (percentile / 100) * (sortedValues.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sortedValues[low];
  const ratio = rank - low;
  return sortedValues[low] + (sortedValues[high] - sortedValues[low]) * ratio;
}

function normalizeSuccessRate(rawSuccessRate) {
  const normalized = toFiniteNumber(rawSuccessRate);
  if (normalized == null) return 1;
  // Accept either [0,1] or [0,100]
  const value = normalized > 1 ? normalized / 100 : normalized;
  return clamp(value, 0, 1);
}

function computeLatencyWeightedScore({ latencyP50Ms, latencyP95Ms, successRate }) {
  const p50 = toFiniteNumber(latencyP50Ms);
  const p95 = toFiniteNumber(latencyP95Ms);
  const success = normalizeSuccessRate(successRate);

  // Lower latency is better. 600ms p50 and 1500ms p95 map close to 1.0.
  const latencyP50Norm = p50 == null ? 0.5 : clamp((3000 - p50) / 3000, 0, 1);
  const latencyP95Norm = p95 == null ? 0.5 : clamp((8000 - p95) / 8000, 0, 1);

  // Deterministic weighted score [0..100].
  const score = (
    success * 0.5 +
    latencyP50Norm * 0.3 +
    latencyP95Norm * 0.2
  ) * 100;

  return Number(score.toFixed(2));
}

function extractLatencyMs(metrics) {
  if (!metrics || typeof metrics !== 'object') return null;
  const candidates = [
    metrics.response_latency_ms,
    metrics.latency_ms,
    metrics.first_token_ms,
    metrics.ttft_ms,
    metrics.inference_latency_ms,
  ];
  for (const candidate of candidates) {
    const value = toFiniteNumber(candidate);
    if (value != null && value >= 0) return value;
  }
  return null;
}

function recordDispatchSample(db, providerId, { observedAt, success, latencyMs }) {
  const timestamp = observedAt || new Date().toISOString();
  const successValue = success ? 1 : 0;
  const latency = toFiniteNumber(latencyMs);

  db.prepare(
    `INSERT INTO provider_dispatch_samples (provider_id, observed_at, success, latency_ms)
     VALUES (?, ?, ?, ?)`
  ).run(providerId, timestamp, successValue, latency != null ? Number(latency.toFixed(2)) : null);
}

function recomputeProviderDispatchRanking(db, providerId, { now = new Date().toISOString() } = {}) {
  const samples = db.all(
    `SELECT success, latency_ms
     FROM provider_dispatch_samples
     WHERE provider_id = ?
       AND observed_at >= datetime('now', ?)
     ORDER BY observed_at DESC
     LIMIT ?`,
    providerId,
    `-${ROLLING_WINDOW_DAYS} days`,
    MAX_ROLLING_SAMPLES
  );

  const sampleCount = samples.length;
  const successCount = samples.reduce((acc, row) => acc + (Number(row.success) > 0 ? 1 : 0), 0);
  const successRate = sampleCount > 0 ? successCount / sampleCount : 1;

  const latencies = samples
    .map((row) => toFiniteNumber(row.latency_ms))
    .filter((value) => value != null && value >= 0)
    .sort((a, b) => a - b);

  const latencyP50Ms = latencies.length > 0 ? Number(percentileFromSorted(latencies, 50).toFixed(2)) : null;
  const latencyP95Ms = latencies.length > 0 ? Number(percentileFromSorted(latencies, 95).toFixed(2)) : null;
  const dispatchScore = computeLatencyWeightedScore({
    latencyP50Ms,
    latencyP95Ms,
    successRate,
  });

  db.prepare(
    `UPDATE providers
     SET dispatch_latency_p50_ms = ?,
         dispatch_latency_p95_ms = ?,
         dispatch_success_rate = ?,
         dispatch_sample_count = ?,
         dispatch_score = ?,
         dispatch_metrics_updated_at = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(
    latencyP50Ms,
    latencyP95Ms,
    Number(successRate.toFixed(4)),
    sampleCount,
    dispatchScore,
    now,
    now,
    providerId
  );

  return {
    dispatch_latency_p50_ms: latencyP50Ms,
    dispatch_latency_p95_ms: latencyP95Ms,
    dispatch_success_rate: Number(successRate.toFixed(4)),
    dispatch_sample_count: sampleCount,
    dispatch_score: dispatchScore,
  };
}

module.exports = {
  ROLLING_WINDOW_DAYS,
  MAX_ROLLING_SAMPLES,
  extractLatencyMs,
  normalizeSuccessRate,
  computeLatencyWeightedScore,
  recordDispatchSample,
  recomputeProviderDispatchRanking,
  percentileFromSorted,
};
