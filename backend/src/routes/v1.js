/**
 * OpenRouter-compatible /v1/ API endpoints
 *
 * Provides the OpenAI-compatible interface required for OpenRouter integration:
 *   POST /v1/chat/completions   — unified (streaming + non-streaming via req.body.stream)
 *   GET  /v1/models             — model list in OpenAI format
 *
 * These endpoints proxy to the existing vLLM infrastructure and reuse the same
 * renter authentication, billing, and provider-assignment logic.
 *
 * Gap 1: /v1/ path alias
 * Gap 2: unified stream flag (req.body.stream routes internally)
 * Gap 3: /v1/models in OpenAI list format
 */

const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { vllmCompleteLimiter, vllmStreamLimiter } = require('../middleware/rateLimiter');
const { recordOpenRouterUsage } = require('../services/openrouterSettlementService');

const router = express.Router();

// ── Helpers (shared with vllm.js — keep lightweight to avoid circular deps) ──

function normalizeString(value, { maxLen = 500, trim = true } = {}) {
  if (typeof value !== 'string') return null;
  const next = trim ? value.trim() : value;
  if (!next) return null;
  return next.slice(0, maxLen);
}

function toFiniteNumber(value, { min = null, max = null } = {}) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  if (min != null && num < min) return null;
  if (max != null && num > max) return null;
  return num;
}

function toFiniteInt(value, { min = null, max = null } = {}) {
  const num = toFiniteNumber(value, { min, max });
  if (num == null || !Number.isInteger(num)) return null;
  return num;
}

function getRenterKey(req) {
  // Accept: Authorization: Bearer <key>, x-renter-key header, or ?key= query param
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  const header = normalizeString(req.headers['x-renter-key'], { maxLen: 128, trim: false });
  const query = normalizeString(req.query.key, { maxLen: 128, trim: false });
  return header || query || null;
}

function requireAuth(req, res, next) {
  const key = getRenterKey(req);
  if (!key) return res.status(401).json({
    error: { message: 'API key required. Pass via Authorization: Bearer <key>', type: 'authentication_error', code: 401 }
  });

  const now = new Date().toISOString();

  // Check scoped sub-keys first
  const scopedKey = db.get(
    `SELECT k.id, k.renter_id, k.scopes, k.expires_at, k.revoked_at,
            r.id AS r_id, r.api_key, r.balance_halala, r.status
     FROM renter_api_keys k
     JOIN renters r ON r.id = k.renter_id
     WHERE k.key = ? AND r.status = 'active' AND k.revoked_at IS NULL`,
    key
  );

  if (scopedKey) {
    if (scopedKey.expires_at && scopedKey.expires_at < now) {
      return res.status(403).json({ error: { message: 'API key has expired', type: 'authentication_error', code: 403 } });
    }
    let scopes = [];
    try { scopes = JSON.parse(scopedKey.scopes || '[]'); } catch (_) {}
    if (!scopes.includes('inference') && !scopes.includes('admin')) {
      return res.status(403).json({ error: { message: 'API key does not have inference scope', type: 'authentication_error', code: 403 } });
    }
    try { db.prepare('UPDATE renter_api_keys SET last_used_at = ? WHERE id = ?').run(now, scopedKey.id); } catch (_) {}
    req.renter = { id: scopedKey.r_id, api_key: scopedKey.api_key, balance_halala: scopedKey.balance_halala, status: scopedKey.status };
    req.renterKey = key;
    return next();
  }

  // Fall back to master key
  const renter = db.get(
    'SELECT id, api_key, balance_halala, status FROM renters WHERE api_key = ? AND status = ?',
    key, 'active'
  );
  if (!renter) return res.status(401).json({
    error: { message: 'Invalid or inactive API key', type: 'authentication_error', code: 401 }
  });

  req.renter = renter;
  req.renterKey = key;
  return next();
}

// ── GET /v1/models — OpenAI-compatible model list ──────────────────────────

router.get('/models', (req, res) => {
  try {
    const rows = db.all(`
      SELECT id, model_id, display_name, parameter_count, context_window,
             min_gpu_vram_gb, use_cases
      FROM model_registry
      WHERE is_active = 1
      ORDER BY display_name ASC
    `);

    const nowSecs = Math.floor(Date.now() / 1000);

    const data = (rows || []).map(row => ({
      id: row.model_id,
      object: 'model',
      created: nowSecs,
      owned_by: 'dc1-platform',
      permission: [],
      root: row.model_id,
      parent: null,
      // Extra DC1 fields (safe to include — OpenRouter ignores unknown keys)
      display_name: row.display_name || row.model_id,
      context_window: Number(row.context_window || 0),
      parameter_count: row.parameter_count || null,
    }));

    return res.json({ object: 'list', data });
  } catch (error) {
    console.error('[v1/models] Error:', error);
    return res.status(500).json({
      error: { message: 'Failed to fetch model list', type: 'server_error', code: 500 }
    });
  }
});

