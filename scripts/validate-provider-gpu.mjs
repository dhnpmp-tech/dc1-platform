#!/usr/bin/env node

/**
 * Provider GPU Validation Script
 *
 * Validates provider GPU specifications against DCP requirements.
 * Checks: GPU model, VRAM, CUDA version.
 * Assigns provider tier based on GPU capabilities.
 *
 * Requirements per GPU model:
 * - Tier A (ALLaM, Falcon, Qwen, Llama, Mistral): RTX 4090 (24GB), H100+
 * - Tier B (JAIS, SDXL): RTX 4080 (16GB)
 * - Tier C: RTX 4070+ (8GB+)
 *
 * Used by provider onboarding CLI to auto-assign tier.
 *
 * Usage:
 *   node scripts/validate-provider-gpu.mjs
 *
 * Returns JSON with:
 *   - gpu_model: detected GPU model
 *   - vram_gb: total VRAM in GB
 *   - cuda_version: CUDA version
 *   - tier: recommended tier (A/B/C)
 *   - validation: PASS/FAIL
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(__dirname);
const PORTFOLIO_PATH = path.join(REPO_ROOT, 'infra', 'config', 'arabic-portfolio.json');

/**
 * Get GPU model name
 */
async function getGpuModel() {
  try {
    const { stdout } = await execAsync('nvidia-smi --query-gpu=name --format=csv,noheader | head -1');
    return stdout.trim();
  } catch (error) {
    throw new Error(`Failed to query GPU model: ${error.message}`);
  }
}

/**
 * Get GPU VRAM in GB
 */
async function getGpuVram() {
  try {
    const { stdout } = await execAsync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1');
    const vramMb = parseInt(stdout.trim(), 10);
    return vramMb / 1024; // Convert MB to GB
  } catch (error) {
    throw new Error(`Failed to query GPU VRAM: ${error.message}`);
  }
}

/**
 * Get CUDA version
 */
async function getCudaVersion() {
  try {
    const { stdout } = await execAsync('nvidia-smi --query-gpu=compute_cap --format=csv,noheader | head -1');
    return stdout.trim();
  } catch (error) {
    // CUDA version not critical; return unknown
    return 'unknown';
  }
}

/**
 * Determine GPU tier based on model and VRAM
 */
function determineGpuTier(gpuModel, vramGb) {
  const model = gpuModel.toUpperCase();

  // Map of GPU model patterns to tier
  const tierMap = {
    'H100': { tier: 'A', minVram: 80 },
    'H200': { tier: 'A', minVram: 120 },
    'MI300X': { tier: 'A', minVram: 192 },
    'A100': { tier: 'A', minVram: 40 },
    'RTX 4090': { tier: 'A', minVram: 20 },
    'RTX 4080': { tier: 'B', minVram: 12 },
    'RTX A6000': { tier: 'B', minVram: 48 },
    'L40S': { tier: 'B', minVram: 48 },
    'RTX 3090': { tier: 'C', minVram: 20 },
    'RTX 4070': { tier: 'C', minVram: 10 },
    'RTX A5000': { tier: 'B', minVram: 24 },
    'A10': { tier: 'C', minVram: 24 },
  };

  // Check against known GPUs
  for (const [pattern, config] of Object.entries(tierMap)) {
    if (model.includes(pattern)) {
      // Verify VRAM meets minimum
      if (vramGb >= config.minVram) {
        return {
          tier: config.tier,
          matched: pattern,
          reason: `Matched ${pattern}, VRAM ${vramGb}GB >= ${config.minVram}GB`,
        };
      } else {
        return {
          tier: null,
          matched: pattern,
          reason: `Matched ${pattern}, but VRAM ${vramGb}GB < ${config.minVram}GB minimum`,
        };
      }
    }
  }

  // Fallback: estimate tier based on VRAM only
  if (vramGb >= 20) {
    return { tier: 'B', matched: null, reason: `Unknown GPU with ${vramGb}GB VRAM >= 20GB` };
  } else if (vramGb >= 10) {
    return { tier: 'C', matched: null, reason: `Unknown GPU with ${vramGb}GB VRAM >= 10GB` };
  } else {
    return { tier: null, matched: null, reason: `Unknown GPU with insufficient VRAM: ${vramGb}GB` };
  }
}

