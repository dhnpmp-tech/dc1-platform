const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');

// HMAC secret for signing task_spec (falls back to admin token or random)
const HMAC_SECRET = process.env.DC1_HMAC_SECRET || process.env.DC1_ADMIN_TOKEN || crypto.randomBytes(32).toString('hex');

function signTaskSpec(taskSpec) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(taskSpec).digest('hex');
}

// Renter auth middleware — validates renter API key from header or query
function requireRenter(req, res, next) {
  const key = req.headers['x-renter-key'] || req.query.renter_key;
  if (!key) {
    return res.status(401).json({ error: 'Renter API key required (x-renter-key header or renter_key query)' });
  }
  const renter = db.get('SELECT * FROM renters WHERE api_key = ? AND status = ?', key, 'active');
  if (!renter) {
    return res.status(403).json({ error: 'Invalid or inactive renter API key' });
  }
  req.renter = renter;
  next();
}

// Cost rates in halala per minute by job type
const COST_RATES = {
  'llm-inference': 15,    // 15 halala/min
  'llm_inference': 15,    // alias
  'training': 25,         // 25 halala/min
  'rendering': 20,        // 20 halala/min
  'image_generation': 20, // 20 halala/min
  'default': 10           // 10 halala/min
};

// ── Job template scripts ────────────────────────────────────────────────────
// These auto-generate Python task_spec scripts for known job types so renters
// can submit jobs with simple JSON params instead of writing Python code.

// Sanitize a string for safe embedding in Python single-quoted strings
function pyEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, '');
}

// Whitelist model IDs to prevent code injection via model param
const ALLOWED_SD_MODELS = [
  'CompVis/stable-diffusion-v1-4',
  'stable-diffusion-v1-5/stable-diffusion-v1-5',
  'CompVis/stable-diffusion-v1-4',
  'stabilityai/stable-diffusion-2-1',
  'runwayml/stable-diffusion-v1-5',
  'stabilityai/stable-diffusion-xl-base-1.0',
];
const ALLOWED_LLM_MODELS = [
  'microsoft/phi-2',
  'microsoft/phi-1_5',
  'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
  'google/gemma-2b',
  'mistralai/Mistral-7B-Instruct-v0.2',
];