// ── POST /v1/chat/completions — unified streaming + non-streaming ──────────

const PROVIDER_HEARTBEAT_STALE_MS = 10 * 60 * 1000;
const PROXY_TIMEOUT_MS = 30000;

function parseComputeTypes(raw) {
  try { return new Set(JSON.parse(raw || '[]')); } catch (_) { return new Set(); }
}

function resolveProviderVramMb(provider) {
  if (provider.vram_mb) return Number(provider.vram_mb);
  if (provider.vram_gb) return Number(provider.vram_gb) * 1024;
  return 0;
}

function getCapableProviders(minVramMb) {
  const providers = db.all(
    `SELECT * FROM providers
     WHERE status = 'online' AND COALESCE(is_paused, 0) = 0
       AND deleted_at IS NULL`
  );
  const nowMs = Date.now();
  const capable = [];
  for (const p of providers) {
    const hbMs = p.last_heartbeat ? Date.parse(p.last_heartbeat) : NaN;
    if (Number.isFinite(hbMs) && (nowMs - hbMs) > PROVIDER_HEARTBEAT_STALE_MS) continue;
    if (!parseComputeTypes(p.supported_compute_types).has('inference')) continue;
    if (resolveProviderVramMb(p) < minVramMb) continue;
    capable.push(p);
  }
  return capable;
}

function assignProvider(minVramMb) {
  const capable = getCapableProviders(minVramMb);
  if (capable.length === 0) return null;
  capable.sort((a, b) => (a.gpu_util_pct ?? 0) - (b.gpu_util_pct ?? 0));
  return capable[0];
}

function resolveModelRequirements(model) {
  const row = db.get(
    'SELECT model_id, min_gpu_vram_gb, context_window FROM model_registry WHERE model_id = ? AND is_active = 1',
    model
  );
  return {
    model_id: row?.model_id || model,
    min_vram_gb: Number(row?.min_gpu_vram_gb || 0),
    context_window: Number(row?.context_window || 4096),
    fallback_rate_halala_per_min: 2,
  };
}

function approximateTokenCount(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function estimatePromptFromMessages(messages) {
  return messages.map(m => `${m.role}: ${m.content}`).join('\n');
}

async function proxyToProvider({ endpointUrl, modelId, messages, maxTokens, temperature, stream }) {
  const url = `${endpointUrl}/v1/chat/completions`;
  const body = { model: modelId, messages, max_tokens: maxTokens, temperature, stream: !!stream };
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
  } catch (err) {
    return { proxyError: err.name === 'TimeoutError' ? 'timeout' : 'connection_refused', detail: err.message };
  }
  if (!response.ok) {
    return { proxyError: `provider_http_${response.status}`, detail: `Provider returned ${response.status}` };
  }
  // If streaming, return the raw response for pipe-through
  if (stream) return { streamResponse: response };
  let parsed;
  try { parsed = await response.json(); } catch (_) {
    return { proxyError: 'invalid_response', detail: 'Provider returned non-JSON body' };
  }
  return { body: parsed };
}

