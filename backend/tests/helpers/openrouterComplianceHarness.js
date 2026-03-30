'use strict';

const crypto = require('crypto');
const http = require('http');
const express = require('express');

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';

const db = require('../../src/db');
const v1Router = require('../../src/routes/v1');

const DEFAULT_MODEL_ID = 'openrouter-qa-model';

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
    'OpenRouter QA Model',
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
  const key = apiKey || randomKey('qa-renter');
  const result = db.prepare(
    `INSERT INTO renters
      (name, email, api_key, status, balance_halala, total_spent_halala, total_jobs, created_at)
     VALUES (?, ?, ?, 'active', ?, 0, 0, ?)`
  ).run(
    'QA Renter',
    `${key}@dc1.test`,
    key,
    balanceHalala,
    nowIso()
  );

  return { id: result.lastInsertRowid, apiKey: key };
}

function seedProvider({ endpointUrl }) {
  const apiKey = randomKey('qa-provider');
  const result = db.prepare(
    `INSERT INTO providers
      (name, email, api_key, gpu_model, vram_gb, gpu_vram_mib, approval_status, status,
       supported_compute_types, vllm_endpoint_url, last_heartbeat, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'approved', 'online', '["inference"]', ?, ?, ?, ?)`
  ).run(
    'QA Provider',
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

  return { id: result.lastInsertRowid, apiKey };
}

function createApp() {
  const app = express();
  app.use(express.json());
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

async function startMockProvider(mode, capture) {
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      let parsedBody = null;
      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : null;
      } catch (_) {}
      if (capture) capture.push(parsedBody);

      if (mode === 'stream-success') {
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
        return;
      }

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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        model: DEFAULT_MODEL_ID,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'mock provider response' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
      }));
    });
  });

  const port = await listen(server);
  return {
    endpointUrl: `http://127.0.0.1:${port}`,
    close: () => closeServer(server),
  };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { response, text, json };
}

function createCheck(id, title, severity) {
  return { id, title, severity, status: 'fail', details: '', evidence: [], startedAtMs: Date.now() };
}

function finalizeCheck(check, ok, details, evidence = []) {
  const finishedAtMs = Date.now();
  return {
    ...check,
    status: ok ? 'pass' : 'fail',
    details,
    evidence,
    latencyMs: Math.max(0, finishedAtMs - (check.startedAtMs || finishedAtMs)),
    finishedAtMs,
  };
}

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((pct / 100) * sorted.length) - 1;
  const idx = Math.min(sorted.length - 1, Math.max(0, rank));
  return sorted[idx];
}

function buildTelemetry(checks, startedAtIso) {
  const startedAtMs = Date.parse(startedAtIso);
  const endedAtIso = nowIso();
  const endedAtMs = Date.parse(endedAtIso);
  const durations = checks.map((check) => Number(check.latencyMs || 0));
  const failures = checks.filter((check) => check.status !== 'pass').length;
  const blockingChecks = checks.filter((check) => check.severity === 'blocking');
  const blockingPassed = blockingChecks.filter((check) => check.status === 'pass').length;
  const streamChecks = checks.filter((check) => check.id === 'stream_stability');
  const streamPassed = streamChecks.filter((check) => check.status === 'pass').length;

  return {
    window: {
      startedAt: startedAtIso,
      endedAt: endedAtIso,
      durationSeconds: Math.max(0, Number(((endedAtMs - startedAtMs) / 1000).toFixed(3))),
    },
    sampleCount: checks.length,
    latencyMs: {
      min: durations.length ? Math.min(...durations) : 0,
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      max: durations.length ? Math.max(...durations) : 0,
    },
    errorRatePct: checks.length ? Number(((failures / checks.length) * 100).toFixed(2)) : 0,
    streamCompletionRatePct: streamChecks.length ? Number(((streamPassed / streamChecks.length) * 100).toFixed(2)) : 0,
    uptimePct: blockingChecks.length ? Number(((blockingPassed / blockingChecks.length) * 100).toFixed(2)) : 0,
  };
}

function buildSummary(checks) {
  const passed = checks.filter((check) => check.status === 'pass').length;
  const failed = checks.length - passed;
  const blockingFailures = checks.filter((check) => check.status === 'fail' && check.severity === 'blocking');
  const nonBlockingFailures = checks.filter((check) => check.status === 'fail' && check.severity !== 'blocking');
  return {
    total: checks.length,
    passed,
    failed,
    blockingFailures: blockingFailures.length,
    nonBlockingFailures: nonBlockingFailures.length,
    readiness: blockingFailures.length > 0 ? 'fail' : 'pass',
  };
}