function generateImageGenScript(params) {
  const prompt = pyEscape(params.prompt || 'A beautiful sunset over Riyadh skyline');
  const negPrompt = pyEscape(params.negative_prompt || 'blurry, low quality, distorted');
  const steps = Math.min(Math.max(parseInt(params.steps) || 30, 5), 100);
  const width = Math.min(Math.max(parseInt(params.width) || 512, 256), 1024);
  const height = Math.min(Math.max(parseInt(params.height) || 512, 256), 1024);
  const seed = params.seed ? parseInt(params.seed) : -1;
  const rawModel = String(params.model || 'CompVis/stable-diffusion-v1-4');
  const model = ALLOWED_SD_MODELS.includes(rawModel) ? rawModel : 'CompVis/stable-diffusion-v1-4';

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""DC1 Image Generation - auto-generated task script"""
import torch, base64, io, json, sys, time

t0 = time.time()
print("[dc1] Loading model: ${model}", flush=True)

try:
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
except ImportError:
    print("[dc1] Installing diffusers...", flush=True)
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "diffusers", "transformers", "accelerate", "safetensors", "-q"])
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler

device = "cuda" if torch.cuda.is_available() else "cpu"
dtype = torch.float16 if device == "cuda" else torch.float32

pipe = StableDiffusionPipeline.from_pretrained(
    '${model}',
    torch_dtype=dtype,
    safety_checker=None,
    requires_safety_checker=False
)
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
pipe = pipe.to(device)

# Memory optimization for <=8GB GPUs
if device == "cuda":
    try:
        pipe.enable_attention_slicing()
    except:
        pass

print(f"[dc1] Model loaded in {time.time()-t0:.1f}s on {device}", flush=True)

generator = None
seed_used = ${seed}
if seed_used >= 0:
    generator = torch.Generator(device=device).manual_seed(seed_used)
else:
    import random
    seed_used = random.randint(0, 2**32-1)
    generator = torch.Generator(device=device).manual_seed(seed_used)

print(f"[dc1] Generating ${width}x${height} image, ${steps} steps, seed={seed_used}...", flush=True)
t1 = time.time()

with torch.no_grad():
    result = pipe(
        prompt='${prompt}',
        negative_prompt='${negPrompt}',
        num_inference_steps=${steps},
        width=${width},
        height=${height},
        generator=generator,
        guidance_scale=7.5
    )

image = result.images[0]
gen_time = time.time() - t1
print(f"[dc1] Generated in {gen_time:.1f}s", flush=True)

# Encode as base64 PNG
buf = io.BytesIO()
image.save(buf, format="PNG", optimize=True)
b64 = base64.b64encode(buf.getvalue()).decode("ascii")

# Output structured result - daemon captures this
output = {
    "type": "image",
    "format": "png",
    "encoding": "base64",
    "width": ${width},
    "height": ${height},
    "steps": ${steps},
    "seed": seed_used,
    "prompt": '${prompt}',
    "model": '${model}',
    "device": device,
    "gen_time_s": round(gen_time, 1),
    "total_time_s": round(time.time()-t0, 1),
    "data": b64
}
print("DC1_RESULT_JSON:" + json.dumps(output))
`;
}

function generateLlmInferenceScript(params) {
  const prompt = pyEscape(params.prompt || 'What is the capital of Saudi Arabia?');
  const maxTokens = Math.min(Math.max(parseInt(params.max_tokens) || 512, 32), 4096);
  const rawModel = String(params.model || 'TinyLlama/TinyLlama-1.1B-Chat-v1.0');
  const model = ALLOWED_LLM_MODELS.includes(rawModel) ? rawModel : 'TinyLlama/TinyLlama-1.1B-Chat-v1.0';
  const temperature = Math.min(Math.max(parseFloat(params.temperature) || 0.7, 0.1), 2.0);

  // Determine if model needs 4-bit quantization (7B+ params need it for 8GB VRAM cards)
  const needs4bit = model.includes('Mistral-7B') || model.includes('gemma-7b');
  // Determine chat template format based on model
  const isChatModel = model.includes('Chat') || model.includes('Instruct');

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""DC1 LLM Inference v3 - chat templates + phase markers for progress tracking"""
import torch, json, sys, time

t0 = time.time()
print("[dc1-phase] installing_deps", flush=True)

try:
    from transformers import AutoModelForCausalLM, AutoTokenizer
except ImportError:
    print("[dc1] Installing transformers + accelerate...", flush=True)
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install",
        "transformers", "accelerate", "-q"])
    from transformers import AutoModelForCausalLM, AutoTokenizer

device = "cuda" if torch.cuda.is_available() else "cpu"
dtype = torch.float16 if device == "cuda" else torch.float32

