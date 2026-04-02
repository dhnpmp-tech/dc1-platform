#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const PROVIDERS_ROUTE_FILE = path.resolve(__dirname, '../routes/providers.js');
const OUTPUT_DIR = path.resolve(REPO_ROOT, 'docs/reports/reliability');
const PREFIX = 'provider-route-parity-guard';
const DEFAULT_BASE_URL = 'https://api.dcp.sa';
const DEFAULT_TIMEOUT_MS = 12000;

const ROUTES = [
  {
    id: 'providers_model_catalog',
    method: 'GET',
    routePath: '/model-catalog',
    runtimePath: '/api/providers/model-catalog',
    expectedStatus: 200,
    expectedContentTypeIncludes: 'application/json',
    validateBody(json) {
      const mismatches = [];
      if (!json || typeof json !== 'object') {
        return ['response body is not a JSON object'];
      }
      if (json.object !== 'list') mismatches.push('body.object must equal "list"');
      if (!Array.isArray(json.data)) mismatches.push('body.data must be an array');
      if (typeof json.total !== 'number') mismatches.push('body.total must be a number');
      if (typeof json.generated_at !== 'string') mismatches.push('body.generated_at must be a string');
      return mismatches;
    },
  },
  {
    id: 'providers_models_aggregate',
    method: 'GET',
    routePath: '/models',
    runtimePath: '/api/providers/models',
    expectedStatus: 200,
    expectedContentTypeIncludes: 'application/json',
    validateBody(json) {
      const mismatches = [];
      if (!json || typeof json !== 'object') {
        return ['response body is not a JSON object'];
      }
      if (!Array.isArray(json.models)) mismatches.push('body.models must be an array');
      if (typeof json.total !== 'number') mismatches.push('body.total must be a number');
      return mismatches;
    },
  },
];

function utcStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function toIsoStamp() {
  return new Date().toISOString();
}

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('PROVIDER_ROUTE_PARITY_BASE_URL is required');
  return raw.replace(/\/+$/, '');
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function routeDeclaredInSource(route) {
  const source = fs.readFileSync(PROVIDERS_ROUTE_FILE, 'utf8');
  const methodToken = escapeRegExp(String(route.method || '').toLowerCase());
  const pathToken = escapeRegExp(route.routePath);
  const pattern = new RegExp(`router\\.${methodToken}\\(\\s*['\"]${pathToken}['\"]`, 'm');
  return pattern.test(source);
}

async function probeRoute(baseUrl, route, timeoutMs) {
  const endpoint = `${baseUrl}${route.runtimePath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: route.method,
      signal: controller.signal,
    });

    const rawText = await response.text();
    let json = null;
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch (_) {}

    return {
      endpoint,
      ok: true,
      status: response.status,
      contentType: String(response.headers?.get('content-type') || ''),
      bodyText: rawText,
      bodyJson: json,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      endpoint,
      ok: false,
      error: error?.name === 'AbortError' ? 'request_timeout' : (error?.message || 'fetch_failed'),
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

function evaluateRoute(route, runtime) {
  const mismatches = [];
  const declaredInCode = routeDeclaredInSource(route);

  if (!declaredInCode) {
    mismatches.push('route missing in backend/src/routes/providers.js');
  }

  if (!runtime.ok) {
    mismatches.push(`runtime probe failed: ${runtime.error}`);
  } else {
    if (runtime.status !== route.expectedStatus) {
      mismatches.push(`status mismatch: expected ${route.expectedStatus}, got ${runtime.status}`);
    }

    if (!runtime.contentType.includes(route.expectedContentTypeIncludes)) {
      mismatches.push(
        `content-type mismatch: expected to include "${route.expectedContentTypeIncludes}", got "${runtime.contentType || '<empty>'}"`
      );
    }

    const bodyMismatches = route.validateBody(runtime.bodyJson);
    if (Array.isArray(bodyMismatches) && bodyMismatches.length > 0) {
      mismatches.push(...bodyMismatches);
    }
  }

  return {
    id: route.id,
    method: route.method,
    path: route.runtimePath,
    declared_in_code: declaredInCode,
    runtime,
    mismatches,
    status: mismatches.length === 0 ? 'pass' : 'fail',
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Provider Route Parity Guard Report');
  lines.push('');
  lines.push(`- generated_at: \`${report.generated_at}\``);
  lines.push(`- base_url: \`${report.base_url}\``);
  lines.push(`- command: \`${report.command}\``);
  lines.push(`- verdict: **${String(report.summary.status || 'unknown').toUpperCase()}**`);
  lines.push(`- pass: \`${report.summary.pass}\``);
  lines.push(`- failed: \`${report.summary.failed}\``);
  lines.push('');
  lines.push('## Route Results');
  lines.push('');

  report.routes.forEach((route) => {
    lines.push(`### ${route.method} ${route.path}`);
    lines.push(`- status: **${route.status.toUpperCase()}**`);
    lines.push(`- declared_in_code: \`${route.declared_in_code}\``);
    lines.push(`- runtime_status: \`${route.runtime.ok ? route.runtime.status : 'probe_failed'}\``);
    lines.push(`- runtime_duration_ms: \`${route.runtime.durationMs}\``);
    if (route.mismatches.length > 0) {
      lines.push('- mismatches:');
      route.mismatches.forEach((entry) => lines.push(`  - ${entry}`));
    }
    lines.push('');
  });

  return `${lines.join('\n')}\n`;
}

