'use strict';

function toFiniteNumber(value) {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function percentileFromSorted(sortedValues, percentile) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
  if (percentile <= 0) return sortedValues[0];
  if (percentile >= 100) return sortedValues[sortedValues.length - 1];
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * weight;
}

function summarizeLatencyMs(samples) {
  const cleaned = (samples || [])
    .map((value) => toFiniteNumber(value))
    .filter((value) => value != null)
    .sort((a, b) => a - b);
  if (cleaned.length === 0) {
    return {
      sampleCount: 0,
      p50Ms: null,
      p95Ms: null,
    };
  }
  return {
    sampleCount: cleaned.length,
    p50Ms: Math.round(percentileFromSorted(cleaned, 50)),
    p95Ms: Math.round(percentileFromSorted(cleaned, 95)),
  };
}

function normalizeTier(rawTier) {
  const value = String(rawTier || '').trim().toLowerCase();
  if (!value) return 'tier_unknown';
  if (value === 'tier_a' || value === 'a') return 'tier_a';
  if (value === 'tier_b' || value === 'b') return 'tier_b';
  if (value === 'tier_c' || value === 'c') return 'tier_c';
  if (value === 'instant') return 'tier_a';
  return value.startsWith('tier_') ? value : `tier_${value}`;
}

function resolveProviderTier(provider = {}) {
  return normalizeTier(provider.portfolio_tier || provider.gpu_tier || provider.tier);
}

function loadLatencyGateConfig() {
  const toBool = (value, defaultValue) => {
    if (value == null) return defaultValue;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return defaultValue;
  };

  const toBoundedNumber = (value, fallback, { min = null, max = null } = {}) => {
    const num = toFiniteNumber(value);
    if (num == null) return fallback;
    if (min != null && num < min) return fallback;
    if (max != null && num > max) return fallback;
    return num;
  };

  return {
    enabled: toBool(process.env.V1_LATENCY_GATE_ENABLED, true),
    lookbackHours: toBoundedNumber(process.env.V1_LATENCY_GATE_LOOKBACK_HOURS, 168, { min: 1, max: 24 * 30 }),
    maxP50Ms: toBoundedNumber(process.env.V1_LATENCY_GATE_MAX_P50_MS, 300, { min: 50, max: 10_000 }),
    baselineP95Ms: toBoundedNumber(process.env.V1_LATENCY_GATE_BASELINE_P95_MS, 900, { min: 100, max: 20_000 }),
    maxP95RegressionPct: toBoundedNumber(process.env.V1_LATENCY_GATE_MAX_P95_REGRESSION_PCT, 0.2, { min: 0, max: 3 }),
    baselineStreamFailureRate: toBoundedNumber(process.env.V1_LATENCY_GATE_BASELINE_STREAM_FAILURE_RATE, 0.02, { min: 0, max: 1 }),
    maxStreamFailureRegressionPct: toBoundedNumber(process.env.V1_LATENCY_GATE_MAX_STREAM_FAILURE_REGRESSION_PCT, 0.5, { min: 0, max: 10 }),
    minLatencySamples: Math.max(1, Math.round(toBoundedNumber(process.env.V1_LATENCY_GATE_MIN_SAMPLES, 3, { min: 1, max: 500 }))),
    minStreamSamples: Math.max(0, Math.round(toBoundedNumber(process.env.V1_LATENCY_GATE_MIN_STREAM_SAMPLES, 5, { min: 0, max: 500 }))),
  };
}

function getProviderLatencyRows(db, providerIds, lookbackHours) {
  if (!Array.isArray(providerIds) || providerIds.length === 0) return [];
  const placeholders = providerIds.map(() => '?').join(', ');
  const query = `
    SELECT provider_id, latency_ms, completed_at
    FROM benchmark_runs
    WHERE status = 'completed'
      AND latency_ms IS NOT NULL
      AND provider_id IN (${placeholders})
      AND (
        completed_at IS NULL
        OR datetime(completed_at) >= datetime('now', ?)
      )
  `;
  try {
    return db.all(query, ...providerIds, `-${Math.max(1, lookbackHours)} hours`);
  } catch (_) {
    return [];
  }
}

