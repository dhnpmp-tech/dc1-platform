'use strict';
/**
 * Arabic RAG-as-a-Service Pipeline API (DCP-834)
 *
 * One-click bundle: BGE-M3 embeddings + BGE reranker + ALLaM/JAIS generation.
 * Registered at: /api/templates/arabic-rag
 *
 * Routes:
 *   POST /deploy          — deploy the full 3-model RAG stack as a pipeline job
 *   GET  /status/:jobId   — check pipeline health for a specific deployment job
 *   POST /ingest          — embed documents into a named collection (delegated to ragRouter)
 *   POST /query           — RAG query: embed → retrieve → rerank → generate (delegated to ragRouter)
 *   GET  /status          — overall pipeline availability (delegated to ragRouter)
 */

const express  = require('express');
const crypto   = require('crypto');
const db       = require('../db');
const { publicEndpointLimiter, authenticatedEndpointLimiter } = require('../middleware/rateLimiter');
const { getApiKeyFromReq } = require('../middleware/auth');
const pricingService = require('../services/pricingService');

const router    = express.Router();
const ragRouter = require('./rag');

// ── Constants ─────────────────────────────────────────────────────────────

const ARABIC_RAG_TEMPLATE_ID = 'arabic-rag-complete';
const PIPELINE_JOB_TYPE      = 'rag-pipeline';
const MIN_VRAM_GB            = 24;   // RTX 4090 minimum for all 3 containers
const DEFAULT_DURATION_MIN   = 60;
const COMPONENT_PORTS        = { embed: 8001, rerank: 8002, generate: 8003 };
const LLM_MODEL_OPTIONS      = ['allam-7b-instruct', 'jais-13b-chat'];

// ── Helpers ───────────────────────────────────────────────────────────────

/** Extract renter API key from request headers / query. */
function getRenterKey(req) {
  return getApiKeyFromReq(req, {
    headerName: 'x-renter-key',
    queryNames:  ['renter_key', 'key'],
  });
}

/** Authenticate renter and attach to req.renter. Returns renter row or null. */
function authenticateRenter(req, res) {
  const key = getRenterKey(req);
  if (!key) {
    res.status(401).json({ error: 'Renter API key required (x-renter-key header or ?key=)' });
    return null;
  }
  const renter = db.get(
    `SELECT id, api_key, balance_halala, status FROM renters WHERE api_key = ? AND status = 'active'`,
    key
  );
  if (!renter) {
    res.status(401).json({ error: 'Invalid or inactive renter API key' });
    return null;
  }
  return renter;
}

/**
 * Find the most suitable idle provider with enough VRAM for the full RAG stack.
 * Prefers H100/A100 for production, falls back to RTX 4090.
 */
function findRagProvider() {
  const minVramMib = MIN_VRAM_GB * 1024;
  const tenMinAgo  = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  return db.get(
    `SELECT id, name, gpu_model, vram_gb, gpu_vram_mib, endpoint_url FROM providers
     WHERE status IN ('active', 'online')
       AND last_heartbeat >= ?
       AND COALESCE(gpu_vram_mib, vram_gb * 1024, 0) >= ?
       AND NOT EXISTS (
         SELECT 1 FROM jobs j
         WHERE j.provider_id = providers.id
           AND j.status IN ('assigned', 'pulling', 'running', 'pending')
       )
     ORDER BY
       -- Prefer higher-VRAM providers (H100/A100 first)
       COALESCE(gpu_vram_mib, vram_gb * 1024) DESC,
       last_heartbeat DESC
     LIMIT 1`,
    tenMinAgo,
    minVramMib
  );
}

/** Build the endpoint URLs for the 3 pipeline components. */
function buildPipelineEndpoints(providerEndpoint) {
  if (!providerEndpoint) {
    return {
      embed:    null,
      rerank:   null,
      generate: null,
    };
  }
  const base = providerEndpoint.replace(/\/$/, '');
  return {
    embed:    `${base}:${COMPONENT_PORTS.embed}`,
    rerank:   `${base}:${COMPONENT_PORTS.rerank}`,
    generate: `${base}:${COMPONENT_PORTS.generate}/v1`,
  };
}

