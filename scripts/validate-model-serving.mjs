#!/usr/bin/env node

/**
 * Model Serving Validation Suite — Health check and completion validation
 * Designed to run against live provider endpoints to verify model serving capability
 *
 * Usage:
 *   node validate-model-serving.mjs --provider-url <url> --model <model-id>
 *
 * Examples:
 *   node validate-model-serving.mjs --provider-url http://provider.local:8000 --model TinyLlama/TinyLlama-1.1B-Chat-v1.0
 *   node validate-model-serving.mjs --provider-url https://api.dcp.sa/providers/abc123 --model llama-2-7b-chat
 *
 * Exit codes:
 *   0 = All checks passed
 *   1 = Invalid arguments or configuration
 *   2 = Health check failed
 *   3 = Model completions endpoint not available
 *   4 = Timeout or latency threshold exceeded
 */

import { parseArgs } from 'node:util';

const options = {
  'provider-url': { type: 'string', short: 'p' },
  'model': { type: 'string', short: 'm' },
  'timeout': { type: 'string', default: '30000', short: 't' },
  'help': { type: 'boolean', short: 'h' },
};

const { values, positionals } = parseArgs({ options, allowPositionals: true });

const PROVIDER_URL = (values['provider-url'] || '').replace(/\/$/, '');
const MODEL_ID = values['model'] || '';
const TIMEOUT_MS = parseInt(values['timeout'], 10);

const checks = [];

function recordCheck(name, pass, details) {
  checks.push({ name, pass, details });
  const prefix = pass ? '[PASS]' : '[FAIL]';
  console.log(`${prefix} ${name}${details ? ` - ${details}` : ''}`);
}

function printHeader(title) {
  console.log(`\n=== ${title} ===`);
}

function showHelp() {
  console.log(`
Model Serving Validation Suite

Usage:
  node validate-model-serving.mjs --provider-url <url> --model <model-id> [--timeout <ms>]

Options:
  -p, --provider-url  Provider endpoint URL (required)
  -m, --model         Model identifier (required)
  -t, --timeout       Request timeout in ms (default: 30000)
  -h, --help          Show this help message

Examples:
  node validate-model-serving.mjs -p http://localhost:8000 -m llama-2-7b-chat
  node validate-model-serving.mjs --provider-url https://api.dcp.sa/providers/xyz --model mistral-7b

Exit codes:
  0 = All checks passed
  1 = Invalid arguments
  2 = Health check failed
  3 = Model completions endpoint error
  4 = Timeout or latency threshold exceeded
  `);
}

if (values['help']) {
  showHelp();
  process.exit(0);
}

if (!PROVIDER_URL || !MODEL_ID) {
  console.error('Error: --provider-url and --model are required');
  console.error('\nRun with --help for usage information');
  process.exit(1);
}

if (isNaN(TIMEOUT_MS) || TIMEOUT_MS < 1000) {
  console.error('Error: --timeout must be a valid number >= 1000');
  process.exit(1);
}

async function makeRequest(path, options = {}) {
  const url = `${PROVIDER_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
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

    return { ok: res.ok, status: res.status, text, json, url };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message,
      text: error.message,
      json: null,
      url,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function run() {
  console.log('Model Serving Validation Suite');
  console.log(`Provider URL: ${PROVIDER_URL}`);
  console.log(`Model ID: ${MODEL_ID}`);
  console.log(`Timeout: ${TIMEOUT_MS}ms`);

  printHeader('1) Health Check');
  const startHealth = Date.now();
  const healthRes = await makeRequest('/health');
  const healthLatency = Date.now() - startHealth;

  if (!healthRes.ok) {
    recordCheck('GET /health', false, `HTTP ${healthRes.status}`);
    if (healthRes.error) {
      console.error(`  Error: ${healthRes.error}`);
    }
    process.exit(2);
  }

  recordCheck('GET /health', true, `HTTP ${healthRes.status}, ${healthLatency}ms`);

  printHeader('2) Model Completions Test');
  const startCompletion = Date.now();
  const completionRes = await makeRequest('/v1/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      model: MODEL_ID,
      prompt: 'This is a test prompt.',
      max_tokens: 5,
      temperature: 0.7,
    },
  });
  const completionLatency = Date.now() - startCompletion;

  if (!completionRes.ok) {
    recordCheck('POST /v1/completions', false, `HTTP ${completionRes.status}`);
    if (completionRes.error) {
      console.error(`  Error: ${completionRes.error}`);
    }
    process.exit(3);
  }

  const completion = completionRes.json;
  const tokensGenerated = completion?.usage?.completion_tokens || 0;
  recordCheck('POST /v1/completions', true,
    `HTTP ${completionRes.status}, ${completionLatency}ms, ${tokensGenerated} tokens`);

  // Check if response structure is valid
  if (!completion?.choices || completion.choices.length === 0) {
    recordCheck('Response structure valid', false,
      'Missing choices in completions response');
    process.exit(3);
  }

  recordCheck('Response structure valid', true,
    `${completion.choices.length} choice(s) returned`);
  recordCheck('Model name in response', !!completion.model,
    `model=${completion.model || 'null'}`);

  printHeader('3) Performance Analysis');
  const latencyThreshold = 10000; // 10 seconds for completion is reasonable
  if (completionLatency > latencyThreshold) {
    recordCheck('Completion latency acceptable', false,
      `${completionLatency}ms exceeds threshold ${latencyThreshold}ms`);
    process.exit(4);
  }

  recordCheck('Completion latency acceptable', true,
    `${completionLatency}ms (threshold: ${latencyThreshold}ms)`);

  printHeader('Summary');
  const passed = checks.filter((item) => item.pass).length;
  const failed = checks.length - passed;
  console.log(`Checks passed: ${passed}/${checks.length}`);
  console.log(`Checks failed: ${failed}`);

  console.log(`\nProvider Validation Details:`);
  console.log(`- Health check latency: ${healthLatency}ms`);
  console.log(`- Completion latency: ${completionLatency}ms`);
  console.log(`- Model ID: ${MODEL_ID}`);
  console.log(`- Response tokens: ${tokensGenerated}`);

  process.exit(failed === 0 ? 0 : 3);
}

run().catch((error) => {
  console.error(`\nValidation failed: ${error.message}`);
  const passed = checks.filter((item) => item.pass).length;
  const failed = checks.length - passed;
  console.error(`Checks passed: ${passed}/${checks.length} | failed: ${failed}`);
  process.exit(3);
});
