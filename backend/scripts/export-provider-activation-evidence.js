#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');
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
    windowMinutes: 15,
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
    } else if (token === '--window-minutes' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) args.windowMinutes = Math.floor(parsed);
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
    '  --window-minutes <n>    Duplicate-charge/failure check window around candidate timestamp (default: 15)',
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

function loadLinkageSnapshots({
  dbPath,
  utcTimestamp,
  windowMinutes,
  requestId,
  traceId,
  providerId,
  sessionId,
}) {
  const result = {
    db_path: dbPath,
    timestamp_utc: utcTimestamp,
    window_minutes: Number(windowMinutes) || 15,
    usage_rows: [],
    charge_rows: [],
    ledger_rows: [],
    warnings: [],
  };

  if (!fs.existsSync(dbPath)) {
    result.warnings.push(`SQLite database missing at ${dbPath}`);
    return result;
  }

  let db;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const tables = new Set(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name)
    );
    const columnsFor = (tableName) => {
      if (!tables.has(tableName)) return new Set();
      try {
        return new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => row.name));
      } catch (_) {
        return new Set();
      }
    };
    const safeQueryAll = (sql, params, warningTitle) => {
      try {
        return db.prepare(sql).all(params);
      } catch (error) {
        result.warnings.push(`${warningTitle}: ${error.message}`);
        return [];
      }
    };
    const buildIdentityWhere = (columns, aliases) => {
      const clauses = [];
      if (aliases.requestId && columns.has(aliases.requestId)) clauses.push(`(@requestId <> '' AND COALESCE(${aliases.requestId}, '') = @requestId)`);
      if (aliases.traceId && columns.has(aliases.traceId)) clauses.push(`(@traceId <> '' AND COALESCE(${aliases.traceId}, '') = @traceId)`);
      if (aliases.providerId && columns.has(aliases.providerId)) clauses.push(`(@providerId <> '' AND CAST(${aliases.providerId} AS TEXT) = @providerId)`);
      if (aliases.sessionId && columns.has(aliases.sessionId)) clauses.push(`(@sessionId <> '' AND COALESCE(${aliases.sessionId}, '') = @sessionId)`);
      return clauses;
    };
    const firstTimestampColumn = (columns) =>
      ['created_at', 'updated_at', 'occurred_at', 'timestamp_utc'].find((name) => columns.has(name)) || null;
    const minusWindow = `-${result.window_minutes} minutes`;
    const plusWindow = `+${result.window_minutes} minutes`;
    const usageTable =
      ['openrouter_usage_ledger', 'openrouter_usage_events', 'openrouter_usage'].find((name) => tables.has(name)) || null;
    const chargeTable =
      ['openrouter_charge_events', 'openrouter_charges', 'payments'].find((name) => tables.has(name)) || null;

    if (usageTable) {
      const columns = columnsFor(usageTable);
      const idClauses = buildIdentityWhere(columns, {
        requestId: 'request_id',
        traceId: 'trace_id',
        providerId: 'provider_id',
        sessionId: 'session_id',
      });
      const tsColumn = firstTimestampColumn(columns);
      if (tsColumn) idClauses.push(`(${tsColumn} BETWEEN datetime(@ts, @minusWindow) AND datetime(@ts, @plusWindow))`);
      const whereSql = idClauses.length > 0 ? idClauses.join(' OR ') : '1=1';
      const orderColumn = tsColumn || 'rowid';
      result.usage_rows = safeQueryAll(
        `SELECT * FROM ${usageTable} WHERE ${whereSql} ORDER BY ${orderColumn} DESC LIMIT 30`,
        {
        requestId: String(requestId || ''),
        traceId: String(traceId || ''),
        providerId: String(providerId || ''),
        sessionId: String(sessionId || ''),
        ts: utcTimestamp,
        minusWindow,
        plusWindow,
        },
        `Usage snapshot query failed for ${usageTable}`
      );
    } else {
      result.warnings.push('No openrouter usage table found (expected openrouter_usage_ledger/openrouter_usage_events/openrouter_usage).');
    }

    if (chargeTable) {
      const columns = columnsFor(chargeTable);
      const idClauses = buildIdentityWhere(columns, {
        requestId: 'request_id',
        traceId: 'trace_id',
        providerId: 'provider_id',
        sessionId: 'session_id',
      });
      const tsColumn = firstTimestampColumn(columns);
      if (tsColumn) idClauses.push(`(${tsColumn} BETWEEN datetime(@ts, @minusWindow) AND datetime(@ts, @plusWindow))`);
      const whereSql = idClauses.length > 0 ? idClauses.join(' OR ') : '1=1';
      const orderColumn = tsColumn || 'rowid';
      result.charge_rows = safeQueryAll(
        `SELECT * FROM ${chargeTable} WHERE ${whereSql} ORDER BY ${orderColumn} DESC LIMIT 30`,
        {
          requestId: String(requestId || ''),
          traceId: String(traceId || ''),
          providerId: String(providerId || ''),
          sessionId: String(sessionId || ''),
          ts: utcTimestamp,
          minusWindow,
          plusWindow,
        },
        `Charge snapshot query failed for ${chargeTable}`
      );
    } else {
      result.warnings.push('No charge table found (expected openrouter_charge_events/openrouter_charges/payments).');
    }

    if (tables.has('renter_credit_ledger')) {
      const columns = columnsFor('renter_credit_ledger');
      const tsColumn = firstTimestampColumn(columns);
      const clauses = [];
      if (columns.has('payment_ref')) {
        clauses.push(`(@requestId <> '' AND COALESCE(payment_ref, '') LIKE '%' || @requestId || '%')`);
        clauses.push(`(@traceId <> '' AND COALESCE(payment_ref, '') LIKE '%' || @traceId || '%')`);
      }
      if (columns.has('job_id')) clauses.push(`(@requestId <> '' AND CAST(job_id AS TEXT) LIKE '%' || @requestId || '%')`);
      if (tsColumn) clauses.push(`(${tsColumn} BETWEEN datetime(@ts, @minusWindow) AND datetime(@ts, @plusWindow))`);
      const whereSql = clauses.length > 0 ? clauses.join(' OR ') : '1=1';
      result.ledger_rows = safeQueryAll(
        `SELECT * FROM renter_credit_ledger WHERE ${whereSql} ORDER BY ${(tsColumn || 'rowid')} DESC LIMIT 30`,
        {
          requestId: String(requestId || ''),
          traceId: String(traceId || ''),
          ts: utcTimestamp,
          minusWindow,
          plusWindow,
        },
        'Ledger snapshot query failed for renter_credit_ledger'
      );
    } else {
      result.warnings.push('No renter_credit_ledger table found.');
    }

    result.tables_detected = Array.from(tables).sort();
    return result;
  } catch (error) {
    result.warnings.push(`Failed to load linkage snapshots: ${error.message}`);
    return result;
  } finally {
    if (db) db.close();
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
  const sqlUtc = utcTimestamp.replace(/'/g, "''");
  const sqlProviderId = String(responseHeaders['x-dcp-provider-id'] || args.providerId || '').replace(/'/g, "''");
  const sqlRequestId = String(responseHeaders['x-dcp-request-id'] || '').replace(/'/g, "''");
  const duplicateChargeChecks = [
    {
      title: 'SSE completion marker verification',
      command: `grep -n "\\[DONE\\]" ${JSON.stringify(streamPath)}`,
    },
    {
      title: 'Nearby job retries/failures for provider window',
      command: [
        `node -e "const Database=require('better-sqlite3');`,
        `const db=new Database('backend/data/providers.db');`,
        `const sql=\\\"SELECT job_id,status,retry_count,max_retries,created_at,completed_at,error FROM jobs`,
        `WHERE provider_id=${JSON.stringify(sqlProviderId)} `,
        `AND created_at BETWEEN datetime('${sqlUtc}','-${args.windowMinutes} minutes') AND datetime('${sqlUtc}','+${args.windowMinutes} minutes')`,
        `ORDER BY created_at ASC;\\\";`,
        `console.log(JSON.stringify(db.prepare(sql).all(), null, 2));\\"`,
      ].join(' '),
    },
    {
      title: 'Potential duplicate charge rows in candidate window',
      command: [
        `node -e "const Database=require('better-sqlite3');`,
        `const db=new Database('backend/data/providers.db');`,
        `const sql=\\\"SELECT l.id,l.renter_id,l.job_id,l.payment_ref,l.amount_halala,l.direction,l.created_at,p.id AS payment_row_id,p.payment_id,p.status AS payment_status`,
        `FROM renter_credit_ledger l LEFT JOIN payments p ON (p.payment_id=l.payment_ref OR p.moyasar_id=l.payment_ref)`,
        `WHERE l.created_at BETWEEN datetime('${sqlUtc}','-${args.windowMinutes} minutes') AND datetime('${sqlUtc}','+${args.windowMinutes} minutes')`,
        `ORDER BY l.created_at ASC;\\\";`,
        `console.log(JSON.stringify(db.prepare(sql).all(), null, 2));\\"`,
      ].join(' '),
    },
    {
      title: 'Lookup by request id (if persisted externally)',
      command: sqlRequestId
        ? `echo "request_id=${sqlRequestId} (check telemetry sink / logs if request_id persistence is external to SQLite)"`
        : 'echo "request_id missing from response headers; verify upstream logs and proxy path"',
    },
  ];
  const commandPack = [
    command,
    '',
    `# Duplicate-charge risk checks (window ±${args.windowMinutes}m around ${utcTimestamp})`,
    ...duplicateChargeChecks.map((entry, idx) => `${idx + 1}. ${entry.title}\n${entry.command}`),
  ].join('\n');

  const linkageSnapshots = loadLinkageSnapshots({
    dbPath: path.resolve(__dirname, '..', 'data', 'providers.db'),
    utcTimestamp,
    windowMinutes: args.windowMinutes,
    requestId: responseHeaders['x-dcp-request-id'] || '',
    traceId: responseHeaders['x-dcp-trace-id'] || args.traceId || '',
    providerId: responseHeaders['x-dcp-provider-id'] || args.providerId || '',
    sessionId: responseHeaders['x-dcp-session-id'] || '',
  });

  const bundle = buildEvidenceBundle({
    route: args.route,
    endpointUrl: routeUrl,
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
    commandPack,
    duplicateChargeChecks,
    linkageSnapshots,
    nearbyWindowMinutes: args.windowMinutes,
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
