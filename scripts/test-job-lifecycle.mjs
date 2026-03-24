#!/usr/bin/env node
/**
 * test-job-lifecycle.mjs — End-to-end job lifecycle integration test (DCP-740)
 *
 * Validates the complete job flow:
 *   provider register → heartbeat → renter register → template deploy →
 *   provider polls job → job-started event → job-completed event →
 *   renter job history confirms cost & status
 *
 * Usage:
 *   node scripts/test-job-lifecycle.mjs
 *
 * Environment:
 *   DCP_API_BASE   — Backend URL (default: http://localhost:8083/api)
 *   DCP_POLL_MS    — Provider job poll interval (default: 1000)
 *   DCP_TIMEOUT_MS — Max wait for job terminal state (default: 30000)
 *
 * Server requirements:
 *   The server must be running with:
 *     ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT=1  (allows test providers to heartbeat)
 *
 *   Without this flag, provider heartbeat returns HTTP 403 (provider not approved).
 *   In production, providers go through a manual approval flow. This test covers
 *   post-approval behavior — the flag opts in to that behaviour without a real approval.
 *
 * Integration gaps discovered and fixed (DCP-740):
 *   GAP-1: templates.js findAvailableProvider queried status='active', but heartbeat
 *          sets status='online'. Fixed: now accepts status IN ('active','online').
 *   GAP-2: webhooks.js received provider events but never dispatched them to
 *          jobQueue.handleProviderEvent. Job status stayed 'pending' forever.
 *          Fixed: webhook route now calls handleProviderEvent on every event.
 */

import crypto from 'node:crypto';

const API_BASE = (process.env.DCP_API_BASE || 'http://localhost:8083/api').replace(/\/$/, '');
const POLL_MS = Number.parseInt(process.env.DCP_POLL_MS || '1000', 10);
const TIMEOUT_MS = Number.parseInt(process.env.DCP_TIMEOUT_MS || '30000', 10);

/** Unique suffix so parallel test runs don't collide in the DB */
const RUN_ID = crypto.randomBytes(4).toString('hex');

const checks = [];

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printHeader(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function recordCheck(name, pass, details) {
  checks.push({ name, pass, details });
  const icon = pass ? '[PASS]' : '[FAIL]';
  const line = details ? `${icon} ${name} — ${details}` : `${icon} ${name}`;
  console.log(line);
  return pass;
}

function recordSkip(name, reason) {
  checks.push({ name, pass: null, details: reason });
  console.log(`[SKIP] ${name} — ${reason}`);
}

/**
 * Low-level HTTP helper.
 * Returns { ok, status, json, text, url }.
 */
async function request(path, { method = 'GET', headers = {}, body } = {}) {
  const url = `${API_BASE}${path}`;
  const reqHeaders = { ...headers };
  let payload;
  if (body !== undefined) {
    reqHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers: reqHeaders, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { ok: res.ok, status: res.status, json, text, url };
}

/**
 * Build the HMAC signature headers required by /api/webhooks/provider/event.
 *
 * Signature: sha256=HMAC-SHA256(rawBody, providerApiKey)
 * Headers needed: X-Provider-Key, X-DCP-Timestamp, X-DCP-Signature
 */
function buildWebhookHeaders(providerApiKey, bodyObj) {
  const rawBody = Buffer.from(JSON.stringify(bodyObj));
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = 'sha256=' + crypto.createHmac('sha256', providerApiKey).update(rawBody).digest('hex');
  return {
    'X-Provider-Key': providerApiKey,
    'X-DCP-Timestamp': ts,
    'X-DCP-Signature': sig,
  };
}

/**
 * POST a signed webhook event and verify it updated the job.
 */
async function sendWebhookEvent(providerApiKey, eventName, jobId, extraPayload = {}) {
  const bodyObj = {
    event: eventName,
    job_id: jobId,
    payload: extraPayload,
  };
  const whHeaders = buildWebhookHeaders(providerApiKey, bodyObj);
  return request('/webhooks/provider/event', {
    method: 'POST',
    headers: whHeaders,
    body: bodyObj,
  });
}

/**
 * Poll GET /api/renters/me/jobs until the given job reaches a terminal status.
 * Returns the job row, or null on timeout.
 */
async function waitForJobTerminal(renterKey, jobId) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await request(`/renters/me/jobs?key=${encodeURIComponent(renterKey)}&limit=50`);
    if (res.ok && Array.isArray(res.json?.jobs)) {
      const job = res.json.jobs.find((j) => j.job_id === jobId);
      if (job) {
        const st = String(job.status || '').toLowerCase();
        if (['completed', 'failed', 'cancelled', 'timed_out'].includes(st)) return job;
      }
    }
    await sleep(POLL_MS);
  }
  return null;
}

