const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const { publicEndpointLimiter } = require('../middleware/rateLimiter');
const { getApiKeyFromReq } = require('../middleware/auth');
const pricingService = require('../services/pricingService');
const { GPU_RATE_TABLE } = require('../config/pricing');

// Templates are stored as JSON files in /docker-templates at the repo root
const TEMPLATES_DIR = path.join(__dirname, '../../../docker-templates');

// Collect all approved images across all templates (for daemon whitelist)
const APPROVED_IMAGES_EXTRA = [
  'dc1/general-worker:latest',
  'dc1/llm-worker:latest',
  'dc1/sd-worker:latest',
  'dc1/base-worker:latest',
  'pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime',
  'pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime',
  'nvcr.io/nvidia/pytorch:24.01-py3',
  'nvcr.io/nvidia/tensorflow:24.01-tf2-py3',
  'tensorflow/tensorflow:2.15.0-gpu',
];

function loadTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  try {
    return fs.readdirSync(TEMPLATES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
  } catch {
    return [];
  }
}

// Category -> tag mappings for the ?category= filter
const CATEGORY_TAG_MAP = {
  llm:       ['llm', 'inference', 'chat', 'instruct', 'arabic'],
  embedding: ['embedding', 'embed', 'rag'],
  image:     ['image', 'diffusion', 'sdxl', 'stable-diffusion'],
  notebook:  ['notebook', 'jupyter', 'python', 'scientific'],
  training:  ['training', 'finetune', 'lora', 'qlora'],
};

// GET /api/templates -- list all templates (optionally filter by tag or category)
router.get('/', publicEndpointLimiter, (req, res) => {
  const templates = loadTemplates();
  const { tag, category } = req.query;

  let filtered = templates;
  if (tag) {
    filtered = filtered.filter(t => Array.isArray(t.tags) && t.tags.includes(tag));
  }
  if (category) {
    const catKey = String(category).toLowerCase();
    const catTags = CATEGORY_TAG_MAP[catKey];
    if (catTags) {
      filtered = filtered.filter(t =>
        t.category === catKey ||
        (Array.isArray(t.tags) && catTags.some(ct => t.tags.includes(ct)))
      );
    }
  }

  // Strip approved_images from list response; attach floor pricing + derived metadata (DCP-829)
  const safe = filtered.map(({ approved_images: _ai, ...t }) => ({
    ...t,
    arabic_capable: Array.isArray(t.tags) && t.tags.includes('arabic'),
    category: deriveCategory(t),
    pricing: buildTemplatePricing(t),
  }));
  res.json({ templates: safe, count: safe.length });
});

// GET /api/templates/whitelist -- approved Docker image list for daemon validation
router.get('/whitelist', publicEndpointLimiter, (req, res) => {
  const templates = loadTemplates();
  const fromTemplates = templates.flatMap(t => t.approved_images || []);
  const fromImages = templates.map(t => t.image).filter(i => i && i !== 'custom');
  let approvedFromDb = [];
  try {
    approvedFromDb = db.all(
      `SELECT image_ref, resolved_digest
         FROM approved_container_images
        WHERE is_active = 1
        ORDER BY approved_at DESC`
    ).flatMap((row) => {
      const refs = [];
      if (row.image_ref) refs.push(row.image_ref);
      if (row.image_ref && row.resolved_digest) refs.push(`${String(row.image_ref).split('@')[0]}@${row.resolved_digest}`);
      return refs;
    });
  } catch (_) {
    approvedFromDb = [];
  }

  const all = [...new Set([...APPROVED_IMAGES_EXTRA, ...fromImages, ...fromTemplates, ...approvedFromDb])];
  res.json({ approved_images: all });
});