/** Check whether all 3 pipeline containers are running for a job. */
function getPipelineContainerStatus(jobId, providerId) {
  try {
    const containers = db.all(
      `SELECT model_id, status FROM provider_containers
       WHERE provider_id = ? AND job_id = ?`,
      providerId,
      jobId
    );
    const byRole = {};
    for (const c of containers) byRole[c.model_id] = c.status;
    return {
      embed:    byRole['bge-m3-embedding']   || 'pending',
      rerank:   byRole['reranker-v2-m3']     || 'pending',
      generate: byRole['allam-7b-instruct']  || byRole['jais-13b-chat'] || 'pending',
    };
  } catch (_) {
    // provider_containers may not exist yet
    return { embed: 'unknown', rerank: 'unknown', generate: 'unknown' };
  }
}

// ── POST /deploy ──────────────────────────────────────────────────────────
/**
 * Deploy the full Arabic RAG pipeline (BGE-M3 + reranker + ALLaM/JAIS).
 *
 * Body:
 *   duration_minutes   — 1–1440, default 60
 *   llm_model          — 'allam-7b-instruct' (default) | 'jais-13b-chat'
 *   collection_id      — optional: pre-created RAG collection to attach
 *
 * Returns 201:
 *   { jobId, status, estimatedStart, provider, gpuTier,
 *     endpoints: { embed, rerank, generate },
 *     totalCost, llm_model, message }
 */