async function run() {
  console.log('DCP End-to-End Job Lifecycle Integration Test (DCP-740)');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Run ID:   ${RUN_ID}`);
  console.log(`Started:  ${nowIso()}`);

  // ──────────────────────────────────────────────────────────────────────────
  printHeader('Phase 1 — Provider Registration');
  // ──────────────────────────────────────────────────────────────────────────

  const providerEmail = `test-provider-${RUN_ID}@lifecycle.test`;
  const regRes = await request('/providers/register', {
    method: 'POST',
    body: {
      name: `Lifecycle-Test-Provider-${RUN_ID}`,
      email: providerEmail,
      gpu_model: 'NVIDIA RTX 4090',
      os: 'linux',
      resource_spec: { vram_gb: 24 },
    },
  });

  const providerOk = recordCheck(
    'Provider registration',
    regRes.status === 200 && !!regRes.json?.api_key,
    `HTTP ${regRes.status}${regRes.json?.api_key ? ' — api_key obtained' : ' — ' + (regRes.text || 'no body')}`,
  );
  if (!providerOk) {
    console.error('Cannot continue without a provider. Is the server running?');
    console.error(`  Try: DC1_PROVIDER_PORT=8083 node backend/src/server.js`);
    process.exit(1);
  }

  const providerKey = regRes.json.api_key;
  const providerId = regRes.json.provider_id;
  console.log(`  provider_id=${providerId}  api_key=${providerKey.slice(0, 24)}…`);

  // ──────────────────────────────────────────────────────────────────────────
  printHeader('Phase 2 — Provider Heartbeat (marks provider online)');
  // ──────────────────────────────────────────────────────────────────────────

  console.log('  NOTE: Requires ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT=1 on the server.');
  console.log('  Without it the server returns HTTP 403 (provider not approved).');
  console.log('  In production, an operator approves providers via the admin panel.');

  const hbRes = await request('/providers/heartbeat', {
    method: 'POST',
    body: {
      api_key: providerKey,
      gpu_status: {
        gpu_name: 'NVIDIA GeForce RTX 4090',
        gpu_vram_mib: 24576,
        gpu_util_pct: 0,
        temp_c: 42,
        power_w: 50,
        daemon_version: 'test-lifecycle-1.0',
      },
      provider_ip: '127.0.0.1',
      provider_hostname: `lifecycle-test-${RUN_ID}`,
    },
  });

  const hbOk = recordCheck(
    'Provider heartbeat',
    hbRes.ok,
    `HTTP ${hbRes.status}${hbRes.status === 403 ? ' — server requires provider approval; set ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT=1' : ''}`,
  );

  if (!hbOk) {
    // Fall back to the simplified /:id/heartbeat — same approval check, but useful for diagnostics
    const hb2Res = await request(`/providers/${providerId}/heartbeat`, {
      method: 'POST',
      headers: { 'x-provider-key': providerKey },
      body: { gpu_utilization: 0, vram_used_mb: 0 },
    });
    recordCheck(
      'Provider heartbeat (simplified /:id endpoint)',
      hb2Res.ok,
      `HTTP ${hb2Res.status}`,
    );
    if (!hb2Res.ok) {
      console.error('\n[BLOCKER] Provider cannot heartbeat — all downstream steps will fail.');
      console.error('  Fix: start the server with ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT=1');
      console.error('  Or approve the provider via the admin panel and re-run.');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  printHeader('Phase 3 — Renter Registration + Balance');
  // ──────────────────────────────────────────────────────────────────────────

  const renterEmail = `test-renter-${RUN_ID}@lifecycle.test`;
  const renterRes = await request('/renters/register', {
    method: 'POST',
    body: {
      name: `Lifecycle-Renter-${RUN_ID}`,
      email: renterEmail,
      organization: 'DCP Integration Tests',
      use_case: 'E2E job lifecycle testing',
    },
  });

  const renterOk = recordCheck(
    'Renter registration',
    renterRes.status === 201 && !!renterRes.json?.api_key,
    `HTTP ${renterRes.status}${renterRes.json?.api_key ? ` — api_key obtained, starting balance=1000 halala` : ' — ' + (renterRes.text || 'no body')}`,
  );
  if (!renterOk) {
    console.error('Cannot continue without a renter.');
    process.exit(1);
  }

  const renterKey = renterRes.json.api_key;
  const renterId = renterRes.json.renter_id;
  console.log(`  renter_id=${renterId}  api_key=${renterKey.slice(0, 26)}…`);

  // Verify initial balance (new renters start with 1000 halala)
  const balRes = await request(`/renters/balance?key=${encodeURIComponent(renterKey)}`);
  const initialBalance = balRes.json?.balance_halala ?? 0;
  recordCheck(
    'Renter starting balance',
    balRes.ok && initialBalance >= 540, // 60 min × 9 halala/min = 540 halala minimum for llama3-8b
    `balance=${initialBalance} halala (${(initialBalance / 100).toFixed(2)} SAR)`,
  );

  // ──────────────────────────────────────────────────────────────────────────
  printHeader('Phase 4 — Template Deployment (one-click job creation)');
  // ──────────────────────────────────────────────────────────────────────────

  console.log('  Template: llama3-8b (requires 16 GB VRAM, llm-inference job type)');
  console.log('  Cost: 9 halala/min × 1 min = 9 halala (~0.09 SAR)');

  const deployRes = await request('/templates/llama3-8b/deploy', {
    method: 'POST',
    headers: { 'x-renter-key': renterKey },
    body: {
      duration_minutes: 1,
      pricing_class: 'standard',
    },
  });

  const deployOk = recordCheck(
    'Template deployment',
    deployRes.status === 201 && !!deployRes.json?.jobId,
    (() => {
      if (deployRes.status === 503) return `HTTP 503 — no online provider with ≥16 GB VRAM (heartbeat failed or provider not online)`;
      if (deployRes.status === 402) return `HTTP 402 — insufficient renter balance`;
      if (deployRes.status === 404) return `HTTP 404 — template not found`;
      return `HTTP ${deployRes.status}${deployRes.json?.jobId ? ` — jobId=${deployRes.json.jobId}` : ' — ' + (deployRes.text || 'no body')}`;
    })(),
  );

  if (!deployOk) {
    if (deployRes.status === 503) {
      console.error('\n[BLOCKER] No provider available for template deploy.');
      console.error('  This is likely because:');
      console.error('  1. The provider heartbeat failed (see Phase 2 above), OR');
      console.error('  2. The provider VRAM reported is below the template min_vram_gb=16.');
      console.error('  Ensure ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT=1 and heartbeat succeeded.');
    }
    // Still try provider job poll to show the gap explicitly
    recordSkip('Provider job poll', 'no job created — skipping provider-side steps');
    recordSkip('Webhook: job_started', 'no job created');
    recordSkip('Webhook: job_completed', 'no job created');
    recordSkip('Renter job history', 'no job created');
    summarize();
    process.exit(1);
  }

  const jobId = deployRes.json.jobId;
  const totalCost = deployRes.json.totalCost;
  console.log(`  jobId=${jobId}`);
  console.log(`  cost=${totalCost?.halala} halala (${totalCost?.sar} SAR)`);
  console.log(`  provider=${deployRes.json.provider?.name} (id=${deployRes.json.provider?.id})`);
  console.log(`  estimatedStart=${deployRes.json.estimatedStart}`);

  // ──────────────────────────────────────────────────────────────────────────
  printHeader('Phase 5 — Provider Job Poll');
  // ──────────────────────────────────────────────────────────────────────────

  console.log('  Polling GET /api/providers/jobs/next until our job appears…');

  let claimedJob = null;
  const pollDeadline = Date.now() + TIMEOUT_MS;
  let pollAttempts = 0;
  while (Date.now() < pollDeadline) {
    pollAttempts++;
    const pollRes = await request(`/providers/jobs/next?key=${encodeURIComponent(providerKey)}`);
    if (!pollRes.ok) {
      console.log(`  poll attempt ${pollAttempts}: HTTP ${pollRes.status} — ${pollRes.text}`);
      break;
    }
    const nextJob = pollRes.json?.job;
    if (nextJob && nextJob.job_id === jobId) {
      claimedJob = nextJob;
      break;
    }
    await sleep(POLL_MS);
  }

  recordCheck(
    'Provider polls and receives job',
    !!claimedJob,
    claimedJob
      ? `found after ${pollAttempts} attempt(s), attempt_number=${claimedJob.attempt_number ?? 1}`
      : `job not found in ${pollAttempts} poll(s) within ${TIMEOUT_MS}ms`,
  );

  if (!claimedJob) {
    console.error('\n[BLOCKER] Provider could not poll the job.');
    console.error('  Possible cause: job status not pending, or provider_id mismatch.');
    recordSkip('Webhook: job_started', 'no claimed job');
    recordSkip('Webhook: job_completed', 'no claimed job');
    recordSkip('Renter job history', 'no claimed job');
    summarize();
    process.exit(1);
  }

  // ──────────────────────────────────────────────────────────────────────────
  printHeader('Phase 6 — Provider Webhook: job_started');
  // ──────────────────────────────────────────────────────────────────────────

  console.log('  POST /api/webhooks/provider/event  { event: "job_started", job_id }');
  console.log('  Signed with HMAC-SHA256(body, providerApiKey)');

  const startedRes = await sendWebhookEvent(providerKey, 'job_started', jobId, {
    started_at: nowIso(),
    container_id: `ctr-test-${RUN_ID}`,
  });

  recordCheck(
    'Webhook job_started accepted',
    startedRes.ok,
    `HTTP ${startedRes.status}${startedRes.json?.job_updated ? `, job_updated=true, new_status=${startedRes.json?.new_status}` : ''}`,
  );
  recordCheck(
    'Webhook dispatched to job queue (job_updated=true)',
    startedRes.ok && startedRes.json?.job_updated === true,
    startedRes.ok
      ? `new_status=${startedRes.json?.new_status ?? 'not set'}`
      : `HTTP ${startedRes.status} — ${startedRes.text}`,
  );

  // Small pause to let DB write settle
  await sleep(200);

  // ──────────────────────────────────────────────────────────────────────────
  printHeader('Phase 7 — Provider Webhook: job_completed (with metering data)');
  // ──────────────────────────────────────────────────────────────────────────

  console.log('  POST /api/webhooks/provider/event  { event: "job_completed", payload: { tokens_used, duration_sec } }');

  const tokensUsed = 512;
  const durationSec = 14.7;

  const completedRes = await sendWebhookEvent(providerKey, 'job_completed', jobId, {
    tokens_used: tokensUsed,
    duration_sec: durationSec,
    tokens_per_second: Math.round(tokensUsed / durationSec),
    model: 'meta-llama/Meta-Llama-3-8B-Instruct',
    completed_at: nowIso(),
  });

  recordCheck(
    'Webhook job_completed accepted',
    completedRes.ok,
    `HTTP ${completedRes.status}`,
  );
  recordCheck(
    'Webhook dispatched — job marked completed',
    completedRes.ok && completedRes.json?.job_updated === true && completedRes.json?.new_status === 'completed',
    completedRes.ok
      ? `new_status=${completedRes.json?.new_status ?? 'not set'}`
      : `HTTP ${completedRes.status} — ${completedRes.text}`,
  );

  // ──────────────────────────────────────────────────────────────────────────
  printHeader('Phase 8 — Renter Cost Dashboard Verification');
  // ──────────────────────────────────────────────────────────────────────────

  console.log('  Polling GET /api/renters/me/jobs for terminal status…');

  const terminalJob = await waitForJobTerminal(renterKey, jobId);

  recordCheck(
    'Job reaches terminal state',
    !!terminalJob,
    terminalJob ? `status=${terminalJob.status}` : `timeout after ${TIMEOUT_MS}ms`,
  );
  recordCheck(
    'Completed job has cost recorded',
    !!terminalJob && (terminalJob.cost_halala || 0) > 0,
    terminalJob ? `cost=${terminalJob.cost_halala} halala (${terminalJob.cost_sar} SAR)` : 'n/a',
  );

  // Verify balance was deducted
  const balAfterRes = await request(`/renters/balance?key=${encodeURIComponent(renterKey)}`);
  const balanceAfter = balAfterRes.json?.balance_halala ?? initialBalance;
  const deducted = initialBalance - balanceAfter;
  recordCheck(
    'Renter balance deducted for job',
    deducted > 0,
    `balance before=${initialBalance} after=${balanceAfter} deducted=${deducted} halala`,
  );

  // ──────────────────────────────────────────────────────────────────────────
  summarize();
  // ──────────────────────────────────────────────────────────────────────────
}

function summarize() {
  const definite = checks.filter((c) => c.pass !== null);
  const passed = definite.filter((c) => c.pass).length;
  const failed = definite.filter((c) => !c.pass).length;
  const skipped = checks.filter((c) => c.pass === null).length;

  printHeader('Summary');
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${checks.length}`);
  console.log('');
  console.log('  Lifecycle checkpoints:');
  console.log('  A. Auth + registration    (provider register, renter register, balance)');
  console.log('  B. Job creation           (template deploy, provider assignment)');
  console.log('  C. Provider execution     (job poll, webhook job_started)');
  console.log('  D. Settlement + metering  (webhook job_completed, cost dashboard)');
  console.log('');

  if (failed > 0) {
    console.log('  FAILED checks:');
    for (const c of checks.filter((c) => !c.pass)) {
      console.log(`    - ${c.name}: ${c.details || ''}`);
    }
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(`\nFatal error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
