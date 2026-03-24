#!/usr/bin/env node
/**
 * provider-heartbeat-daemon.mjs
 * DCP-839 — Provider liveness heartbeat daemon (PM2 service)
 *
 * Runs on the provider machine. Every 60 seconds, collects GPU stats and
 * sends a signed heartbeat to the backend so the marketplace knows the
 * provider is alive and how much capacity is available.
 *
 * Required env vars:
 *   DC1_API_KEY          — provider API key (from registration)
 *   DC1_API_URL          — backend URL (default: https://api.dcp.sa)
 *
 * Optional env vars:
 *   DC1_HMAC_SECRET      — if set, requests are signed with HMAC-SHA256
 *   DC1_HEARTBEAT_INTERVAL_MS — heartbeat interval in ms (default: 60000)
 *   DC1_DAEMON_VERSION   — version string reported in heartbeat
 *
 * Usage (standalone):
 *   DC1_API_KEY=<key> node scripts/provider-heartbeat-daemon.mjs
 *
 * Usage (PM2):
 *   pm2 start scripts/provider-heartbeat-daemon.mjs --name dc1-heartbeat \
 *     --interpreter node \
 *     --env DC1_API_KEY=<key>
 */

import { execSync, exec } from 'child_process';
import { createHmac } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { hostname, platform } from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ─── Config ────────────────────────────────────────────────────────────────────

const API_KEY = process.env.DC1_API_KEY || '';
const API_URL = (process.env.DC1_API_URL || 'https://api.dcp.sa').replace(/\/$/, '');
const HMAC_SECRET = process.env.DC1_HMAC_SECRET || '';
const INTERVAL_MS = Number.parseInt(process.env.DC1_HEARTBEAT_INTERVAL_MS || '60000', 10);
const DAEMON_VERSION = process.env.DC1_DAEMON_VERSION || '1.0.0';

if (!API_KEY) {
    console.error('[heartbeat-daemon] FATAL: DC1_API_KEY is not set. Exiting.');
    process.exit(1);
}

// ─── GPU stat collection ────────────────────────────────────────────────────────

async function collectNvidiaSmi() {
    try {
        const { stdout } = await execAsync(
            'nvidia-smi --query-gpu=name,memory.total,memory.free,utilization.gpu,temperature.gpu,power.draw,driver_version --format=csv,noheader,nounits',
            { timeout: 10000 }
        );
        const lines = stdout.trim().split('\n').filter(Boolean);
        const gpus = lines.map((line) => {
            const parts = line.split(',').map((s) => s.trim());
            return {
                gpu_name: parts[0] || 'unknown',
                vram_total_mib: Number(parts[1]) || 0,
                vram_free_mib: Number(parts[2]) || 0,
                gpu_util_pct: Number(parts[3]) || 0,
                temp_c: Number(parts[4]) || 0,
                power_w: Number(parts[5]) || 0,
                driver_version: parts[6] || null,
            };
        });
        return gpus;
    } catch {
        return null;
    }
}