/**
 * Load model requirements from portfolio
 */
function loadModelRequirements() {
  try {
    const content = fs.readFileSync(PORTFOLIO_PATH, 'utf-8');
    const portfolio = JSON.parse(content);

    const requirements = {};
    for (const [tierName, models] of Object.entries(portfolio.tiers)) {
      for (const model of models) {
        requirements[model.id] = {
          tier: tierName.replace('tier_', '').toUpperCase(),
          min_vram_gb: model.min_vram_gb,
          recommended_vram_gb: model.recommended_vram_gb,
        };
      }
    }

    return requirements;
  } catch (error) {
    console.warn(`Warning: Could not load portfolio: ${error.message}`);
    return {};
  }
}

/**
 * Validate GPU against all model requirements
 */
function validateAgainstModels(gpuTier, vramGb, modelRequirements) {
  if (!gpuTier) {
    return { compatible_models: [], incompatible_models: [] };
  }

  const compatible = [];
  const incompatible = [];

  for (const [modelId, req] of Object.entries(modelRequirements)) {
    if (vramGb >= req.min_vram_gb) {
      compatible.push(modelId);
    } else {
      incompatible.push({ modelId, requires: req.min_vram_gb, available: vramGb });
    }
  }

  return { compatible_models: compatible, incompatible_models: incompatible };
}

/**
 * Run validation
 */
async function validateGpu() {
  console.log('\n=== GPU Validation ===');

  try {
    // Collect GPU info
    const [gpuModel, vramGb, cudaVersion] = await Promise.all([
      getGpuModel(),
      getGpuVram(),
      getCudaVersion(),
    ]);

    console.log(`GPU Model: ${gpuModel}`);
    console.log(`VRAM: ${vramGb}GB`);
    console.log(`CUDA Version: ${cudaVersion}`);

    // Determine tier
    const tierInfo = determineGpuTier(gpuModel, vramGb);
    const validation = tierInfo.tier ? 'PASS' : 'FAIL';

    // Load model requirements
    const modelRequirements = loadModelRequirements();
    const compatibility = validateAgainstModels(tierInfo.tier, vramGb, modelRequirements);

    const result = {
      timestamp: new Date().toISOString(),
      gpu: {
        model: gpuModel,
        vram_gb: vramGb,
        cuda_version: cudaVersion,
      },
      validation: validation,
      tier: tierInfo.tier,
      tier_reason: tierInfo.reason,
      tier_matched: tierInfo.matched,
      compatibility: compatibility,
    };

    console.log(`\nResult: ${validation}`);
    if (tierInfo.tier) {
      console.log(`Recommended Tier: ${tierInfo.tier}`);
      console.log(`Reason: ${tierInfo.reason}`);
      console.log(`Compatible Models: ${compatibility.compatible_models.length}`);
      if (compatibility.incompatible_models.length > 0) {
        console.log(`Incompatible Models: ${compatibility.incompatible_models.length}`);
        for (const incomp of compatibility.incompatible_models.slice(0, 3)) {
          console.log(`  - ${incomp.modelId} (needs ${incomp.requires}GB, have ${incomp.available}GB)`);
        }
      }
    } else {
      console.log(`Reason: ${tierInfo.reason}`);
    }

    console.log('\n=== Result (JSON) ===');
    console.log(JSON.stringify(result, null, 2));

    // Exit with appropriate code
    process.exit(validation === 'PASS' ? 0 : 1);
  } catch (error) {
    console.error(`\nValidation Error: ${error.message}`);
    console.error('Make sure nvidia-smi is installed and GPU is available');

    const result = {
      timestamp: new Date().toISOString(),
      validation: 'ERROR',
      error: error.message,
    };

    console.log('\n=== Result (JSON) ===');
    console.log(JSON.stringify(result, null, 2));

    process.exit(2);
  }
}

validateGpu();
