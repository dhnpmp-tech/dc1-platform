// DCP Agent Gateway — single proxy point for every brain that runs on
// a provider's machine. Provider's Hermes config sets the brain base
// URL to api.dcp.sa/api/agent/gateway and uses its DCP_PROVIDER_KEY for
// auth — the upstream provider's API key (MiniMax / Anthropic / future
// in-house model) lives ONLY on this VPS, never on a provider machine.
//
// Two surfaces:
//   POST /v1/messages         — Anthropic Messages format (Hermes built-in
//                               `minimax` and `claude` providers post here)
//   POST /chat/completions    — OpenAI chat-completions format (older
//                               clients, the original gateway shape)
//
// Routing is intentionally pluggable so we can swap brains or add a
// task-complexity classifier later (e.g. send reasoning tasks to Claude
// Opus, chat to MiniMax) without touching call-sites.

const express = require('express');
const https = require('https');
const router = express.Router();

// ── CORS — Tauri desktop, browser, Hermes ──────────────────────────────
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Provider-Key, anthropic-version, x-api-key'
  );
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Upstream registry ────────────────────────────────────────────────
// Add new brains here. Each upstream may expose an Anthropic-format
// endpoint, an OpenAI-format endpoint, or both — leave fields blank
// for a surface the upstream doesn't speak. Auth is described by the
// header name, prefix, and the env var that holds the key on this VPS.
const UPSTREAMS = {
  minimax: {
    anthropic_url: 'https://api.minimax.io/anthropic/v1/messages',
    openai_url:    'https://api.minimax.io/v1/text/chatcompletion_v2',
    key_env:       'MINIMAX_AGENT_KEY',
    auth_header:   'Authorization',
    auth_prefix:   'Bearer ',
    default_model: 'MiniMax-M2.7-highspeed',
  },
  anthropic: {
    anthropic_url: 'https://api.anthropic.com/v1/messages',
    openai_url:    null,
    key_env:       'ANTHROPIC_API_KEY',
    auth_header:   'x-api-key',
    auth_prefix:   '',
    default_model: 'claude-sonnet-4-6',
  },
  // Drop a new entry here to make a new brain available — no other
  // code changes needed:
  //
  // openrouter:  { ... },
  // dcp_inhouse: { anthropic_url: 'http://10.8.0.1:8000/v1/messages', ... },
};

// ── Routing — which upstream serves which kind of task ─────────────
// Today: everything goes to the default. Tomorrow: classify the
// incoming request (e.g. by message length, system-prompt keywords,
// or an explicit `x-route` hint) and dispatch by complexity.
const ROUTING = {
  default: { upstream: 'minimax' },
  // Examples kept in source as design notes — uncomment when wired:
  //
  // reasoning: { upstream: 'anthropic', model: 'claude-opus-4-7' },
  // coding:    { upstream: 'anthropic', model: 'claude-sonnet-4-6' },
};

function resolveRoute(req) {
  // Future: read req.headers['x-route'], inspect req.body.messages,
  // or classify by token count. For now, allow an explicit override
  // header and otherwise default everything.
  const explicit = (req.headers['x-route'] || '').toString().trim();
  if (explicit && ROUTING[explicit]) return ROUTING[explicit];
  return ROUTING.default;
}

function authHeadersFor(upstreamName) {
  const u = UPSTREAMS[upstreamName];
  const key = (process.env[u.key_env] || '').trim();
  if (!key) return {};
  return { [u.auth_header]: u.auth_prefix + key };
}

