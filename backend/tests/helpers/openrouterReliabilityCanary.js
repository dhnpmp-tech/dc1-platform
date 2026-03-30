'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const express = require('express');

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';

const db = require('../../src/db');
const v1Router = require('../../src/routes/v1');

const DEFAULT_MODEL_ID = 'openrouter-canary-model';

function nowIso() {
  return new Date().toISOString();
}

function randomKey(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

function safeDelete(table) {
  try {
    db.prepare(`DELETE FROM ${table}`).run();
  } catch (_) {}
}

function resetDb() {
  [
    'openrouter_settlement_alerts',
    'openrouter_settlement_items',
    'openrouter_settlement_topups',
    'openrouter_settlement_invoices',
    'openrouter_settlements',
    'openrouter_usage_ledger',
    'renter_api_keys',
    'jobs',
    'model_registry',
    'providers',
    'renters',
  ].forEach(safeDelete);
}

function seedModel(modelId = DEFAULT_MODEL_ID) {
  db.prepare(
    `INSERT OR REPLACE INTO model_registry
      (model_id, display_name, family, vram_gb, quantization, context_window, use_cases,
       min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    modelId,
    'OpenRouter Canary Model',
    'qa',
    8,
    'fp16',
    8192,
    '["qa"]',
    4,
    20,
    nowIso()
  );
}

function seedRenter({ balanceHalala, apiKey }) {
  const key = apiKey || randomKey('canary-renter');
  db.prepare(
    `INSERT INTO renters
      (name, email, api_key, status, balance_halala, total_spent_halala, total_jobs, created_at)
     VALUES (?, ?, ?, 'active', ?, 0, 0, ?)`
  ).run(
    'Canary Renter',
    `${key}@dc1.test`,
    key,
    balanceHalala,
    nowIso()
  );

  return { apiKey: key };
}

function seedProvider({ endpointUrl }) {
  const apiKey = randomKey('canary-provider');
  db.prepare(
    `INSERT INTO providers
      (name, email, api_key, gpu_model, vram_gb, gpu_vram_mib, approval_status, status,
       supported_compute_types, vllm_endpoint_url, last_heartbeat, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'approved', 'online', '["inference"]', ?, ?, ?, ?)`
  ).run(
    'Canary Provider',
    `${apiKey}@dc1.test`,
    apiKey,
    'RTX 4090',
    24,
    24576,
    endpointUrl,
    nowIso(),
    nowIso(),
    nowIso()
  );
}

function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const onlineCount = Number(
      db.prepare("SELECT COUNT(*) AS count FROM providers WHERE status = 'online'").get()?.count || 0
    );
    res.json({
      status: 'ok',
      timestamp: nowIso(),
      providers: {
        online: onlineCount,
      },
    });
  });

  app.use('/v1', v1Router);
  return app;
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function startMockProvider(mode) {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (mode === 'stream-fail-midway') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(`data: ${JSON.stringify({
          id: 'chatcmpl-stream-fail',
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: DEFAULT_MODEL_ID,
          choices: [{ index: 0, delta: { content: 'partial' }, finish_reason: null }],
        })}\n\n`);
        res.socket.destroy();
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({
        id: 'chatcmpl-stream-ok',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: DEFAULT_MODEL_ID,
        choices: [{ index: 0, delta: { content: 'Mar' }, finish_reason: null }],
      })}\n\n`);
      res.write(`data: ${JSON.stringify({
        id: 'chatcmpl-stream-ok',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: DEFAULT_MODEL_ID,
        choices: [{ index: 0, delta: { content: 'haba' }, finish_reason: 'stop' }],
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });

  const port = await listen(server);
  return {
    endpointUrl: `http://127.0.0.1:${port}`,
    close: () => closeServer(server),
  };
}

function evaluateCheck(id, title, pass, evidence) {
  return {
    id,
    title,
    status: pass ? 'pass' : 'fail',
    evidence,
  };
}

function buildSummary(checks) {
  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.length - passed;
  return {
    total: checks.length,
    passed,
    failed,
    status: failed === 0 ? 'pass' : 'fail',
  };
}

function resolveThresholds(input = {}) {
  const env = process.env;
  const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    minProvidersOnline: toNumber(input.minProvidersOnline ?? env.CANARY_MIN_PROVIDERS_ONLINE, 1),
    maxStreamLatencyMs: toNumber(input.maxStreamLatencyMs ?? env.CANARY_MAX_STREAM_LATENCY_MS, 1500),
    maxErrorRate: toNumber(input.maxErrorRate ?? env.CANARY_MAX_ERROR_RATE, 0),
  };
}

