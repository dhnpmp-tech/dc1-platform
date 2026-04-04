#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ensureInferenceSmokePrincipal } = require('./ensure-inference-smoke-principal');

const REPO_ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR_DEFAULT = path.resolve(__dirname, '../../docs/reports/reliability/dcp-472-proof');
const PREFIX = 'dcp-472-capacity-proof';

function parseJsonBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || process.env.DCP_API_BASE_URL || process.env.DCP_BASE_URL || 'https://api.dcp.sa').replace(/\/+$/, '');
}

function toStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function toHash(input) {
  return crypto.createHash('sha256').update(String(input || '')).digest('hex');
}

function normalizeModelToken(value) {
  if (typeof value !== 'string') return null;
  const next = value.trim().toLowerCase();
  return next || null;
}

function extractCachedModelIds(provider = {}) {
  const source = provider.cached_models;
  if (!Array.isArray(source)) return [];
  const ids = [];
  for (const entry of source) {
    if (typeof entry === 'string') ids.push(entry);
    else if (entry && typeof entry === 'object') {
      if (typeof entry.model_id === 'string') ids.push(entry.model_id);
      else if (typeof entry.id === 'string') ids.push(entry.id);
      else if (typeof entry.model === 'string') ids.push(entry.model);
    }
  }
  return ids;
}

