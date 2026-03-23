const express = require('express');
const crypto = require('crypto');
const { vllmCompleteLimiter, vllmStreamLimiter } = require('../middleware/rateLimiter');
const db = require('../db');

const router = express.Router();

const WAIT_TIMEOUT_MS = 300 * 1000;
const WAIT_POLL_MS = 1500;
const PROVIDER_HEARTBEAT_STALE_MS = 10 * 60 * 1000;
const TERMINAL_FAILURE_STATUSES = new Set(['failed', 'cancelled', 'permanently_failed', 'timed_out']);

function flattenRunParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params.reduce((acc, p) => (Array.isArray(p) ? acc.concat(p) : acc.concat([p])), []);
}

function runStatement(sql, ...params) {
  return db.prepare(sql).run(...flattenRunParams(params));
}

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
  const header = normalizeString(req.headers['x-renter-key'], { maxLen: 128, trim: false });
  const query = normalizeString(req.query.key, { maxLen: 128, trim: false });
  return header || query || null;
}

function requireRenter(req, res, next) {
  const key = getRenterKey(req);
  if (!key) return res.status(401).json({ error: 'Renter API key required (?key= or x-renter-key)' });

  // Sprint 25 Gap 2: check scoped sub-keys first (renter_api_keys table)
  const now = new Date().toISOString();
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
      return res.status(403).json({ error: 'API key has expired' });
    }
    let scopes = [];
    try { scopes = JSON.parse(scopedKey.scopes || '[]'); } catch (_) {}
    if (!scopes.includes('inference') && !scopes.includes('admin')) {
      return res.status(403).json({ error: 'API key does not have inference scope' });
    }
    // Touch last_used_at (best-effort, non-blocking)
    try {
      db.prepare('UPDATE renter_api_keys SET last_used_at = ? WHERE id = ?').run(now, scopedKey.id);
    } catch (_) {}
    req.renter = { id: scopedKey.r_id, api_key: scopedKey.api_key, balance_halala: scopedKey.balance_halala, status: scopedKey.status };
    req.renterKey = key;
    req.renterKeyScopes = scopes;
    return next();
  }

  // Fall back to master key (renters.api_key) — full access
  const renter = db.get(
    'SELECT id, api_key, balance_halala, status FROM renters WHERE api_key = ? AND status = ?',
    key,
    'active'
  );
  if (!renter) return res.status(403).json({ error: 'Invalid or inactive renter API key' });

  req.renter = renter;
  req.renterKey = key;
  req.renterKeyScopes = ['admin'];
  return next();
}