function writeArtifacts(report) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const stamp = utcStamp();
  const jsonRel = `docs/reports/reliability/${PREFIX}-${stamp}.json`;
  const mdRel = `docs/reports/reliability/${PREFIX}-${stamp}.md`;
  const latestJsonRel = `docs/reports/reliability/${PREFIX}-latest.json`;
  const latestMdRel = `docs/reports/reliability/${PREFIX}-latest.md`;

  const jsonPath = path.resolve(REPO_ROOT, jsonRel);
  const mdPath = path.resolve(REPO_ROOT, mdRel);
  const latestJsonPath = path.resolve(REPO_ROOT, latestJsonRel);
  const latestMdPath = path.resolve(REPO_ROOT, latestMdRel);

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, renderMarkdown(report), 'utf8');
  fs.copyFileSync(jsonPath, latestJsonPath);
  fs.copyFileSync(mdPath, latestMdPath);

  return {
    json: jsonRel,
    markdown: mdRel,
    latest_json: latestJsonRel,
    latest_markdown: latestMdRel,
  };
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.PROVIDER_ROUTE_PARITY_BASE_URL || DEFAULT_BASE_URL);
  const timeoutMs = Number.parseInt(process.env.PROVIDER_ROUTE_PARITY_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10);
  const command = 'cd backend && npm run gate:provider-route-parity';

  const routes = [];
  for (const route of ROUTES) {
    const runtime = await probeRoute(baseUrl, route, timeoutMs);
    routes.push(evaluateRoute(route, runtime));
  }

  const failed = routes.filter((route) => route.status === 'fail').length;
  const report = {
    generated_at: toIsoStamp(),
    base_url: baseUrl,
    timeout_ms: timeoutMs,
    command,
    summary: {
      total_routes: routes.length,
      pass: routes.length - failed,
      failed,
      status: failed === 0 ? 'pass' : 'fail',
    },
    routes,
  };

  const artifacts = writeArtifacts(report);
  report.artifacts = artifacts;

  fs.writeFileSync(path.resolve(REPO_ROOT, artifacts.json), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.copyFileSync(path.resolve(REPO_ROOT, artifacts.json), path.resolve(REPO_ROOT, artifacts.latest_json));

  console.log(`[provider-route-parity] base=${baseUrl}`);
  console.log(`[provider-route-parity] status=${report.summary.status} pass=${report.summary.pass} failed=${report.summary.failed}`);
  console.log(`[provider-route-parity] artifact_json=${artifacts.json}`);
  console.log(`[provider-route-parity] artifact_md=${artifacts.markdown}`);

  routes
    .filter((route) => route.status === 'fail')
    .forEach((route) => {
      console.error(`[provider-route-parity] route=${route.method} ${route.path}`);
      route.mismatches.forEach((entry) => {
        console.error(`[provider-route-parity] mismatch=${entry}`);
      });
    });

  if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[provider-route-parity] fatal=${error.message}`);
  process.exit(1);
});