async function requestJson(baseUrl, route, options = {}) {
  const startedAt = Date.now();
  const response = await fetch(new URL(route, baseUrl), options);
  const elapsedMs = Date.now() - startedAt;
  const text = await response.text();
  const json = parseJsonBody(text);
  return {
    status: response.status,
    ok: response.ok,
    elapsed_ms: elapsedMs,
    text,
    json,
    headers: {
      'x-request-id': response.headers.get('x-request-id'),
      'x-dcp-provider-id': response.headers.get('x-dcp-provider-id'),
      'x-dcp-requested-model-id': response.headers.get('x-dcp-requested-model-id'),
      'x-dcp-routed-model-id': response.headers.get('x-dcp-routed-model-id'),
    },
  };
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# DCP-472 Capacity Proof');
  lines.push('');
  lines.push(`- generated_at: \`${report.generated_at}\``);
  lines.push(`- verdict: **${report.verdict}**`);
  lines.push(`- base_url: \`${report.base_url}\``);
  lines.push(`- model: \`${report.model}\``);
  lines.push(`- renter_id: \`${report.principal.renter_id}\``);
  lines.push(`- provider_id: \`${report.capacity_snapshot.provider_id || ''}\``);
  lines.push(`- heartbeat_timestamp: \`${report.capacity_snapshot.heartbeat_timestamp || ''}\``);
  lines.push(`- capable_providers: \`${report.capacity_snapshot.capable_providers}\``);
  lines.push('');
  lines.push('## Probes');
  lines.push('');
  lines.push(`- providers_available.status: \`${report.probes.providers_available.status}\``);
  lines.push(`- providers_available.total: \`${report.probes.providers_available.provider_count}\``);
  lines.push(`- providers_available.model_matched_provider_count: \`${report.probes.providers_available.model_matched_provider_count}\``);
  lines.push(`- completion_json.status: \`${report.probes.completion_json.status}\``);
  lines.push(`- completion_json.error: \`${report.probes.completion_json.error_message || ''}\``);
  lines.push('');
  if (report.failure) {
    lines.push('## Failure');
    lines.push('');
    lines.push(`- code: \`${report.failure.code}\``);
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
  const model = String(process.env.DCP_SMOKE_MODEL || 'ALLaM-AI/ALLaM-7B-Instruct-preview').trim();
  const outputDir = path.resolve(process.env.DCP_DCP472_OUTPUT_DIR || OUTPUT_DIR_DEFAULT);
  const stamp = toStamp();
  fs.mkdirSync(outputDir, { recursive: true });

  const transcript = [];
  const addLog = (line) => transcript.push(`${new Date().toISOString()} ${line}`);

  addLog(`start base_url=${baseUrl} model=${model}`);
  const principal = await ensureInferenceSmokePrincipal({ baseUrl });
  addLog(`principal ready renter_id=${principal.renterId}`);

  const providerRes = await requestJson(baseUrl, '/api/providers/available', { method: 'GET' });
  const providers = Array.isArray(providerRes.json?.providers) ? providerRes.json.providers : [];
  const target = normalizeModelToken(model);
  const matchedProviders = providers.filter((provider) => (
    extractCachedModelIds(provider)
      .map(normalizeModelToken)
      .filter(Boolean)
      .includes(target)
  ));

  let livenessRes = null;
  if (matchedProviders[0]?.id != null) {
    addLog(`probe liveness provider_id=${matchedProviders[0].id}`);
    livenessRes = await requestJson(baseUrl, `/api/providers/${encodeURIComponent(String(matchedProviders[0].id))}/liveness`, { method: 'GET' });
  }

  const completionRes = await requestJson(baseUrl, `/v1/chat/completions?key=${encodeURIComponent(principal.inferenceKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-renter-key': principal.inferenceKey },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply with the exact token: DCP472_OK' }],
      temperature: 0,
      max_tokens: 24,
    }),
  });

  const diagnosticsCapableProviders = Number(completionRes.json?.diagnostics?.capable_providers);
  const matchedProviderCount = matchedProviders.length;
  const capableProviders = Number.isFinite(diagnosticsCapableProviders) && diagnosticsCapableProviders >= 0
    ? diagnosticsCapableProviders
    : matchedProviderCount;

  const providerId = completionRes.headers['x-dcp-provider-id']
    || matchedProviders[0]?.id
    || null;
  const heartbeatTimestamp = livenessRes?.json?.last_heartbeat || null;

  const pass = completionRes.status === 200 && capableProviders > 0 && Boolean(providerId) && Boolean(heartbeatTimestamp);
  const failure = pass ? null : {
    code: 'dcp472_capacity_not_restored',
    action: 'Deploy ALLaM routing fix to production and ensure at least one live provider advertises the requested model in cached_models.',
  };

  const jsonFile = path.join(outputDir, `${PREFIX}-${stamp}.json`);
  const mdFile = path.join(outputDir, `${PREFIX}-${stamp}.md`);
  const logFile = path.join(outputDir, `${PREFIX}-${stamp}.log`);
  const latestJson = path.join(outputDir, `${PREFIX}-latest.json`);
  const latestMd = path.join(outputDir, `${PREFIX}-latest.md`);
  const latestLog = path.join(outputDir, `${PREFIX}-latest.log`);

  const report = {
    generated_at: new Date().toISOString(),
    verdict: pass ? 'PASS' : 'FAIL',
    base_url: baseUrl,
    model,
    principal: {
      renter_id: principal.renterId,
      renter_email: principal.renterEmail,
      scoped_key_id: principal.inferenceKeyId,
      scoped_key_expires_at: principal.inferenceKeyExpiresAt,
    },
    probes: {
      providers_available: {
        status: providerRes.status,
        elapsed_ms: providerRes.elapsed_ms,
        provider_count: providers.length,
        model_matched_provider_count: matchedProviderCount,
        response_hash: toHash(providerRes.text),
      },
      provider_liveness: livenessRes ? {
        status: livenessRes.status,
        elapsed_ms: livenessRes.elapsed_ms,
        provider_id: livenessRes.json?.provider_id ?? matchedProviders[0]?.id ?? null,
        last_heartbeat: livenessRes.json?.last_heartbeat ?? null,
        heartbeat_age_seconds: livenessRes.json?.heartbeat_age_seconds ?? null,
        response_hash: toHash(livenessRes.text),
      } : null,
      completion_json: {
        status: completionRes.status,
        elapsed_ms: completionRes.elapsed_ms,
        provider_id: completionRes.headers['x-dcp-provider-id'] || null,
        requested_model_id: completionRes.headers['x-dcp-requested-model-id'] || null,
        routed_model_id: completionRes.headers['x-dcp-routed-model-id'] || null,
        diagnostics: completionRes.json?.diagnostics || null,
        error_message: completionRes.ok ? null : (completionRes.json?.error?.message || completionRes.text.slice(0, 240)),
        response_hash: toHash(completionRes.text),
      },
    },
    capacity_snapshot: {
      provider_id: providerId,
      model_id: model,
      heartbeat_timestamp: heartbeatTimestamp,
      capable_providers: capableProviders,
    },
    failure,
    artifacts: {
      json: path.relative(REPO_ROOT, jsonFile),
      markdown: path.relative(REPO_ROOT, mdFile),
      log: path.relative(REPO_ROOT, logFile),
      latest_json: path.relative(REPO_ROOT, latestJson),
      latest_markdown: path.relative(REPO_ROOT, latestMd),
      latest_log: path.relative(REPO_ROOT, latestLog),
    },
  };

  fs.writeFileSync(jsonFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdFile, buildMarkdown(report), 'utf8');
  fs.writeFileSync(logFile, `${transcript.join('\n')}\n`, 'utf8');
  fs.copyFileSync(jsonFile, latestJson);
  fs.copyFileSync(mdFile, latestMd);
  fs.copyFileSync(logFile, latestLog);

  process.stdout.write(`${JSON.stringify({
    verdict: report.verdict,
    capacity_snapshot: report.capacity_snapshot,
    artifacts: report.artifacts,
  }, null, 2)}\n`);

  if (!pass) process.exit(1);
}

run().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    message: error?.message || 'Unknown error',
    details: error?.details || null,
  }, null, 2)}\n`);
  process.exit(1);
});
