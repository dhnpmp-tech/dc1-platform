#!/usr/bin/env node
/**
 * GPU Provider Validation CLI
 *
 * Providers run this script locally to verify their system meets DCP requirements:
 * - GPU with >= 24GB VRAM (for Tier A model serving)
 * - Docker installed and running
 * - NVIDIA container toolkit available
 *
 * Outputs: JSON report + human-readable summary
 * Exit code: 0 if eligible, 1 if not
 */

import { execSync } from 'child_process';
import fs from 'fs';

// Tier A model minimum VRAM requirements
const TIER_A_MIN_VRAM = 24; // GB
const TIER_B_MIN_VRAM = 40; // GB
const TIER_C_MIN_VRAM = 80; // GB

const report = {
  timestamp: new Date().toISOString(),
  gpus: [],
  docker: { installed: false, running: false },
  nvidia_runtime: false,
  eligible: false,
  eligible_tiers: [],
  issues: [],
  system_info: {}
};

// Helper: Run command and return output
function runCommand(cmd, quiet = false) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: quiet ? 'pipe' : 'inherit' }).trim();
  } catch (e) {
    return null;
  }
}

// Helper: Get user-friendly GPU name
function getGPUFriendlyName(gpuName) {
  const names = {
    'NVIDIA RTX 4090': 'RTX 4090',
    'NVIDIA RTX 4080': 'RTX 4080',
    'NVIDIA H100': 'H100',
    'NVIDIA H200': 'H200',
    'NVIDIA L40S': 'L40S',
    'NVIDIA A100': 'A100',
    'Tesla V100': 'V100',
  };

  for (const [pattern, friendly] of Object.entries(names)) {
    if (gpuName.includes(pattern)) return friendly;
  }

  return gpuName.split('(')[0].trim();
}

// Step 1: Detect GPUs
console.log('🔍 Detecting GPUs...');
const nvidiaSmiOutput = runCommand('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader', true);

if (!nvidiaSmiOutput) {
  report.issues.push('nvidia-smi not found: NVIDIA GPU drivers not installed or not in PATH');
  console.log('❌ NVIDIA GPU drivers not detected');
} else {
  const gpuLines = nvidiaSmiOutput.split('\n').filter(line => line.trim());

  gpuLines.forEach((line, idx) => {
    const [name, memory] = line.split(',').map(s => s.trim());
    const vramGb = parseInt(memory) / 1024;

    const gpu = {
      index: idx,
      model: getGPUFriendlyName(name),
      vram_gb: Math.round(vramGb * 10) / 10,
      eligible_tiers: []
    };

    // Determine which tiers this GPU is eligible for
    if (vramGb >= TIER_C_MIN_VRAM) {
      gpu.eligible_tiers = ['Tier A', 'Tier B', 'Tier C'];
    } else if (vramGb >= TIER_B_MIN_VRAM) {
      gpu.eligible_tiers = ['Tier A', 'Tier B'];
    } else if (vramGb >= TIER_A_MIN_VRAM) {
      gpu.eligible_tiers = ['Tier A'];
    }

    report.gpus.push(gpu);
    console.log(`  ✓ GPU ${idx}: ${gpu.model} (${gpu.vram_gb}GB VRAM) — eligible for: ${gpu.eligible_tiers.join(', ') || 'None'}`);
  });
}

// Step 2: Check for eligible GPU (at least 24GB)
const hasEligibleGPU = report.gpus.some(gpu => gpu.eligible_tiers.length > 0);

if (!hasEligibleGPU && report.gpus.length > 0) {
  const maxVram = Math.max(...report.gpus.map(g => g.vram_gb));
  report.issues.push(`GPU VRAM insufficient: max ${maxVram}GB found, minimum 24GB required for Tier A`);
  console.log('❌ GPU VRAM insufficient (need >= 24GB for model serving)');
}

// Step 3: Check Docker
console.log('🔍 Checking Docker...');
const dockerVersionOutput = runCommand('docker --version', true);

if (dockerVersionOutput) {
  report.docker.installed = true;
  console.log(`  ✓ Docker installed: ${dockerVersionOutput}`);

  // Check if Docker daemon is running
  const dockerPsOutput = runCommand('docker ps >/dev/null 2>&1', true);
  if (dockerPsOutput !== null || runCommand('docker ps 2>&1', true)) {
    report.docker.running = true;
    console.log('  ✓ Docker daemon is running');
  } else {
    report.issues.push('Docker daemon not running: run `docker ps` or restart Docker service');
    console.log('❌ Docker daemon not running');
  }
} else {
  report.issues.push('Docker not installed: download from https://docs.docker.com/engine/install/');
  console.log('❌ Docker not installed');
}

// Step 4: Check NVIDIA container toolkit
console.log('🔍 Checking NVIDIA container toolkit...');
const nvidiaCLIOutput = runCommand('nvidia-ctk --version', true);

if (nvidiaCLIOutput) {
  report.nvidia_runtime = true;
  console.log(`  ✓ NVIDIA container toolkit available: ${nvidiaCLIOutput}`);

  // Verify runtime is configured
  const runtimeCheckOutput = runCommand('docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi 2>&1', true);
  if (runtimeCheckOutput && !runtimeCheckOutput.includes('error')) {
    console.log('  ✓ NVIDIA runtime properly configured in Docker');
  } else {
    report.issues.push('NVIDIA Docker runtime not configured: run `nvidia-ctk runtime configure --runtime=docker`');
    console.log('⚠️  NVIDIA Docker runtime may need configuration');
  }
} else {
  report.issues.push('NVIDIA container toolkit not installed: follow https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html');
  console.log('❌ NVIDIA container toolkit not installed');
}

// Step 5: System info
report.system_info = {
  platform: process.platform,
  arch: process.arch,
  node_version: process.version
};

// Step 6: Determine overall eligibility
report.eligible = hasEligibleGPU && report.docker.installed && report.docker.running && report.nvidia_runtime;
report.eligible_tiers = Array.from(new Set(report.gpus.flatMap(g => g.eligible_tiers))).sort();

// Output JSON report
console.log('\n📊 Validation Report (JSON):');
console.log(JSON.stringify(report, null, 2));

// Output human-readable summary
console.log('\n' + '='.repeat(60));
if (report.eligible) {
  console.log('✅ ELIGIBLE: Your system meets DCP provider requirements');
  console.log(`   GPU: ${report.gpus[0].model} (${report.gpus[0].vram_gb}GB)`);
  console.log(`   Docker: ✓ Running`);
  console.log(`   NVIDIA Runtime: ✓ Configured`);
  console.log(`   Eligible Tiers: ${report.eligible_tiers.join(', ')}`);
} else {
  console.log('❌ NOT ELIGIBLE: Your system does not meet requirements');
  console.log('\nIssues found:');
  report.issues.forEach(issue => console.log(`   • ${issue}`));
  console.log('\nNext steps:');
  if (!report.docker.installed) console.log('   1. Install Docker: https://docs.docker.com/engine/install/');
  if (!report.docker.running) console.log('   1. Start Docker daemon');
  if (!report.nvidia_runtime) console.log('   2. Install NVIDIA container toolkit: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html');
  if (!hasEligibleGPU) console.log('   3. Ensure GPU has >= 24GB VRAM for Tier A model serving');
}
console.log('='.repeat(60));

// Write report to file for reference
const reportPath = `${process.cwd()}/gpu-validation-report.json`;
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📝 Full report saved to: ${reportPath}`);

// Exit with appropriate code
process.exit(report.eligible ? 0 : 1);
