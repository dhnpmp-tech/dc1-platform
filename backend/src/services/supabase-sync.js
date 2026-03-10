// DC1 SQLite -> Supabase Sync Bridge
const { createClient } = require('@supabase/supabase-js');
const db = require('../db');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwxqcqgjszvbwcyjfpec.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '30000', 10);
const HEARTBEAT_TIMEOUT_S = 90;
const JOB_SYNC_BATCH = 100; // max jobs per sync cycle

let supabase = null;
let syncRunning = false;
let lastSyncAt = null;
let syncStats = { total: 0, success: 0, errors: 0, lastError: null };

// ── Sync state table (persisted in SQLite) ───────────────────────────────────
// Ensures job sync cursor survives process restarts.
function ensureSyncStateTable() {
  db._db.exec(`
    CREATE TABLE IF NOT EXISTS sync_state (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

function getSyncState(key) {
  try {
    const row = db.get('SELECT value FROM sync_state WHERE key = ?', key);
    return row?.value || null;
  } catch { return null; }
}

function setSyncState(key, value) {
  const now = new Date().toISOString();
  db.run(
    'INSERT OR REPLACE INTO sync_state (key, value, updated_at) VALUES (?, ?, ?)',
    key, value, now
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const { deterministicUuid } = require('../utils/crypto');

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

// ── Provider sync ─────────────────────────────────────────────────────────────

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

// ── Job sync ──────────────────────────────────────────────────────────────────

/**
 * Look up a Supabase user UUID by email. Returns null if not found.
 * Cached per-cycle via a simple Map to avoid N+1 queries.
 */
const _emailCache = new Map();
async function resolveSupabaseUserId(email) {
  if (!email) return null;
  if (_emailCache.has(email)) return _emailCache.get(email);
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .limit(1);
  if (error || !data?.length) { _emailCache.set(email, null); return null; }
  const id = data[0].id;
  _emailCache.set(email, id);
  return id;
}

/**
 * Sync completed jobs from SQLite → Supabase job_history table.
 *
 * Uses a timestamp cursor stored in sync_state to avoid re-syncing.
 * Upserts on job_id to be idempotent (safe to run multiple times).
 *
 * Also applies wallet debit (renter) + credit (provider) per job if:
 * - renter_email / renter_supabase_user_id is present on the job row
 * - provider email is resolvable to a Supabase user
 * - wallet_debited / provider_credited flags are FALSE in job_history
 */
async function syncJobs() {
  if (!supabase) return { synced: 0, errors: 0, skipped: 0 };

  // Clear per-cycle cache
  _emailCache.clear();

  const lastSyncCursor = getSyncState('last_job_sync_at') || '1970-01-01T00:00:00.000Z';

  // Read completed jobs newer than cursor — JOIN providers for email resolution
  const jobs = db.all(
    `SELECT j.*,
            p.email  AS provider_email,
            p.name   AS provider_name
     FROM   jobs j
     LEFT JOIN providers p ON p.id = j.provider_id
     WHERE  j.status      = 'completed'
     AND    j.completed_at > ?
     ORDER  BY j.completed_at ASC
     LIMIT  ?`,
    lastSyncCursor,
    JOB_SYNC_BATCH
  );

  if (!jobs.length) return { synced: 0, errors: 0, skipped: 0 };
  console.log('[SYNC] Jobs: processing ' + jobs.length + ' completed jobs');

  let synced = 0, errors = 0, skipped = 0;
  let latestCompletedAt = lastSyncCursor;

  for (const job of jobs) {
    try {
      // Resolve Supabase IDs
      const providerUserId = await resolveSupabaseUserId(job.provider_email);
      const renterUserId   = job.renter_supabase_user_id
        || await resolveSupabaseUserId(job.renter_email);

      const actualCost    = job.actual_cost_halala || job.cost_halala || 0;
      const providerEarned = job.provider_earned_halala || Math.floor(actualCost * 0.75);
      const dc1Fee         = job.dc1_fee_halala  || (actualCost - providerEarned);

      // Upsert job_history row
      const { data: histRow, error: upsertErr } = await supabase
        .from('job_history')
        .upsert({
          job_id:                  job.job_id || String(job.id),
          provider_sqlite_id:      job.provider_id,
          provider_user_id:        providerUserId,
          renter_user_id:          renterUserId,
          job_type:                job.job_type,
          status:                  job.status,
          cost_halala:             job.cost_halala || 0,
          actual_cost_halala:      actualCost,
          provider_earned_halala:  providerEarned,
          dc1_fee_halala:          dc1Fee,
          duration_minutes:        job.duration_minutes || 0,
          actual_duration_minutes: job.actual_duration_minutes || job.duration_minutes || 0,
          submitted_at:            job.submitted_at || null,
          completed_at:            job.completed_at || null,
          synced_at:               new Date().toISOString(),
        }, { onConflict: 'job_id', ignoreDuplicates: false })
        .select()
        .single();

      if (upsertErr) throw new Error('job_history upsert: ' + upsertErr.message);

      // ── Wallet credits/debits (idempotent via billing flags) ─────────────
      const walletDebited     = histRow?.wallet_debited;
      const providerCredited  = histRow?.provider_credited;

      // Debit renter (if renter known and not yet debited)
      if (!walletDebited && renterUserId && actualCost > 0) {
        const idemKey = deterministicUuid('dc1-renter-debit-' + job.job_id);
        const { error: debitErr } = await supabase.rpc('debit_wallet_atomic', {
          p_user_id:         renterUserId,
          p_amount_halala:   actualCost,
          p_reason:          'job_completion',
          p_job_id:          null,   // job_id is text not UUID; omit
          p_idempotency_key: idemKey,
        });
        if (debitErr) {
          console.warn('[SYNC] Renter debit skipped for ' + job.job_id + ': ' + debitErr.message);
        } else {
          await supabase.from('job_history')
            .update({ wallet_debited: true })
            .eq('job_id', job.job_id || String(job.id));
        }
      }

      // Credit provider (if provider known and not yet credited)
      if (!providerCredited && providerUserId && providerEarned > 0) {
        const idemKey = deterministicUuid('dc1-provider-credit-' + job.job_id);
        const { error: creditErr } = await supabase.rpc('credit_wallet_atomic', {
          p_user_id:         providerUserId,
          p_amount_halala:   providerEarned,
          p_reason:          'provider_earning',
          p_idempotency_key: idemKey,
        });
        if (creditErr) {
          console.warn('[SYNC] Provider credit skipped for ' + job.job_id + ': ' + creditErr.message);
        } else {
          await supabase.from('job_history')
            .update({ provider_credited: true })
            .eq('job_id', job.job_id || String(job.id));
        }
      }

      synced++;
      if (job.completed_at > latestCompletedAt) latestCompletedAt = job.completed_at;
    } catch (e) {
      errors++;
      console.error('[SYNC] Job ' + (job.job_id || job.id) + ' error: ' + e.message);
    }
  }

  // Advance cursor only if we made progress
  if (synced > 0 && latestCompletedAt > lastSyncCursor) {
    setSyncState('last_job_sync_at', latestCompletedAt);
  }

  console.log('[SYNC] Jobs done: ' + synced + ' synced, ' + errors + ' errors');
  return { synced, errors, skipped };
}

// ── Main sync cycle ───────────────────────────────────────────────────────────

async function runSyncCycle() {
  if (!supabase || syncRunning) return null;
  syncRunning = true;
  const start = Date.now();
  try {
    const providers = db.all('SELECT * FROM providers');
    let synced = 0, errors = 0;

    if (providers && providers.length) {
      console.log('[SYNC] Syncing ' + providers.length + ' providers');
      for (const p of providers) {
        try { await syncProvider(p); synced++; } catch (e) { errors++; console.error('[SYNC] Provider error: ' + e.message); }
      }
    }

    // Job sync runs every cycle alongside provider sync
    const jobResult = await syncJobs();

    lastSyncAt = new Date().toISOString();
    syncStats.total++; if (!errors) syncStats.success++; else syncStats.errors++;
    const duration = Date.now() - start;
    console.log('[SYNC] Done: providers=' + synced + '/' + (providers?.length||0) + ' jobs=' + jobResult.synced + ' err=' + (errors + jobResult.errors) + ' ' + duration + 'ms');
    return { synced, errors, jobs: jobResult, duration };
  } finally { syncRunning = false; }
}

async function markStaleOffline() {
  if (!supabase) return;
  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_S * 1000).toISOString();
  await supabase.from('machines').update({ online: false, status: 'offline' }).eq('online', true).lt('last_heartbeat', cutoff);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

function init() {
  if (!SUPABASE_SERVICE_KEY) {
    console.warn('[SYNC] SUPABASE_SERVICE_ROLE_KEY not set - sync disabled');
    return false;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  ensureSyncStateTable();
  console.log('[SYNC] Supabase sync bridge initialized');
  return true;
}

let syncInterval = null;
function startPeriodicSync() {
  if (!supabase) return;
  runSyncCycle().then(() => markStaleOffline());
  syncInterval = setInterval(async () => { await runSyncCycle(); await markStaleOffline(); }, SYNC_INTERVAL_MS);
  console.log('[SYNC] Periodic sync started (every ' + SYNC_INTERVAL_MS/1000 + 's)');
}
function stopPeriodicSync() { if (syncInterval) { clearInterval(syncInterval); syncInterval = null; } }

module.exports = {
  init,
  runSyncCycle,
  markStaleOffline,
  startPeriodicSync,
  stopPeriodicSync,
  syncJobs,
  /** Expose Supabase client for use in other modules (wallet debit in jobs.js) */
  getClient: () => supabase,
  getStatus: () => ({
    initialized: !!supabase,
    running: syncRunning,
    lastSyncAt,
    stats: syncStats,
    intervalMs: SYNC_INTERVAL_MS,
    heartbeatTimeoutS: HEARTBEAT_TIMEOUT_S,
    jobSyncCursor: getSyncState('last_job_sync_at'),
  }),
};