async function collectCudaVersion() {
    try {
        const { stdout } = await execAsync('nvcc --version 2>/dev/null || nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null', { timeout: 5000 });
        const match = stdout.match(/release\s+([\d.]+)/i) || stdout.match(/([\d.]+)/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

async function collectModelCacheStats() {
    // Check common model cache locations
    const cachePaths = [
        process.env.DC1_MODEL_CACHE_PATH,
        '/var/lib/dc1/models',
        '/opt/dc1/models',
        `${process.env.HOME || '/root'}/.cache/dc1/models`,
    ].filter(Boolean);

    for (const cachePath of cachePaths) {
        if (!existsSync(cachePath)) continue;
        try {
            const { stdout } = await execAsync(`du -sm "${cachePath}" 2>/dev/null`, { timeout: 10000 });
            const usedMb = Number(stdout.split('\t')[0]) || 0;
            // Estimate total based on disk availability
            const { stdout: dfOut } = await execAsync(`df -m "${cachePath}" 2>/dev/null | tail -1`, { timeout: 5000 });
            const dfParts = dfOut.trim().split(/\s+/);
            const totalMb = Number(dfParts[1]) || 0;
            return { used_mb: usedMb, total_mb: totalMb };
        } catch {
            continue;
        }
    }
    return { used_mb: 0, total_mb: 0 };
}

function collectOsInfo() {
    const os = platform();
    try {
        if (os === 'linux') {
            const release = readFileSync('/etc/os-release', 'utf-8');
            const match = release.match(/PRETTY_NAME="([^"]+)"/);
            return match ? match[1] : `Linux (${os})`;
        }
    } catch {
        // ignore
    }
    return os;
}

function collectPythonVersion() {
    try {
        return execSync('python3 --version 2>&1', { timeout: 3000 }).toString().trim().replace('Python ', '');
    } catch {
        try {
            return execSync('python --version 2>&1', { timeout: 3000 }).toString().trim().replace('Python ', '');
        } catch {
            return null;
        }
    }
}

let containerRestartCount = 0;
async function collectContainerRestarts() {
    try {
        const { stdout } = await execAsync('docker ps --format "{{.RestartCount}}" 2>/dev/null | paste -sd+ - | bc 2>/dev/null', { timeout: 5000 });
        const total = Number(stdout.trim()) || 0;
        containerRestartCount = total;
        return total;
    } catch {
        return containerRestartCount;
    }
}

// ─── Heartbeat payload builder ──────────────────────────────────────────────────

async function buildHeartbeatPayload() {
    const gpus = await collectNvidiaSmi();
    const primaryGpu = gpus?.[0] || null;
    const modelCache = await collectModelCacheStats();
    const restarts = await collectContainerRestarts();
    const pythonVersion = collectPythonVersion();
    const osInfo = collectOsInfo();
    const cudaVersion = await collectCudaVersion();

    const gpuStatus = primaryGpu
        ? {
              gpu_name: primaryGpu.gpu_name,
              gpu_vram_mib: primaryGpu.vram_total_mib,
              free_vram_mib: primaryGpu.vram_free_mib,
              gpu_util_pct: primaryGpu.gpu_util_pct,
              temp_c: primaryGpu.temp_c,
              power_w: primaryGpu.power_w,
              driver_version: primaryGpu.driver_version,
              daemon_version: DAEMON_VERSION,
              python_version: pythonVersion,
              os_info: osInfo,
              container_restart_count: restarts,
          }
        : {
              daemon_version: DAEMON_VERSION,
              python_version: pythonVersion,
              os_info: osInfo,
              container_restart_count: restarts,
          };

    const gpuInfo = primaryGpu
        ? {
              gpu_name: primaryGpu.gpu_name,
              vram_mb: Math.round(primaryGpu.vram_total_mib),
              driver_version: primaryGpu.driver_version,
              cuda_version: cudaVersion,
          }
        : null;

    // resource_spec: summary used by job routing
    const resourceSpec = {
        gpu_count: gpus ? gpus.length : 0,
        gpu_model: primaryGpu?.gpu_name || 'unknown',
        vram_free_gb: primaryGpu ? Number((primaryGpu.vram_free_mib / 1024).toFixed(2)) : 0,
        vram_total_gb: primaryGpu ? Number((primaryGpu.vram_total_mib / 1024).toFixed(2)) : 0,
    };

    return {
        api_key: API_KEY,
        gpu_status: gpuStatus,
        gpu_info: gpuInfo,
        provider_hostname: hostname(),
        container_restart_count: restarts,
        resource_spec: resourceSpec,
        model_cache: {
            used_mb: modelCache.used_mb,
            total_mb: modelCache.total_mb,
        },
    };
}

// ─── HMAC signing ──────────────────────────────────────────────────────────────

function signPayload(body) {
    if (!HMAC_SECRET) return null;
    return 'sha256=' + createHmac('sha256', HMAC_SECRET).update(body).digest('hex');
}

// ─── HTTP heartbeat ────────────────────────────────────────────────────────────

async function sendHeartbeat() {
    let payload;
    try {
        payload = await buildHeartbeatPayload();
    } catch (err) {
        console.error('[heartbeat-daemon] payload build failed:', err.message);
        return;
    }

    const body = JSON.stringify(payload);
    const signature = signPayload(body);

    const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString(),
    };
    if (signature) headers['X-DC1-Signature'] = signature;

    const url = `${API_URL}/api/providers/heartbeat`;

    try {
        // Use native fetch (Node 18+) or fall back to http module
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(15000),
        });

        const responseText = await res.text();
        let responseJson;
        try { responseJson = JSON.parse(responseText); } catch { responseJson = null; }

        if (res.ok) {
            const gpuStr = payload.resource_spec?.gpu_model || 'no GPU';
            const freeVram = payload.resource_spec?.vram_free_gb ?? '?';
            console.log(`[heartbeat-daemon] ✓ heartbeat accepted (${gpuStr}, ${freeVram} GB free VRAM)`);

            // Check for update nudge from server
            if (responseJson?.update_available) {
                console.warn(`[heartbeat-daemon] Update available: ${responseJson.latest_version}. Run the DCP provider installer to update.`);
            }
        } else {
            console.warn(`[heartbeat-daemon] heartbeat rejected: HTTP ${res.status} — ${responseText.slice(0, 200)}`);
        }
    } catch (err) {
        console.error(`[heartbeat-daemon] heartbeat request failed: ${err.message}`);
    }
}

// ─── Main loop ─────────────────────────────────────────────────────────────────

console.log(`[heartbeat-daemon] starting — API: ${API_URL}, interval: ${INTERVAL_MS}ms, version: ${DAEMON_VERSION}`);
if (HMAC_SECRET) {
    console.log('[heartbeat-daemon] HMAC signing enabled');
} else {
    console.warn('[heartbeat-daemon] HMAC signing disabled (DC1_HMAC_SECRET not set)');
}

// Send immediately on startup
sendHeartbeat();

const timer = setInterval(sendHeartbeat, INTERVAL_MS);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[heartbeat-daemon] SIGTERM received — stopping');
    clearInterval(timer);
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('[heartbeat-daemon] SIGINT received — stopping');
    clearInterval(timer);
    process.exit(0);
});