router.post('/chat/completions', vllmCompleteLimiter, requireAuth, async (req, res) => {
  try {
    const model = normalizeString(req.body?.model, { maxLen: 200 });
    if (!model) return res.status(400).json({
      error: { message: '`model` is required', type: 'invalid_request_error', code: 400 }
    });

    const messagesRaw = req.body?.messages;
    if (!Array.isArray(messagesRaw) || messagesRaw.length === 0) {
      return res.status(400).json({
        error: { message: '`messages` must be a non-empty array', type: 'invalid_request_error', code: 400 }
      });
    }

    // Prepare messages — support tool_calls in assistant msgs and tool role msgs
    const messages = [];
    for (const entry of messagesRaw.slice(0, 100)) {
      const role = normalizeString(entry?.role, { maxLen: 20 }) || 'user';
      const msg = { role: role.toLowerCase() };

      // Tool call results (role: "tool")
      if (msg.role === 'tool' && entry.tool_call_id) {
        msg.tool_call_id = String(entry.tool_call_id);
        msg.content = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content || '');
        messages.push(msg);
        continue;
      }

      // Assistant messages with tool_calls
      if (msg.role === 'assistant' && Array.isArray(entry.tool_calls)) {
        msg.content = entry.content || '';
        msg.tool_calls = entry.tool_calls.map(tc => ({
          id: tc.id || `call_${crypto.randomBytes(8).toString('hex')}`,
          type: 'function',
          function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '{}' },
        }));
        messages.push(msg);
        continue;
      }

      // Regular messages
      const content = normalizeString(entry?.content, { maxLen: 20000, trim: false });
      if (!content) continue;
      msg.content = content;
      messages.push(msg);
    }

    if (messages.length === 0) {
      return res.status(400).json({
        error: { message: 'messages must include at least one non-empty content string', type: 'invalid_request_error', code: 400 }
      });
    }

    const maxTokens = toFiniteInt(req.body?.max_tokens, { min: 1, max: 8192 }) || 512;
    const temperature = toFiniteNumber(req.body?.temperature, { min: 0, max: 2 }) ?? 0.7;
    const wantsStream = !!req.body?.stream;

    // Extract function calling params (Gap 4)
    const tools = Array.isArray(req.body?.tools) ? req.body.tools : null;
    const toolChoice = req.body?.tool_choice || null;

    const modelReq = resolveModelRequirements(model);
    const minVramMb = modelReq.min_vram_gb * 1024;

    const assignedProvider = assignProvider(minVramMb);
    if (!assignedProvider) {
      return res.status(503).json({
        error: { message: 'No inference providers available for this model', type: 'server_error', code: 503 }
      });
    }

    // Check balance
    const mergedPrompt = estimatePromptFromMessages(messages);
    const promptTokens = approximateTokenCount(mergedPrompt);
    const durationMinutes = Math.max(1, Math.ceil(maxTokens / 350));
    const estimatedCostHalala = Math.max(1, Math.round(durationMinutes * modelReq.fallback_rate_halala_per_min));
    if (Number(req.renter.balance_halala || 0) < estimatedCostHalala) {
      return res.status(402).json({
        error: { message: 'Insufficient balance', type: 'billing_error', code: 402 }
      });
    }

    // If provider has a vLLM endpoint, proxy directly
    if (assignedProvider.vllm_endpoint_url) {
      const proxyResult = await proxyToProvider({
        endpointUrl: assignedProvider.vllm_endpoint_url,
        modelId: modelReq.model_id,
        messages,
        maxTokens,
        temperature,
        stream: wantsStream,
      });

      const debitAndReturnProxyResult = (resultBody) => {
        const usage = resultBody?.usage || {};
        const promptUsed = Number(usage.prompt_tokens || 0);
        const completionUsed = Number(usage.completion_tokens || 0);
        const actualTokens = promptUsed + completionUsed;
        const rateRecord = db.get(
          'SELECT token_rate_halala FROM cost_rates WHERE model = ? AND is_active = 1', modelReq.model_id
        ) || db.get('SELECT token_rate_halala FROM cost_rates WHERE model = ? AND is_active = 1', '__default__');
        const tokenRate = rateRecord?.token_rate_halala || 1;
        const actualCost = Math.max(1, actualTokens * tokenRate);
        try {
          db.prepare('UPDATE renters SET balance_halala = balance_halala - ?, updated_at = ? WHERE id = ? AND balance_halala >= ?')
            .run(actualCost, new Date().toISOString(), req.renter.id, actualCost);
        } catch (_) { /* best-effort */ }

        try {
          recordOpenRouterUsage(db._db || db, {
            renterId: req.renter.id,
            providerId: assignedProvider.id,
            model: modelReq.model_id,
            source: 'v1_proxy',
            promptTokens: promptUsed,
            completionTokens: completionUsed,
            totalTokens: actualTokens,
            costHalala: actualCost,
            currency: 'SAR',
          });
        } catch (ledgerError) {
          console.error('[v1/chat/completions] OpenRouter usage ledger write failed:', ledgerError.message);
        }

        return res.json(resultBody);
      };

      const writeStreamingResponse = (streamResponse) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        streamResponse.body.pipe(res);
      };

      if (wantsStream && proxyResult.streamResponse) {
        writeStreamingResponse(proxyResult.streamResponse);
        return;
      }

      if (proxyResult.body) {
        return debitAndReturnProxyResult(proxyResult.body);
      }

      // If selected provider endpoint exists but failed to produce a valid payload,
      // retry once through other capable providers before returning upstream failure.
      const fallbackCapable = getCapableProviders(minVramMb)
        .filter((provider) => provider.id !== assignedProvider.id && provider.vllm_endpoint_url)
        .sort((a, b) => (a.gpu_util_pct ?? 0) - (b.gpu_util_pct ?? 0))
        .slice(0, 2);

      for (const fallbackProvider of fallbackCapable) {
        const fallbackResult = await proxyToProvider({
          endpointUrl: fallbackProvider.vllm_endpoint_url,
          modelId: modelReq.model_id,
          messages,
          maxTokens,
          temperature,
          stream: wantsStream,
        });

        if (fallbackResult.proxyError) continue;

        if (wantsStream && fallbackResult.streamResponse) {
          writeStreamingResponse(fallbackResult.streamResponse);
          return;
        }

        if (fallbackResult.body) {
          return debitAndReturnProxyResult(fallbackResult.body);
        }
      }

      return res.status(502).json({
        error: {
          message: proxyResult.proxyError
            ? `Provider failover exhausted after initial error: ${proxyResult.proxyError}`
            : 'Provider failover exhausted',
          type: 'upstream_error',
          code: 502
        }
      });
    }

    // Fallback: create job in queue (non-streaming only for job-based flow)
    const now = new Date().toISOString();
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const containerSpec = {
      image_type: 'vllm-serve',
      image: 'dcp/vllm-serve:latest',
      model_id: modelReq.model_id,
      vram_required_mb: minVramMb,
      gpu_count: 1,
      compute_type: 'inference',
    };

    try {
      db.prepare('UPDATE renters SET balance_halala = balance_halala - ?, updated_at = ? WHERE id = ? AND balance_halala >= ?')
        .run(estimatedCostHalala, now, req.renter.id, estimatedCostHalala);

      db.prepare(
        `INSERT INTO jobs (job_id, provider_id, renter_id, job_type, model, status, submitted_at,
          duration_minutes, cost_halala, gpu_requirements, container_spec, max_duration_seconds,
          notes, created_at, updated_at, priority)
         VALUES (?, ?, ?, 'vllm', ?, 'pending', ?, ?, ?, ?, ?, 300, 'v1:chat/completions', ?, ?, 8)`
      ).run(
        jobId, assignedProvider.id, req.renter.id, modelReq.model_id, now,
        durationMinutes, estimatedCostHalala,
        JSON.stringify({ min_vram_gb: modelReq.min_vram_gb }),
        JSON.stringify(containerSpec), now, now
      );
    } catch (error) {
      return res.status(500).json({
        error: { message: 'Failed to submit inference job', type: 'server_error', code: 500 }
      });
    }

    // Poll for completion (max 5 minutes)
    const POLL_MS = 1500;
    const TIMEOUT_MS = 300000;
    const deadline = Date.now() + TIMEOUT_MS;

    while (Date.now() < deadline) {
      const job = db.get('SELECT * FROM jobs WHERE job_id = ?', jobId);
      if (!job) break;

      if (job.status === 'completed') {
        const text = job.result_text || '';
        const cTokens = job.completion_tokens || approximateTokenCount(text);
        try {
          recordOpenRouterUsage(db._db || db, {
            renterId: req.renter.id,
            providerId: assignedProvider.id,
            model: modelReq.model_id,
            source: 'v1_queue',
            promptTokens,
            completionTokens: cTokens,
            totalTokens: promptTokens + cTokens,
            costHalala: estimatedCostHalala,
            currency: 'SAR',
          });
        } catch (ledgerError) {
          console.error('[v1/chat/completions] OpenRouter queued usage ledger write failed:', ledgerError.message);
        }

        // If streaming was requested, simulate SSE from completed text
        if (wantsStream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no');
          if (res.flushHeaders) res.flushHeaders();

          const completionId = `chatcmpl-${jobId}`;
          // Send content in small chunks
          const chunkSize = 20;
          for (let i = 0; i < text.length; i += chunkSize) {
            const chunk = text.slice(i, i + chunkSize);
            const payload = {
              id: completionId, object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000), model: modelReq.model_id,
              choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }],
            };
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
          }
          res.write(`data: ${JSON.stringify({
            id: completionId, object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000), model: modelReq.model_id,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
            usage: { prompt_tokens: promptTokens, completion_tokens: cTokens, total_tokens: promptTokens + cTokens },
          })}\n\n`);
          res.write('data: [DONE]\n\n');
          return res.end();
        }

        return res.json({
          id: `chatcmpl-${jobId}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: modelReq.model_id,
          choices: [{
            index: 0,
            message: { role: 'assistant', content: text },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: promptTokens, completion_tokens: cTokens, total_tokens: promptTokens + cTokens },
        });
      }

      if (['failed', 'cancelled', 'permanently_failed', 'timed_out'].includes(job.status)) {
        return res.status(502).json({
          error: { message: `Inference ${job.status}: ${job.error || 'unknown'}`, type: 'upstream_error', code: 502 }
        });
      }

      await new Promise(r => setTimeout(r, POLL_MS));
    }

    return res.status(504).json({
      error: { message: 'Inference did not complete within timeout', type: 'timeout_error', code: 504 }
    });

  } catch (error) {
    console.error('[v1/chat/completions] Error:', error);
    return res.status(500).json({
      error: { message: 'Internal server error', type: 'server_error', code: 500 }
    });
  }
});

module.exports = router;