function getProviderStreamRows(db, providerIds, lookbackHours) {
  if (!Array.isArray(providerIds) || providerIds.length === 0) return [];
  const placeholders = providerIds.map(() => '?').join(', ');
  const query = `
    SELECT provider_id,
           SUM(CASE WHEN stream_success = 1 THEN 1 ELSE 0 END) AS success_count,
           SUM(CASE WHEN stream_success = 0 THEN 1 ELSE 0 END) AS failure_count
    FROM inference_stream_events
    WHERE provider_id IN (${placeholders})
      AND datetime(created_at) >= datetime('now', ?)
    GROUP BY provider_id
  `;
  try {
    return db.all(query, ...providerIds, `-${Math.max(1, lookbackHours)} hours`);
  } catch (_) {
    return [];
  }
}

function evaluateProvider(provider, latencySamples, streamStats, config) {
  const p95Limit = config.baselineP95Ms * (1 + config.maxP95RegressionPct);
  const streamFailureLimit = config.baselineStreamFailureRate * (1 + config.maxStreamFailureRegressionPct);
  const latency = summarizeLatencyMs(latencySamples);

  const successCount = Number(streamStats?.success_count || 0);
  const failureCount = Number(streamStats?.failure_count || 0);
  const streamSampleCount = successCount + failureCount;
  const streamFailureRate = streamSampleCount > 0 ? (failureCount / streamSampleCount) : 0;

  const reasons = [];
  if (latency.sampleCount > 0) {
    if (latency.p50Ms != null && latency.p50Ms > config.maxP50Ms) {
      reasons.push(`p50 ${latency.p50Ms}ms > ${config.maxP50Ms}ms`);
    }
    if (latency.p95Ms != null && latency.p95Ms > p95Limit) {
      reasons.push(`p95 ${latency.p95Ms}ms > ${Math.round(p95Limit)}ms baseline-regression limit`);
    }
  } else {
    reasons.push('missing latency samples');
  }

  if (streamSampleCount > 0 && streamFailureRate > streamFailureLimit) {
    reasons.push(`stream failure ${(streamFailureRate * 100).toFixed(2)}% > ${(streamFailureLimit * 100).toFixed(2)}% baseline-regression limit`);
  }

  const sparse =
    latency.sampleCount < config.minLatencySamples
    || streamSampleCount < config.minStreamSamples;

  const passesCoreThresholds = reasons.length === 0;
  const strictPass = passesCoreThresholds && !sparse;
  const sparsePass = passesCoreThresholds && sparse && latency.sampleCount > 0;

  return {
    providerId: provider.id,
    providerTier: resolveProviderTier(provider),
    latency,
    stream: {
      successCount,
      failureCount,
      sampleCount: streamSampleCount,
      failureRate: Number(streamFailureRate.toFixed(6)),
    },
    sparse,
    strictPass,
    sparsePass,
    reasons,
    gpuUtilPct: toFiniteNumber(provider.gpu_util_pct) ?? 0,
  };
}

function sortProviderCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    if (a.gpuUtilPct !== b.gpuUtilPct) return a.gpuUtilPct - b.gpuUtilPct;
    return Number(a.providerId) - Number(b.providerId);
  });
}

function summarizeByTier(evaluations) {
  const grouped = new Map();
  for (const row of evaluations) {
    const tier = row.providerTier;
    if (!grouped.has(tier)) {
      grouped.set(tier, {
        tier,
        providerCount: 0,
        latencySamples: [],
        streamSuccess: 0,
        streamFailure: 0,
      });
    }
    const bucket = grouped.get(tier);
    bucket.providerCount += 1;
    if (row.latency?.sampleCount > 0) bucket.latencySamples.push(row.latency.p50Ms, row.latency.p95Ms);
    bucket.streamSuccess += row.stream.successCount;
    bucket.streamFailure += row.stream.failureCount;
  }

  return Array.from(grouped.values()).map((bucket) => {
    const latencySummary = summarizeLatencyMs(bucket.latencySamples);
    const streamSamples = bucket.streamSuccess + bucket.streamFailure;
    const failureRate = streamSamples > 0 ? bucket.streamFailure / streamSamples : 0;
    return {
      tier: bucket.tier,
      provider_count: bucket.providerCount,
      latency_ms: {
        p50: latencySummary.p50Ms,
        p95: latencySummary.p95Ms,
        sample_count: latencySummary.sampleCount,
      },
      stream: {
        success_count: bucket.streamSuccess,
        failure_count: bucket.streamFailure,
        failure_rate: Number(failureRate.toFixed(6)),
      },
    };
  });
}