// GET /api/templates/:id -- single template with full detail
router.get('/:id', publicEndpointLimiter, (req, res) => {
  const templates = loadTemplates();
  const template = templates.find(t => t.id === req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  // Strip approved_images from direct response too -- daemon uses /whitelist
  const { approved_images: _ai, ...safe } = template;
  res.json({
    ...safe,
    arabic_capable: Array.isArray(safe.tags) && safe.tags.includes('arabic'),
    category: deriveCategory(safe),
    pricing: buildTemplatePricing(safe),
  });
});

// Derive canonical category string from template tags (DCP-829).
// Returns one of: 'llm' | 'embedding' | 'image' | 'notebook' | 'training' | 'other'
function deriveCategory(template) {
  const tags = Array.isArray(template.tags) ? template.tags : [];
  if (tags.some(t => ['llm', 'inference', 'chat', 'instruct'].includes(t))) return 'llm';
  if (tags.some(t => ['embedding', 'embed', 'rag'].includes(t))) return 'embedding';
  if (tags.some(t => ['image', 'diffusion', 'sdxl', 'stable-diffusion'].includes(t))) return 'image';
  if (tags.some(t => ['notebook', 'jupyter', 'scientific'].includes(t))) return 'notebook';
  if (tags.some(t => ['training', 'finetune', 'lora', 'qlora'].includes(t))) return 'training';
  return 'other';
}

// Pricing sourced from config/pricing.js via pricingService (DCP-762).
function calcDeployCostHalala(jobType, durationMinutes, pricingClass, gpuModel) {
  return pricingService.calculateCostHalala(gpuModel || null, durationMinutes, pricingClass, jobType);
}

// Build pricing display block for a template using its min_vram_gb (DCP-762).
function buildTemplatePricing(template) {
  const minVram = template.min_vram_gb || 0;
  // Find best-fit GPU tier: smallest entry whose min_vram_gb >= template min
  const entry = GPU_RATE_TABLE
    .filter(e => e.models[0] !== 'default' && e.min_vram_gb >= minVram)
    .sort((a, b) => a.min_vram_gb - b.min_vram_gb)[0]
    || GPU_RATE_TABLE[GPU_RATE_TABLE.length - 1];
  const gpuKey = entry.models[0] === 'default' ? null : entry.models[0];
  const rate = pricingService.getRate(gpuKey);
  return {
    price_per_hour_usd: rate.rate_per_hour_usd,
    price_per_hour_sar: rate.rate_per_hour_sar,
    gpu_tier: rate.tier,
    gpu_display_name: rate.display_name,
    competitor_prices: rate.competitor_prices,
    savings_pct: rate.savings_pct,
  };
}

// Find best idle provider matching minVramGb. Returns provider row or null.
function findAvailableProvider(minVramGb) {
  const minVramMib = (minVramGb || 0) * 1024;
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  return db.get(
    `SELECT id, name, gpu_model, vram_gb, gpu_vram_mib FROM providers
     WHERE status IN ('active', 'online')
       AND last_heartbeat >= ?
       AND COALESCE(gpu_vram_mib, vram_gb * 1024, 0) >= ?
       AND NOT EXISTS (
         SELECT 1 FROM jobs j
         WHERE j.provider_id = providers.id
           AND j.status IN ('assigned', 'pulling', 'running', 'pending')
       )
     ORDER BY last_heartbeat DESC
     LIMIT 1`,
    tenMinAgo,
    minVramMib
  );
}

// POST /api/templates/:id/deploy -- one-click deploy; requires renter auth
// Body: { duration_minutes?, pricing_class?, params? }
// Returns 201: { jobId, status, estimatedStart, gpuTier, totalCost, template, provider, message }
// Errors: 401 no auth | 403 invalid key | 402 insufficient balance | 404 not found | 503 no GPU
router.post('/:id/deploy', publicEndpointLimiter, (req, res) => {
  try {
    // 1. Authenticate renter
    const key = getApiKeyFromReq(req, {
      headerName: 'x-renter-key',
      queryNames: ['renter_key', 'key'],
    });
    if (!key) {
      return res.status(401).json({
        error: 'Renter API key required (x-renter-key header or renter_key query)',
      });
    }
    const renter = db.get('SELECT * FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) {
      return res.status(403).json({ error: 'Invalid or inactive renter API key' });
    }

    // 2. Validate template
    const templates = loadTemplates();
    const template = templates.find(t => t.id === req.params.id);
    if (!template) {
      return res.status(404).json({ error: `Template '${req.params.id}' not found` });
    }

    // 3. Parse and validate request body
    const rawDuration = req.body.duration_minutes;
    const duration_minutes = rawDuration !== undefined ? Number(rawDuration) : 60;
    if (!Number.isFinite(duration_minutes) || duration_minutes <= 0 || duration_minutes > 1440) {
      return res.status(400).json({ error: 'duration_minutes must be between 1 and 1440' });
    }
    const { PRICING_CLASS_MULTIPLIERS } = require('../config/pricing');
    const pricing_class = PRICING_CLASS_MULTIPLIERS[req.body.pricing_class] !== undefined
      ? req.body.pricing_class
      : 'standard';
    const extraParams = (req.body.params && typeof req.body.params === 'object') ? req.body.params : {};

    // 4. Calculate estimated cost using template's min_vram_gb for tier selection (DCP-762)
    // gpuModel resolved after provider lookup in step 6; recalculated then for snapshot accuracy.
    const cost_halala = calcDeployCostHalala(template.job_type, duration_minutes, pricing_class, null);

    // 5. Balance checks
    if (renter.balance_halala <= 0) {
      return res.status(402).json({
        error: 'Balance is zero. Please top up your wallet before deploying.',
        balance_halala: renter.balance_halala,
        required_halala: cost_halala,
      });
    }
    if (renter.balance_halala < cost_halala) {
      return res.status(402).json({
        error: 'Insufficient balance',
        balance_halala: renter.balance_halala,
        required_halala: cost_halala,
        shortfall_halala: cost_halala - renter.balance_halala,
        message: `Top up at least ${Math.ceil((cost_halala - renter.balance_halala) / 100)} SAR to deploy this template. POST /api/renters/topup`,
      });
    }

    // 6. Find an available GPU provider matching template VRAM requirements
    const provider = findAvailableProvider(template.min_vram_gb || 0);
    if (!provider) {
      return res.status(503).json({
        error: 'No GPU provider currently available for this template',
        required_vram_gb: template.min_vram_gb || 0,
        hint: 'Retry shortly or use POST /api/jobs/submit with queued fallback.',
      });
    }

    // 7. Create job record (deduct balance atomically)
    const now = new Date().toISOString();
    const job_id = 'job-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
    const containerSpec = JSON.stringify({
      image_override: (template.image && template.image !== 'custom') ? template.image : undefined,
      pricing_class,
    });
    const taskSpec = JSON.stringify({
      job_type: template.job_type,
      template_id: template.id,
      params: { ...((template.params) || {}), ...extraParams },
    });
    const gpuReqs = template.min_vram_gb ? JSON.stringify({ min_vram_gb: template.min_vram_gb }) : null;
    const timeoutSec = 1800;
    const timeoutAt = new Date(Date.now() + timeoutSec * 1000).toISOString();

    // Build rate snapshot using provider's actual gpu_model (DCP-762)
    const gpuRateSnapshot = pricingService.estimateCost(
      provider.gpu_model || null, duration_minutes * 60, pricing_class, template.job_type
    ).gpu_rate_snapshot;
    const gpuRateSnapshotJson = gpuRateSnapshot ? JSON.stringify(gpuRateSnapshot) : null;

    const JOB_COLS = new Set((db.all("PRAGMA table_info('jobs')") || []).map(r => r.name));
    const hasTemplateId = JOB_COLS.has('template_id');
    const hasGpuRateSnapshot = JOB_COLS.has('gpu_rate_snapshot');

    const insertSql = hasTemplateId
      ? `INSERT INTO jobs
           (job_id, provider_id, renter_id, job_type, status, submitted_at,
            duration_minutes, cost_halala, gpu_requirements, container_spec, task_spec,
            max_duration_seconds, timeout_at, created_at, priority, pricing_class,
            prewarm_requested, workspace_volume_name, checkpoint_enabled, template_id
            ${hasGpuRateSnapshot ? ', gpu_rate_snapshot' : ''})
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?${hasGpuRateSnapshot ? ',?' : ''})`
      : `INSERT INTO jobs
           (job_id, provider_id, renter_id, job_type, status, submitted_at,
            duration_minutes, cost_halala, gpu_requirements, container_spec, task_spec,
            max_duration_seconds, timeout_at, created_at, priority, pricing_class,
            prewarm_requested, workspace_volume_name, checkpoint_enabled
            ${hasGpuRateSnapshot ? ', gpu_rate_snapshot' : ''})
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?${hasGpuRateSnapshot ? ',?' : ''})`;

    const insertVals = [
      job_id, provider.id, renter.id, template.job_type, 'pending', now,
      duration_minutes, cost_halala, gpuReqs, containerSpec, taskSpec,
      timeoutSec, timeoutAt, now, 2, pricing_class,
      0, `dcp-job-${job_id}`, 0,
      ...(hasTemplateId ? [template.id] : []),
      ...(hasGpuRateSnapshot ? [gpuRateSnapshotJson] : []),
    ];

    const doInsert = () => {
      db.prepare('UPDATE renters SET balance_halala = balance_halala - ?, updated_at = ? WHERE id = ?')
        .run(cost_halala, now, renter.id);
      const result = db.prepare(insertSql).run(insertVals);
      db.prepare('UPDATE renters SET total_jobs = total_jobs + 1, updated_at = ? WHERE id = ?')
        .run(now, renter.id);
      return result.lastInsertRowid;
    };

    if (typeof db._db?.transaction === 'function') {
      db._db.transaction(doInsert)();
    } else {
      doInsert();
    }

    // 8. Build response
    const gpuTier = provider.gpu_model
      || (Math.round((provider.gpu_vram_mib || (provider.vram_gb || 0) * 1024) / 1024) + 'GB GPU');
    const estimatedStart = new Date(Date.now() + 30 * 1000).toISOString();

    return res.status(201).json({
      jobId: job_id,
      status: 'pending',
      estimatedStart,
      gpuTier,
      totalCost: {
        halala: cost_halala,
        sar: (cost_halala / 100).toFixed(2),
      },
      template: { id: template.id, name: template.name },
      provider: { id: provider.id, name: provider.name },
      message: `Job created and assigned to provider "${provider.name}". Expected start in ~30 seconds.`,
    });
  } catch (err) {
    console.error('[templates/deploy] error:', err.message, err.stack);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