function formatComplianceReport(report) {
  const lines = [];
  lines.push('# OpenRouter Compliance Readiness Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Readiness: ${report.summary.readiness.toUpperCase()}`);
  lines.push(`Checks: ${report.summary.passed}/${report.summary.total} passing`);
  lines.push(`Blocking failures: ${report.summary.blockingFailures}`);
  lines.push(`Non-blocking failures: ${report.summary.nonBlockingFailures}`);
  lines.push('');
  lines.push('## Check Results');
  lines.push('');

  for (const check of report.checks) {
    const marker = check.status === 'pass' ? 'PASS' : 'FAIL';
    lines.push(`- [${marker}] ${check.id} (${check.severity}) — ${check.title}`);
    lines.push(`  ${check.details}`);
    for (const item of check.evidence) {
      lines.push(`  evidence: ${item}`);
    }
  }

  const blocking = report.checks.filter((check) => check.status === 'fail' && check.severity === 'blocking');
  const nonBlocking = report.checks.filter((check) => check.status === 'fail' && check.severity !== 'blocking');

  lines.push('');
  lines.push('## Leadership Handoff');
  lines.push('');
  lines.push(`- Blocking: ${blocking.length ? blocking.map((check) => check.id).join(', ') : 'none'}`);
  lines.push(`- Non-blocking: ${nonBlocking.length ? nonBlocking.map((check) => check.id).join(', ') : 'none'}`);

  return lines.join('\n');
}

async function runOpenRouterComplianceHarness() {
  const startedAtIso = nowIso();
  resetDb();
  const app = createApp();
  const server = http.createServer(app);
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  const checks = [];

  try {
    seedModel(DEFAULT_MODEL_ID);

    const providerCapture = [];
    const healthyProvider = await startMockProvider('json-success', providerCapture);
    const streamProvider = await startMockProvider('stream-success');
    const failingStreamProvider = await startMockProvider('stream-fail-midway');

    try {
      const fundedRenter = seedRenter({ balanceHalala: 10_000, apiKey: 'qa-funded-renter' });
      const emptyRenter = seedRenter({ balanceHalala: 0, apiKey: 'qa-empty-renter' });
      seedProvider({ endpointUrl: healthyProvider.endpointUrl });

      {
        const check = createCheck('models_contract', 'GET /v1/models returns an OpenAI-compatible list payload', 'blocking');
        const { response, json } = await fetchJson(`${baseUrl}/v1/models`);
        const model = json?.data?.find((entry) => entry.id === DEFAULT_MODEL_ID);
        checks.push(finalizeCheck(
          check,
          response.status === 200 && json?.object === 'list' && model?.object === 'model',
          response.status === 200
            ? 'Model catalog contract matches the OpenAI list shape expected by OpenRouter.'
            : 'Model catalog contract is not returning the expected OpenAI list shape.',
          [`status=${response.status}`, `model_present=${Boolean(model)}`]
        ));
      }

      {
        const check = createCheck('auth_required', 'POST /v1/chat/completions rejects requests without a renter API key', 'blocking');
        const { response, json } = await fetchJson(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: DEFAULT_MODEL_ID,
            messages: [{ role: 'user', content: 'hello' }],
          }),
        });
        checks.push(finalizeCheck(
          check,
          response.status === 401 && json?.error?.type === 'authentication_error',
          response.status === 401
            ? 'Auth guard correctly rejects anonymous requests with an OpenAI-style authentication error.'
            : 'Auth guard did not return the expected OpenAI-style authentication error.',
          [`status=${response.status}`, `error_type=${json?.error?.type || 'missing'}`]
        ));
      }

      {
        const check = createCheck('billing_guard', 'POST /v1/chat/completions rejects renters without enough balance', 'blocking');
        const { response, json } = await fetchJson(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${emptyRenter.apiKey}`,
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL_ID,
            messages: [{ role: 'user', content: 'hello' }],
          }),
        });
        checks.push(finalizeCheck(
          check,
          response.status === 402 && json?.error?.type === 'billing_error',
          response.status === 402
            ? 'Billing guard correctly returns a 402 billing error before proxying the request.'
            : 'Billing guard did not return the expected 402 billing error.',
          [`status=${response.status}`, `error_type=${json?.error?.type || 'missing'}`]
        ));
      }

      {
        const check = createCheck('chat_completion_proxy', 'POST /v1/chat/completions proxies a healthy completion response', 'blocking');
        const { response, json } = await fetchJson(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${fundedRenter.apiKey}`,
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL_ID,
            messages: [{ role: 'user', content: 'hello' }],
            max_tokens: 32,
          }),
        });
        checks.push(finalizeCheck(
          check,
          response.status === 200 && json?.choices?.[0]?.message?.content === 'mock provider response',
          response.status === 200
            ? 'Healthy OpenRouter-style completion requests reach the provider proxy and return a standard chat completion payload.'
            : 'Healthy completion requests failed to proxy through the /v1 surface.',
          [`status=${response.status}`, `content=${json?.choices?.[0]?.message?.content || 'missing'}`]
        ));
      }

      {
        const check = createCheck('stream_stability', 'Streaming responses preserve SSE headers and emit a DONE terminator', 'blocking');
        db.prepare('UPDATE providers SET vllm_endpoint_url = ?').run(streamProvider.endpointUrl);
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${fundedRenter.apiKey}`,
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL_ID,
            messages: [{ role: 'user', content: 'stream hello' }],
            stream: true,
          }),
        });
        const text = await response.text();
        checks.push(finalizeCheck(
          check,
          response.status === 200
            && String(response.headers.get('content-type') || '').includes('text/event-stream')
            && text.includes('data: [DONE]'),
          response.status === 200
            ? 'Healthy streaming requests keep the SSE content type and terminate cleanly with [DONE].'
            : 'Streaming requests did not preserve the expected SSE contract.',
          [
            `status=${response.status}`,
            `content_type=${response.headers.get('content-type') || 'missing'}`,
            `done_seen=${text.includes('data: [DONE]')}`,
          ]
        ));
      }

      {
        const check = createCheck('tool_result_roundtrip', 'Assistant tool_calls and tool result messages survive the proxy transform', 'non_blocking');
        providerCapture.length = 0;
        db.prepare('UPDATE providers SET vllm_endpoint_url = ?').run(healthyProvider.endpointUrl);
        await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${fundedRenter.apiKey}`,
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL_ID,
            messages: [
              { role: 'user', content: 'What is the weather?' },
              {
                role: 'assistant',
                content: '',
                tool_calls: [{
                  id: 'call_weather_1',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"city":"Riyadh"}' },
                }],
              },
              { role: 'tool', tool_call_id: 'call_weather_1', content: '{"temp_c":31}' },
            ],
          }),
        });

        const proxied = providerCapture[0];
        const assistantWithToolCall = proxied?.messages?.find((message) => message.role === 'assistant' && Array.isArray(message.tool_calls));
        const toolMessage = proxied?.messages?.find((message) => message.role === 'tool' && message.tool_call_id === 'call_weather_1');
        checks.push(finalizeCheck(
          check,
          Boolean(assistantWithToolCall && toolMessage),
          assistantWithToolCall && toolMessage
            ? 'Conversation history with tool calls and tool outputs is preserved when the request is proxied.'
            : 'Tool call conversation history was dropped or malformed before reaching the provider.',
          [
            `assistant_tool_calls=${assistantWithToolCall ? assistantWithToolCall.tool_calls.length : 0}`,
            `tool_message_seen=${Boolean(toolMessage)}`,
          ]
        ));
      }

      {
        const check = createCheck('tool_definition_passthrough', 'Tool definitions and tool_choice are forwarded to the provider', 'blocking');
        providerCapture.length = 0;
        await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${fundedRenter.apiKey}`,
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL_ID,
            messages: [{ role: 'user', content: 'Call a tool' }],
            tools: [{
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get the weather',
                parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
              },
            }],
            tool_choice: { type: 'function', function: { name: 'get_weather' } },
          }),
        });

        const proxied = providerCapture[0];
        const forwarded = Array.isArray(proxied?.tools) && proxied.tools.length === 1 && proxied?.tool_choice;
        checks.push(finalizeCheck(
          check,
          Boolean(forwarded),
          forwarded
            ? 'Tool definitions reach the provider proxy intact.'
            : 'Tool definitions/tool_choice are currently stripped before the provider request, which blocks OpenRouter tool-calling parity.',
          [
            `tools_forwarded=${Array.isArray(proxied?.tools) ? proxied.tools.length : 0}`,
            `tool_choice_forwarded=${Boolean(proxied?.tool_choice)}`,
          ]
        ));
      }

      {
        const check = createCheck('mid_stream_failure_handling', 'Mid-stream provider failures are surfaced cleanly to QA', 'blocking');
        db.prepare('UPDATE providers SET vllm_endpoint_url = ?').run(failingStreamProvider.endpointUrl);
        let text = '';
        let observedError = null;
        try {
          const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${fundedRenter.apiKey}`,
            },
            body: JSON.stringify({
              model: DEFAULT_MODEL_ID,
              messages: [{ role: 'user', content: 'stream failure probe' }],
              stream: true,
            }),
          });
          text = await response.text();
        } catch (error) {
          observedError = error;
        }
        const graceful = text.includes('data: [DONE]') || /upstream_error|terminated/i.test(String(observedError?.message || text));
        checks.push(finalizeCheck(
          check,
          graceful,
          graceful
            ? 'The harness observed a cleanly surfaced mid-stream failure mode.'
            : 'Mid-stream provider disconnects currently terminate the stream without a clean OpenRouter-style error or DONE terminator.',
          [
            `fetch_error=${observedError ? observedError.message : 'none'}`,
            `done_seen=${text.includes('data: [DONE]')}`,
            `body_prefix=${text.slice(0, 80) || 'empty'}`,
          ]
        ));
      }
    } finally {
      await healthyProvider.close();
      await streamProvider.close();
      await failingStreamProvider.close();
    }
  } finally {
    await closeServer(server);
  }

  return {
    generatedAt: nowIso(),
    summary: buildSummary(checks),
    checks,
    telemetry: buildTelemetry(checks, startedAtIso),
  };
}

module.exports = {
  formatComplianceReport,
  runOpenRouterComplianceHarness,
};
