#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  buildEvidenceBundle,
  buildEvidenceMarkdown,
  maskSecret,
} = require('../src/services/providerActivationEvidenceService');

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.DCP_API_BASE_URL || 'http://127.0.0.1:8083',
    route: '/v1/chat/completions',
    outDir: path.resolve(__dirname, '..', '..', 'docs', 'ops', 'provider-activation-evidence'),
    stream: true,
    maxTokens: 64,
    temperature: 0.2,
    prompt: 'Return one short line confirming provider execution.',
    providerId: process.env.DCP_PROVIDER_ID || null,
    renterKey: process.env.DCP_RENTER_KEY || null,
    model: process.env.DCP_MODEL_ID || null,
    traceId: process.env.DCP_TRACE_ID || `trace_${Date.now()}`,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--base-url' && next) {
      args.baseUrl = next;
      i += 1;
    } else if (token === '--provider-id' && next) {
      args.providerId = next;
      i += 1;
    } else if (token === '--renter-key' && next) {
      args.renterKey = next;
      i += 1;
    } else if (token === '--model' && next) {
      args.model = next;
      i += 1;
    } else if (token === '--prompt' && next) {
      args.prompt = next;
      i += 1;
    } else if (token === '--trace-id' && next) {
      args.traceId = next;
      i += 1;
    } else if (token === '--max-tokens' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) args.maxTokens = Math.floor(parsed);
      i += 1;
    } else if (token === '--temperature' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed >= 0) args.temperature = parsed;
      i += 1;
    } else if (token === '--out-dir' && next) {
      args.outDir = path.resolve(next);
      i += 1;
    } else if (token === '--stream=false') {
      args.stream = false;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    }
  }

  return args;
}

function usage() {
  console.log([
    'Usage: node backend/scripts/export-provider-activation-evidence.js --provider-id <id> --renter-key <key> --model <model-id> [options]',
    '',
    'Options:',
    '  --base-url <url>        API base URL (default: http://127.0.0.1:8083)',
    '  --prompt <text>         Prompt text for /v1/chat/completions',
    '  --trace-id <id>         Trace ID forwarded as X-DCP-Trace-Id',
    '  --max-tokens <n>        max_tokens payload value (default: 64)',
    '  --temperature <n>       temperature payload value (default: 0.2)',
    '  --stream=false          Disable streaming request mode',
    '  --out-dir <path>        Output directory for JSON/MD/TXT artifacts',
  ].join('\n'));
}

function toHeaderMap(headers) {
  const map = {};
  for (const [k, v] of headers.entries()) map[k.toLowerCase()] = v;
  return map;
}

function toStamp(iso) {
  return String(iso || '').replace(/[:.]/g, '-');
}

function getGitInfo() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
    const sha = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
    return { branch, sha };
  } catch (_) {
    return { branch: null, sha: null };
  }
}

