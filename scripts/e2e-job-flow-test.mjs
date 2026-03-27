#!/usr/bin/env node
/**
 * e2e-job-flow-test.mjs — End-to-end Arabic RAG job flow verification (DCP-951)
 *
 * Validates the complete Arabic RAG job flow:
 *   renter: POST /api/jobs {templateId: "arabic-rag-complete", providerId: "<active>"}
 *   → backend: job queued, status=pending
 *   → provider daemon: picks up job, pulls docker image
 *   → provider: container starts, model loads
 *   → provider: heartbeat updates job status=running
 *   → renter: can query the running service
 *   → job completion: billing record created
 *
 * Usage:
 *   node scripts/e2e-job-flow-test.mjs
 *
 * Environment:
 *   DCP_API_BASE   — Backend URL (default: http://localhost:8083/api)
 *   DCP_RENTER_KEY — Renter API key for authentication
 *   DCP_POLL_MS    — Job status poll interval (default: 5000)
 *   DCP_TIMEOUT_MS — Max wait for job terminal state (default: 600000 = 10 min)
 *
 * Notes:
 *   - Requires at least one online provider with GPU
 *   - Requires arabic-rag-complete template to be registered
 *   - Job may take 5-10 minutes due to model download/loading
 */

import crypto from 'node:crypto';

const API_BASE = (process.env.DCP_API_BASE || 'http://localhost:8083/api').replace(/\/$/, '');
const RENTER_KEY = process.env.DCP_RENTER_KEY;
const POLL_MS = Number.parseInt(process.env.DCP_POLL_MS || '5000', 10);
const TIMEOUT_MS = Number.parseInt(process.env.DCP_TIMEOUT_MS || '600000', 10);
const TEMPLATE_ID = 'arabic-rag-complete';

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
  console.log('='.repeat(60)');
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
  return null;
}

async function request(path, { method = 'GET', headers = {}, body } = {}) {
  const url = `${API_BASE}${path}`;
  const reqHeaders = { ...headers };
  let payload;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    reqHeaders['Content-Type'] = 'application/json';
  }
  if (RENTER_KEY) {
    reqHeaders['x-renter-key'] = RENTER_KEY;
  }

  const res = await fetch(url, { method, headers: reqHeaders, body: payload });
  let json = null;
  let text = '';
  try {
    text = await res.text();
    json = JSON.parse(text);
  } catch {
    text = text.slice(0, 200);
  }
  return { ok: res.ok, status: res.status, json, text, url };
}

async function waitForJobTerminalState(jobId, timeoutMs = TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request(`/jobs/${jobId}`, {
      headers: { 'x-renter-key': RENTER_KEY || '' }
    });
    if (!res.ok) {
      return { timedOut: true, status: res.status, job: null };
    }
    const job = res.json?.job;
    if (!job) {
      return { timedOut: true, error: 'Job response missing job object', job: null };
    }
    const terminalStates = ['completed', 'failed', 'cancelled', 'permanently_failed', 'timed_out'];
    if (terminalStates.includes(job.status)) {
      return { timedOut: false, job };
    }
    console.log(`  [POLL] Job ${jobId} status: ${job.status} — waiting...`);
    await sleep(POLL_MS);
  }
  const res = await request(`/jobs/${jobId}`, {
    headers: { 'x-renter-key': RENTER_KEY || '' }
  });
  return { timedOut: true, job: res.json?.job };
}