print("[dc1-phase] downloading_model", flush=True)
print("[dc1] Downloading/loading model: ${model}", flush=True)
tokenizer = AutoTokenizer.from_pretrained('${model}', trust_remote_code=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

print("[dc1-phase] loading_model", flush=True)
model = AutoModelForCausalLM.from_pretrained(
    '${model}', torch_dtype=dtype,
    device_map="auto" if device == "cuda" else None,
    trust_remote_code=True
)
print(f"[dc1] Model loaded in {time.time()-t0:.1f}s on {device}", flush=True)

user_prompt = '${prompt}'

# ── Format with chat template ────────────────────────────────────────
${isChatModel ? `messages = [{"role": "user", "content": user_prompt}]
try:
    formatted = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
except Exception:
    model_lower = '${model}'.lower()
    if 'tinyllama' in model_lower:
        formatted = f"<|user|>\\n{user_prompt}\\n<|assistant|>\\n"
    elif 'mistral' in model_lower:
        formatted = f"[INST] {user_prompt} [/INST]"
    else:
        formatted = f"User: {user_prompt}\\nAssistant:"
` : `formatted = f"Question: {user_prompt}\\nAnswer:"`}
print(f"[dc1] Prompt formatted ({len(formatted)} chars)", flush=True)

inputs = tokenizer(formatted, return_tensors="pt").to(device)
input_len = inputs["input_ids"].shape[1]

print("[dc1-phase] generating", flush=True)
print(f"[dc1] Generating up to ${maxTokens} tokens...", flush=True)
t1 = time.time()
with torch.no_grad():
    out = model.generate(**inputs, max_new_tokens=${maxTokens},
        temperature=${temperature}, do_sample=True, top_p=0.9,
        repetition_penalty=1.1,
        pad_token_id=tokenizer.eos_token_id)

gen_ids = out[0][input_len:]
response = tokenizer.decode(gen_ids, skip_special_tokens=True).strip()
gen_time = time.time() - t1
n_tokens = len(gen_ids)
print(f"[dc1] Generated {n_tokens} tokens in {gen_time:.1f}s", flush=True)

output = {
    "type": "text", "prompt": user_prompt, "response": response,
    "model": '${model}', "tokens_generated": n_tokens,
    "tokens_per_second": round(n_tokens / gen_time, 1) if gen_time > 0 else 0,
    "gen_time_s": round(gen_time, 1), "total_time_s": round(time.time()-t0, 1),
    "device": device
}
print("DC1_RESULT_JSON:" + json.dumps(output))
`;
}

// Map job types to their template generators
const JOB_TEMPLATES = {
  'image_generation': generateImageGenScript,
  'llm-inference': generateLlmInferenceScript,
  'llm_inference': generateLlmInferenceScript,  // underscore alias (avoids daemon Docker path for llm-inference)
};

function calculateCostHalala(jobType, durationMinutes) {
  const rate = COST_RATES[jobType] || COST_RATES['default'];
  return Math.round(rate * durationMinutes);
}

// Floor-plus-remainder: guarantees provider + dc1 === total exactly
function splitBilling(totalHalala) {
  const provider = Math.floor(totalHalala * 0.75);
  return { provider, dc1: totalHalala - provider };
}

// POST /api/jobs/submit — requires renter auth
router.post('/submit', requireRenter, (req, res) => {
  try {
    const { provider_id, job_type, duration_minutes, gpu_requirements, task_spec, params: bodyParams, max_duration_seconds } = req.body;

    if (!provider_id || !job_type || !duration_minutes) {
      return res.status(400).json({ error: 'Missing required fields: provider_id, job_type, duration_minutes' });
    }

    if (typeof duration_minutes !== 'number' || duration_minutes <= 0) {
      return res.status(400).json({ error: 'duration_minutes must be a positive number' });
    }

    // Check provider exists and is online
    const provider = db.get('SELECT * FROM providers WHERE id = ?', provider_id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    if (provider.status !== 'online') {
      return res.status(400).json({ error: 'Provider is not online', provider_status: provider.status });
    }

    // Check provider doesn't already have a running job
    const existingJob = db.get(
      `SELECT id FROM jobs WHERE provider_id = ? AND status = 'running'`,
      provider_id
    );
    if (existingJob) {
      return res.status(409).json({ error: 'Provider already has a running job', existing_job_id: existingJob.id });
    }

    // Validate GPU requirements if specified
    if (gpu_requirements) {
      const req_vram = gpu_requirements.min_vram_gb;
      const providerVram = provider.gpu_vram_mib ? provider.gpu_vram_mib / 1024 : provider.vram_gb;
      if (req_vram && providerVram && providerVram < req_vram) {
        return res.status(400).json({
          error: 'Provider does not meet GPU requirements',
          required_vram_gb: req_vram,
          provider_vram_gb: providerVram
        });
      }
    }

    const cost_halala = calculateCostHalala(job_type, duration_minutes);

    // ── Pre-pay balance check ──────────────────────────────────────────
    // Renter must have enough balance to cover estimated job cost
    if (req.renter.balance_halala < cost_halala) {
      return res.status(402).json({
        error: 'Insufficient balance',
        balance_halala: req.renter.balance_halala,
        required_halala: cost_halala,
        shortfall_halala: cost_halala - req.renter.balance_halala,
        message: `Top up at least ${Math.ceil((cost_halala - req.renter.balance_halala) / 100)} SAR to submit this job. POST /api/renters/topup`
      });
    }

    // Hold (deduct) estimated cost from renter balance upfront
    db.run(
      `UPDATE renters SET balance_halala = balance_halala - ? WHERE id = ?`,
      cost_halala, req.renter.id
    );

    const now = new Date().toISOString();
    const job_id = 'job-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    // Job timeout: default 30 minutes, max 1 hour
    const timeout = Math.min(max_duration_seconds || 1800, 3600);
    const timeoutAt = new Date(Date.now() + timeout * 1000).toISOString().replace('T', ' ').replace('Z', '');

    // ── Auto-generate task script from template if job_type has one ─────
    let finalTaskSpec = task_spec;
    let result_type = 'text'; // default result type

    if (JOB_TEMPLATES[job_type]) {
      // Parse params: prefer body.params, fall back to task_spec
      let params = {};
      if (bodyParams && typeof bodyParams === 'object' && Object.keys(bodyParams).length > 0) {
        // Renter sent params directly in request body (recommended way)
        params = bodyParams;
      } else if (task_spec) {
        // Fall back to parsing task_spec as JSON
        params = typeof task_spec === 'string' ? (() => { try { return JSON.parse(task_spec); } catch { return { prompt: task_spec }; } })() : task_spec;
      }
      // If params look like raw Python code (not JSON), use as-is
      if (typeof params === 'string' || (params.prompt === undefined && typeof task_spec === 'string' && task_spec.includes('import '))) {
        finalTaskSpec = task_spec;
      } else {
        finalTaskSpec = JOB_TEMPLATES[job_type](params);
        result_type = job_type === 'image_generation' ? 'image' : 'text';
      }
    }

    // Stringify task_spec if it's an object, then HMAC-sign
    const taskSpecStr = finalTaskSpec ? (typeof finalTaskSpec === 'string' ? finalTaskSpec : JSON.stringify(finalTaskSpec)) : null;
    const taskSpecHmac = taskSpecStr ? signTaskSpec(taskSpecStr) : null;

    const result = db.run(
      `INSERT INTO jobs (job_id, provider_id, renter_id, job_type, status, submitted_at, duration_minutes,
        cost_halala, gpu_requirements, task_spec, task_spec_hmac, max_duration_seconds, timeout_at, notes, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      job_id, provider_id, req.renter.id, job_type, now, duration_minutes, cost_halala,
      gpu_requirements ? JSON.stringify(gpu_requirements) : null,
      taskSpecStr,
      taskSpecHmac,
      timeout,
      timeoutAt,
      null,
      now
    );

    // Job stays 'pending' until daemon picks it up and sets 'running'
    const job = db.get('SELECT * FROM jobs WHERE id = ?', result.lastInsertRowid);

    res.status(201).json({
      success: true,
      job: {
        id: job.id,
        job_id: job.job_id,
        provider_id: job.provider_id,
        renter_id: job.renter_id,
        job_type: job.job_type,
        status: job.status,
        submitted_at: job.submitted_at,
        started_at: job.started_at,
        duration_minutes: job.duration_minutes,
        cost_halala: job.cost_halala,
        max_duration_seconds: timeout,
        timeout_at: timeoutAt,
        gpu_requirements: job.gpu_requirements ? JSON.parse(job.gpu_requirements) : null,
        task_spec_signed: !!taskSpecHmac
      }
    });
  } catch (error) {
    console.error('Job submit error:', error);
    res.status(500).json({ error: 'Job submission failed' });
  }
});

