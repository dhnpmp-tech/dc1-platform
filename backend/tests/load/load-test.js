#!/usr/bin/env node
/*
 * DCP Sprint 15 load test suite.
 *
 * Scenarios:
 *  1) Marketplace burst (50 concurrent GET for 30s)
 *  2) Job submission flood (20 concurrent POST for 60s)
 *  3) Heartbeat storm (30 concurrent POST for 30s)
 *  4) Admin dashboard under load (10 concurrent GET for 30s)
 *
 * Usage:
 *   DC1_BASE_URL=http://127.0.0.1:8083 node backend/tests/load/load-test.js
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.DC1_BASE_URL || 'http://127.0.0.1:8083';
const REQUEST_TIMEOUT_MS = Number(process.env.DC1_LOAD_TIMEOUT_MS || 15000);
const RESULTS_FILE = process.env.DC1_LOAD_RESULTS_FILE
  || path.resolve(__dirname, 'load-test-results.md');

const MARKETPLACE_PATH = process.env.DC1_LOAD_MARKETPLACE_PATH || '/api/providers/marketplace';
const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN || '';

const THRESHOLDS = {
  marketplaceBurst: { p99Ms: 500, maxErrorRatePct: 0 },
  jobSubmissionFlood: {
    p99Ms: 1000,
    requireSomeSuccess: true,
    require429: true,
  },
  heartbeatStorm: { p99Ms: 200, requireAll200: true },
  adminDashboard: { p99Ms: 1000, maxErrorRatePct: 0 },
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
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }

    return {
      ok: response.ok,
      status: response.status,
      body: parsed,
      headers: response.headers,
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
  const providerId = providerRegister.body?.provider_id;

  if (!providerKey || !providerId) {
    throw new Error('Provider registration missing api_key/provider_id');
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
    }),
  });

  if (!hb.ok) {
    throw new Error(`Initial heartbeat failed (${hb.status})`);
  }

  const renterRegister = await requestJson('/api/renters/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Load Renter ${uniq}`,
      email: `load-renter-${uniq}@example.com`,
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
    // Endpoint exists on this codebase, but tolerate if older branch differs.
    console.warn(`[bootstrap] renter topup returned ${topup.status}`);
  }

  return { providerKey, providerId: Number(providerId), renterKey };
}

async function runLoadScenario({
  name,
  concurrency,
  durationSeconds,
  makeRequest,
}) {
  const startedAt = performance.now();
  const endAt = startedAt + (durationSeconds * 1000);

  const latencies = [];
  const statusCounts = new Map();
  let networkErrors = 0;

  async function workerLoop() {
    while (performance.now() < endAt) {
      const reqStart = performance.now();
      try {
        const status = await makeRequest();
        const elapsed = performance.now() - reqStart;
        latencies.push(elapsed);
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      } catch {
        const elapsed = performance.now() - reqStart;
        latencies.push(elapsed);
        networkErrors += 1;
      }
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, () => workerLoop())
  );

  const wallSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
  const total = latencies.length;
  const non2xx = [...statusCounts.entries()]
    .filter(([status]) => status < 200 || status >= 300)
    .reduce((sum, [, count]) => sum + count, 0);
  const errorCount = non2xx + networkErrors;
  const errorRatePct = (errorCount / Math.max(total, 1)) * 100;

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
    name,
    concurrency,
    durationSeconds,
    totalRequests: total,
    reqPerSec: total / wallSeconds,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    errorRatePct,
    networkErrors,
    statusCounts: Object.fromEntries([...statusCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
    byClass,
  };
}

function evaluateScenario(result, threshold) {
  const reasons = [];
  let pass = true;

  if (threshold.maxErrorRatePct != null && result.errorRatePct > threshold.maxErrorRatePct) {
    pass = false;
    reasons.push(`error_rate ${toFixed(result.errorRatePct, 3)}% > ${toFixed(threshold.maxErrorRatePct, 3)}%`);
  }

  if (threshold.p99Ms != null && result.p99Ms > threshold.p99Ms) {
    pass = false;
    reasons.push(`p99 ${toFixed(result.p99Ms, 1)}ms > ${threshold.p99Ms}ms`);
  }

  if (threshold.requireAll200) {
    const non200 = Object.entries(result.statusCounts)
      .filter(([status]) => Number(status) !== 200)
      .reduce((sum, [, count]) => sum + count, 0);
    if (non200 > 0 || result.networkErrors > 0) {
      pass = false;
      reasons.push(`found ${non200 + result.networkErrors} non-200/network errors`);
    }
  }

  if (threshold.require429) {
    const count429 = Number(result.statusCounts['429'] || 0);
    if (count429 === 0) {
      pass = false;
      reasons.push('expected rate limiter 429 responses but got none');
    }
  }

  if (threshold.requireSomeSuccess) {
    const successes = Object.entries(result.statusCounts)
      .filter(([status]) => Number(status) >= 200 && Number(status) < 300)
      .reduce((sum, [, count]) => sum + count, 0);
    if (successes === 0) {
      pass = false;
      reasons.push('expected at least one successful 2xx request');
    }
  }

  return {
    pass,
    reasons,
  };
}

function renderMarkdown({ baseUrl, startedIso, finishedIso, results }) {
  const headers = [
    '| Scenario | Concurrency | Duration (s) | Req/s | p50 (ms) | p95 (ms) | p99 (ms) | Error % | Status | P1 Bug | Notes |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|',
  ];

  const rows = results.map((r) => {
    const status = r.evaluation.pass ? 'PASS' : 'FAIL';
    const p1 = r.evaluation.pass ? 'No' : 'Yes';
    const notes = r.evaluation.reasons.length ? r.evaluation.reasons.join('; ') : 'Thresholds met';

    return `| ${r.name} | ${r.concurrency} | ${r.durationSeconds} | ${toFixed(r.reqPerSec)} | ${toFixed(r.p50Ms, 1)} | ${toFixed(r.p95Ms, 1)} | ${toFixed(r.p99Ms, 1)} | ${toFixed(r.errorRatePct, 3)} | ${status} | ${p1} | ${notes} |`;
  });

  const statusBlocks = results.map((r) => {
    return `- **${r.name}**: ${JSON.stringify(r.statusCounts)}${r.networkErrors ? `, network_errors=${r.networkErrors}` : ''}`;
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
    '## Thresholds',
    '- Marketplace burst: p99 < 500ms, 0% errors',
    '- Job submission flood: rate limiter emits 429, with at least one legitimate 2xx submit',
    '- Heartbeat storm: all 200 responses, p99 < 200ms',
    '- Admin dashboard load: p99 < 1000ms, 0% errors',
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

  const scenarios = [
    {
      id: 'marketplaceBurst',
      name: 'Scenario 1: Marketplace burst',
      concurrency: 50,
      durationSeconds: 30,
      makeRequest: async () => {
        const res = await requestJson(MARKETPLACE_PATH, { method: 'GET' });
        return res.status;
      },
    },
    {
      id: 'jobSubmissionFlood',
      name: 'Scenario 2: Job submission flood',
      concurrency: 20,
      durationSeconds: 60,
      makeRequest: async () => {
        const res = await requestJson('/api/jobs/submit', {
          method: 'POST',
          headers: {
            'x-renter-key': ctx.renterKey,
          },
          body: JSON.stringify({
            provider_id: ctx.providerId,
            job_type: 'llm_inference',
            duration_minutes: 1,
            params: {
              prompt: 'load test prompt',
              model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
              max_tokens: 32,
            },
          }),
        });
        return res.status;
      },
    },
    {
      id: 'heartbeatStorm',
      name: 'Scenario 3: Heartbeat storm',
      concurrency: 30,
      durationSeconds: 30,
      makeRequest: async () => {
        const res = await requestJson('/api/providers/heartbeat', {
          method: 'POST',
          body: JSON.stringify({
            api_key: ctx.providerKey,
            provider_hostname: 'load-host',
            provider_ip: '127.0.0.1',
            uptime: 3600,
            gpu_status: {
              gpu_name: 'NVIDIA RTX 4090',
              gpu_vram_mib: 24576,
              free_vram_mib: 21500,
              gpu_util_pct: 22,
              temp_c: 52,
              power_w: 210,
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
  ];

  if (ADMIN_TOKEN) {
    scenarios.push({
      id: 'adminDashboard',
      name: 'Scenario 4: Admin dashboard under load',
      concurrency: 10,
      durationSeconds: 30,
      makeRequest: async () => {
        const res = await requestJson('/api/admin/dashboard', {
          method: 'GET',
          headers: {
            'x-admin-token': ADMIN_TOKEN,
          },
        });
        return res.status;
      },
    });
  } else {
    console.warn('[load] DC1_ADMIN_TOKEN not set; scenario 4 will be skipped.');
  }

  const results = [];
  for (const scenario of scenarios) {
    console.log(`[load] running ${scenario.name} (concurrency=${scenario.concurrency}, duration=${scenario.durationSeconds}s)`);
    const raw = await runLoadScenario(scenario);
    const evaluation = evaluateScenario(raw, THRESHOLDS[scenario.id]);
    results.push({ ...raw, evaluation });
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
