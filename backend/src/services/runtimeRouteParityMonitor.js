'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 12000;
const PROVIDERS_ROUTE_FILE = path.resolve(__dirname, '../routes/providers.js');
const V1_ROUTE_FILE = path.resolve(__dirname, '../routes/v1.js');

const DEFAULT_ROUTE_DEFINITIONS = [
  {
    id: 'providers_model_catalog',
    mountPath: '/api/providers',
    sourceFile: PROVIDERS_ROUTE_FILE,
    routePath: '/model-catalog',
    method: 'GET',
    runtimePath: '/api/providers/model-catalog',
    expectedStatus: 200,
    expectedContentTypeIncludes: 'application/json',
    requestBody: null,
    validateBody: (json) => {
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
    id: 'v1_models',
    mountPath: '/v1',
    sourceFile: V1_ROUTE_FILE,
    routePath: '/models',
    method: 'GET',
    runtimePath: '/v1/models',
    expectedStatus: 200,
    expectedContentTypeIncludes: 'application/json',
    requestBody: null,
    validateBody: (json) => {
      const mismatches = [];
      if (!json || typeof json !== 'object') {
        return ['response body is not a JSON object'];
      }
      if (json.object !== 'list') mismatches.push('body.object must equal "list"');
      if (!Array.isArray(json.data)) mismatches.push('body.data must be an array');
      return mismatches;
    },
  },
  {
    id: 'v1_chat_completions_auth_guard',
    mountPath: '/v1',
    sourceFile: V1_ROUTE_FILE,
    routePath: '/chat/completions',
    method: 'POST',
    runtimePath: '/v1/chat/completions',
    expectedStatus: 401,
    expectedContentTypeIncludes: 'application/json',
    requestBody: {
      model: 'parity-check-model',
      messages: [{ role: 'user', content: 'parity check' }],
    },
    validateBody: (json) => {
      const mismatches = [];
      if (!json || typeof json !== 'object') {
        return ['response body is not a JSON object'];
      }
      if (!json.error || typeof json.error !== 'object') mismatches.push('body.error must be an object');
      if (typeof json.error?.message !== 'string') mismatches.push('body.error.message must be a string');
      if (typeof json.error?.code !== 'number') mismatches.push('body.error.code must be a number');
      return mismatches;
    },
  },
];

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('ROUTE_PARITY_BASE_URL is required');
  return raw.replace(/\/+$/, '');
}