router.post('/deploy', authenticatedEndpointLimiter, (req, res) => {
  try {
    // 1. Authenticate
    const renter = authenticateRenter(req, res);
    if (!renter) return;

    // 2. Parse body
    const rawDuration = req.body?.duration_minutes;
    const durationMin = rawDuration !== undefined ? Number(rawDuration) : DEFAULT_DURATION_MIN;
    if (!Number.isFinite(durationMin) || durationMin < 1 || durationMin > 1440) {
      return res.status(400).json({ error: 'duration_minutes must be between 1 and 1440' });
    }

    const llmModel = LLM_MODEL_OPTIONS.includes(req.body?.llm_model)
      ? req.body.llm_model
      : LLM_MODEL_OPTIONS[0];

    const collectionId = (typeof req.body?.collection_id === 'string' && req.body.collection_id.trim())
      ? req.body.collection_id.trim()
      : null;

    // 3. Estimate cost (RAG pipeline billed as rag-pipeline job type)
    const costHalala = pricingService.calculateCostHalala(null, durationMin, 'standard', PIPELINE_JOB_TYPE);

    // 4. Balance checks
    if (renter.balance_halala <= 0) {
      return res.status(402).json({
        error: 'Balance is zero. Please top up before deploying.',
        balance_halala: renter.balance_halala,
        required_halala: costHalala,
      });
    }
    if (renter.balance_halala < costHalala) {
      return res.status(402).json({
        error: 'Insufficient balance',
        balance_halala: renter.balance_halala,
        required_halala: costHalala,
        shortfall_halala: costHalala - renter.balance_halala,
        message: `Top up at least ${Math.ceil((costHalala - renter.balance_halala) / 100)} SAR. POST /api/renters/topup`,
      });
    }

    // 5. Find available GPU provider with 24 GB+ VRAM
    const provider = findRagProvider();
    if (!provider) {
      return res.status(503).json({
        error: 'No GPU provider available for the Arabic RAG pipeline',
        required_vram_gb: MIN_VRAM_GB,
        hint: 'Retry shortly — an RTX 4090 or higher-tier provider is required.',
      });
    }

    // 6. Create pipeline job
    const now     = new Date().toISOString();
    const jobId   = 'rag-job-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
    const timeoutAt = new Date(Date.now() + 1800 * 1000).toISOString();

    const containerSpec = JSON.stringify({
      pipeline: 'arabic-rag',
      components: [
        { role: 'embed',    model: 'BAAI/bge-m3',              port: COMPONENT_PORTS.embed    },
        { role: 'rerank',   model: 'BAAI/bge-reranker-v2-m3', port: COMPONENT_PORTS.rerank   },
        { role: 'generate', model: llmModel,                   port: COMPONENT_PORTS.generate },
      ],
    });
    const taskSpec = JSON.stringify({
      job_type:    PIPELINE_JOB_TYPE,
      template_id: ARABIC_RAG_TEMPLATE_ID,
      llm_model:   llmModel,
      collection_id: collectionId,
    });
    const gpuReqs = JSON.stringify({ min_vram_gb: MIN_VRAM_GB });

    // Detect schema capabilities (backwards-compat)
    const JOB_COLS = new Set((db.all("PRAGMA table_info('jobs')") || []).map(r => r.name));
    const hasTemplateId     = JOB_COLS.has('template_id');
    const hasGpuRateSnapshot = JOB_COLS.has('gpu_rate_snapshot');

    const gpuRateSnapshot = pricingService.estimateCost(
      provider.gpu_model || null, durationMin * 60, 'standard', PIPELINE_JOB_TYPE
    ).gpu_rate_snapshot;
    const gpuRateSnapshotJson = gpuRateSnapshot ? JSON.stringify(gpuRateSnapshot) : null;

    const insertSql = [
      'INSERT INTO jobs (',
      '  job_id, provider_id, renter_id, job_type, status, submitted_at,',
      '  duration_minutes, cost_halala, gpu_requirements, container_spec, task_spec,',
      '  max_duration_seconds, timeout_at, created_at, priority, pricing_class,',
      '  prewarm_requested, workspace_volume_name, checkpoint_enabled',
      hasTemplateId      ? ', template_id'      : '',
      hasGpuRateSnapshot ? ', gpu_rate_snapshot' : '',
      ') VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?',
      hasTemplateId      ? ',?' : '',
      hasGpuRateSnapshot ? ',?' : '',
      ')',
    ].join('');

    const insertVals = [
      jobId, provider.id, renter.id, PIPELINE_JOB_TYPE, 'pending', now,
      durationMin, costHalala, gpuReqs, containerSpec, taskSpec,
      1800, timeoutAt, now, 2, 'standard', 0,
      `dcp-rag-${jobId}`, 0,
      ...(hasTemplateId      ? [ARABIC_RAG_TEMPLATE_ID]  : []),
      ...(hasGpuRateSnapshot ? [gpuRateSnapshotJson]      : []),
    ];

    const doInsert = () => {
      db.prepare('UPDATE renters SET balance_halala = balance_halala - ?, updated_at = ? WHERE id = ?')
        .run(costHalala, now, renter.id);
      db.prepare(insertSql).run(insertVals);
      db.prepare('UPDATE renters SET total_jobs = total_jobs + 1, updated_at = ? WHERE id = ?')
        .run(now, renter.id);
    };

    if (typeof db._db?.transaction === 'function') {
      db._db.transaction(doInsert)();
    } else {
      doInsert();
    }

    // 7. Build response
    const endpoints      = buildPipelineEndpoints(provider.endpoint_url);
    const gpuTier        = provider.gpu_model
      || (Math.round((provider.gpu_vram_mib || (provider.vram_gb || 0) * 1024) / 1024) + 'GB GPU');
    const estimatedStart = new Date(Date.now() + 30 * 1000).toISOString();

    return res.status(201).json({
      jobId,
      status: 'pending',
      estimatedStart,
      provider: { id: provider.id, name: provider.name },
      gpuTier,
      endpoints,
      llm_model:  llmModel,
      collection_id: collectionId,
      totalCost: {
        halala: costHalala,
        sar:    (costHalala / 100).toFixed(2),
      },
      pipeline: {
        components: ['BGE-M3 (embed)', 'BGE reranker-v2-m3 (rerank)', `${llmModel} (generate)`],
        ports: COMPONENT_PORTS,
      },
      message: `Arabic RAG pipeline deploying on "${provider.name}". ` +
               `3 containers starting — embed:${COMPONENT_PORTS.embed}, ` +
               `rerank:${COMPONENT_PORTS.rerank}, generate:${COMPONENT_PORTS.generate}. ` +
               `Expected ready in ~30-90 seconds.`,
    });
  } catch (err) {
    console.error('[arabic-rag/deploy] error:', err.message, err.stack);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /status/:jobId ────────────────────────────────────────────────────
/**
 * Returns pipeline health for a specific Arabic RAG deployment job.
 *
 * Returns 200: { jobId, status, pipelineHealth, containers, endpoints, age_seconds }
 * Returns 404: job not found or not a rag-pipeline job
 * Returns 401: renter not authenticated
 */
router.get('/status/:jobId', publicEndpointLimiter, (req, res) => {
  try {
    const renter = authenticateRenter(req, res);
    if (!renter) return;

    const { jobId } = req.params;
    const job = db.get(
      `SELECT j.job_id, j.status, j.job_type, j.provider_id, j.submitted_at,
              j.container_spec, j.task_spec, j.duration_minutes, j.cost_halala,
              p.name AS provider_name, p.endpoint_url, p.gpu_model
         FROM jobs j
         LEFT JOIN providers p ON p.id = j.provider_id
        WHERE j.job_id = ? AND j.renter_id = ?`,
      jobId,
      renter.id
    );

    if (!job) {
      return res.status(404).json({ error: `Job '${jobId}' not found or does not belong to this renter` });
    }

    if (job.job_type !== PIPELINE_JOB_TYPE) {
      return res.status(400).json({
        error: `Job '${jobId}' is type '${job.job_type}', not a RAG pipeline job`,
      });
    }

    // Container-level health from provider_containers table (if available)
    const containers = getPipelineContainerStatus(jobId, job.provider_id);
    const allRunning  = Object.values(containers).every(s => s === 'running');
    const anyFailed   = Object.values(containers).some(s => s === 'failed' || s === 'error');

    const pipelineHealth =
      job.status === 'running' && allRunning ? 'healthy'   :
      anyFailed                              ? 'degraded'  :
      job.status === 'failed'                ? 'failed'    :
      job.status === 'done'                  ? 'completed' : 'starting';

    const endpoints    = buildPipelineEndpoints(job.endpoint_url);
    const submittedAt  = new Date(job.submitted_at || 0).getTime();
    const ageSeconds   = Math.round((Date.now() - submittedAt) / 1000);

    let taskSpec = {};
    try { taskSpec = JSON.parse(job.task_spec || '{}'); } catch (_) {}

    return res.json({
      jobId:          job.job_id,
      status:         job.status,
      pipelineHealth,
      containers,
      endpoints,
      llm_model:      taskSpec.llm_model || LLM_MODEL_OPTIONS[0],
      collection_id:  taskSpec.collection_id || null,
      provider: {
        id:        job.provider_id,
        name:      job.provider_name,
        gpu_model: job.gpu_model,
      },
      age_seconds:       ageSeconds,
      duration_minutes:  job.duration_minutes,
      cost: {
        halala: job.cost_halala,
        sar:    (job.cost_halala / 100).toFixed(2),
      },
    });
  } catch (err) {
    console.error('[arabic-rag/status] error:', err.message, err.stack);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Delegate ingest / query / status (pipeline-level) to ragRouter ────────
// POST /ingest, POST /query, GET /status are handled by the existing rag router.
router.use('/', ragRouter);

module.exports = router;