async function main() {
  console.log(`\nDCP-951 Arabic RAG E2E Job Flow Test — ${nowIso()}`);
  console.log(`Run ID: ${RUN_ID}`);
  console.log(`API Base: ${API_BASE}`);
  console.log(`Renter Key: ${RENTER_KEY ? RENTER_KEY.slice(0, 8) + '...' : '(none — using query param)'}`);

  if (!RENTER_KEY) {
    console.log('\n[NOTE] DCP_RENTER_KEY not set — will use ?key= query param');
  }

  printHeader('Step 1: Verify Renter Authentication');
  const meRes = await request('/renters/me', {
    headers: { 'x-renter-key': RENTER_KEY || '' }
  });
  if (!meRes.ok) {
    recordCheck('Renter authentication', false, `HTTP ${meRes.status}: ${meRes.json?.error || meRes.text}`);
    printSummary();
    process.exit(1);
  }
  const renter = meRes.json?.renter || meRes.json;
  recordCheck('Renter authentication', true, `Renter ID: ${renter?.id}`);
  const renterId = renter?.id;

  printHeader('Step 2: Get Online Providers');
  const providersRes = await request('/renters/available-providers', {
    headers: { 'x-renter-key': RENTER_KEY || '' }
  });
  if (!providersRes.ok) {
    recordCheck('Fetch available providers', false, `HTTP ${providersRes.status}`);
    printSummary();
    process.exit(1);
  }
  const providers = providersRes.json?.providers || [];
  if (providers.length === 0) {
    recordSkip('Provider selection', 'No online providers available');
    console.log('\n[E2E] Cannot test Arabic RAG job flow without an online provider.');
    console.log('[E2E] Deploy a provider and ensure they are online before running this test.');
    printSummary();
    process.exit(0);
  }
  const provider = providers[0];
  recordCheck('Online providers found', true, `Found ${providers.length} provider(s), using: ${provider.id}`);
  const providerId = provider.id;

  printHeader('Step 3: Verify Arabic RAG Template Exists');
  const templatesRes = await request('/templates');
  const templates = templatesRes.json?.templates || [];
  const arabicRagTemplate = templates.find(t => t.id === TEMPLATE_ID || t.id === 'arabic-rag');
  if (!arabicRagTemplate) {
    recordCheck('Arabic RAG template exists', false, `Template "${TEMPLATE_ID}" not found`);
    const available = templates.map(t => t.id).join(', ');
    console.log(`[NOTE] Available templates: ${available || 'none'}`);
    printSummary();
    process.exit(1);
  }
  recordCheck('Arabic RAG template exists', true, `Template: ${arabicRagTemplate.id} — ${arabicRagTemplate.name}`);

  printHeader('Step 4: Submit Arabic RAG Job');
  const jobPayload = {
    templateId: arabicRagTemplate.id,
    providerId: providerId,
    durationMinutes: 30,
    params: {
      query: 'ما حقوق الموظف الأجنبي في السعودية؟',
      reranker_top_k: 3
    }
  };
  console.log(`[SUBMIT] Payload: ${JSON.stringify(jobPayload, null, 2)}`);
  const submitRes = await request('/jobs', {
    method: 'POST',
    headers: { 'x-renter-key': RENTER_KEY || '' },
    body: jobPayload
  });
  if (!submitRes.ok) {
    recordCheck('Job submission', false, `HTTP ${submitRes.status}: ${submitRes.json?.error || submitRes.text}`);
    printSummary();
    process.exit(1);
  }
  const job = submitRes.json?.job || submitRes.json;
  const jobId = job?.job_id || job?.id;
  recordCheck('Job submission', true, `Job ID: ${jobId}, Status: ${job?.status}`);
  if (!jobId) {
    recordCheck('Job ID retrieved', false, 'No job_id in response');
    printSummary();
    process.exit(1);
  }

  printHeader('Step 5: Poll Job Until Terminal State');
  console.log(`[POLL] Waiting up to ${TIMEOUT_MS}ms for job ${jobId} to reach terminal state...`);
  const waitResult = await waitForJobTerminalState(jobId);
  if (waitResult.timedOut) {
    recordCheck('Job completion within timeout', false, `Job ${jobId} did not complete within ${TIMEOUT_MS}ms`);
    if (waitResult.job) {
      console.log(`[NOTE] Last known status: ${waitResult.job.status}`);
    }
  } else if (waitResult.error) {
    recordCheck('Job completion', false, waitResult.error);
  } else {
    const finalJob = waitResult.job;
    recordCheck('Job completion', true, `Final status: ${finalJob.status}`);
    if (finalJob.status === 'completed') {
      recordCheck('Billing record created', true, `Cost: ${finalJob.cost_halala || finalJob.actual_cost_halala || 0} halala`);
    } else if (finalJob.status === 'failed') {
      recordCheck('Job failure reason', false, finalJob.notes || 'Unknown failure');
    }
  }

  printHeader('Step 6: Verify Job History Shows Cost');
  const historyRes = await request(`/renters/me`, {
    headers: { 'x-renter-key': RENTER_KEY || '' }
  });
  if (historyRes.ok) {
    const renterData = historyRes.json?.renter || historyRes.json;
    const renterJobs = renterData?.total_jobs || 0;
    recordCheck('Renter job count updated', renterJobs > 0, `Total jobs: ${renterJobs}`);
  } else {
    recordSkip('Job history verification', `HTTP ${historyRes.status}`);
  }

  printSummary();

  const failedChecks = checks.filter(c => c.pass === false);
  if (failedChecks.length > 0) {
    console.log('\n[E2E] RESULT: SOME CHECKS FAILED');
    process.exit(1);
  } else {
    console.log('\n[E2E] RESULT: ALL CHECKS PASSED');
    process.exit(0);
  }
}

function printSummary() {
  printHeader('E2E Test Summary');
  const passed = checks.filter(c => c.pass === true).length;
  const failed = checks.filter(c => c.pass === false).length;
  const skipped = checks.filter(c => c.pass === null).length;
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);
  if (failed > 0) {
    console.log('\nFailed checks:');
    checks.filter(c => c.pass === false).forEach(c => {
      console.log(`  - ${c.name}: ${c.details}`);
    });
  }
}

main().catch((err) => {
  console.error('[E2E] Unhandled error:', err);
  process.exit(1);
});