function routeExists(router, method, routePath) {
  if (!router || !Array.isArray(router.stack)) return false;
  const expectedMethod = String(method || '').toLowerCase();
  return router.stack.some((layer) => {
    if (!layer?.route?.path || !layer.route.methods) return false;
    const layerPath = String(layer.route.path);
    return layerPath === routePath && Boolean(layer.route.methods[expectedMethod]);
  });
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function routeExistsInSource(sourceFile, method, routePath) {
  if (!sourceFile) return false;
  let sourceText = '';
  try {
    sourceText = fs.readFileSync(sourceFile, 'utf8');
  } catch (_) {
    return false;
  }

  const methodToken = escapeRegExp(String(method || '').toLowerCase());
  const pathToken = escapeRegExp(routePath);
  const routeExpr = new RegExp(`router\\.${methodToken}\\(\\s*['"]${pathToken}['"]`, 'm');
  return routeExpr.test(sourceText);
}

async function fetchRoute({ fetchImpl, baseUrl, route, timeoutMs }) {
  const endpoint = `${baseUrl}${route.runtimePath}`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: route.method,
      headers: route.requestBody ? { 'Content-Type': 'application/json' } : undefined,
      body: route.requestBody ? JSON.stringify(route.requestBody) : undefined,
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

function evaluateRoute(route, runtimeResult, latencyThresholdMs) {
  const mismatches = [];

  if (!route.codeContract.declaredInCode) {
    mismatches.push('route missing in code router stack');
  }

  if (!runtimeResult.ok) {
    mismatches.push(`runtime probe failed: ${runtimeResult.error}`);
  } else {
    if (runtimeResult.status !== route.expectedStatus) {
      mismatches.push(`status mismatch: expected ${route.expectedStatus}, got ${runtimeResult.status}`);
    }
    if (route.expectedContentTypeIncludes && !runtimeResult.contentType.includes(route.expectedContentTypeIncludes)) {
      mismatches.push(
        `content-type mismatch: expected to include "${route.expectedContentTypeIncludes}", got "${runtimeResult.contentType || '<empty>'}"`
      );
    }
    const bodyMismatches = route.validateBody(runtimeResult.bodyJson);
    if (Array.isArray(bodyMismatches) && bodyMismatches.length > 0) {
      mismatches.push(...bodyMismatches);
    }
  }

  const latencyBreached = Number.isFinite(latencyThresholdMs)
    && latencyThresholdMs > 0
    && Number(runtimeResult.durationMs || 0) > latencyThresholdMs;

  return {
    id: route.id,
    method: route.method,
    path: route.runtimePath,
    codeContract: route.codeContract,
    runtime: runtimeResult,
    mismatches,
    latencyBreached,
    status: mismatches.length === 0 ? 'pass' : 'fail',
  };
}

function toIsoStamp(date) {
  return new Date(date.getTime() - (date.getMilliseconds())).toISOString().replace(/[:]/g, '-');
}

function writeReportArtifact(report, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = toIsoStamp(new Date());
  const filePath = path.join(outputDir, `route-parity-${stamp}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return filePath;
}

async function runRuntimeRouteParityMonitor(options = {}) {
  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is unavailable. Use Node.js 18+ or pass fetchImpl.');
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl || process.env.ROUTE_PARITY_BASE_URL || 'https://api.dcp.sa');
  const timeoutMs = Number.parseInt(process.env.ROUTE_PARITY_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10);
  const maxFailures = Number.parseInt(process.env.ROUTE_PARITY_MAX_FAILURES || '0', 10);
  const latencyThresholdMs = Number.parseInt(process.env.ROUTE_PARITY_LATENCY_THRESHOLD_MS || '4000', 10);
  const maxLatencyBreaches = Number.parseInt(process.env.ROUTE_PARITY_MAX_LATENCY_BREACHES || '0', 10);

  const routeDefinitions = (options.routeDefinitions || DEFAULT_ROUTE_DEFINITIONS).map((route) => ({
    ...route,
    codeContract: {
      mountPath: route.mountPath,
      routePath: route.routePath,
      method: route.method,
      declaredInCode: route.router
        ? routeExists(route.router, route.method, route.routePath)
        : routeExistsInSource(route.sourceFile, route.method, route.routePath),
    },
  }));

  const routeResults = [];
  for (const route of routeDefinitions) {
    const runtimeResult = await fetchRoute({ fetchImpl, baseUrl, route, timeoutMs });
    routeResults.push(evaluateRoute(route, runtimeResult, latencyThresholdMs));
  }

  const failed = routeResults.filter((route) => route.status === 'fail').length;
  const latencyBreaches = routeResults.filter((route) => route.latencyBreached).length;
  const pass = routeResults.length - failed;

  const thresholdBreaches = [];
  if (failed > maxFailures) {
    thresholdBreaches.push(`route failures ${failed} > max ${maxFailures}`);
  }
  if (latencyBreaches > maxLatencyBreaches) {
    thresholdBreaches.push(`latency breaches ${latencyBreaches} > max ${maxLatencyBreaches}`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    thresholds: {
      max_failures: maxFailures,
      latency_threshold_ms: latencyThresholdMs,
      max_latency_breaches: maxLatencyBreaches,
    },
    summary: {
      total_routes: routeResults.length,
      pass,
      failed,
      latency_breaches: latencyBreaches,
      status: thresholdBreaches.length === 0 ? 'pass' : 'fail',
      threshold_breaches: thresholdBreaches,
    },
    routes: routeResults,
  };

  const outputDir = options.outputDir || process.env.ROUTE_PARITY_ARTIFACT_DIR || 'docs/reports/runtime-parity';
  const artifactPath = writeReportArtifact(report, outputDir);

  return {
    report,
    artifactPath,
    failed,
    latencyBreaches,
    thresholdBreaches,
  };
}

module.exports = {
  DEFAULT_ROUTE_DEFINITIONS,
  runRuntimeRouteParityMonitor,
  evaluateRoute,
  routeExists,
  routeExistsInSource,
};
