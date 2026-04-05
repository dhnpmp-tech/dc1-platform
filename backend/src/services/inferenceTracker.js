/**
 * In-memory inference request tracker for real-time renter dashboard.
 * Tracks active and recently completed /v1/chat/completions requests.
 *
 * RunPod-style: renters see live progress, tok/s, ETA, cost.
 */

const EVICT_AFTER_MS = 5 * 60 * 1000; // keep completed requests for 5 min
const MAX_COMPLETED = 100; // max completed requests to keep per renter

// Map<requestId, RequestEntry>
const activeRequests = new Map();

// Map<renterId, RequestEntry[]> — ring buffer of recent completions
const completedByRenter = new Map();

// Global session counters per renter: Map<renterId, SessionStats>
const sessionStats = new Map();

function getSessionStats(renterId) {
  if (!sessionStats.has(renterId)) {
    sessionStats.set(renterId, {
      sessionStartedAt: Date.now(),
      totalRequests: 0,
      totalErrors: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalCostHalala: 0,
      totalDurationMs: 0,
    });
  }
  return sessionStats.get(renterId);
}

/**
 * Register a new inference request (call at start of /v1/chat/completions).
 */
function trackStart({ requestId, renterId, model, maxTokens, temperature, stream, providerGpu, providerId, providerEndpoint }) {
  const entry = {
    requestId,
    renterId,
    model,
    maxTokens: maxTokens || 512,
    temperature,
    stream: !!stream,
    providerGpu: providerGpu || 'unknown',
    providerId: providerId || null,
    providerEndpoint: providerEndpoint || null,
    status: 'processing',
    startedAt: Date.now(),
    completedAt: null,
    tokensGenerated: 0,
    promptTokens: 0,
    completionTokens: 0,
    costHalala: 0,
    error: null,
    lastTokenAt: null,
  };
  activeRequests.set(requestId, entry);
  return entry;
}

/**
 * Update token count mid-stream (call from streaming SSE loop).
 */
function trackTokens(requestId, tokensDelta) {
  const entry = activeRequests.get(requestId);
  if (!entry) return;
  entry.tokensGenerated += tokensDelta;
  entry.lastTokenAt = Date.now();
}

/**
 * Mark request as completed (call after response sent).
 */
function trackComplete(requestId, { promptTokens, completionTokens, costHalala } = {}) {
  const entry = activeRequests.get(requestId);
  if (!entry) return;

  entry.status = 'completed';
  entry.completedAt = Date.now();
  entry.promptTokens = promptTokens || entry.promptTokens;
  entry.completionTokens = completionTokens || entry.tokensGenerated;
  entry.costHalala = costHalala || 0;

  // Move to completed ring buffer
  activeRequests.delete(requestId);
  if (!completedByRenter.has(entry.renterId)) {
    completedByRenter.set(entry.renterId, []);
  }
  const ring = completedByRenter.get(entry.renterId);
  ring.push(entry);
  if (ring.length > MAX_COMPLETED) ring.shift();

  // Update session stats
  const stats = getSessionStats(entry.renterId);
  stats.totalRequests++;
  stats.totalPromptTokens += entry.promptTokens;
  stats.totalCompletionTokens += entry.completionTokens;
  stats.totalCostHalala += entry.costHalala;
  stats.totalDurationMs += (entry.completedAt - entry.startedAt);
}

/**
 * Mark request as failed.
 */
function trackError(requestId, errorMessage) {
  const entry = activeRequests.get(requestId);
  if (!entry) return;

  entry.status = 'error';
  entry.completedAt = Date.now();
  entry.error = errorMessage || 'Unknown error';

  activeRequests.delete(requestId);
  if (!completedByRenter.has(entry.renterId)) {
    completedByRenter.set(entry.renterId, []);
  }
  completedByRenter.get(entry.renterId).push(entry);

  const stats = getSessionStats(entry.renterId);
  stats.totalRequests++;
  stats.totalErrors++;
  stats.totalDurationMs += (entry.completedAt - entry.startedAt);
}

/**
 * Compute live metrics for a single active request.
 */