async function runOpenRouterReliabilityCanary(options = {}) {
  resetDb();
  const app = createApp();
  const appServer = http.createServer(app);
  const appPort = await listen(appServer);
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const checks = [];
  const simulateFailure = Boolean(options.simulateFailure);
  const thresholds = resolveThresholds(options.thresholds || {});

  let streamStatus = 0;
  let streamDoneSeen = false;
  let streamLatencyMs = 0;
  let streamError = null;

  try {
    seedModel(DEFAULT_MODEL_ID);

    const provider = await startMockProvider(simulateFailure ? 'stream-fail-midway' : 'stream-success');
    try {
      seedProvider({ endpointUrl: provider.endpointUrl });
      const renter = seedRenter({ balanceHalala: 10_000, apiKey: 'canary-funded-renter' });

      const healthResponse = await fetch(`${baseUrl}/api/health`);
      const health = await healthResponse.json();
      const providersOnline = Number(health?.providers?.online || 0);

      checks.push(evaluateCheck(
        'provider_online_count',
        'Online provider count meets threshold',
        healthResponse.status === 200 && providersOnline >= thresholds.minProvidersOnline,
        {
          status: healthResponse.status,
          providersOnline,
          minProvidersOnline: thresholds.minProvidersOnline,
        }
      ));

      const streamStart = Date.now();
      try {
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${renter.apiKey}`,
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL_ID,
            messages: [{ role: 'user', content: 'stream canary ping' }],
            stream: true,
          }),
        });
        streamStatus = response.status;
        const streamBody = await response.text();
        streamDoneSeen = streamBody.includes('data: [DONE]');
      } catch (error) {
        streamError = error;
      } finally {
        streamLatencyMs = Date.now() - streamStart;
      }

      checks.push(evaluateCheck(
        'v1_stream_done_termination',
        'V1 streaming returns DONE termination',
        streamStatus === 200 && streamDoneSeen,
        {
          status: streamStatus,
          doneSeen: streamDoneSeen,
          fetchError: streamError ? String(streamError.message || streamError) : null,
        }
      ));

      const errorRate = (streamStatus === 200 && streamDoneSeen && !streamError) ? 0 : 1;

      checks.push(evaluateCheck(
        'latency_error_thresholds',
        'Stream latency and error rate stay within thresholds',
        streamLatencyMs <= thresholds.maxStreamLatencyMs && errorRate <= thresholds.maxErrorRate,
        {
          streamLatencyMs,
          maxStreamLatencyMs: thresholds.maxStreamLatencyMs,
          errorRate,
          maxErrorRate: thresholds.maxErrorRate,
        }
      ));
    } finally {
      await provider.close();
    }
  } finally {
    await closeServer(appServer);
  }

  const summary = buildSummary(checks);
  return {
    generatedAt: nowIso(),
    mode: simulateFailure ? 'forced_failure' : 'clean',
    thresholds,
    summary,
    checks,
  };
}

function formatCanaryReport(report) {
  const lines = [];
  lines.push('# OpenRouter Reliability Canary');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Mode: ${report.mode}`);
  lines.push(`Overall: ${report.summary.status.toUpperCase()} (${report.summary.passed}/${report.summary.total} checks passing)`);
  lines.push('');
  lines.push('## Thresholds');
  lines.push('');
  lines.push(`- minProvidersOnline: ${report.thresholds.minProvidersOnline}`);
  lines.push(`- maxStreamLatencyMs: ${report.thresholds.maxStreamLatencyMs}`);
  lines.push(`- maxErrorRate: ${report.thresholds.maxErrorRate}`);
  lines.push('');
  lines.push('## Checks');
  lines.push('');

  for (const check of report.checks) {
    lines.push(`- [${check.status.toUpperCase()}] ${check.id} - ${check.title}`);
    lines.push(`  evidence: ${JSON.stringify(check.evidence)}`);
  }

  return lines.join('\n');
}

function writeCanaryArtifacts(report, options = {}) {
  const outputDir = options.outputDir || path.resolve(__dirname, '../../../docs/reports/openrouter/reliability');
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = report.generatedAt.replace(/[:.]/g, '-');
  const baseName = `canary-${report.mode}-${timestamp}`;

  const jsonPath = path.join(outputDir, `${baseName}.json`);
  const mdPath = path.join(outputDir, `${baseName}.md`);
  const latestJsonPath = path.join(outputDir, `canary-${report.mode}-latest.json`);
  const latestMdPath = path.join(outputDir, `canary-${report.mode}-latest.md`);

  const jsonText = `${JSON.stringify(report, null, 2)}\n`;
  const mdText = `${formatCanaryReport(report)}\n`;

  fs.writeFileSync(jsonPath, jsonText, 'utf8');
  fs.writeFileSync(mdPath, mdText, 'utf8');
  fs.writeFileSync(latestJsonPath, jsonText, 'utf8');
  fs.writeFileSync(latestMdPath, mdText, 'utf8');

  return {
    outputDir,
    jsonPath,
    mdPath,
    latestJsonPath,
    latestMdPath,
  };
}

module.exports = {
  formatCanaryReport,
  runOpenRouterReliabilityCanary,
  writeCanaryArtifacts,
};
