#!/usr/bin/env node
/**
 * seed-arabic-models.mjs — Model Registry DB Seed (Sprint 27, DCP-671)
 *
 * Seeds all models from infra/config/arabic-portfolio.json into the
 * model_registry and cost_rates tables using INSERT OR IGNORE so existing
 * records are preserved.
 *
 * Usage (run from repo root using the backend's node_modules):
 *   node scripts/seed-arabic-models.mjs
 *   # or with explicit DB path:
 *   DC1_DB_PATH=/path/to/providers.db node scripts/seed-arabic-models.mjs
 *
 * NOTE: better-sqlite3 is a native module compiled for the backend's Node.js
 * version. If you get ERR_DLOPEN_FAILED, run:
 *   cd backend && npm rebuild better-sqlite3 && cd ..
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
// Resolve better-sqlite3 from the backend package where it is installed
const Database = require(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'backend', 'node_modules', 'better-sqlite3')
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const DB_PATH = process.env.DC1_DB_PATH
  || path.join(REPO_ROOT, 'backend', 'data', 'providers.db');

const PORTFOLIO_FILE = process.env.DCP_ARABIC_PORTFOLIO_FILE
  || path.join(REPO_ROOT, 'infra', 'config', 'arabic-portfolio.json');

// ─── MODEL DEFINITIONS ───────────────────────────────────────────────────────
// Enrichment metadata for each portfolio model (mapped by repo path).
// Fields match the model_registry schema in backend/src/db.js.
const MODEL_META = {
  'ALLaM-AI/ALLaM-7B-Instruct-preview': {
    display_name: 'ALLaM 7B Instruct',
    family: 'allam',
    vram_gb: 24,
    quantization: 'bf16',
    context_window: 8192,
    use_cases: ['arabic', 'chat', 'enterprise'],
    min_gpu_vram_gb: 24,
    default_price_halala_per_min: 22,
    token_rate_halala: 3,
  },
  'tiiuae/Falcon-H1-7B-Instruct': {
    display_name: 'Falcon H1 7B Instruct',
    family: 'falcon',
    vram_gb: 24,
    quantization: 'bf16',
    context_window: 8192,
    use_cases: ['arabic', 'chat', 'reasoning'],
    min_gpu_vram_gb: 24,
    default_price_halala_per_min: 20,
    token_rate_halala: 3,
  },
  'Qwen/Qwen2.5-7B-Instruct': {
    display_name: 'Qwen 2.5 7B Instruct',
    family: 'qwen',
    vram_gb: 16,
    quantization: 'bf16',
    context_window: 32768,
    use_cases: ['chat', 'arabic', 'translation', 'coding'],
    min_gpu_vram_gb: 16,
    default_price_halala_per_min: 16,
    token_rate_halala: 2,
  },
  'meta-llama/Meta-Llama-3-8B-Instruct': {
    display_name: 'LLaMA 3 8B Instruct',
    family: 'llama',
    vram_gb: 16,
    quantization: 'bf16',
    context_window: 8192,
    use_cases: ['chat', 'reasoning'],
    min_gpu_vram_gb: 16,
    default_price_halala_per_min: 17,
    token_rate_halala: 3,
  },
  'mistralai/Mistral-7B-Instruct-v0.2': {
    display_name: 'Mistral 7B Instruct',
    family: 'mistral',
    vram_gb: 14,
    quantization: 'bf16',
    context_window: 32768,
    use_cases: ['chat', 'coding', 'arabic'],
    min_gpu_vram_gb: 16,
    default_price_halala_per_min: 15,
    token_rate_halala: 2,
  },
  'nvidia/Nemotron-Mini-4B-Instruct': {
    display_name: 'Nemotron Nano 4B Instruct',
    family: 'nemotron',
    vram_gb: 8,
    quantization: 'bf16',
    context_window: 4096,
    use_cases: ['chat', 'coding', 'edge'],
    min_gpu_vram_gb: 8,
    default_price_halala_per_min: 10,
    token_rate_halala: 1,
  },
  'inceptionai/jais-13b-chat': {
    display_name: 'JAIS 13B Chat',
    family: 'jais',
    vram_gb: 24,
    quantization: 'bf16',
    context_window: 4096,
    use_cases: ['arabic', 'chat', 'enterprise'],
    min_gpu_vram_gb: 24,
    default_price_halala_per_min: 27,
    token_rate_halala: 4,
  },
  'BAAI/bge-m3': {
    display_name: 'BGE M3 Embeddings',
    family: 'embedding',
    vram_gb: 8,
    quantization: 'fp16',
    context_window: 8192,
    use_cases: ['embedding', 'rag', 'retrieval'],
    min_gpu_vram_gb: 8,
    default_price_halala_per_min: 12,
    token_rate_halala: 1,
  },
  'BAAI/bge-reranker-v2-m3': {
    display_name: 'BGE Reranker v2 M3',
    family: 'reranker',
    vram_gb: 8,
    quantization: 'fp16',
    context_window: 4096,
    use_cases: ['reranking', 'rag', 'search'],
    min_gpu_vram_gb: 8,
    default_price_halala_per_min: 14,
    token_rate_halala: 1,
  },
  'stabilityai/stable-diffusion-xl-base-1.0': {
    display_name: 'Stable Diffusion XL Base 1.0',
    family: 'diffusion',
    vram_gb: 16,
    quantization: 'fp16',
    context_window: 2048,
    use_cases: ['image-generation', 'creative', 'marketing'],
    min_gpu_vram_gb: 16,
    default_price_halala_per_min: 30,
    token_rate_halala: 2,
  },
  'nvidia/Llama-3.1-Nemotron-70B-Instruct-HF': {
    display_name: 'Nemotron Super 70B Instruct',
    family: 'nemotron',
    vram_gb: 80,
    quantization: 'bf16',
    context_window: 131072,
    use_cases: ['chat', 'reasoning', 'coding', 'enterprise'],
    min_gpu_vram_gb: 80,
    default_price_halala_per_min: 90,
    token_rate_halala: 10,
  },
  'Qwen/Qwen2-72B-Instruct': {
    display_name: 'Qwen 2 72B Instruct',
    family: 'qwen',
    vram_gb: 80,
    quantization: 'bf16',
    context_window: 32768,
    use_cases: ['chat', 'arabic', 'reasoning', 'translation'],
    min_gpu_vram_gb: 80,
    default_price_halala_per_min: 85,
    token_rate_halala: 10,
  },
  'meta-llama/Meta-Llama-3-70B-Instruct': {
    display_name: 'LLaMA 3 70B Instruct',
    family: 'llama',
    vram_gb: 80,
    quantization: 'bf16',
    context_window: 8192,
    use_cases: ['chat', 'reasoning', 'coding'],
    min_gpu_vram_gb: 80,
    default_price_halala_per_min: 85,
    token_rate_halala: 10,
  },
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`ERROR: Database not found at ${DB_PATH}`);
    console.error('Set DC1_DB_PATH env var or start the backend once to create the DB.');
    process.exit(1);
  }

  if (!fs.existsSync(PORTFOLIO_FILE)) {
    console.error(`ERROR: Portfolio file not found at ${PORTFOLIO_FILE}`);
    process.exit(1);
  }

  const portfolio = JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf8'));
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const now = new Date().toISOString();
  let seeded = 0;
  let skipped = 0;
  let costRatesAdded = 0;

  const insertModel = db.prepare(`
    INSERT OR IGNORE INTO model_registry
      (model_id, display_name, family, vram_gb, quantization, context_window,
       use_cases, min_gpu_vram_gb, default_price_halala_per_min, is_active,
       prewarm_class, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const insertCostRate = db.prepare(`
    INSERT OR IGNORE INTO cost_rates (model, token_rate_halala, is_active, created_at)
    VALUES (?, ?, 1, ?)
  `);

  const updatePrewarm = db.prepare(`
    UPDATE model_registry SET prewarm_class = ?, updated_at = ?
    WHERE model_id = ? AND (prewarm_class IS NULL OR prewarm_class = 'warm')
  `);

  const seedTx = db.transaction(() => {
    for (const [tierName, entries] of Object.entries(portfolio.tiers || {})) {
      if (!Array.isArray(entries)) continue;

      for (const entry of entries) {
        const repo = entry.repo;
        const prewarmClass = entry.prewarm_class || 'warm';
        const meta = MODEL_META[repo];

        if (!meta) {
          console.warn(`  [SKIP] No metadata defined for ${repo} — add to MODEL_META`);
          skipped++;
          continue;
        }

        const result = insertModel.run(
          repo,
          meta.display_name,
          meta.family,
          meta.vram_gb,
          meta.quantization,
          meta.context_window,
          JSON.stringify(meta.use_cases),
          meta.min_gpu_vram_gb,
          meta.default_price_halala_per_min,
          prewarmClass,
          now
        );

        if (result.changes > 0) {
          console.log(`  [SEED] model_registry: ${repo} (${meta.display_name}, ${tierName})`);
          seeded++;
        } else {
          // Model already exists — ensure prewarm_class is set from portfolio
          updatePrewarm.run(prewarmClass, now, repo);
          console.log(`  [SKIP] model_registry: ${repo} — already exists`);
          skipped++;
        }

        // Seed cost_rates for per-token billing
        const rateResult = insertCostRate.run(repo, meta.token_rate_halala, now);
        if (rateResult.changes > 0) {
          console.log(`  [SEED] cost_rates: ${repo} @ ${meta.token_rate_halala} halala/token`);
          costRatesAdded++;
        }
      }
    }
  });

  console.log('\nDCP Arabic Portfolio Seed Script');
  console.log(`DB: ${DB_PATH}`);
  console.log(`Portfolio: ${PORTFOLIO_FILE}`);
  console.log(`Timestamp: ${now}`);
  console.log('');

  seedTx();

  db.close();

  console.log('');
  console.log('=== SEED COMPLETE ===');
  console.log(`  model_registry: ${seeded} inserted, ${skipped} skipped/existing`);
  console.log(`  cost_rates:     ${costRatesAdded} inserted`);
  console.log('');
  console.log('Verify with: GET /api/models');
}

main();