function computeRequestMetrics(entry) {
  const now = Date.now();
  const elapsedMs = entry.completedAt ? (entry.completedAt - entry.startedAt) : (now - entry.startedAt);
  const elapsedSec = elapsedMs / 1000;
  // For completed non-streaming requests, compute tok/s from final completion tokens
  const effectiveTokens = entry.tokensGenerated > 0
    ? entry.tokensGenerated
    : (entry.completionTokens || 0);
  const tokensPerSec = elapsedSec > 0 ? (effectiveTokens / elapsedSec) : 0;

  // Progress: tokens generated vs max_tokens requested
  // For completed requests, use completionTokens if tokensGenerated wasn't tracked (non-streaming)
  const progressTokens = entry.tokensGenerated > 0 ? entry.tokensGenerated : (entry.completionTokens || 0);
  const progressPct = entry.status === 'completed' ? 100
    : entry.maxTokens > 0
      ? Math.min(100, Math.round((progressTokens / entry.maxTokens) * 100))
      : 0;

  // ETA: based on current tok/s rate
  const remainingTokens = Math.max(0, entry.maxTokens - entry.tokensGenerated);
  const etaSeconds = tokensPerSec > 0 ? Math.round(remainingTokens / tokensPerSec) : null;

  return {
    requestId: entry.requestId,
    model: entry.model,
    status: entry.status,
    stream: entry.stream,
    maxTokens: entry.maxTokens,
    temperature: entry.temperature,
    providerGpu: entry.providerGpu,
    tokensGenerated: entry.tokensGenerated,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    progressPct,
    tokensPerSec: Math.round(tokensPerSec * 10) / 10,
    elapsedMs,
    elapsedSec: Math.round(elapsedSec * 10) / 10,
    etaSeconds,
    costHalala: entry.costHalala,
    startedAt: new Date(entry.startedAt).toISOString(),
    completedAt: entry.completedAt ? new Date(entry.completedAt).toISOString() : null,
    error: entry.error,
  };
}

/**
 * Get live dashboard data for a renter.
 */
function getLiveDashboard(renterId) {
  const now = Date.now();

  // Active requests for this renter
  const active = [];
  for (const entry of activeRequests.values()) {
    if (entry.renterId === renterId) {
      active.push(computeRequestMetrics(entry));
    }
  }

  // Recent completed (evict old ones)
  const ring = completedByRenter.get(renterId) || [];
  const recent = [];
  for (let i = ring.length - 1; i >= 0; i--) {
    const entry = ring[i];
    if (now - entry.completedAt > EVICT_AFTER_MS) {
      ring.splice(i, 1);
      continue;
    }
    recent.push(computeRequestMetrics(entry));
    if (recent.length >= 20) break;
  }

  // Session stats
  const stats = getSessionStats(renterId);
  const sessionDurationSec = (now - stats.sessionStartedAt) / 1000;
  const avgTokPerSec = stats.totalDurationMs > 0
    ? Math.round(((stats.totalPromptTokens + stats.totalCompletionTokens) / (stats.totalDurationMs / 1000)) * 10) / 10
    : 0;

  return {
    active,
    recent,
    session: {
      startedAt: new Date(stats.sessionStartedAt).toISOString(),
      durationSec: Math.round(sessionDurationSec),
      totalRequests: stats.totalRequests,
      totalErrors: stats.totalErrors,
      totalPromptTokens: stats.totalPromptTokens,
      totalCompletionTokens: stats.totalCompletionTokens,
      totalTokens: stats.totalPromptTokens + stats.totalCompletionTokens,
      totalCostHalala: stats.totalCostHalala,
      totalCostUsd: `$${(stats.totalCostHalala * 0.00267).toFixed(4)}`,
      avgTokensPerSec: avgTokPerSec,
      successRate: stats.totalRequests > 0
        ? Math.round(((stats.totalRequests - stats.totalErrors) / stats.totalRequests) * 100)
        : 100,
    },
  };
}

module.exports = {
  trackStart,
  trackTokens,
  trackComplete,
  trackError,
  getLiveDashboard,
};
