#!/usr/bin/env node
/*
 * DC1 API performance baseline script
 * Run: node backend/tests/performance/load-test.js
 *
 * Prerequisite: local backend running on http://127.0.0.1:8083
 */

const { performance } = require('perf_hooks');

const BASE_URL = process.env.DC1_BASE_URL || 'http://127.0.0.1:8083';
const TARGET_RPS = Number(process.env.DC1_LOAD_RPS || 50);
const DURATION_SECONDS = Number(process.env.DC1_LOAD_DURATION || 30);
const REQUEST_TIMEOUT_MS = Number(process.env.DC1_LOAD_TIMEOUT_MS || 15000);

const THRESHOLDS = {
  p50Ms: 50,
  p99Ms: 500,
  errorRatePercent: 0.1,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pct(values, percentile) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return sorted[idx];
}

function fmt(num, digits = 2) {
  return Number(num).toFixed(digits);
}

async function requestJson(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureBackendHealthy() {
  const health = await requestJson('/api/health', { method: 'GET' }).catch(() => null);
  if (!health || !health.ok) {
    throw new Error(`Backend is not reachable at ${BASE_URL}. Start it first with: node backend/src/server.js`);
  }
}

async function bootstrapTestContext() {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const providerRes = await requestJson('/api/providers/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Perf Provider ${unique}`,
      email: `perf-provider-${unique}@example.com`,
      gpu_model: 'NVIDIA RTX 4090',
      os: 'Linux',
      phone: '+966500000000',
    }),
  });

  if (!providerRes.ok) {
    throw new Error(`Provider register failed (${providerRes.status}): ${JSON.stringify(providerRes.json)}`);
  }

  const providerKey = providerRes.json?.api_key;
  const providerId = providerRes.json?.provider_id;

  if (!providerKey || !providerId) {
    throw new Error('Provider registration did not return api_key/provider_id');
  }

  const heartbeatRes = await requestJson('/api/providers/heartbeat', {
    method: 'POST',
    body: JSON.stringify({
      api_key: providerKey,
      provider_hostname: 'perf-host',
      provider_ip: '127.0.0.1',
      uptime: 120,
      gpu_status: {
        gpu_name: 'NVIDIA RTX 4090',
        gpu_vram_mib: 24576,
        free_vram_mib: 22000,
        gpu_util_pct: 10,
        temp_c: 44,
        power_w: 120,
        driver_version: '550.54',
        cuda_version: '12.4',
        compute_capability: '8.9',
        daemon_version: '3.3.0',
      },
    }),
  });

  if (!heartbeatRes.ok) {
    throw new Error(`Initial provider heartbeat failed (${heartbeatRes.status}): ${JSON.stringify(heartbeatRes.json)}`);
  }

  const renterRes = await requestJson('/api/renters/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Perf Renter ${unique}`,
      email: `perf-renter-${unique}@example.com`,
      organization: 'DC1 QA',
    }),
  });

  if (!renterRes.ok) {
    throw new Error(`Renter register failed (${renterRes.status}): ${JSON.stringify(renterRes.json)}`);
  }

  const renterKey = renterRes.json?.api_key;
  if (!renterKey) {
    throw new Error('Renter registration did not return api_key');
  }

  // Optional top-up to avoid balance-related noise in /jobs/submit.
  await requestJson('/api/renters/topup', {
    method: 'POST',
    headers: { 'x-renter-key': renterKey },
    body: JSON.stringify({ amount_halala: 100000 }),
  }).catch(() => null);

  return { providerKey, providerId, renterKey };
}

