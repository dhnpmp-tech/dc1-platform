#!/usr/bin/env node

const API_BASE = (process.env.DCP_API_BASE || process.env.API_BASE || 'http://76.13.179.86:8083/api').replace(/\/$/, '');
const PROVIDER_KEY = process.env.DCP_PROVIDER_KEY || process.env.PROVIDER_KEY || '';
const RENTER_KEY = process.env.DCP_RENTER_KEY || process.env.RENTER_KEY || '';
const POLL_INTERVAL_MS = Number.parseInt(process.env.DCP_SMOKE_POLL_MS || '3000', 10);
const POLL_TIMEOUT_MS = Number.parseInt(process.env.DCP_SMOKE_TIMEOUT_MS || '180000', 10);
const DURATION_MINUTES = Number.parseFloat(process.env.DCP_SMOKE_DURATION_MINUTES || '0.2');
const MODEL = process.env.DCP_SMOKE_MODEL || 'TinyLlama/TinyLlama-1.1B-Chat-v1.0';

const checks = [];

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printHeader(title) {
  console.log(`\n=== ${title} ===`);
}

function recordCheck(name, pass, details) {
  checks.push({ name, pass, details });
  const prefix = pass ? '[PASS]' : '[FAIL]';
  console.log(`${prefix} ${name}${details ? ` - ${details}` : ''}`);
}

function requireEnv() {
  const missing = [];
  if (!PROVIDER_KEY) missing.push('DCP_PROVIDER_KEY (or PROVIDER_KEY)');
  if (!RENTER_KEY) missing.push('DCP_RENTER_KEY (or RENTER_KEY)');
  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    for (const key of missing) {
      console.error(`- ${key}`);
    }
    process.exit(2);
  }
}

async function requestJson(path, { method = 'GET', headers = {}, body } = {}) {
  const url = `${API_BASE}${path}`;
  const requestHeaders = { ...headers };
  let payload;
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method,
    headers: requestHeaders,
    body: payload,
  });

  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch (_) {
      json = null;
    }
  }

  return {
    ok: res.ok,
    status: res.status,
    text,
    json,
    url,
  };
}