function parseComputeTypes(raw) {
  if (!raw) return new Set(['inference', 'training', 'rendering']);
  if (Array.isArray(raw)) {
    return new Set(raw.map((value) => String(value).toLowerCase()));
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map((value) => String(value).toLowerCase()));
    }
  } catch (_) {
    // ignore
  }
  return new Set(String(raw).split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function resolveProviderVramMb(provider) {
  const candidates = [
    provider.vram_mb,
    provider.gpu_vram_mb,
    provider.gpu_vram_mib,
    provider.vram_gb != null ? Number(provider.vram_gb) * 1024 : null,
  ];
  for (const candidate of candidates) {
    const value = toFiniteInt(candidate, { min: 0, max: 1024 * 1024 });
    if (value != null) return value;
  }
  return 0;
}

function estimatePromptFromMessages(messages) {
  return messages
    .map((message) => {
      const role = normalizeString(message?.role, { maxLen: 30 }) || 'user';
      const content = normalizeString(message?.content, { maxLen: 20000, trim: false }) || '';
      return `${role}: ${content}`;
    })
    .join('\n');
}

function approximateTokenCount(text) {
  if (!text) return 0;
  const chunks = String(text).trim().split(/\s+/).filter(Boolean);
  return Math.max(1, Math.ceil(chunks.length * 1.3));
}

function splitStreamText(text) {
  const parts = String(text || '').split(/(\s+)/).filter((chunk) => chunk.length > 0);
  if (parts.length === 0) return [''];
  return parts;
}

function parseStructuredJobResult(resultText) {
  if (!resultText || typeof resultText !== 'string') return null;
  const match = resultText.match(/DC1_RESULT_JSON:({[\s\S]+})\s*$/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (_) {
    return null;
  }
}

function extractCompletionText(job) {
  const resultText = typeof job.result === 'string' ? job.result : '';
  const structured = parseStructuredJobResult(resultText);

  if (structured && structured.type === 'text') {
    const responseText = normalizeString(structured.response, { maxLen: 100000, trim: false }) || '';
    return {
      text: responseText,
      completion_tokens: toFiniteInt(structured.tokens_generated, { min: 0, max: 1000000 }) || null,
      structured,
    };
  }

  if (structured && Array.isArray(structured.choices)) {
    const messageText = normalizeString(structured.choices?.[0]?.message?.content, { maxLen: 100000, trim: false }) || '';
    return { text: messageText, completion_tokens: null, structured };
  }

  return {
    text: normalizeString(resultText, { maxLen: 100000, trim: false }) || '',
    completion_tokens: null,
    structured: null,
  };
}

function resolveModelRequirements(modelId) {
  const record = db.get(
    `SELECT model_id, display_name, min_gpu_vram_gb, default_price_halala_per_min
     FROM model_registry
     WHERE model_id = ? AND is_active = 1`,
    modelId
  );

  const minVramGb = toFiniteInt(record?.min_gpu_vram_gb, { min: 0, max: 1024 }) || 16;
  const fallbackRatePerMinute = toFiniteInt(record?.default_price_halala_per_min, { min: 1, max: 100000 }) || 20;

  return {
    model_id: record?.model_id || modelId,
    display_name: record?.display_name || modelId,
    min_vram_gb: minVramGb,
    fallback_rate_halala_per_min: fallbackRatePerMinute,
  };
}

function getCapableProviderCount(minVramMb) {
  const providers = db.all(
    `SELECT id, status, is_paused, last_heartbeat, supported_compute_types,
            vram_mb, gpu_vram_mb, gpu_vram_mib, vram_gb
     FROM providers
     WHERE status = 'online' AND COALESCE(is_paused, 0) = 0`
  );

  const nowMs = Date.now();
  let count = 0;
  for (const provider of providers) {
    const heartbeatMs = provider.last_heartbeat ? Date.parse(provider.last_heartbeat) : NaN;
    if (Number.isFinite(heartbeatMs) && (nowMs - heartbeatMs) > PROVIDER_HEARTBEAT_STALE_MS) continue;

    const computeTypes = parseComputeTypes(provider.supported_compute_types);
    if (!computeTypes.has('inference')) continue;

    const providerVramMb = resolveProviderVramMb(provider);
    if (providerVramMb < minVramMb) continue;

    count += 1;
  }

  return count;
}

function buildRuntimeDiagnostics({ modelId, minVramGb, jobId = null }) {
  const minVramMb = toFiniteInt(minVramGb, { min: 0, max: 1024 }) != null ? Number(minVramGb) * 1024 : 0;
  return {
    model_id: modelId || null,
    min_vram_gb: Number(minVramGb || 0),
    capable_providers: getCapableProviderCount(minVramMb),
    queued_vllm_jobs: getNoProviderQueueDepth(),
    provider_heartbeat_stale_ms: PROVIDER_HEARTBEAT_STALE_MS,
    wait_timeout_ms: WAIT_TIMEOUT_MS,
    job_id: jobId,
  };
}

function logVllmDegradation(event, diagnostics, details = {}) {
  const payload = {
    event,
    diagnostics,
    details,
    ts: new Date().toISOString(),
  };
  console.warn(`[vllm:${event}] ${JSON.stringify(payload)}`);
}

function getNoProviderQueueDepth() {
  const row = db.get(
    `SELECT COUNT(*) AS count
     FROM jobs
     WHERE status IN ('queued', 'pending', 'running')
       AND (
         job_type = 'vllm'
         OR container_spec LIKE '%"image_type":"vllm-serve"%'
       )`
  );
  return Number(row?.count || 0);
}

function buildTaskScript({ model, prompt, maxTokens, temperature }) {
  const escapedModel = JSON.stringify(model);
  const escapedPrompt = JSON.stringify(prompt);

  return [
    '#!/usr/bin/env python3',
    'import json',
    'import time',
    'import torch',
    'from transformers import AutoTokenizer, AutoModelForCausalLM',
    '',
    `model_id = ${escapedModel}`,
    `user_prompt = ${escapedPrompt}`,
    `max_tokens = ${maxTokens}`,
    `temperature = ${temperature}`,
    '',
    't0 = time.time()',
    'device = "cuda" if torch.cuda.is_available() else "cpu"',
    'dtype = torch.float16 if device == "cuda" else torch.float32',
    '',
    'tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)',
    'if tokenizer.pad_token is None:',
    '    tokenizer.pad_token = tokenizer.eos_token',
    'model = AutoModelForCausalLM.from_pretrained(',
    '    model_id,',
    '    torch_dtype=dtype,',
    '    device_map="auto" if device == "cuda" else None,',
    '    trust_remote_code=True',
    ')',
    '',
    'messages = [{"role": "user", "content": user_prompt}]',
    'try:',
    '    formatted = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)',
    'except Exception:',
    '    formatted = f"User: {user_prompt}\\nAssistant:"',
    '',
    'inputs = tokenizer(formatted, return_tensors="pt").to(device)',
    'input_len = inputs["input_ids"].shape[1]',
    'with torch.no_grad():',
    '    output = model.generate(',
    '        **inputs,',
    '        max_new_tokens=max_tokens,',
    '        temperature=temperature,',
    '        do_sample=True,',
    '        top_p=0.9,',
    '        repetition_penalty=1.1,',
    '        pad_token_id=tokenizer.eos_token_id',
    '    )',
    '',
    'gen_ids = output[0][input_len:]',
    'response = tokenizer.decode(gen_ids, skip_special_tokens=True).strip()',
    'result = {',
    '    "type": "text",',
    '    "model": model_id,',
    '    "prompt": user_prompt,',
    '    "response": response,',
    '    "tokens_generated": int(len(gen_ids)),',
    '    "total_time_s": round(time.time() - t0, 3),',
    '}',
    'print("DC1_RESULT_JSON:" + json.dumps(result))',
    '',
  ].join('\n');
}

function estimateDurationMinutes(maxTokens) {
  const approxTokensPerMinute = 350;
  return Math.max(1, Math.ceil(maxTokens / approxTokensPerMinute));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJobCompletion(jobId, diagnosticsContext = {}) {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const job = db.get('SELECT * FROM jobs WHERE id = ?', jobId);
    if (!job) return { error: { status: 404, body: { error: 'Job not found after submission' } } };

    const status = String(job.status || '').toLowerCase();
    if (status === 'completed') {
      return { job };
    }

    if (TERMINAL_FAILURE_STATUSES.has(status)) {
      const diagnostics = buildRuntimeDiagnostics({
        modelId: diagnosticsContext.modelId,
        minVramGb: diagnosticsContext.minVramGb,
        jobId: job.job_id,
      });
      logVllmDegradation('terminal_failure', diagnostics, {
        status: job.status,
        error: job.error || null,
      });
      return {
        error: {
          status: 502,
          body: {
            error: 'inference_failed',
            job_id: job.job_id,
            status: job.status,
            details: job.error || null,
            diagnostics,
          },
        },
      };
    }

    await sleep(WAIT_POLL_MS);
  }

  return {
    error: {
      status: 504,
      body: {
        error: 'timeout',
        message: 'Inference did not complete within 300 seconds',
        diagnostics: buildRuntimeDiagnostics({
          modelId: diagnosticsContext.modelId,
          minVramGb: diagnosticsContext.minVramGb,
          jobId: diagnosticsContext.jobId || null,
        }),
      },
    },
  };
}

function buildOpenAiResponse({ job, model, text, promptTokens, completionTokens }) {
  const completionId = `chatcmpl-${job.job_id}`;
  const completion = completionTokens != null ? completionTokens : approximateTokenCount(text);
  const total = promptTokens + completion;

  return {
    id: completionId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completion,
      total_tokens: total,
    },
    cost_halala: Number(job.actual_cost_halala ?? job.cost_halala ?? 0),
  };
}

function prepareMessages(messagesRaw) {
  if (!Array.isArray(messagesRaw) || messagesRaw.length === 0) {
    return { error: 'messages must be a non-empty array' };
  }

  const messages = [];
  for (const entry of messagesRaw.slice(0, 100)) {
    const role = normalizeString(entry?.role, { maxLen: 20 }) || 'user';
    const content = normalizeString(entry?.content, { maxLen: 20000, trim: false });
    if (!content) continue;
    messages.push({ role: role.toLowerCase(), content });
  }

  if (messages.length === 0) {
    return { error: 'messages must include at least one non-empty content string' };
  }

  return { value: messages };
}

async function submitAndAwait(req) {
  const model = normalizeString(req.body?.model, { maxLen: 200 });
  if (!model) return { error: { status: 400, body: { error: 'model is required' } } };

  const preparedMessages = prepareMessages(req.body?.messages);
  if (preparedMessages.error) {
    return { error: { status: 400, body: { error: preparedMessages.error } } };
  }

  const maxTokens = toFiniteInt(req.body?.max_tokens, { min: 1, max: 8192 }) || 512;
  const temperature = toFiniteNumber(req.body?.temperature, { min: 0, max: 2 }) ?? 0.7;

  const modelReq = resolveModelRequirements(model);
  const minVramMb = modelReq.min_vram_gb * 1024;
  const capableProviders = getCapableProviderCount(minVramMb);
  if (capableProviders < 1) {
    const diagnostics = buildRuntimeDiagnostics({
      modelId: modelReq.model_id,
      minVramGb: modelReq.min_vram_gb,
      jobId: null,
    });
    logVllmDegradation('no_capacity', diagnostics, {
      renter_id: req.renter?.id || null,
      route: req.originalUrl || '/api/vllm/complete',
    });
    return {
      error: {
        status: 503,
        body: {
          error: 'no_capacity',
          message: 'No online providers currently satisfy this model GPU requirement',
          diagnostics,
        },
      },
    };
  }

  const messages = preparedMessages.value;
  const mergedPrompt = estimatePromptFromMessages(messages);
  const promptTokens = approximateTokenCount(mergedPrompt);
  const durationMinutes = estimateDurationMinutes(maxTokens);
  const estimatedCostHalala = Math.max(1, Math.round(durationMinutes * modelReq.fallback_rate_halala_per_min));

  if (Number(req.renter.balance_halala || 0) < estimatedCostHalala) {
    return {
      error: {
        status: 402,
        body: {
          error: 'Insufficient balance',
          balance_halala: Number(req.renter.balance_halala || 0),
          required_halala: estimatedCostHalala,
          shortfall_halala: estimatedCostHalala - Number(req.renter.balance_halala || 0),
        },
      },
    };
  }

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

  const taskSpec = buildTaskScript({
    model: modelReq.model_id,
    prompt: mergedPrompt,
    maxTokens,
    temperature,
  });

  const createJobTx = db._db.transaction(() => {
    const debit = db.prepare(
      'UPDATE renters SET balance_halala = balance_halala - ?, updated_at = ? WHERE id = ? AND balance_halala >= ?'
    ).run(estimatedCostHalala, now, req.renter.id, estimatedCostHalala);
    if (!debit || debit.changes !== 1) {
      throw new Error('INSUFFICIENT_BALANCE_OR_CONCURRENT_UPDATE');
    }

    return db.prepare(
      `INSERT INTO jobs (
        job_id,
        provider_id,
        renter_id,
        job_type,
        model,
        status,
        submitted_at,
        duration_minutes,
        cost_halala,
        gpu_requirements,
        container_spec,
        task_spec,
        max_duration_seconds,
        notes,
        created_at,
        updated_at,
        priority
      ) VALUES (?, NULL, ?, 'vllm', ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      jobId,
      req.renter.id,
      modelReq.model_id,
      now,
      durationMinutes,
      estimatedCostHalala,
      JSON.stringify({ min_vram_gb: modelReq.min_vram_gb }),
      JSON.stringify(containerSpec),
      taskSpec,
      300,
      'vllm:direct-completion',
      now,
      now,
      8
    );
  });

  let insert;
  try {
    insert = createJobTx();
  } catch (error) {
    if (String(error?.message || '').includes('INSUFFICIENT_BALANCE_OR_CONCURRENT_UPDATE')) {
      return {
        error: {
          status: 402,
          body: {
            error: 'Insufficient balance',
            balance_halala: Number(req.renter.balance_halala || 0),
            required_halala: estimatedCostHalala,
            shortfall_halala: Math.max(0, estimatedCostHalala - Number(req.renter.balance_halala || 0)),
          },
        },
      };
    }
    throw error;
  }

  const waitResult = await waitForJobCompletion(insert.lastInsertRowid, {
    modelId: modelReq.model_id,
    minVramGb: modelReq.min_vram_gb,
    jobId,
  });
  if (waitResult.error) {
    return waitResult;
  }

  const completedJob = waitResult.job;
  const extracted = extractCompletionText(completedJob);

  // Persist actual token counts for billing traceability (Sprint 25 Gap 1)
  const actualCompletionTokens = extracted.completion_tokens != null
    ? extracted.completion_tokens
    : approximateTokenCount(extracted.text);
  try {
    runStatement(
      'UPDATE jobs SET prompt_tokens = ?, completion_tokens = ?, updated_at = ? WHERE job_id = ?',
      promptTokens,
      actualCompletionTokens,
      now,
      jobId
    );
  } catch (_) {
    // Non-fatal — token write-back failure must not block the inference response
  }

  const responsePayload = buildOpenAiResponse({
    job: completedJob,
    model: modelReq.model_id,
    text: extracted.text,
    promptTokens,
    completionTokens: extracted.completion_tokens,
  });

  return {
    payload: responsePayload,
    text: extracted.text,
  };
}

// GET /api/vllm/models
// Mirrors model registry for vLLM callers.
router.get('/models', (req, res) => {
  try {
    const models = db.all(
      `SELECT
         m.model_id,
         m.display_name,
         m.family,
         m.vram_gb,
         m.quantization,
         m.context_window,
         m.use_cases,
         m.min_gpu_vram_gb,
         COUNT(p.id) AS providers_online,
         COALESCE(
           ROUND(AVG(COALESCE(p.price_per_min_halala, m.default_price_halala_per_min)) / 100.0, 2),
           ROUND(m.default_price_halala_per_min / 100.0, 2)
         ) AS avg_price_sar_per_min
       FROM model_registry m
       LEFT JOIN providers p
         ON p.status = 'online'
        AND COALESCE(
              p.vram_gb,
              CAST(ROUND(COALESCE(p.gpu_vram_mb, p.gpu_vram_mib, 0) / 1024.0) AS INTEGER),
              0
            ) >= m.min_gpu_vram_gb
       WHERE m.is_active = 1
       GROUP BY m.id
       ORDER BY m.display_name ASC`
    );

    const payload = models.map((row) => {
      let useCases = [];
      try {
        const parsed = JSON.parse(row.use_cases || '[]');
        useCases = Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        useCases = [];
      }

      const providersOnline = Number(row.providers_online || 0);
      const avgSarPerMin = Number(row.avg_price_sar_per_min || 0);

      return {
        model_id: row.model_id,
        display_name: row.display_name,
        family: row.family,
        vram_gb: Number(row.vram_gb || 0),
        quantization: row.quantization,
        context_window: Number(row.context_window || 0),
        use_cases: useCases,
        min_gpu_vram_gb: Number(row.min_gpu_vram_gb || 0),
        providers_online: providersOnline,
        avg_price_sar_per_min: Number.isFinite(avgSarPerMin) ? avgSarPerMin : 0,
        status: providersOnline > 0 ? 'available' : 'no_providers',
      };
    });

    return res.json({ object: 'list', data: payload });
  } catch (error) {
    console.error('vLLM model registry error:', error);
    return res.status(500).json({ error: 'Failed to fetch vLLM model registry' });
  }
});

// POST /api/vllm/complete?key=
router.post('/complete', vllmCompleteLimiter, requireRenter, async (req, res) => {
  try {
    const result = await submitAndAwait(req);
    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    return res.json(result.payload);
  } catch (error) {
    console.error('vLLM complete error:', error);
    return res.status(500).json({ error: 'vLLM completion failed' });
  }
});

// POST /api/vllm/complete/stream?key=
router.post('/complete/stream', vllmStreamLimiter, requireRenter, async (req, res) => {
  let cancelled = false;
  req.on('close', () => { cancelled = true; });

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    const result = await submitAndAwait(req);
    if (cancelled) return res.end();
    if (result.error) {
      res.write(`data: ${JSON.stringify({ error: result.error.body })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const chunks = splitStreamText(result.text);
    const completionId = result.payload.id || `chatcmpl-${crypto.randomBytes(8).toString('hex')}`;

    for (const part of chunks) {
      if (cancelled) return res.end();
      const payload = {
        id: completionId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: result.payload.model,
        choices: [{ index: 0, delta: { content: part }, finish_reason: null }],
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }

    const finalPayload = {
      id: completionId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: result.payload.model,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: result.payload.usage,
      cost_halala: result.payload.cost_halala,
    };
    res.write(`data: ${JSON.stringify(finalPayload)}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  } catch (error) {
    console.error('vLLM stream error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'vLLM streaming failed' });
    }
    try {
      res.write(`data: ${JSON.stringify({ error: 'vLLM streaming failed' })}\n\n`);
      res.write('data: [DONE]\n\n');
    } catch (_) {
      // no-op
    }
    return res.end();
  }
});

module.exports = router;
