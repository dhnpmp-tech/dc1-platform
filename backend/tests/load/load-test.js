#!/usr/bin/env node
/*
 * DCP Sprint 20 load test suite.
 *
 * Scenarios:
 *  1) vLLM completion endpoint
 *  2) Public marketplace endpoint
 *  3) Job queue status endpoint
 *  4) Container registry endpoint
 *
 * Usage:
 *   DC1_BASE_URL=http://127.0.0.1:8083 node backend/tests/load/load-test.js
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.DC1_BASE_URL || 'http://127.0.0.1:8083';
const REQUEST_TIMEOUT_MS = Number(process.env.DC1_LOAD_TIMEOUT_MS || 35000);
const RESULTS_FILE = process.env.DC1_LOAD_RESULTS_FILE
  || path.resolve(__dirname, 'load-test-results.md');
const BREAKPOINT_PROBE_SECONDS = Number(process.env.DC1_LOAD_BREAKPOINT_SECONDS || 8);

const THRESHOLDS = {
  vllmComplete: {
    p99Ms: 30000,
    maxErrorRatePct: 5,
    toleratedStatuses: new Set([503]),
    disallowedStatuses: new Set([500]),
  },
  providersPublic: {
    p99Ms: 500,
    maxErrorRatePct: 0,
    requireCacheControlContains: 'max-age=30',
  },
  queueStatus: {
    p99Ms: 200,
    maxErrorRatePct: 0,
  },
  containersRegistry: {
    p99Ms: 300,
    maxErrorRatePct: 0,
  },
};

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[idx];
}

function toFixed(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function statusClass(status) {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500) return '5xx';
  return 'other';
}

function parseJsonOrRaw(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return { raw: text };
  }
}

async function requestJson(endpoint, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const text = await response.text();
    const body = parseJsonOrRaw(text);
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      ok: response.ok,
      status: response.status,
      body,
      headers,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureHealthy() {
  const res = await requestJson('/api/health', { method: 'GET' }).catch(() => null);
  if (!res || !res.ok) {
    throw new Error(`Backend not reachable at ${BASE_URL}. Start backend first.`);
  }
}

async function registerRenterWithBalance(suffix) {
  const renterRegister = await requestJson('/api/renters/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Load Renter ${suffix}`,
      email: `load-renter-${suffix}@example.com`,
      organization: 'DCP QA',
    }),
  });

  if (!renterRegister.ok) {
    throw new Error(`Renter registration failed (${renterRegister.status})`);
  }

  const renterKey = renterRegister.body?.api_key;
  if (!renterKey) {
    throw new Error('Renter registration missing api_key');
  }

  const topup = await requestJson('/api/renters/topup', {
    method: 'POST',
    headers: { 'x-renter-key': renterKey },
    body: JSON.stringify({ amount_halala: 100000 }),
  });

  if (!topup.ok && topup.status !== 404) {
    console.warn(`[bootstrap] renter topup returned ${topup.status}`);
  }

  return renterKey;
}

async function bootstrapContext() {
  const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const providerRegister = await requestJson('/api/providers/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Load Provider ${uniq}`,
      email: `load-provider-${uniq}@example.com`,
      gpu_model: 'NVIDIA RTX 4090',
      os: 'linux',
      phone: '+966500000000',
    }),
  });

  if (!providerRegister.ok) {
    throw new Error(`Provider registration failed (${providerRegister.status})`);
  }

  const providerKey = providerRegister.body?.api_key;
  if (!providerKey) {
    throw new Error('Provider registration missing api_key');
  }

  const hb = await requestJson('/api/providers/heartbeat', {
    method: 'POST',
    body: JSON.stringify({
      api_key: providerKey,
      provider_hostname: 'load-host',
      provider_ip: '127.0.0.1',
      uptime: 120,
      gpu_status: {
        gpu_name: 'NVIDIA RTX 4090',
        gpu_vram_mib: 24576,
        free_vram_mib: 22000,
        gpu_util_pct: 15,
        temp_c: 48,
        power_w: 180,
        driver_version: '550.54',
        cuda_version: '12.4',
        compute_capability: '8.9',
        daemon_version: '3.3.0',
      },
      gpu_count: 1,
      supported_compute_types: ['inference', 'training', 'rendering'],
    }),
  });

  if (!hb.ok) {
    throw new Error(`Initial heartbeat failed (${hb.status})`);
  }

  const renterKeys = [];
  const poolSize = Number(process.env.DC1_LOAD_RENTER_POOL_SIZE || 40);
  for (let i = 0; i < poolSize; i += 1) {
    // Spread requests across many keys to avoid per-key rate limiting dominating.
    renterKeys.push(await registerRenterWithBalance(`${uniq}-${i}`));
  }

  return { renterKeys };
}

function normalizeRequestResult(requestResult) {
  if (typeof requestResult === 'number') {
    return { status: requestResult, headers: {} };
  }
  if (requestResult && typeof requestResult === 'object') {
    return {
      status: Number(requestResult.status || 0),
      headers: requestResult.headers || {},
    };
  }
  return { status: 0, headers: {} };
}

function computeErrorRates({ statusCounts, networkErrors, toleratedStatuses }) {
  const totalByStatus = [...statusCounts.values()].reduce((sum, n) => sum + n, 0);
  const total = totalByStatus + networkErrors;
  if (total === 0) {
    return { total, strictErrorRatePct: 0, thresholdErrorRatePct: 0 };
  }

  let strictErrorCount = networkErrors;
  let thresholdErrorCount = networkErrors;

  for (const [status, count] of statusCounts.entries()) {
    if (status < 200 || status >= 300) strictErrorCount += count;
    const isTolerated = toleratedStatuses?.has(status) || false;
    if ((status < 200 || status >= 300) && !isTolerated) thresholdErrorCount += count;
  }

  return {
    total,
    strictErrorRatePct: (strictErrorCount / total) * 100,
    thresholdErrorRatePct: (thresholdErrorCount / total) * 100,
  };
}

async function runLoadScenario({
  name,
  id,
  concurrency,
  durationSeconds,
  makeRequest,
  toleratedStatuses = new Set(),
  sampledHeaderNames = [],
}) {
  const startedAt = performance.now();
  const endAt = startedAt + (durationSeconds * 1000);

  const latencies = [];
  const statusCounts = new Map();
  const headerSamples = new Map();
  let networkErrors = 0;

  async function workerLoop() {
    while (performance.now() < endAt) {
      const reqStart = performance.now();
      try {
        const requestResult = await makeRequest();
        const { status, headers } = normalizeRequestResult(requestResult);
        const elapsed = performance.now() - reqStart;
        latencies.push(elapsed);
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

        sampledHeaderNames.forEach((name) => {
          const key = String(name).toLowerCase();
          const val = headers[key];
          if (val != null) {
            headerSamples.set(`${key}:${val}`, (headerSamples.get(`${key}:${val}`) || 0) + 1);
          }
        });
      } catch (_) {
        const elapsed = performance.now() - reqStart;
        latencies.push(elapsed);
        networkErrors += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => workerLoop()));

  const wallSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
  const rates = computeErrorRates({ statusCounts, networkErrors, toleratedStatuses });

  const byClass = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
    other: 0,
  };
  for (const [status, count] of statusCounts.entries()) {
    byClass[statusClass(status)] += count;
  }

  return {
    id,
    name,
    concurrency,
    durationSeconds,
    totalRequests: rates.total,
    reqPerSec: rates.total / wallSeconds,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    strictErrorRatePct: rates.strictErrorRatePct,
    thresholdErrorRatePct: rates.thresholdErrorRatePct,
    networkErrors,
    statusCounts: Object.fromEntries([...statusCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
    byClass,
    headerSamples: Object.fromEntries([...headerSamples.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  };
}

function evaluateScenario(result, threshold) {
  const reasons = [];
  let pass = true;

  if (threshold.maxErrorRatePct != null && result.thresholdErrorRatePct > threshold.maxErrorRatePct) {
    pass = false;
    reasons.push(`error_rate ${toFixed(result.thresholdErrorRatePct, 3)}% > ${toFixed(threshold.maxErrorRatePct, 3)}%`);
  }

  if (threshold.p99Ms != null && result.p99Ms > threshold.p99Ms) {
    pass = false;
    reasons.push(`p99 ${toFixed(result.p99Ms, 1)}ms > ${threshold.p99Ms}ms`);
  }

  if (threshold.disallowedStatuses && threshold.disallowedStatuses.size > 0) {
    for (const status of threshold.disallowedStatuses) {
      if (Number(result.statusCounts[String(status)] || 0) > 0) {
        pass = false;
        reasons.push(`received disallowed status ${status}`);
      }
    }
  }

  if (threshold.requireCacheControlContains) {
    const found = Object.keys(result.headerSamples)
      .some((k) => k.startsWith('cache-control:') && k.includes(threshold.requireCacheControlContains));
    if (!found) {
      pass = false;
      reasons.push(`missing cache-control containing "${threshold.requireCacheControlContains}"`);
    }
  }

  return { pass, reasons };
}

async function findBreakingPoint({
  scenario,
  toleratedStatuses = new Set(),
}) {
  const probes = scenario.breakpointProbeConcurrency;
  if (!Array.isArray(probes) || probes.length === 0) {
    return { breakingPoint: null, samples: [] };
  }

  const samples = [];
  for (const concurrency of probes) {
    const probeResult = await runLoadScenario({
      id: `${scenario.id}-probe-${concurrency}`,
      name: `${scenario.name} [probe ${concurrency}]`,
      concurrency,
      durationSeconds: BREAKPOINT_PROBE_SECONDS,
      makeRequest: scenario.makeRequest,
      toleratedStatuses,
      sampledHeaderNames: [],
    });
    samples.push({
      concurrency,
      thresholdErrorRatePct: probeResult.thresholdErrorRatePct,
      strictErrorRatePct: probeResult.strictErrorRatePct,
      p99Ms: probeResult.p99Ms,
      reqPerSec: probeResult.reqPerSec,
    });
  }

  const crossed = samples.find((s) => s.thresholdErrorRatePct > 1);
  return {
    breakingPoint: crossed ? crossed.concurrency : null,
    samples,
  };
}

function renderMarkdown({ baseUrl, startedIso, finishedIso, results }) {
  const headers = [
    '| Endpoint | Concurrency | Duration (s) | Req/s | p50 (ms) | p95 (ms) | p99 (ms) | Error % (strict) | Error % (threshold) | Breaking Point (>1%) | Status | Notes |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|',
  ];

  const rows = results.map((r) => {
    const status = r.evaluation.pass ? 'PASS' : 'FAIL';
    const notes = r.evaluation.reasons.length ? r.evaluation.reasons.join('; ') : 'Thresholds met';
    const breakPoint = r.breakingPoint.breakingPoint == null ? 'Not reached' : String(r.breakingPoint.breakingPoint);

    return `| ${r.name} | ${r.concurrency} | ${r.durationSeconds} | ${toFixed(r.reqPerSec)} | ${toFixed(r.p50Ms, 1)} | ${toFixed(r.p95Ms, 1)} | ${toFixed(r.p99Ms, 1)} | ${toFixed(r.strictErrorRatePct, 3)} | ${toFixed(r.thresholdErrorRatePct, 3)} | ${breakPoint} | ${status} | ${notes} |`;
  });

  const statusBlocks = results.map((r) => {
    const cacheNotes = Object.keys(r.headerSamples).length
      ? `; header_samples=${JSON.stringify(r.headerSamples)}`
      : '';
    return `- **${r.name}**: ${JSON.stringify(r.statusCounts)}${r.networkErrors ? `, network_errors=${r.networkErrors}` : ''}${cacheNotes}`;
  }).join('\n');

  const breakpointBlocks = results.map((r) => {
    const probeLines = r.breakingPoint.samples.map((sample) => {
      return `{c=${sample.concurrency}, err_threshold=${toFixed(sample.thresholdErrorRatePct, 3)}%, err_strict=${toFixed(sample.strictErrorRatePct, 3)}%, p99=${toFixed(sample.p99Ms, 1)}ms, rps=${toFixed(sample.reqPerSec, 2)}}`;
    });
    return `- **${r.name}**: ${probeLines.length ? probeLines.join(' ') : 'No probes run'}`;
  }).join('\n');

  const p1Findings = results
    .filter((r) => !r.evaluation.pass)
    .map((r) => `- **P1** ${r.name}: ${r.evaluation.reasons.join('; ')}`)
    .join('\n');

  return [
    '# DCP Load Test Results',
    '',
    `- **Base URL**: \`${baseUrl}\``,
    `- **Started (UTC)**: ${startedIso}`,
    `- **Finished (UTC)**: ${finishedIso}`,
    '',
    '## Results Table',
    ...headers,
    ...rows,
    '',
    '## Status Code Breakdown',
    statusBlocks || '- No requests executed',
    '',
    '## Breaking Point Probes',
    `- Probe duration per concurrency: ${BREAKPOINT_PROBE_SECONDS}s`,
    breakpointBlocks || '- No probes executed',
    '',
    '## Thresholds',
    '- `POST /api/vllm/complete`: 50 concurrent for 30s, p99 < 30s, error rate < 5%, and no HTTP 500. HTTP 503 is tolerated degradation when no provider is available.',
    '- `GET /api/providers/public`: 200 concurrent for 60s, p99 < 500ms, error rate 0%, and `Cache-Control` contains `max-age=30`.',
    '- `GET /api/jobs/queue/status`: 100 concurrent for 30s, p99 < 200ms, error rate 0%.',
    '- `GET /api/containers/registry`: 100 concurrent for 30s, p99 < 300ms, error rate 0%.',
    '',
    '## P1 Performance Bugs',
    p1Findings || '- None',
    '',
  ].join('\n');
}

async function main() {
  const startedIso = new Date().toISOString();

  console.log(`[load] base_url=${BASE_URL}`);
  await ensureHealthy();
  const ctx = await bootstrapContext();

  let renterIdx = 0;
  const nextRenterKey = () => {
    const key = ctx.renterKeys[renterIdx % ctx.renterKeys.length];
    renterIdx += 1;
    return key;
  };

  const scenarios = [
    {
      id: 'vllmComplete',
      name: 'POST /api/vllm/complete',
      concurrency: 50,
      durationSeconds: 30,
      breakpointProbeConcurrency: [25, 50, 75, 100, 150],
      sampledHeaderNames: [],
      makeRequest: async () => {
        const res = await requestJson('/api/vllm/complete', {
          method: 'POST',
          headers: {
            'x-renter-key': nextRenterKey(),
          },
          body: JSON.stringify({
            model: 'meta-llama/Llama-3.1-8B-Instruct',
            messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
            max_tokens: 32,
            temperature: 0.2,
          }),
        });
        return { status: res.status, headers: res.headers };
      },
    },
    {
      id: 'providersPublic',
      name: 'GET /api/providers/public',
      concurrency: 200,
      durationSeconds: 60,
      breakpointProbeConcurrency: [100, 150, 200, 250, 300],
      sampledHeaderNames: ['cache-control', 'x-cache'],
      makeRequest: async () => {
        const res = await requestJson('/api/providers/public', { method: 'GET' });
        return { status: res.status, headers: res.headers };
      },
    },
    {
      id: 'queueStatus',
      name: 'GET /api/jobs/queue/status',
      concurrency: 100,
      durationSeconds: 30,
      breakpointProbeConcurrency: [50, 100, 150, 200, 300],
      sampledHeaderNames: [],
      makeRequest: async () => {
        const res = await requestJson('/api/jobs/queue/status', { method: 'GET' });
        return { status: res.status, headers: res.headers };
      },
    },
    {
      id: 'containersRegistry',
      name: 'GET /api/containers/registry',
      concurrency: 100,
      durationSeconds: 30,
      breakpointProbeConcurrency: [50, 100, 150, 200, 300],
      sampledHeaderNames: [],
      makeRequest: async () => {
        const res = await requestJson('/api/containers/registry', { method: 'GET' });
        return { status: res.status, headers: res.headers };
      },
    },
  ];

  const results = [];
  for (const scenario of scenarios) {
    const threshold = THRESHOLDS[scenario.id];
    console.log(`[load] running ${scenario.name} (concurrency=${scenario.concurrency}, duration=${scenario.durationSeconds}s)`);

    const raw = await runLoadScenario({
      id: scenario.id,
      name: scenario.name,
      concurrency: scenario.concurrency,
      durationSeconds: scenario.durationSeconds,
      makeRequest: scenario.makeRequest,
      toleratedStatuses: threshold.toleratedStatuses || new Set(),
      sampledHeaderNames: scenario.sampledHeaderNames || [],
    });

    const evaluation = evaluateScenario(raw, threshold);
    const breakingPoint = await findBreakingPoint({
      scenario,
      toleratedStatuses: threshold.toleratedStatuses || new Set(),
    });

    results.push({ ...raw, evaluation, breakingPoint });
  }

  const finishedIso = new Date().toISOString();
  const markdown = renderMarkdown({
    baseUrl: BASE_URL,
    startedIso,
    finishedIso,
    results,
  });

  fs.writeFileSync(RESULTS_FILE, markdown, 'utf8');
  console.log(`[load] results written to ${RESULTS_FILE}`);

  const failed = results.filter((r) => !r.evaluation.pass);
  if (failed.length > 0) {
    console.error('[load] P1 performance issues detected:');
    for (const row of failed) {
      console.error(`  - ${row.name}: ${row.evaluation.reasons.join('; ')}`);
    }
    process.exit(1);
  }

  console.log('[load] all scenario thresholds passed');
}

main().catch((error) => {
  const now = new Date().toISOString();
  const failureMd = [
    '# DCP Load Test Results',
    '',
    `- **Base URL**: \`${BASE_URL}\``,
    `- **Finished (UTC)**: ${now}`,
    '',
    '## Run Status',
    `- Failed to execute load suite: ${error.message}`,
    '',
    '## Next Action',
    '- Start backend (`node backend/src/server.js` or PM2 app on port 8083) and rerun `npm run test:load` from `backend/`.',
    '',
  ].join('\n');

  try {
    fs.writeFileSync(RESULTS_FILE, failureMd, 'utf8');
  } catch (writeErr) {
    console.error('[load] also failed to write failure markdown:', writeErr.message);
  }

  console.error('[load] suite failed:', error.message);
  process.exit(1);
});
