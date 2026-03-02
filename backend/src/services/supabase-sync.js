// DC1 SQLite -> Supabase Sync Bridge
const { createClient } = require('@supabase/supabase-js');
const db = require('../db');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwxqcqgjszvbwcyjfpec.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '30000', 10);
const HEARTBEAT_TIMEOUT_S = 90;

let supabase = null;
let syncRunning = false;
let lastSyncAt = null;
let syncStats = { total: 0, success: 0, errors: 0, lastError: null };

function init() {
  if (!SUPABASE_SERVICE_KEY) {
    console.warn('[SYNC] SUPABASE_SERVICE_ROLE_KEY not set - sync disabled');
    return false;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  console.log('[SYNC] Supabase sync bridge initialized');
  return true;
}

function mapMachineStatus(sqliteStatus, lastHeartbeat) {
  if (lastHeartbeat) {
    const secondsAgo = (Date.now() - new Date(lastHeartbeat).getTime()) / 1000;
    if (secondsAgo <= HEARTBEAT_TIMEOUT_S) return 'active';
    return 'offline';
  }
  const statusMap = { 'pending':'pending','registered':'pending','online':'active','offline':'offline','disconnected':'offline','maintenance':'maintenance','verified':'verified' };
  return statusMap[sqliteStatus] || 'pending';
}

function isOnline(lastHeartbeat) {
  if (!lastHeartbeat) return false;
  return (Date.now() - new Date(lastHeartbeat).getTime()) / 1000 <= HEARTBEAT_TIMEOUT_S;
}

function parseGpuStatus(s) {
  if (!s) return null;
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; }
}

async function syncProvider(provider) {
  const gpuStatus = parseGpuStatus(provider.gpu_status);
  const online = isOnline(provider.last_heartbeat);
  const machineStatus = mapMachineStatus(provider.status, provider.last_heartbeat);

  const { data: existingUsers, error: uqe } = await supabase.from('users').select('id, email, type').eq('email', provider.email).limit(1);
  if (uqe) throw new Error('User query failed: ' + uqe.message);

  let userId;
  if (existingUsers && existingUsers.length > 0) {
    userId = existingUsers[0].id;
    if (existingUsers[0].type === 'renter') await supabase.from('users').update({ type: 'both' }).eq('id', userId);
  } else {
    const { data: nu, error: ie } = await supabase.from('users').insert({ email: provider.email, name: provider.name, type: 'provider' }).select('id').single();
    if (ie) throw new Error('User insert failed: ' + ie.message);
    userId = nu.id;
  }

  const gpuType = provider.gpu_name_detected || provider.gpu_model || 'Unknown';
  const gpuVramGb = provider.gpu_vram_mib ? Math.round(provider.gpu_vram_mib / 1024) : provider.vram_gb || null;

  const { data: em, error: mqe } = await supabase.from('machines').select('id').eq('provider_id', userId).eq('gpu_type', gpuType).limit(1);
  if (mqe) throw new Error('Machine query failed: ' + mqe.message);

  const machineData = {
    provider_id: userId, name: provider.name + "'s " + gpuType, gpu_type: gpuType,
    gpu_count: provider.gpu_count || 1, gpu_vram_gb: gpuVramGb,
    gpu_utilization_pct: gpuStatus?.utilization || 0, gpu_temperature_c: gpuStatus?.temperature || null,
    bandwidth_mbps: provider.bandwidth_mbps || null, location: provider.location || null,
    status: machineStatus, online: online, last_heartbeat: provider.last_heartbeat || null,
    uptime_pct_30d: provider.uptime_percent || 0, updated_at: new Date().toISOString()
  };

  let machineId;
  if (em && em.length > 0) {
    machineId = em[0].id;
    await supabase.from('machines').update(machineData).eq('id', machineId);
  } else {
    const { data: nm, error: mie } = await supabase.from('machines').insert({
      ...machineData, hourly_rate_usd: 0.10, hourly_rate_sar: 0.38, created_at: new Date().toISOString()
    }).select('id').single();
    if (mie) throw new Error('Machine insert failed: ' + mie.message);
    machineId = nm.id;
  }

  if (online && gpuStatus) {
    await supabase.from('machine_metrics').insert({
      machine_id: machineId, gpu_utilization_pct: gpuStatus.utilization || 0,
      gpu_temperature_c: gpuStatus.temperature || null,
      gpu_memory_used_gb: gpuStatus.memory_used_mb ? gpuStatus.memory_used_mb / 1024 : null,
      online: true, uptime_status: 'up', timestamp: new Date().toISOString()
    });
  }
  return { userId, machineId, online, machineStatus };
}

async function runSyncCycle() {
  if (!supabase || syncRunning) return null;
  syncRunning = true;
  const start = Date.now();
  try {
    const providers = db.all('SELECT * FROM providers');
    if (!providers || !providers.length) return { synced: 0, errors: 0, duration: Date.now() - start };
    console.log('[SYNC] Syncing ' + providers.length + ' providers');
    let synced = 0, errors = 0;
    for (const p of providers) {
      try { await syncProvider(p); synced++; } catch (e) { errors++; console.error('[SYNC] Error: ' + e.message); }
    }
    lastSyncAt = new Date().toISOString();
    syncStats.total++; if (!errors) syncStats.success++; else syncStats.errors++;
    console.log('[SYNC] Done: ' + synced + ' synced, ' + errors + ' errors, ' + (Date.now()-start) + 'ms');
    return { synced, errors, duration: Date.now() - start };
  } finally { syncRunning = false; }
}

async function markStaleOffline() {
  if (!supabase) return;
  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_S * 1000).toISOString();
  await supabase.from('machines').update({ online: false, status: 'offline' }).eq('online', true).lt('last_heartbeat', cutoff);
}

let syncInterval = null;
function startPeriodicSync() {
  if (!supabase) return;
  runSyncCycle().then(() => markStaleOffline());
  syncInterval = setInterval(async () => { await runSyncCycle(); await markStaleOffline(); }, SYNC_INTERVAL_MS);
  console.log('[SYNC] Periodic sync started (every ' + SYNC_INTERVAL_MS/1000 + 's)');
}
function stopPeriodicSync() { if (syncInterval) { clearInterval(syncInterval); syncInterval = null; } }

module.exports = { init, runSyncCycle, markStaleOffline, startPeriodicSync, stopPeriodicSync,
  getStatus: () => ({ initialized: !!supabase, running: syncRunning, lastSyncAt, stats: syncStats, intervalMs: SYNC_INTERVAL_MS, heartbeatTimeoutS: HEARTBEAT_TIMEOUT_S })
};