async function runEndpointLoadTest(name, makeRequest) {
  const totalRequests = Math.max(1, Math.floor(TARGET_RPS * DURATION_SECONDS));
  const intervalMs = 1000 / TARGET_RPS;
  const start = performance.now();

  const latencies = [];
  const statusCounts = new Map();
  let networkErrors = 0;

  const inFlight = [];

  for (let i = 0; i < totalRequests; i += 1) {
    const dueAt = start + (i * intervalMs);
    const now = performance.now();
    if (dueAt > now) {
      await sleep(dueAt - now);
    }

    const reqStartedAt = performance.now();
    const p = makeRequest()
      .then((status) => {
        const elapsed = performance.now() - reqStartedAt;
        latencies.push(elapsed);
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      })
      .catch(() => {
        const elapsed = performance.now() - reqStartedAt;
        latencies.push(elapsed);
        networkErrors += 1;
      });

    inFlight.push(p);
  }

  await Promise.all(inFlight);

  const wallSeconds = Math.max(0.001, (performance.now() - start) / 1000);
  const completed = latencies.length;

  const non2xx = [...statusCounts.entries()]
    .filter(([status]) => status < 200 || status >= 300)
    .reduce((acc, [, count]) => acc + count, 0);

  const errorCount = non2xx + networkErrors;
  const errorRate = (errorCount / Math.max(1, completed)) * 100;

  const summary = {
    endpoint: name,
    target_rps: TARGET_RPS,
    duration_s: DURATION_SECONDS,
    sent: totalRequests,
    completed,
    achieved_rps: completed / wallSeconds,
    p50_ms: pct(latencies, 50),
    p95_ms: pct(latencies, 95),
    p99_ms: pct(latencies, 99),
    error_rate_pct: errorRate,
    status_counts: Object.fromEntries([...statusCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
    network_errors: networkErrors,
    passed: {
      p50: pct(latencies, 50) < THRESHOLDS.p50Ms,
      p99: pct(latencies, 99) < THRESHOLDS.p99Ms,
      errorRate: errorRate < THRESHOLDS.errorRatePercent,
    },
  };

  return summary;
}

function printTable(results) {
  const rows = results.map((r) => ({
    Endpoint: r.endpoint,
    Sent: r.sent,
    Done: r.completed,
    'RPS(avg)': fmt(r.achieved_rps),
    'p50(ms)': fmt(r.p50_ms, 1),
    'p95(ms)': fmt(r.p95_ms, 1),
    'p99(ms)': fmt(r.p99_ms, 1),
    'Err(%)': fmt(r.error_rate_pct, 3),
    'Pass?': r.passed.p50 && r.passed.p99 && r.passed.errorRate ? 'YES' : 'NO',
  }));

  console.log('\n=== DC1 Performance Baseline ===');
  console.table(rows);

  console.log('\n=== Status Code Breakdown ===');
  for (const r of results) {
    console.log(`- ${r.endpoint}: ${JSON.stringify(r.status_counts)}${r.network_errors ? `, network_errors=${r.network_errors}` : ''}`);
  }

  console.log('\n=== Thresholds ===');
  console.log(`- p50 latency < ${THRESHOLDS.p50Ms}ms`);
  console.log(`- p99 latency < ${THRESHOLDS.p99Ms}ms`);
  console.log(`- error rate < ${THRESHOLDS.errorRatePercent}%`);
}

async function main() {
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Target: ${TARGET_RPS} RPS for ${DURATION_SECONDS}s per endpoint`);

  await ensureBackendHealthy();
  const ctx = await bootstrapTestContext();

  const endpoints = [
    {
      name: 'POST /api/providers/heartbeat',
      fn: async () => {
        const res = await requestJson('/api/providers/heartbeat', {
          method: 'POST',
          body: JSON.stringify({
            api_key: ctx.providerKey,
            provider_hostname: 'perf-host',
            provider_ip: '127.0.0.1',
            uptime: 3600,
            gpu_status: {
              gpu_name: 'NVIDIA RTX 4090',
              gpu_vram_mib: 24576,
              free_vram_mib: 22000,
              gpu_util_pct: 35,
              temp_c: 55,
              power_w: 230,
              driver_version: '550.54',
              cuda_version: '12.4',
              compute_capability: '8.9',
              daemon_version: '3.3.0',
            },
          }),
        });
        return res.status;
      },
    },
    {
      name: 'GET /api/providers/available',
      fn: async () => {
        const res = await requestJson('/api/providers/available', { method: 'GET' });
        return res.status;
      },
    },
    {
      name: 'POST /api/jobs/submit',
      fn: async () => {
        const res = await requestJson('/api/jobs/submit', {
          method: 'POST',
          headers: { 'x-renter-key': ctx.renterKey },
          body: JSON.stringify({
            provider_id: ctx.providerId,
            job_type: 'llm_inference',
            duration_minutes: 0.01,
            params: {
              prompt: 'Load test prompt',
              model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
              max_tokens: 64,
            },
          }),
        });
        return res.status;
      },
    },
    {
      name: 'GET /api/jobs/assigned',
      fn: async () => {
        const res = await requestJson(`/api/jobs/assigned?key=${encodeURIComponent(ctx.providerKey)}`, { method: 'GET' });
        return res.status;
      },
    },
    {
      name: 'GET /api/renters/me',
      fn: async () => {
        const res = await requestJson(`/api/renters/me?key=${encodeURIComponent(ctx.renterKey)}`, { method: 'GET' });
        return res.status;
      },
    },
  ];

  const results = [];
  for (const endpoint of endpoints) {
    console.log(`\nRunning: ${endpoint.name}`);
    const summary = await runEndpointLoadTest(endpoint.name, endpoint.fn);
    results.push(summary);
  }

  printTable(results);

  console.log('\n=== JSON Summary ===');
  console.log(JSON.stringify({ base_url: BASE_URL, target_rps: TARGET_RPS, duration_s: DURATION_SECONDS, results }, null, 2));
}

main().catch((err) => {
  console.error('Load test failed:', err.message);
  process.exit(1);
});