function selectProvidersWithLatencyGate({ db, providers = [], config = loadLatencyGateConfig() }) {
  if (!config.enabled) {
    const all = sortProviderCandidates((providers || []).map((provider) => ({
      providerId: provider.id,
      gpuUtilPct: toFiniteNumber(provider.gpu_util_pct) ?? 0,
    }))).map((entry) => entry.providerId);
    return {
      pass: all.length > 0,
      mode: 'disabled',
      selectedProviderId: all[0] || null,
      fallbackProviderIds: all.slice(1),
      reasons: [],
      tiers: [],
      providers: [],
      thresholds: config,
    };
  }

  const providerIds = (providers || []).map((provider) => provider.id);
  const latencyRows = getProviderLatencyRows(db, providerIds, config.lookbackHours);
  const streamRows = getProviderStreamRows(db, providerIds, config.lookbackHours);

  const latencyByProvider = new Map();
  for (const row of latencyRows) {
    const providerId = Number(row.provider_id);
    if (!latencyByProvider.has(providerId)) latencyByProvider.set(providerId, []);
    const latency = toFiniteNumber(row.latency_ms);
    if (latency != null) latencyByProvider.get(providerId).push(latency);
  }

  const streamByProvider = new Map();
  for (const row of streamRows) {
    streamByProvider.set(Number(row.provider_id), {
      success_count: Number(row.success_count || 0),
      failure_count: Number(row.failure_count || 0),
    });
  }

  const evaluations = (providers || []).map((provider) => evaluateProvider(
    provider,
    latencyByProvider.get(Number(provider.id)) || [],
    streamByProvider.get(Number(provider.id)) || null,
    config
  ));

  const anyLatencySamples = evaluations.some((entry) => entry.latency.sampleCount > 0);
  const strictPass = sortProviderCandidates(evaluations.filter((entry) => entry.strictPass));
  const sparsePass = sortProviderCandidates(evaluations.filter((entry) => entry.sparsePass));

  if (!anyLatencySamples) {
    const fallback = sortProviderCandidates(evaluations);
    return {
      pass: fallback.length > 0,
      mode: 'telemetry_unavailable_fallback',
      selectedProviderId: fallback[0]?.providerId || null,
      fallbackProviderIds: fallback.slice(1).map((entry) => entry.providerId),
      reasons: fallback.length > 0 ? [] : ['no capable providers'],
      tiers: summarizeByTier(evaluations),
      providers: evaluations,
      thresholds: config,
    };
  }

  if (strictPass.length > 0) {
    return {
      pass: true,
      mode: 'strict',
      selectedProviderId: strictPass[0].providerId,
      fallbackProviderIds: strictPass.slice(1).map((entry) => entry.providerId),
      reasons: [],
      tiers: summarizeByTier(evaluations),
      providers: evaluations,
      thresholds: config,
    };
  }

  if (sparsePass.length > 0) {
    return {
      pass: true,
      mode: 'sparse_provider_fallback',
      selectedProviderId: sparsePass[0].providerId,
      fallbackProviderIds: sparsePass.slice(1).map((entry) => entry.providerId),
      reasons: [],
      tiers: summarizeByTier(evaluations),
      providers: evaluations,
      thresholds: config,
    };
  }

  const failReasons = evaluations
    .filter((entry) => entry.reasons.length > 0)
    .map((entry) => `provider ${entry.providerId}: ${entry.reasons.join(', ')}`);

  return {
    pass: false,
    mode: 'blocked',
    selectedProviderId: null,
    fallbackProviderIds: [],
    reasons: failReasons.length > 0 ? failReasons : ['no provider satisfies latency budget gate'],
    tiers: summarizeByTier(evaluations),
    providers: evaluations,
    thresholds: config,
  };
}

function recordStreamOutcome(db, payload = {}) {
  try {
    db.prepare(
      `INSERT INTO inference_stream_events
        (provider_id, model_id, provider_tier, stream_success, stream_error_code, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      payload.providerId,
      payload.modelId || null,
      normalizeTier(payload.providerTier || null),
      payload.success ? 1 : 0,
      payload.errorCode || null,
      toFiniteNumber(payload.durationMs),
      new Date().toISOString()
    );
  } catch (_) {
    // Best effort only; gate can operate on missing stream telemetry.
  }
}

module.exports = {
  loadLatencyGateConfig,
  summarizeLatencyMs,
  selectProvidersWithLatencyGate,
  recordStreamOutcome,
  resolveProviderTier,
  normalizeTier,
};