async function waitForJobTerminal(jobId) {
  const started = Date.now();
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    const res = await requestJson(`/jobs/${encodeURIComponent(jobId)}?key=${encodeURIComponent(RENTER_KEY)}`);
    if (!res.ok || !res.json?.job) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    const status = String(res.json.job.status || '').toLowerCase();
    if (['completed', 'failed', 'cancelled', 'timed_out', 'permanently_failed'].includes(status)) {
      return res.json.job;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

async function run() {
  requireEnv();

  console.log('DCP GPU Lifecycle Smoke Harness');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Start: ${nowIso()}`);
  console.log('Flow: submit -> run -> logs -> completion artifact');

  printHeader('1) Provider + Renter Preconditions');
  const providerMe = await requestJson(`/providers/me?key=${encodeURIComponent(PROVIDER_KEY)}`);
  if (!providerMe.ok || !providerMe.json?.provider?.id) {
    recordCheck('Provider key valid', false, `HTTP ${providerMe.status}`);
    throw new Error(`Cannot load provider profile: ${providerMe.text || providerMe.status}`);
  }
  const provider = providerMe.json.provider;
  recordCheck('Provider key valid', true, `provider_id=${provider.id}`);

  const heartbeat = await requestJson('/providers/heartbeat', {
    method: 'POST',
    body: {
      api_key: PROVIDER_KEY,
      gpu_status: { utilization_pct: 0, temperature_c: 45, vram_used_mib: 256 },
      uptime: 60,
      daemon_version: 'smoke-harness',
      provider_ip: '127.0.0.1',
      provider_hostname: 'smoke-harness',
    },
  });
  recordCheck('Provider heartbeat accepted', heartbeat.ok, `HTTP ${heartbeat.status}`);
  if (!heartbeat.ok) throw new Error(`Heartbeat failed: ${heartbeat.text || heartbeat.status}`);

  const renterMe = await requestJson(`/renters/me?key=${encodeURIComponent(RENTER_KEY)}`);
  if (!renterMe.ok || !renterMe.json?.renter?.id) {
    recordCheck('Renter key valid', false, `HTTP ${renterMe.status}`);
    throw new Error(`Cannot load renter profile: ${renterMe.text || renterMe.status}`);
  }
  const renter = renterMe.json.renter;
  recordCheck('Renter key valid', true, `renter_id=${renter.id}, balance_halala=${renter.balance_halala}`);

  printHeader('2) Submit Job');
  const trace = `smoke-${Date.now()}`;
  const submitRes = await requestJson('/jobs/submit', {
    method: 'POST',
    headers: { 'x-renter-key': RENTER_KEY },
    body: {
      provider_id: provider.id,
      job_type: 'llm_inference',
      duration_minutes: DURATION_MINUTES,
      params: {
        prompt: `Smoke test ${trace}: respond with OK`,
        model: MODEL,
        max_tokens: 64,
        temperature: 0,
      },
      metadata: {
        smoke_test: true,
        trace_id: trace,
      },
    },
  });
  if (submitRes.status !== 201 || !submitRes.json?.job?.job_id) {
    recordCheck('Job submitted', false, `HTTP ${submitRes.status}`);
    throw new Error(`Job submit failed: ${submitRes.text || submitRes.status}`);
  }
  const jobId = submitRes.json.job.job_id;
  recordCheck('Job submitted', true, `job_id=${jobId}`);

  printHeader('3) Claim + Run');
  let claimed = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const nextRes = await requestJson(`/providers/jobs/next?key=${encodeURIComponent(PROVIDER_KEY)}`);
    if (!nextRes.ok) {
      recordCheck('Provider poll accepted', false, `HTTP ${nextRes.status}`);
      throw new Error(`Provider poll failed: ${nextRes.text || nextRes.status}`);
    }
    const nextJob = nextRes.json?.job;
    if (nextJob && nextJob.job_id === jobId) {
      claimed = nextJob;
      break;
    }
    await sleep(1000);
  }

  if (!claimed) {
    recordCheck('Job claimed by provider poll', false, 'no matching job on /providers/jobs/next');
    throw new Error('Smoke harness could not claim the submitted job');
  }
  recordCheck('Job claimed by provider poll', true, `attempt=${claimed.attempt_number || 1}`);

  const logsRes = await requestJson(`/providers/jobs/${encodeURIComponent(jobId)}/logs`, {
    method: 'PATCH',
    headers: { 'x-provider-key': PROVIDER_KEY },
    body: {
      lines: [
        { level: 'info', message: `[${trace}] container booted` },
        { level: 'info', message: `[${trace}] model warmed` },
      ],
      attempt_number: claimed.attempt_number || 1,
    },
  });
  if (!logsRes.ok) {
    recordCheck('Provider logs accepted', false, `HTTP ${logsRes.status}`);
    throw new Error(`Log upload failed: ${logsRes.text || logsRes.status}`);
  }
  recordCheck('Provider logs accepted', true, `lines_written=${logsRes.json?.lines_written ?? 'n/a'}`);

  const resultPayload = {
    type: 'text',
    prompt: `Smoke test ${trace}: respond with OK`,
    response: `OK ${trace}`,
    model: MODEL,
    tokens_generated: 2,
    tokens_per_second: 20,
    gen_time_s: 0.2,
    total_time_s: 0.5,
    device: 'gpu',
  };
  const resultRes = await requestJson('/providers/job-result', {
    method: 'POST',
    body: {
      api_key: PROVIDER_KEY,
      job_id: jobId,
      success: true,
      result: `DC1_RESULT_JSON:${JSON.stringify(resultPayload)}`,
      metrics: { gpu_count: 1 },
      gpu_seconds_used: 1.5,
      attempt_number: claimed.attempt_number || 1,
    },
  });
  if (!resultRes.ok || resultRes.json?.success !== true) {
    recordCheck('Provider result accepted', false, `HTTP ${resultRes.status}`);
    throw new Error(`Result submit failed: ${resultRes.text || resultRes.status}`);
  }
  recordCheck('Provider result accepted', true, `new_status=${resultRes.json?.job?.status || 'completed'}`);

  printHeader('4) Validate Logs + Output Artifact');
  const renterLogsRes = await requestJson(`/jobs/${encodeURIComponent(jobId)}/logs?key=${encodeURIComponent(RENTER_KEY)}`);
  if (!renterLogsRes.ok || !Array.isArray(renterLogsRes.json?.logs)) {
    recordCheck('Renter can fetch logs', false, `HTTP ${renterLogsRes.status}`);
    throw new Error(`Log fetch failed: ${renterLogsRes.text || renterLogsRes.status}`);
  }
  const hasTraceLog = renterLogsRes.json.logs.some((line) => String(line.message || '').includes(trace));
  recordCheck('Renter can fetch logs', hasTraceLog, hasTraceLog ? `trace=${trace}` : 'trace marker not found');
  if (!hasTraceLog) throw new Error('Uploaded logs are not visible through renter log endpoint');

  const terminalJob = await waitForJobTerminal(jobId);
  if (!terminalJob) {
    recordCheck('Job reached terminal state', false, `timeout=${POLL_TIMEOUT_MS}ms`);
    throw new Error('Job did not reach terminal state before timeout');
  }
  recordCheck('Job reached terminal state', terminalJob.status === 'completed', `status=${terminalJob.status}`);
  if (terminalJob.status !== 'completed') throw new Error(`Expected completed job, got ${terminalJob.status}`);

  const outputRes = await requestJson(`/jobs/${encodeURIComponent(jobId)}/output?key=${encodeURIComponent(RENTER_KEY)}`, {
    headers: { Accept: 'application/json' },
  });
  const outputOk = outputRes.ok && outputRes.json?.type === 'text' && String(outputRes.json?.response || '').includes(trace);
  recordCheck('Completion artifact readable', outputOk, outputOk ? `response contains ${trace}` : `HTTP ${outputRes.status}`);
  if (!outputOk) throw new Error(`Output check failed: ${outputRes.text || outputRes.status}`);

  printHeader('Summary');
  const passed = checks.filter((item) => item.pass).length;
  const failed = checks.length - passed;
  console.log(`Checks passed: ${passed}/${checks.length}`);
  console.log(`Checks failed: ${failed}`);

  console.log('\nDemo-critical reliability map:');
  console.log('- Checkpoint A: Auth + readiness (provider/renter key and heartbeat)');
  console.log('- Checkpoint B: Scheduler handoff (submit and provider poll claim)');
  console.log('- Checkpoint C: Runtime observability (provider log ingestion and renter log read)');
  console.log('- Checkpoint D: Settlement + artifact (job-result completion and output retrieval)');

  process.exit(failed === 0 ? 0 : 1);
}

run().catch((error) => {
  console.error(`\nSmoke harness failed: ${error.message}`);
  const passed = checks.filter((item) => item.pass).length;
  const failed = checks.length - passed;
  console.error(`Checks passed: ${passed}/${checks.length} | failed: ${failed}`);
  process.exit(1);
});
