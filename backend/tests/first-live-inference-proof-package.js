#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ensureInferenceSmokePrincipal } = require('./ensure-inference-smoke-principal');

const OUTPUT_DIR_DEFAULT = path.resolve(__dirname, '../../docs/reports/reliability');
const PROOF_PREFIX = 'first-live-inference-proof';
const REPO_ROOT = path.resolve(__dirname, '../..');

function parseJsonBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function toStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function makeSha256(input) {
  return crypto.createHash('sha256').update(String(input || '')).digest('hex');
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || process.env.DCP_API_BASE_URL || process.env.DCP_BASE_URL || 'https://api.dcp.sa').replace(/\/+$/, '');
}

function redactSecret(secret) {
  if (!secret || typeof secret !== 'string') return null;
  return secret.length <= 12 ? secret : `${secret.slice(0, 8)}...${secret.slice(-4)}`;
}

async function requestJson(baseUrl, route, options = {}) {
  const startedAt = Date.now();
  const response = await fetch(new URL(route, baseUrl), options);
  const elapsedMs = Date.now() - startedAt;
  const text = await response.text();
  const json = parseJsonBody(text);
  return {
    ok: response.ok,
    status: response.status,
    elapsed_ms: elapsedMs,
    headers: {
      'x-request-id': response.headers.get('x-request-id'),
      'content-type': response.headers.get('content-type'),
      'x-dcp-provider-id': response.headers.get('x-dcp-provider-id'),
      'x-dcp-provider-tier': response.headers.get('x-dcp-provider-tier'),
      'x-dcp-provider-endpoint-host': response.headers.get('x-dcp-provider-endpoint-host'),
      'x-dcp-requested-model-id': response.headers.get('x-dcp-requested-model-id'),
      'x-dcp-routed-model-id': response.headers.get('x-dcp-routed-model-id'),
      'x-dcp-latency-gate-mode': response.headers.get('x-dcp-latency-gate-mode'),
    },
    text,
    json,
  };
}

async function probeHealth(baseUrl) {
  const primary = await requestJson(baseUrl, '/health');
  if (primary.status !== 404) return { route: '/health', result: primary };
  const fallback = await requestJson(baseUrl, '/api/health');
  return { route: '/api/health', result: fallback };
}