function proxyJson(targetUrl, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(targetUrl);
    const req = https.request(
      {
        method: 'POST',
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + (u.search || ''),
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...extraHeaders,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          let parsed = null;
          try { parsed = JSON.parse(text); } catch (_) { /* keep raw */ }
          resolve({ status: res.statusCode, json: parsed, raw: parsed ? null : text });
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Stream-mode proxy: pipe upstream response bytes straight to client
// without JSON.parse (text/event-stream chunks aren't single JSON docs).
// Used for stream:true requests where Hermes' client expects SSE.
function proxyStream(targetUrl, body, extraHeaders, res) {
  const data = JSON.stringify(body);
  const u = new URL(targetUrl);
  const upstreamReq = https.request(
    {
      method: 'POST',
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + (u.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Content-Length': Buffer.byteLength(data),
        ...extraHeaders,
      },
    },
    (upstreamRes) => {
      res.status(upstreamRes.statusCode || 502);
      const ct = upstreamRes.headers['content-type'];
      if (ct) res.setHeader('Content-Type', ct);
      const cc = upstreamRes.headers['cache-control'];
      if (cc) res.setHeader('Cache-Control', cc);
      upstreamRes.pipe(res);
    }
  );
  upstreamReq.on('error', (err) => {
    console.error(`[agent-gateway/stream] upstream error: ${err.message}`);
    if (!res.headersSent) res.status(502).json({ error: 'gateway_failed', detail: err.message });
  });
  upstreamReq.write(data);
  upstreamReq.end();
}


function shortKey(req) {
  const raw =
    req.headers['x-provider-key'] ||
    req.headers['authorization'] ||
    req.headers['x-api-key'] ||
    '';
  return String(raw).slice(0, 16);
}

// ── Anthropic-format handler ──────────────────────────────────────────
// Hermes' built-in `minimax` overlay uses transport="anthropic_messages"
// and posts here. Same handler will serve any future Anthropic-format
// client (Claude SDK, anthropic-vendored MCP servers, etc.).
router.post('/v1/messages', async (req, res) => {
  const route = resolveRoute(req);
  const upstream = UPSTREAMS[route.upstream];
  if (!upstream || !upstream.anthropic_url) {
    return res.status(502).json({
      error: 'upstream_no_anthropic_surface',
      upstream: route.upstream,
    });
  }
  const model = route.model || req.body?.model || upstream.default_model;
  const ts = new Date().toISOString();
  const msgs = Array.isArray(req.body?.messages) ? req.body.messages.length : 0;
  console.log(
    `[agent-gateway/anthropic] ${ts} provider=${shortKey(req)} ` +
    `upstream=${route.upstream} model=${model} msgs=${msgs}`
  );
  // Streaming requests need byte-level proxying — JSON.parse can't
  // handle text/event-stream. Detect and split into two paths.
  if (req.body && req.body.stream === true) {
    return proxyStream(upstream.anthropic_url, { ...req.body, model }, {
      ...authHeadersFor(route.upstream),
      'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
    }, res);
  }
  try {
    const body = { ...req.body, model };
    const result = await proxyJson(upstream.anthropic_url, body, {
      ...authHeadersFor(route.upstream),
      'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
    });
    if (result.status >= 400) {
      console.warn(
        `[agent-gateway/anthropic] upstream=${route.upstream} status=${result.status} ` +
        `body=${(result.raw || JSON.stringify(result.json)).slice(0, 240)}`
      );
    } else {
      const usage = result.json?.usage || {};
      console.log(
        `[agent-gateway/anthropic] DONE provider=${shortKey(req)} ` +
        `in=${usage.input_tokens || 0} out=${usage.output_tokens || 0}`
      );
      // TEMP debug: when usage is missing, log full upstream body.
      if (!usage.input_tokens && !usage.output_tokens) {
        console.log(`[agent-gateway/anthropic] DEBUG req-keys=${Object.keys(req.body || {}).join(',')} resp-keys=${Object.keys(result.json || {}).join(',')} resp-body=${JSON.stringify(result.json).slice(0, 500)}`);
      }
    }
    res.status(result.status).json(result.json || { error: 'upstream_text', raw: result.raw });
  } catch (err) {
    console.error(`[agent-gateway/anthropic] ERROR: ${err.message}`);
    res.status(502).json({ error: 'gateway_failed', detail: err.message });
  }
});

// ── OpenAI-format handler — preserved for older callers ──────────────
router.post('/chat/completions', async (req, res) => {
  const route = resolveRoute(req);
  const upstream = UPSTREAMS[route.upstream];
  if (!upstream || !upstream.openai_url) {
    return res.status(502).json({
      error: 'upstream_no_openai_surface',
      upstream: route.upstream,
    });
  }
  const model = route.model || req.body?.model || upstream.default_model;
  const ts = new Date().toISOString();
  const msgs = Array.isArray(req.body?.messages) ? req.body.messages.length : 0;
  console.log(
    `[agent-gateway/openai] ${ts} provider=${shortKey(req)} ` +
    `upstream=${route.upstream} model=${model} msgs=${msgs}`
  );
  try {
    const body = {
      model,
      messages: req.body.messages,
      max_tokens: req.body.max_tokens || 4096,
      temperature: req.body.temperature ?? 0.7,
    };
    const result = await proxyJson(upstream.openai_url, body, authHeadersFor(route.upstream));
    if (result.status >= 400) {
      console.warn(
        `[agent-gateway/openai] upstream=${route.upstream} status=${result.status} ` +
        `body=${(result.raw || JSON.stringify(result.json)).slice(0, 240)}`
      );
    } else {
      const usage = result.json?.usage || {};
      console.log(
        `[agent-gateway/openai] DONE provider=${shortKey(req)} ` +
        `in=${usage.prompt_tokens || 0} out=${usage.completion_tokens || 0}`
      );
    }
    res.status(result.status).json(result.json || { error: 'upstream_text', raw: result.raw });
  } catch (err) {
    console.error(`[agent-gateway/openai] ERROR: ${err.message}`);
    res.status(502).json({ error: 'gateway_failed', detail: err.message });
  }
});

// Alias: Hermes auto-detects Anthropic transport ONLY when base_url
// ends in `/anthropic` (runtime_provider.py:81). So providers ship with
// credential.base_url = `…/api/agent/gateway/anthropic`, and Hermes
// posts to `…/anthropic/v1/messages`. Same handler as `/v1/messages`.
router.post('/anthropic/v1/messages', (req, res, next) => {
  req.url = '/v1/messages';
  router.handle(req, res, next);
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    default_upstream: ROUTING.default.upstream,
    available_upstreams: Object.keys(UPSTREAMS),
    available_routes: Object.keys(ROUTING),
  });
});

module.exports = router;