async function fetchJsonOrNull(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_) {
      body = { raw: text };
    }
    if (!response.ok) {
      return { ok: false, status: response.status, body };
    }
    return { ok: true, status: response.status, body };
  } catch (error) {
    return { ok: false, status: 0, body: { error: error.message } };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  if (!args.providerId || !args.renterKey || !args.model) {
    usage();
    console.error('[provider-evidence] Missing required args: --provider-id, --renter-key, --model');
    process.exit(2);
  }

  const utcTimestamp = new Date().toISOString();
  const routeUrl = `${args.baseUrl.replace(/\/+$/, '')}${args.route}`;
  const livenessUrl = `${args.baseUrl.replace(/\/+$/, '')}/api/providers/${encodeURIComponent(args.providerId)}/liveness`;
  const availabilityUrl = `${args.baseUrl.replace(/\/+$/, '')}/api/providers/available`;

  const requestBody = {
    model: args.model,
    messages: [{ role: 'user', content: args.prompt }],
    max_tokens: args.maxTokens,
    temperature: args.temperature,
    stream: args.stream,
  };

  const requestHeaders = {
    authorization: `Bearer ${args.renterKey}`,
    'content-type': 'application/json',
    'x-dcp-trace-id': args.traceId,
  };

  const livenessRes = await fetchJsonOrNull(livenessUrl, { method: 'GET' });
  const availabilityRes = await fetchJsonOrNull(availabilityUrl, { method: 'GET' });

  const providerAvailability = (() => {
    const body = availabilityRes.body;
    if (!availabilityRes.ok || !body) return null;
    if (Array.isArray(body)) {
      return body.find((p) => String(p.id) === String(args.providerId) || String(p.provider_id) === String(args.providerId)) || null;
    }
    if (Array.isArray(body.providers)) {
      return body.providers.find((p) => String(p.id) === String(args.providerId) || String(p.provider_id) === String(args.providerId)) || null;
    }
    return body;
  })();

  const response = await fetch(routeUrl, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  const responseHeaders = toHeaderMap(response.headers);

  fs.mkdirSync(args.outDir, { recursive: true });
  const stamp = toStamp(utcTimestamp);
  const streamPath = path.join(args.outDir, `provider-activation-stream-${stamp}.txt`);
  const jsonPath = path.join(args.outDir, `provider-activation-evidence-${stamp}.json`);
  const mdPath = path.join(args.outDir, `provider-activation-evidence-${stamp}.md`);

  fs.writeFileSync(streamPath, `${responseText}\n`, 'utf8');

  const command = [
    'DCP_PROVIDER_ID=<provider-id> DCP_RENTER_KEY=<renter-key> DCP_MODEL_ID=<model-id>',
    `node backend/scripts/export-provider-activation-evidence.js --base-url ${JSON.stringify(args.baseUrl)} --provider-id <provider-id> --model <model-id> --trace-id ${JSON.stringify(args.traceId)}`,
  ].join('\n');

  const bundle = buildEvidenceBundle({
    route: args.route,
    utcTimestamp,
    model: args.model,
    requestHeaders: {
      authorization: requestHeaders.authorization,
      'x-dcp-trace-id': requestHeaders['x-dcp-trace-id'],
      'content-type': requestHeaders['content-type'],
    },
    responseHeaders,
    streamRaw: responseText,
    providerLiveness: livenessRes.body,
    providerAvailability,
    git: getGitInfo(),
    command,
    outputPath: streamPath,
    prompt: args.prompt,
  });

  bundle.http_status = response.status;
  bundle.http_ok = response.ok;
  bundle.stream_output_path = streamPath;
  bundle.request_payload = {
    ...requestBody,
    messages: [{ role: 'user', content: `<sha256:${bundle.prompt_sha256}>` }],
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, `${buildEvidenceMarkdown(bundle)}\n`, 'utf8');

  console.log(`[provider-evidence] Route: ${args.route}`);
  console.log(`[provider-evidence] HTTP status: ${response.status}`);
  console.log(`[provider-evidence] Trace: ${args.traceId}`);
  console.log(`[provider-evidence] Request ID: ${responseHeaders['x-dcp-request-id'] || 'n/a'}`);
  console.log(`[provider-evidence] Provider ID: ${responseHeaders['x-dcp-provider-id'] || 'n/a'}`);
  console.log(`[provider-evidence] Session ID: ${responseHeaders['x-dcp-session-id'] || 'n/a'}`);
  console.log(`[provider-evidence] Stream output: ${streamPath}`);
  console.log(`[provider-evidence] JSON: ${jsonPath}`);
  console.log(`[provider-evidence] Markdown: ${mdPath}`);
  console.log(`[provider-evidence] Renter key used: ${maskSecret(args.renterKey)}`);

  if (!response.ok) {
    console.error('[provider-evidence] Inference request failed; artifacts were still written for debugging.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[provider-evidence] Fatal error:', error);
  process.exit(1);
});