// GET /api/jobs/assigned?key=API_KEY
// Daemon polls this to check if it has a running job with a task to execute
router.get('/assigned', (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'API key required' });

    const provider = db.get('SELECT * FROM providers WHERE api_key = ?', [key]);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const job = db.get(
      `SELECT * FROM jobs WHERE provider_id = ? AND status IN ('pending', 'running') AND task_spec IS NOT NULL AND picked_up_at IS NULL ORDER BY created_at ASC LIMIT 1`,
      [provider.id]
    );

    if (!job) return res.json({ job: null });

    // Transition to running + mark as picked up so daemon doesn't re-execute
    const now = new Date().toISOString();
    db.run(`UPDATE jobs SET status = 'running', started_at = COALESCE(started_at, ?), picked_up_at = ? WHERE id = ?`, [now, now, job.id]);
    job.status = 'running';
    job.picked_up_at = now;

    job.gpu_requirements = job.gpu_requirements ? JSON.parse(job.gpu_requirements) : null;
    res.json({ job });
  } catch (error) {
    console.error('Assigned job fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch assigned job' });
  }
});

// POST /api/jobs/:job_id/result
// Daemon posts execution result; auto-completes the job
router.post('/:job_id/result', (req, res) => {
  try {
    const job = db.get('SELECT * FROM jobs WHERE id = ? OR job_id = ?', req.params.job_id, req.params.job_id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Guard against duplicate settlement — only settle a running job once
    if (job.status !== 'running') {
      return res.status(409).json({
        error: 'Job already settled',
        current_status: job.status,
        job_id: job.job_id
      });
    }

    const { result, error: jobError, duration_seconds, gpu_util_peak } = req.body;

    const now = new Date().toISOString();
    const actualMinutes = duration_seconds ? Math.ceil(duration_seconds / 60) : job.duration_minutes;
    const billingRate = COST_RATES[job.job_type] || COST_RATES['default'];
    const actualCostHalala = billingRate * actualMinutes;
    const { provider: providerEarned, dc1: dc1Fee } = splitBilling(actualCostHalala);

    db.run(
      `UPDATE jobs SET
        status = 'completed',
        result = ?,
        error = ?,
        completed_at = ?,
        actual_duration_minutes = ?,
        actual_cost_halala = ?,
        provider_earned_halala = ?,
        dc1_fee_halala = ?
      WHERE id = ?`,
      [
        result || 'completed',
        jobError || null,
        now,
        actualMinutes,
        actualCostHalala,
        providerEarned,
        dc1Fee,
        job.id
      ]
    );

    db.run(
      `UPDATE providers SET total_earnings = total_earnings + ?, total_jobs = total_jobs + 1 WHERE id = ?`,
      [providerEarned / 100, job.provider_id]
    );

    const updated = db.get('SELECT * FROM jobs WHERE id = ?', [job.id]);
    res.json({
      success: true,
      job: updated,
      billing: {
        actual_cost_halala: actualCostHalala,
        provider_earned_halala: providerEarned,
        dc1_fee_halala: dc1Fee
      }
    });
  } catch (error) {
    console.error('Job result error:', error);
    res.status(500).json({ error: 'Failed to record job result' });
  }
});

// GET /api/jobs/active
router.get('/active', (req, res) => {
  try {
    const jobs = db.all(
      `SELECT * FROM jobs WHERE status IN ('pending', 'running') ORDER BY submitted_at DESC`
    );
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active jobs' });
  }
});

// GET /api/jobs/verify-hmac?job_id=X&hmac=Y
// Daemon can verify a task_spec signature before executing
// IMPORTANT: must be BEFORE /:job_id routes to avoid being caught by param route
router.get('/verify-hmac', (req, res) => {
  try {
    const { job_id, hmac } = req.query;
    if (!job_id || !hmac) return res.status(400).json({ error: 'job_id and hmac required' });

    const job = db.get('SELECT task_spec_hmac FROM jobs WHERE id = ?', job_id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const valid = job.task_spec_hmac && crypto.timingSafeEqual(
      Buffer.from(hmac, 'hex'),
      Buffer.from(job.task_spec_hmac, 'hex')
    );

    res.json({ valid: !!valid });
  } catch (error) {
    res.json({ valid: false, error: 'Verification failed' });
  }
});

// ============================================================================
// GET /api/jobs/history — Renter's recent job history
// IMPORTANT: Must be BEFORE /:job_id to avoid param catch
// ============================================================================
router.get('/history', (req, res) => {
  try {
    const renterKey = req.headers['x-renter-key'];
    if (!renterKey) return res.status(401).json({ error: 'Renter API key required' });

    const renter = db.get('SELECT * FROM renters WHERE api_key = ?', renterKey);
    if (!renter) return res.status(401).json({ error: 'Invalid renter key' });

    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const jobs = db.all(
      `SELECT j.id, j.job_id, j.job_type, j.status, j.submitted_at, j.started_at,
              j.completed_at, j.progress_phase, j.error, j.actual_cost_halala,
              j.cost_halala, j.actual_duration_minutes, j.duration_minutes,
              j.refunded_at,
              p.name as provider_name, p.gpu_model as provider_gpu
       FROM jobs j
       LEFT JOIN providers p ON j.provider_id = p.id
       WHERE j.renter_id = ?
       ORDER BY j.submitted_at DESC
       LIMIT ?`,
      renter.id, limit
    );

    res.json({
      balance_halala: renter.balance_halala || 0,
      balance_sar: ((renter.balance_halala || 0) / 100).toFixed(2),
      total_jobs: jobs.length,
      jobs: jobs.map(j => ({
        ...j,
        cost_sar: j.actual_cost_halala ? (j.actual_cost_halala / 100).toFixed(2) : (j.cost_halala ? (j.cost_halala / 100).toFixed(2) : '0.00'),
        refunded: !!j.refunded_at
      }))
    });
  } catch (error) {
    console.error('Job history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/jobs/:job_id
router.get('/:job_id', (req, res) => {
  try {
    const job = db.get('SELECT * FROM jobs WHERE id = ? OR job_id = ?', req.params.job_id, req.params.job_id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    job.gpu_requirements = job.gpu_requirements ? JSON.parse(job.gpu_requirements) : null;
    res.json({ job });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// POST /api/jobs/:job_id/complete
router.post('/:job_id/complete', (req, res) => {
  try {
    const job = db.get('SELECT * FROM jobs WHERE id = ? OR job_id = ?', req.params.job_id, req.params.job_id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status !== 'running') {
      return res.status(400).json({ error: 'Job is not running', current_status: job.status });
    }

    const now = new Date().toISOString();

    // Calculate ACTUAL cost from real elapsed time, not the submitted estimate
    const startedAt = job.started_at || job.submitted_at;
    const actualMinutes = startedAt
      ? Math.max(1, Math.ceil((new Date(now) - new Date(startedAt)) / 60000))
      : (job.duration_minutes || 1);
    const rate = COST_RATES[job.job_type] || COST_RATES['default'];
    const actual_cost_halala = Math.round(rate * actualMinutes);
    const { provider: provider_earned, dc1: dc1_fee } = splitBilling(actual_cost_halala);

    db.run(
      `UPDATE jobs SET
        status = 'completed',
        completed_at = ?,
        actual_duration_minutes = ?,
        actual_cost_halala = ?,
        provider_earned_halala = ?,
        dc1_fee_halala = ?
       WHERE id = ?`,
      now, actualMinutes, actual_cost_halala, provider_earned, dc1_fee, job.id
    );

    // Provider earnings updated from actual billing — 75% floor split, not full renter charge
    // provider_earned = splitBilling(actual_cost_halala).provider (computed at line 147)
    db.run(
      `UPDATE providers SET
        total_jobs = total_jobs + 1,
        total_earnings = total_earnings + ?
       WHERE id = ?`,
      provider_earned / 100, job.provider_id
    );

    const updated = db.get('SELECT * FROM jobs WHERE id = ?', job.id);
    updated.gpu_requirements = updated.gpu_requirements ? JSON.parse(updated.gpu_requirements) : null;
    res.json({
      success: true,
      job: updated,
      billing: {
        estimated_cost_halala: job.cost_halala,
        actual_cost_halala,
        actual_duration_minutes: actualMinutes,
        provider_earned_halala: provider_earned,
        dc1_fee_halala: dc1_fee
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// POST /api/jobs/:job_id/cancel
router.post('/:job_id/cancel', (req, res) => {
  try {
    const job = db.get('SELECT * FROM jobs WHERE id = ? OR job_id = ?', req.params.job_id, req.params.job_id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status === 'completed' || job.status === 'cancelled') {
      return res.status(400).json({ error: `Cannot cancel job with status: ${job.status}` });
    }

    const now = new Date().toISOString();
    db.run(
      `UPDATE jobs SET status = 'cancelled', completed_at = ? WHERE id = ?`,
      now, job.id
    );

    const updated = db.get('SELECT * FROM jobs WHERE id = ?', job.id);
    res.json({ success: true, job: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// POST /api/jobs/:job_id/progress — Daemon reports execution phase (downloading, loading, generating)
router.post('/:job_id/progress', (req, res) => {
  try {
    const { api_key, phase } = req.body;
    if (!api_key || !phase) return res.status(400).json({ error: 'api_key and phase required' });

    const provider = db.get('SELECT id FROM providers WHERE api_key = ?', api_key);
    if (!provider) return res.status(401).json({ error: 'Invalid API key' });

    const job = db.get('SELECT * FROM jobs WHERE (id = ? OR job_id = ?) AND provider_id = ?',
      req.params.job_id, req.params.job_id, provider.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const validPhases = ['downloading_model', 'installing_deps', 'loading_model', 'generating', 'formatting'];
    if (!validPhases.includes(phase)) {
      return res.status(400).json({ error: `Invalid phase. Valid: ${validPhases.join(', ')}` });
    }

    const now = new Date().toISOString();
    db.run('UPDATE jobs SET progress_phase = ?, progress_updated_at = ? WHERE id = ?', phase, now, job.id);
    console.log(`[progress] Job ${job.job_id}: ${phase}`);
    res.json({ success: true, phase });
  } catch (error) {
    console.error('Job progress error:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// GET /api/jobs/:job_id/output — serve job result (image, text, etc.)
// Renter or anyone with the job_id can fetch the output
router.get('/:job_id/output', (req, res) => {
  try {
    const job = db.get('SELECT * FROM jobs WHERE id = ? OR job_id = ?', req.params.job_id, req.params.job_id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Failed/cancelled/timed-out jobs — return 410 Gone with error details
    if (job.status === 'failed' || job.status === 'cancelled') {
      return res.status(410).json({
        status: job.status,
        error: job.error || (job.status === 'cancelled' ? 'Job was cancelled' : 'Job failed'),
        job_id: job.job_id,
        submitted_at: job.submitted_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        progress_phase: job.progress_phase || null,
        refunded: job.refunded_at ? true : false
      });
    }

    if (job.status !== 'completed') {
      // Build phase-aware status message
      const phaseMessages = {
        'downloading_model': 'Downloading model weights...',
        'installing_deps': 'Installing dependencies...',
        'loading_model': 'Loading model onto GPU...',
        'generating': 'Generating response...',
        'formatting': 'Formatting output...',
      };
      const message = (job.progress_phase && phaseMessages[job.progress_phase])
        ? phaseMessages[job.progress_phase]
        : (job.status === 'running' ? 'Job running...' : `Job status: ${job.status}`);

      return res.status(202).json({
        status: job.status,
        message,
        progress_phase: job.progress_phase || null,
        job_id: job.job_id,
        submitted_at: job.submitted_at,
        started_at: job.started_at,
        progress_updated_at: job.progress_updated_at || null,
        timeout_at: job.timeout_at || null,
        cost_halala: job.cost_halala || 0
      });
    }

    if (!job.result) {
      return res.status(204).json({ error: 'Job completed but no output data' });
    }

    // Try to parse structured DC1_RESULT_JSON from the result
    let structured = null;
    // Match the DC1_RESULT_JSON marker — greedy to capture the full JSON object
    const jsonMatch = job.result.match(/DC1_RESULT_JSON:({[\s\S]+})\s*$/);
    if (jsonMatch) {
      try {
        structured = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.warn(`Job ${job.job_id} DC1_RESULT_JSON parse failed: ${e.message} (length: ${jsonMatch[1].length})`);
      }
    }

    // If structured image result, serve as image or JSON based on Accept header
    if (structured && structured.type === 'image' && structured.data) {
      // Base64 integrity validation — catch truncated images early
      const b64 = structured.data;
      const b64clean = b64.replace(/[\s\r\n]/g, '');
      const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(b64clean);
      const expectedMinBytes = (structured.width || 256) * (structured.height || 256) * 0.05; // ~5% of raw size minimum for compressed PNG
      const actualBytes = Math.floor(b64clean.length * 3 / 4);
      const isTruncated = !isValidBase64 || actualBytes < expectedMinBytes;

      if (isTruncated) {
        return res.status(206).json({
          error: 'Image data appears truncated or corrupted',
          type: 'image',
          expected_dimensions: `${structured.width}x${structured.height}`,
          base64_length: b64clean.length,
          decoded_bytes: actualBytes,
          expected_min_bytes: Math.round(expectedMinBytes),
          valid_base64: isValidBase64,
          hint: 'The provider daemon may have truncated stdout. Ensure daemon version >= 3.1.0',
          billing: {
            actual_cost_halala: job.actual_cost_halala,
            actual_cost_sar: job.actual_cost_halala ? (job.actual_cost_halala / 100).toFixed(2) : null
          }
        });
      }

      const wantsJson = (req.headers.accept || '').includes('application/json');
      if (wantsJson) {
        return res.json({
          type: 'image',
          format: structured.format || 'png',
          width: structured.width,
          height: structured.height,
          prompt: structured.prompt,
          model: structured.model,
          seed: structured.seed,
          gen_time_s: structured.gen_time_s,
          total_time_s: structured.total_time_s,
          device: structured.device,
          image_base64: structured.data,
          image_bytes: actualBytes,
          billing: {
            actual_cost_halala: job.actual_cost_halala,
            actual_cost_sar: job.actual_cost_halala ? (job.actual_cost_halala / 100).toFixed(2) : null
          }
        });
      }
      // Serve raw image
      const imgBuf = Buffer.from(structured.data, 'base64');
      res.set('Content-Type', `image/${structured.format || 'png'}`);
      res.set('Content-Length', imgBuf.length);
      res.set('X-DC1-Prompt', structured.prompt?.substring(0, 200));
      res.set('X-DC1-Seed', String(structured.seed || ''));
      res.set('X-DC1-GenTime', String(structured.gen_time_s || ''));
      res.set('X-DC1-ImageBytes', String(actualBytes));
      return res.send(imgBuf);
    }

    // If structured text result
    if (structured && structured.type === 'text') {
      return res.json({
        type: 'text',
        prompt: structured.prompt,
        response: structured.response,
        model: structured.model,
        tokens_generated: structured.tokens_generated,
        tokens_per_second: structured.tokens_per_second,
        gen_time_s: structured.gen_time_s,
        total_time_s: structured.total_time_s,
        device: structured.device,
        billing: {
          actual_cost_halala: job.actual_cost_halala,
          actual_cost_sar: job.actual_cost_halala ? (job.actual_cost_halala / 100).toFixed(2) : null
        }
      });
    }

    // Fallback: raw text result
    res.json({
      type: 'text',
      result: job.result,
      billing: {
        actual_cost_halala: job.actual_cost_halala,
        actual_cost_sar: job.actual_cost_halala ? (job.actual_cost_halala / 100).toFixed(2) : null
      }
    });
  } catch (error) {
    console.error('Job output error:', error);
    res.status(500).json({ error: 'Failed to fetch job output' });
  }
});

// Timeout enforcement — called by recovery engine every 30s
function enforceJobTimeouts() {
  try {
    const now = new Date().toISOString();
    const timedOut = db.all(
      `SELECT * FROM jobs WHERE status = 'running' AND timeout_at IS NOT NULL AND datetime(replace(timeout_at, 'T', ' ')) < datetime(replace(?, 'T', ' '))`,
      now
    );

    for (const job of timedOut) {
      db.run(
        `UPDATE jobs SET status = 'failed', error = 'Job timed out — provider may be offline or model too large', completed_at = ? WHERE id = ?`,
        now, job.id
      );
      // Refund renter for timed-out jobs
      if (job.renter_id && job.cost_halala > 0) {
        try {
          db.run('UPDATE renters SET balance_halala = balance_halala + ? WHERE id = ?', job.cost_halala, job.renter_id);
          db.run('UPDATE jobs SET refunded_at = ? WHERE id = ?', now, job.id);
          console.log(`[timeout] Refunded ${job.cost_halala} halala to renter ${job.renter_id} for job ${job.job_id}`);
        } catch(e) { console.error('[timeout] Refund error:', e); }
      }
      console.log(`[timeout] Job ${job.job_id} timed out (provider ${job.provider_id})`);
    }

    return timedOut.length;
  } catch (error) {
    console.error('[timeout] Enforcement error:', error);
    return 0;
  }
}

// ============================================================================
// POST /api/jobs/test - Admin creates test benchmark job for a provider
// ============================================================================
router.post('/test', (req, res) => {
  try {
    const adminToken = req.headers['x-admin-token'];
    const expectedToken = process.env.DC1_ADMIN_TOKEN;
    if (expectedToken && adminToken !== expectedToken) {
      return res.status(403).json({ error: 'Admin token required' });
    }

    const { provider_id, matrix_size, iterations } = req.body;
    if (!provider_id) return res.status(400).json({ error: 'provider_id required' });

    // Verify provider exists and is online
    const provider = db.get('SELECT id, status, readiness_status FROM providers WHERE id = ?', provider_id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const job_id = 'test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const taskSpec = JSON.stringify({
      benchmark: 'matmul',
      matrix_size: matrix_size || 4096,
      iterations: iterations || 5
    });
    const taskSpecHmac = signTaskSpec(taskSpec);
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO jobs (job_id, provider_id, job_type, status, task_spec, task_spec_hmac, gpu_requirements, duration_minutes, max_duration_seconds, submitted_at, created_at)
       VALUES (?, ?, 'benchmark', 'pending', ?, ?, '{}', 5, 300, ?, ?)`,
      job_id, provider_id, taskSpec, taskSpecHmac, now, now
    );

    res.json({
      success: true,
      job: { job_id, provider_id, status: 'pending', task_spec: JSON.parse(taskSpec) },
      message: `Test job created. Daemon will pick it up on next poll.`
    });
  } catch (error) {
    console.error('Test job creation error:', error);
    res.status(500).json({ error: 'Test job creation failed' });
  }
});

module.exports = router;
module.exports.calculateCostHalala = calculateCostHalala;
module.exports.COST_RATES = COST_RATES;
module.exports.enforceJobTimeouts = enforceJobTimeouts;
module.exports.signTaskSpec = signTaskSpec;
module.exports.HMAC_SECRET = HMAC_SECRET;