function classifyFailure(results) {
  const completion = results.completion_json;
  const stream = results.completion_stream;
  const hasProviderEvidence = Boolean(
    completion.provider_id
    || completion.provider_endpoint_host
    || stream.provider_id
    || stream.provider_endpoint_host
  );
  if ((completion.status === 401 || completion.status === 403) || (stream.status === 401 || stream.status === 403)) {
    return {
      code: 'auth_scope_failure',
      severity: 'blocking',
      action: 'Run backend/tests/ensure-inference-smoke-principal.js and ensure scoped key carries inference scope.',
    };
  }
  if ([502, 503, 504].includes(completion.status) || [502, 503, 504].includes(stream.status)) {
    return {
      code: 'provider_unreachable_or_unavailable',
      severity: 'blocking',
      action: 'Verify provider heartbeat, reachable vLLM endpoint URL, and model is loaded on at least one online provider.',
    };
  }
  if ((completion.status === 200 || stream.status === 200) && !Boolean(stream.stream_done)) {
    return {
      code: 'sse_done_missing',
      severity: 'blocking',
      action: 'Fix SSE contract to guarantee terminal `data: [DONE]` for stream=true responses.',
    };
  }
  if ((completion.status === 200 || stream.status === 200) && !hasProviderEvidence) {
    return {
      code: 'provider_route_evidence_missing',
      severity: 'blocking',
      action: 'Ensure /v1/chat/completions emits x-dcp-provider-* route evidence headers for both JSON and streaming responses.',
    };
  }
  if (completion.status === 404 || stream.status === 404) {
    return {
      code: 'model_or_route_not_found',
      severity: 'blocking',
      action: 'Validate /v1/models output and rerun with an available model id.',
    };
  }
  if (completion.status !== 200 || stream.status !== 200) {
    return {
      code: 'unexpected_completion_status',
      severity: 'blocking',
      action: 'Inspect completion response body and provider logs for non-contract behavior.',
    };
  }
  return null;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# First-Live Inference Proof Report');
  lines.push('');
  lines.push(`- generated_at: \`${report.generated_at}\``);
  lines.push(`- verdict: **${report.verdict}**`);
  lines.push(`- base_url: \`${report.base_url}\``);
  lines.push(`- model: \`${report.model}\``);
  lines.push(`- smoke_principal: renter_id=\`${report.principal.renter_id}\` key_hint=\`${report.principal.key_hint}\``);
  lines.push(`- transcript_command: \`${report.command}\``);
  lines.push('');
  lines.push('## Probe Summary');
  lines.push('');
  lines.push('| step | status | elapsed_ms | request_id | notes |');
  lines.push('|---|---:|---:|---|---|');
  for (const [step, result] of Object.entries(report.probes)) {
    const notes = result.stream_done === false
      ? 'missing [DONE]'
      : (result.error_message || '');
    lines.push(`| ${step} | ${result.status} | ${result.elapsed_ms ?? ''} | ${result.request_id || ''} | ${String(notes || '').replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
  lines.push('## Provider Route Evidence');
  lines.push('');
  lines.push(`- completion_json.provider_id: \`${report.probes.completion_json.provider_id || ''}\``);
  lines.push(`- completion_json.provider_tier: \`${report.probes.completion_json.provider_tier || ''}\``);
  lines.push(`- completion_json.provider_endpoint_host: \`${report.probes.completion_json.provider_endpoint_host || ''}\``);
  lines.push(`- completion_stream.provider_id: \`${report.probes.completion_stream.provider_id || ''}\``);
  lines.push(`- completion_stream.provider_tier: \`${report.probes.completion_stream.provider_tier || ''}\``);
  lines.push(`- completion_stream.provider_endpoint_host: \`${report.probes.completion_stream.provider_endpoint_host || ''}\``);
  lines.push('');
  if (report.failure) {
    lines.push('## Failure Classification');
    lines.push('');
    lines.push(`- code: \`${report.failure.code}\``);
    lines.push(`- severity: \`${report.failure.severity}\``);
    lines.push(`- action: ${report.failure.action}`);
    lines.push('');
  }
  lines.push('## Artifacts');
  lines.push('');
  lines.push(`- json: \`${report.artifacts.json}\``);
  lines.push(`- markdown: \`${report.artifacts.markdown}\``);
  lines.push(`- log: \`${report.artifacts.log}\``);
  lines.push(`- latest_json: \`${report.artifacts.latest_json}\``);
  lines.push(`- latest_markdown: \`${report.artifacts.latest_markdown}\``);
  lines.push(`- latest_log: \`${report.artifacts.latest_log}\``);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function run() {
  const baseUrl = normalizeBaseUrl();
  const model = String(process.env.DCP_SMOKE_MODEL || process.env.DCP_PROOF_MODEL || 'allam-2-7b').trim();
  const outputDir = path.resolve(process.env.DCP_PROOF_OUTPUT_DIR || OUTPUT_DIR_DEFAULT);
  const stamp = toStamp();

  fs.mkdirSync(outputDir, { recursive: true });

  const transcript = [];
  const addLog = (line) => transcript.push(`${new Date().toISOString()} ${line}`);

  addLog(`start base_url=${baseUrl} model=${model}`);
  addLog('ensure smoke principal');
  const principal = await ensureInferenceSmokePrincipal({ baseUrl });
  addLog(`smoke principal ready renter_id=${principal.renterId} key_hint=${redactSecret(principal.inferenceKey)}`);

  const authHeaders = {
    'x-renter-key': principal.inferenceKey,
    'content-type': 'application/json',
  };

  addLog('probe health');
  const healthProbe = await probeHealth(baseUrl);
  const health = healthProbe.result;

  addLog('probe /v1/models');
  const models = await requestJson(baseUrl, '/v1/models', {
    method: 'GET',
    headers: { 'x-renter-key': principal.inferenceKey },
  });

  const completionPayload = {
    model,
    messages: [{ role: 'user', content: 'Reply with the exact token: DCP_PROOF_OK' }],
    temperature: 0,
    max_tokens: 24,
  };

  addLog('probe /v1/chat/completions (json)');
  const completionJson = await requestJson(baseUrl, `/v1/chat/completions?key=${encodeURIComponent(principal.inferenceKey)}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(completionPayload),
  });

  addLog('probe /v1/chat/completions (stream)');
  const streamRes = await requestJson(baseUrl, `/v1/chat/completions?key=${encodeURIComponent(principal.inferenceKey)}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ...completionPayload, stream: true }),
  });
  const streamDone = /\bdata:\s*\[DONE\]/.test(String(streamRes.text || ''));

  const probes = {
    health: {
      route: healthProbe.route,
      status: health.status,
      elapsed_ms: health.elapsed_ms,
      request_id: health.headers['x-request-id'] || null,
      response_hash: makeSha256(health.text),
      error_message: health.ok ? null : (health.json?.error?.message || health.text?.slice(0, 240) || null),
    },
    models: {
      status: models.status,
      elapsed_ms: models.elapsed_ms,
      request_id: models.headers['x-request-id'] || null,
      model_count: Array.isArray(models.json?.data) ? models.json.data.length : null,
      response_hash: makeSha256(models.text),
      error_message: models.ok ? null : (models.json?.error?.message || models.text?.slice(0, 240) || null),
    },
    completion_json: {
      status: completionJson.status,
      elapsed_ms: completionJson.elapsed_ms,
      request_id: completionJson.headers['x-request-id'] || null,
      response_hash: makeSha256(completionJson.text),
      provider_id: completionJson.headers['x-dcp-provider-id'] || null,
      provider_tier: completionJson.headers['x-dcp-provider-tier'] || null,
      provider_endpoint_host: completionJson.headers['x-dcp-provider-endpoint-host'] || null,
      requested_model_id: completionJson.headers['x-dcp-requested-model-id'] || null,
      routed_model_id: completionJson.headers['x-dcp-routed-model-id'] || null,
      latency_gate_mode: completionJson.headers['x-dcp-latency-gate-mode'] || null,
      error_message: completionJson.ok ? null : (completionJson.json?.error?.message || completionJson.text?.slice(0, 240) || null),
    },
    completion_stream: {
      status: streamRes.status,
      elapsed_ms: streamRes.elapsed_ms,
      request_id: streamRes.headers['x-request-id'] || null,
      stream_done: streamDone,
      response_hash: makeSha256(streamRes.text),
      provider_id: streamRes.headers['x-dcp-provider-id'] || null,
      provider_tier: streamRes.headers['x-dcp-provider-tier'] || null,
      provider_endpoint_host: streamRes.headers['x-dcp-provider-endpoint-host'] || null,
      requested_model_id: streamRes.headers['x-dcp-requested-model-id'] || null,
      routed_model_id: streamRes.headers['x-dcp-routed-model-id'] || null,
      latency_gate_mode: streamRes.headers['x-dcp-latency-gate-mode'] || null,
      error_message: streamRes.ok ? null : (streamRes.json?.error?.message || streamRes.text?.slice(0, 240) || null),
    },
  };

  const failure = classifyFailure(probes);
  const verdict = failure ? 'FAIL' : 'PASS';
  addLog(`verdict=${verdict}${failure ? ` failure=${failure.code}` : ''}`);

  const jsonFile = path.join(outputDir, `${PROOF_PREFIX}-${stamp}.json`);
  const markdownFile = path.join(outputDir, `${PROOF_PREFIX}-${stamp}.md`);
  const logFile = path.join(outputDir, `${PROOF_PREFIX}-${stamp}.log`);
  const latestJson = path.join(outputDir, `${PROOF_PREFIX}-latest.json`);
  const latestMarkdown = path.join(outputDir, `${PROOF_PREFIX}-latest.md`);
  const latestLog = path.join(outputDir, `${PROOF_PREFIX}-latest.log`);

  const report = {
    generated_at: new Date().toISOString(),
    verdict,
    base_url: baseUrl,
    model,
    command: `node tests/first-live-inference-proof-package.js`,
    principal: {
      renter_id: principal.renterId,
      renter_email: principal.renterEmail,
      key_hint: redactSecret(principal.inferenceKey),
      scoped_key_id: principal.inferenceKeyId,
      scoped_key_label: principal.inferenceKeyLabel,
      scoped_key_expires_at: principal.inferenceKeyExpiresAt,
      balance_halala: principal.balanceHalala,
    },
    probes,
    failure,
    artifacts: {
      json: path.relative(REPO_ROOT, jsonFile),
      markdown: path.relative(REPO_ROOT, markdownFile),
      log: path.relative(REPO_ROOT, logFile),
      latest_json: path.relative(REPO_ROOT, latestJson),
      latest_markdown: path.relative(REPO_ROOT, latestMarkdown),
      latest_log: path.relative(REPO_ROOT, latestLog),
    },
  };

  const markdown = buildMarkdown(report);
  fs.writeFileSync(jsonFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownFile, markdown, 'utf8');
  fs.writeFileSync(logFile, `${transcript.join('\n')}\n`, 'utf8');
  fs.copyFileSync(jsonFile, latestJson);
  fs.copyFileSync(markdownFile, latestMarkdown);
  fs.copyFileSync(logFile, latestLog);

  process.stdout.write(`${JSON.stringify({
    verdict,
    failure_code: failure?.code || null,
    artifacts: report.artifacts,
    principal: report.principal,
  }, null, 2)}\n`);

  if (failure) process.exit(1);
}

run().catch((error) => {
  const message = error?.message || 'Unknown error';
  const details = error?.details || null;
  process.stderr.write(`${JSON.stringify({ ok: false, message, details }, null, 2)}\n`);
  process.exit(1);
});
