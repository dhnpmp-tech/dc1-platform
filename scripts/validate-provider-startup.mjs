#!/usr/bin/env node
/**
 * Provider Startup Validation Script
 *
 * Validates GPU readiness and vLLM configuration before provider activation.
 * Checks: GPU detection, Docker, nvidia-container-toolkit, VRAM, network connectivity.
 *
 * Usage:
 *   node scripts/validate-provider-startup.mjs [--model MODEL_ID]
 *
 * Examples:
 *   node scripts/validate-provider-startup.mjs --model allam-7b-instruct
 *   node scripts/validate-provider-startup.mjs
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

// ── Colors ───────────────────────────────────────────────────────────────
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function success(text) {
  return colorize(`✓ ${text}`, 'green');
}

function failure(text) {
  return colorize(`✗ ${text}`, 'red');
}

function warning(text) {
  return colorize(`⚠ ${text}`, 'yellow');
}

function info(text) {
  return colorize(`ℹ ${text}`, 'cyan');
}

// ── Load portfolio config ────────────────────────────────────────────────
let portfolioConfig;
try {
  const configPath = resolve(__dirname, '../infra/config/arabic-portfolio.json');
  const configText = readFileSync(configPath, 'utf-8');
  portfolioConfig = JSON.parse(configText);
} catch (err) {
  console.error(failure(`Failed to load arabic-portfolio.json: ${err.message}`));
  process.exit(1);
}

// Build model catalog with VRAM requirements
const modelCatalog = {};
Object.entries(portfolioConfig.tiers).forEach(([tier, models]) => {
  models.forEach((model) => {
    modelCatalog[model.id] = {
      ...model,
      tier,
    };
  });
});

// ── Utilities ────────────────────────────────────────────────────────────

function exec(cmd, options = {}) {
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options,
    });
    return { success: true, output: output.trim() };
  } catch (err) {
    return { success: false, error: err.message, output: err.stdout?.trim() || '' };
  }
}

function spawn(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  });
  return {
    success: result.status === 0,
    output: result.stdout?.trim() || '',
    error: result.stderr?.trim() || '',
    status: result.status,
  };
}

// ── Check: GPU Detection ──────────────────────────────────────────────────

function checkGPU() {
  console.log(`\n${colorize('1. GPU DETECTION', 'bold')}`);

  const nvidiaResult = spawn('nvidia-smi', ['--query-gpu=index,name,memory.total,driver_version,compute_cap', '--format=csv,noheader,nounits']);

  if (!nvidiaResult.success) {
    console.log(failure('No NVIDIA GPU detected or nvidia-smi not found'));
    return { success: false };
  }

  const gpus = nvidiaResult.output.split('\n').filter(line => line.trim());
  if (gpus.length === 0) {
    console.log(failure('No GPUs found by nvidia-smi'));
    return { success: false };
  }

  console.log(success(`Found ${gpus.length} GPU(s)`));

  const gpuDetails = [];
  gpus.forEach((line) => {
    const [index, name, memoryMB, driverVer, computeCap] = line.split(',').map(s => s.trim());
    const vramGB = Math.round(parseInt(memoryMB) / 1024);
    console.log(`  GPU ${index}: ${name} (${vramGB}GB VRAM, CUDA ${driverVer})`);
    gpuDetails.push({
      index: parseInt(index),
      name,
      vramGB,
      driverVersion: driverVer,
      computeCap,
    });
  });

  // Get CUDA version
  const cudaResult = spawn('nvcc', ['--version']);
  let cudaVersion = 'unknown';
  if (cudaResult.success) {
    const match = cudaResult.output.match(/release ([\d.]+)/);
    if (match) {
      cudaVersion = match[1];
      console.log(info(`CUDA Toolkit: ${cudaVersion}`));
    }
  }

  return { success: true, gpus: gpuDetails, cudaVersion };
}

// ── Check: Docker ────────────────────────────────────────────────────────

function checkDocker() {
  console.log(`\n${colorize('2. DOCKER & NVIDIA CONTAINER TOOLKIT', 'bold')}`);

  // Check docker installation
  const dockerResult = spawn('docker', ['--version']);
  if (!dockerResult.success) {
    console.log(failure('Docker not installed or not in PATH'));
    return { success: false };
  }
  console.log(success(`Docker: ${dockerResult.output}`));

  // Check docker daemon
  const dockerDaemonCheck = spawn('docker', ['ps']);
  if (!dockerDaemonCheck.success) {
    console.log(failure('Docker daemon not running or insufficient permissions'));
    return { success: false };
  }
  console.log(success('Docker daemon is running'));

  // Check nvidia-container-toolkit
  const nvidiaCtlResult = spawn('nvidia-ctk', ['--version']);
  if (!nvidiaCtlResult.success) {
    console.log(failure('nvidia-container-toolkit not installed'));
    return { success: false };
  }
  console.log(success(`nvidia-container-toolkit: ${nvidiaCtlResult.output}`));

  // Test GPU passthrough
  console.log(info('Testing GPU passthrough with docker...'));
  const gpuTest = spawn('docker', ['run', '--rm', '--gpus', 'all', 'nvidia/cuda:12.0-base', 'nvidia-smi', '-q']);
  if (!gpuTest.success) {
    console.log(failure('GPU passthrough test failed (docker run --gpus all)'));
    return { success: false };
  }
  console.log(success('GPU passthrough works via docker'));

  return { success: true };
}

// ── Check: Network Connectivity ──────────────────────────────────────────

function checkNetworkConnectivity() {
  console.log(`\n${colorize('4. NETWORK CONNECTIVITY', 'bold')}`);

  const endpoints = [
    { name: 'api.dcp.sa (provider registration)', url: 'https://api.dcp.sa/api/health' },
    { name: 'HuggingFace Hub (model downloads)', url: 'https://huggingface.co' },
  ];

  let allReachable = true;
  endpoints.forEach(({ name, url }) => {
    const curlResult = spawn('curl', ['-s', '-m', '5', '-o', '/dev/null', '-w', '%{http_code}', url]);
    const statusCode = curlResult.output.trim();

    if (curlResult.success && parseInt(statusCode) < 500) {
      console.log(success(`${name}: reachable`));
    } else {
      console.log(warning(`${name}: unreachable or slow (HTTP ${statusCode})`));
      allReachable = false;
    }
  });

  return { success: allReachable };
}

// ── Check: VRAM Sufficiency ──────────────────────────────────────────────

function checkVRAM(gpuDetails, modelId) {
  console.log(`\n${colorize('3. VRAM SUFFICIENCY CHECK', 'bold')}`);

  if (!modelId) {
    console.log(info('No specific model requested. Run with --model MODEL_ID to check VRAM.'));
    return { success: true, skipped: true };
  }

  const model = modelCatalog[modelId];
  if (!model) {
    console.log(failure(`Model not found: ${modelId}`));
    console.log(info('Available models:'));
    Object.keys(modelCatalog).forEach((id) => {
      const m = modelCatalog[id];
      console.log(`  - ${id} (min: ${m.min_vram_gb}GB, recommended: ${m.recommended_vram_gb}GB, tier: ${m.tier})`);
    });
    return { success: false };
  }

  const { min_vram_gb, recommended_vram_gb } = model;
  const gpu = gpuDetails[0]; // Use first GPU
  const available = gpu.vramGB;

  console.log(`Model: ${colorize(modelId, 'cyan')}`);
  console.log(`  Min VRAM: ${min_vram_gb}GB`);
  console.log(`  Recommended VRAM: ${recommended_vram_gb}GB`);
  console.log(`  Available: ${available}GB`);

  if (available < min_vram_gb) {
    console.log(failure(`Insufficient VRAM! Need ${min_vram_gb}GB, have ${available}GB`));
    return { success: false };
  }

  if (available < recommended_vram_gb) {
    console.log(warning(`Below recommended VRAM (have ${available}GB, recommended ${recommended_vram_gb}GB). Model may run slowly.`));
    return { success: true, warning: true };
  }

  console.log(success(`Sufficient VRAM available (${available}GB)`));
  return { success: true };
}

// ── Recommendation Engine ────────────────────────────────────────────────

function getModelRecommendations(gpuDetails) {
  const gpu = gpuDetails[0];
  const available = gpu.vramGB;

  const compatible = Object.entries(modelCatalog)
    .filter(([_, model]) => available >= model.min_vram_gb)
    .map(([id, model]) => ({
      id,
      tier: model.tier,
      min: model.min_vram_gb,
      recommended: model.recommended_vram_gb,
    }))
    .sort((a, b) => {
      // Prefer models within recommended range, then sort by tier
      const aPriority = a.recommended <= available ? 0 : 1;
      const bPriority = b.recommended <= available ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.tier.localeCompare(b.tier);
    });

  if (compatible.length === 0) {
    return [];
  }

  return compatible.slice(0, 10); // Top 10 recommendations
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let modelId = null;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) {
      modelId = args[i + 1];
      i++;
    }
  }

  console.log(colorize('\n╔════════════════════════════════════════════════════════════╗', 'blue'));
  console.log(colorize('║         DCP Provider Startup Validation Script             ║', 'blue'));
  console.log(colorize('╚════════════════════════════════════════════════════════════╝\n', 'blue'));

  let hasErrors = false;
  let hasWarnings = false;

  // 1. GPU Detection
  const gpuCheck = checkGPU();
  if (!gpuCheck.success) {
    hasErrors = true;
    console.log(failure('GPU detection FAILED'));
  }

  // 2. Docker & nvidia-container-toolkit
  const dockerCheck = checkDocker();
  if (!dockerCheck.success) {
    hasErrors = true;
    console.log(failure('Docker/nvidia-container-toolkit check FAILED'));
  }

  // 3. VRAM Sufficiency (only if model specified and GPU found)
  let vramCheck = { success: true, skipped: true };
  if (gpuCheck.success) {
    vramCheck = checkVRAM(gpuCheck.gpus, modelId);
    if (!vramCheck.success) {
      hasErrors = true;
    }
    if (vramCheck.warning) {
      hasWarnings = true;
    }
  }

  // 4. Network Connectivity
  const networkCheck = checkNetworkConnectivity();
  if (!networkCheck.success) {
    hasWarnings = true;
  }

  // 5. Summary Report
  console.log(`\n${colorize('5. SUMMARY REPORT', 'bold')}`);
  console.log('─'.repeat(60));

  const checks = [
    { name: 'GPU Detection', status: gpuCheck.success },
    { name: 'Docker/nvidia-container-toolkit', status: dockerCheck.success },
    { name: 'VRAM Sufficiency', status: !vramCheck.skipped ? vramCheck.success : null },
    { name: 'Network Connectivity', status: networkCheck.success },
  ];

  checks.forEach(({ name, status }) => {
    if (status === true) {
      console.log(`  ${success(name)}`);
    } else if (status === false) {
      console.log(`  ${failure(name)}`);
    } else {
      console.log(`  ${info(name + ' (skipped)')}`);
    }
  });

  // Model Recommendations
  if (gpuCheck.success) {
    const recommendations = getModelRecommendations(gpuCheck.gpus);
    if (recommendations.length > 0) {
      console.log(`\n${colorize('Recommended Models:', 'bold')}`);
      recommendations.slice(0, 5).forEach(({ id, tier, min, recommended }) => {
        const indicator = gpuCheck.gpus[0].vramGB >= recommended ? '✓' : '•';
        console.log(`  ${indicator} ${id} (${tier}, min: ${min}GB, rec: ${recommended}GB)`);
      });
    }
  }

  // Final Status
  console.log('\n' + '─'.repeat(60));
  if (hasErrors) {
    console.log(failure('Status: FAILED - Provider startup validation did not pass'));
    process.exit(1);
  } else if (hasWarnings) {
    console.log(warning('Status: WARNINGS - Some checks completed with warnings'));
    process.exit(0);
  } else {
    console.log(success('Status: PASSED - Provider is ready to activate'));
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(failure(`Unexpected error: ${err.message}`));
  process.exit(1);
});
