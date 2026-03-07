// DC1 SQLite -> Supabase Sync Bridge
// Syncs: providers → users + machines + machine_metrics
//        jobs    → rentals + transactions
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

// Cache SQLite provider_id → Supabase user UUID + machine UUID mappings
const providerMap = new Map(); // sqlite_provider_id → { userId, machineId }

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

// ─── PROVIDER SYNC (providers → users + machines + machine_metrics) ─────────

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

  // Cache mapping for job sync
  providerMap.set(provider.id, { userId, machineId });

  return { userId, machineId, online, machineStatus };
}

// ─── JOB SYNC (jobs → rentals + transactions) ──────────────────────────────

function mapRentalStatus(jobStatus) {
  const statusMap = {
    'pending': 'pending', 'running': 'running', 'completed': 'completed',
    'failed': 'cancelled', 'cancelled': 'cancelled', 'timed_out': 'cancelled'
  };
  return statusMap[jobStatus] || 'pending';
}

async function syncJob(job) {
  // We need the Supabase UUIDs for provider and renter
  const providerMapping = providerMap.get(job.provider_id);
  if (!providerMapping) {
    // Provider hasn't been synced yet — skip this job for now
    return null;
  }

  const { userId: providerUserId, machineId } = providerMapping;

  // Get or create renter user in Supabase
  let renterUserId;
  if (job.renter_id) {
    const renter = db.get('SELECT * FROM renters WHERE id = ?', job.renter_id);
    if (renter) {
      const { data: existingRenter, error: rqe } = await supabase
        .from('users').select('id').eq('email', renter.email).limit(1);
      if (rqe) throw new Error('Renter user query failed: ' + rqe.message);

      if (existingRenter && existingRenter.length > 0) {
        renterUserId = existingRenter[0].id;
      } else {
        const { data: newRenter, error: rie } = await supabase
          .from('users').insert({ email: renter.email, name: renter.name, type: 'renter' })
          .select('id').single();
        if (rie) throw new Error('Renter user insert failed: ' + rie.message);
        renterUserId = newRenter.id;
      }
    }
  }

  // If no renter mapping, use provider as placeholder (Gate 0 self-test jobs)
  if (!renterUserId) renterUserId = providerUserId;

  // Calculate costs in SAR (halala → SAR)
  const costSar = job.cost_halala ? job.cost_halala / 100 : 0;
  const actualCostSar = job.actual_cost_halala ? job.actual_cost_halala / 100 : null;
  const providerPayoutSar = job.provider_earned_halala ? job.provider_earned_halala / 100 : null;
  const dc1SpreadSar = job.dc1_fee_halala ? job.dc1_fee_halala / 100 : null;
  const durationHours = job.duration_minutes ? job.duration_minutes / 60 : null;
  const actualHours = job.actual_duration_minutes ? job.actual_duration_minutes / 60 : null;

  // Check if rental already exists (use job_id in job_name field as lookup key)
  const { data: existingRental, error: erq } = await supabase
    .from('rentals').select('id').eq('job_name', job.job_id).limit(1);
  if (erq) throw new Error('Rental query failed: ' + erq.message);

  const rentalData = {
    machine_id: machineId,
    renter_id: renterUserId,
    provider_id: providerUserId,
    job_name: job.job_id,
    status: mapRentalStatus(job.status),
    started_at: job.started_at || job.submitted_at,
    ended_at: job.completed_at || null,
    estimated_hours: durationHours,
    actual_hours: actualHours,
    hourly_rate_sar: 0.38,
    hourly_rate_usd: 0.10,
    total_cost_sar: actualCostSar || costSar,
    total_cost_usd: (actualCostSar || costSar) * 0.27, // approx SAR→USD
    provider_payout_sar: providerPayoutSar,
    dc1_spread_sar: dc1SpreadSar,
    tags: JSON.stringify({ job_type: job.job_type, sqlite_id: job.id }),
  };

  let rentalId;
  if (existingRental && existingRental.length > 0) {
    rentalId = existingRental[0].id;
    await supabase.from('rentals').update(rentalData).eq('id', rentalId);
  } else {
    const { data: newRental, error: rie } = await supabase
      .from('rentals').insert({ ...rentalData, created_at: new Date().toISOString() })
      .select('id').single();
    if (rie) throw new Error('Rental insert failed: ' + rie.message);
    rentalId = newRental.id;
  }

  // Sync transaction for completed jobs (if not already synced)
  if (job.status === 'completed' && (actualCostSar || costSar) > 0) {
    // Check if renter has a wallet
    const { data: wallets } = await supabase
      .from('wallets').select('id').eq('user_id', renterUserId).limit(1);

    if (wallets && wallets.length > 0) {
      const walletId = wallets[0].id;
      // Check if transaction already exists for this rental
      const { data: existingTx } = await supabase
        .from('transactions').select('id').eq('rental_id', rentalId).eq('type', 'rental').limit(1);

      if (!existingTx || existingTx.length === 0) {
        await supabase.from('transactions').insert({
          wallet_id: walletId,
          amount_sar: actualCostSar || costSar,
          amount_usd: (actualCostSar || costSar) * 0.27,
          type: 'rental',
          status: 'completed',
          rental_id: rentalId,
          description: `Job ${job.job_id} (${job.job_type})`,
          created_at: job.completed_at || new Date().toISOString(),
          completed_at: job.completed_at || new Date().toISOString()
        });
      }
    }
  }

  return { rentalId, renterUserId, status: rentalData.status };
}

// ─── RENTER/WALLET SYNC (renters → users + wallets) ──────────────────────────

// Cache SQLite renter_id → Supabase user UUID + wallet UUID
const renterMap = new Map(); // sqlite_renter_id → { userId, walletId }

async function syncRenter(renter) {
  // Find or create user record
  const { data: existingUsers, error: uqe } = await supabase
    .from('users').select('id, type').eq('email', renter.email).limit(1);
  if (uqe) throw new Error('Renter user query failed: ' + uqe.message);

  let userId;
  if (existingUsers && existingUsers.length > 0) {
    userId = existingUsers[0].id;
    // Upgrade type if currently 'provider'
    if (existingUsers[0].type === 'provider') {
      await supabase.from('users').update({ type: 'both', updated_at: new Date().toISOString() }).eq('id', userId);
    }
  } else {
    const { data: nu, error: ie } = await supabase
      .from('users').insert({
        email: renter.email, name: renter.name, type: 'renter',
        created_at: renter.created_at || new Date().toISOString()
      }).select('id').single();
    if (ie) throw new Error('Renter user insert failed: ' + ie.message);
    userId = nu.id;
  }

  // Find or create wallet
  const { data: existingWallets, error: wqe } = await supabase
    .from('wallets').select('id').eq('user_id', userId).limit(1);
  if (wqe) throw new Error('Wallet query failed: ' + wqe.message);

  const balanceSar = (renter.balance_halala || 0) / 100;
  const totalSpentSar = (renter.total_spent_halala || 0) / 100;

  // Calculate held amount from running jobs
  const held = db.get(
    `SELECT COALESCE(SUM(cost_halala), 0) as held_halala FROM jobs WHERE renter_id = ? AND status = 'running'`,
    renter.id
  );
  const holdSar = (held?.held_halala || 0) / 100;

  const walletData = {
    balance_sar: balanceSar,
    balance_usd: balanceSar * 0.27,
    hold_sar: holdSar,
    hold_usd: holdSar * 0.27,
    total_spent_sar: totalSpentSar,
    total_jobs: renter.total_jobs || 0,
    wallet_type: 'renter',
    updated_at: new Date().toISOString()
  };

  let walletId;
  if (existingWallets && existingWallets.length > 0) {
    walletId = existingWallets[0].id;
    await supabase.from('wallets').update(walletData).eq('id', walletId);
  } else {
    const { data: nw, error: wie } = await supabase
      .from('wallets').insert({
        ...walletData, user_id: userId, created_at: new Date().toISOString()
      }).select('id').single();
    if (wie) throw new Error('Wallet insert failed: ' + wie.message);
    walletId = nw.id;
  }

  renterMap.set(renter.id, { userId, walletId });
  return { userId, walletId, balanceSar };
}

// ─── PROVIDER WALLET SYNC (provider earnings → wallets) ──────────────────────

async function syncProviderWallet(provider) {
  const mapping = providerMap.get(provider.id);
  if (!mapping) return null;

  const { userId } = mapping;

  // Find or create provider wallet
  const { data: existingWallets, error: wqe } = await supabase
    .from('wallets').select('id').eq('user_id', userId).eq('wallet_type', 'provider').limit(1);
  if (wqe) throw new Error('Provider wallet query failed: ' + wqe.message);

  const totalEarnedSar = (provider.total_earnings || 0);

  // Calculate pending withdrawals + already withdrawn
  const withdrawn = db.get(
    `SELECT COALESCE(SUM(amount_sar), 0) as total FROM withdrawals WHERE provider_id = ? AND status = 'completed'`,
    provider.id
  );
  const pending = db.get(
    `SELECT COALESCE(SUM(amount_sar), 0) as total FROM withdrawals WHERE provider_id = ? AND status = 'pending'`,
    provider.id
  );
  const totalWithdrawnSar = withdrawn?.total || 0;
  const pendingWithdrawalSar = pending?.total || 0;
  const availableSar = totalEarnedSar - totalWithdrawnSar - pendingWithdrawalSar;

  const walletData = {
    balance_sar: availableSar,
    balance_usd: availableSar * 0.27,
    total_earned_sar: totalEarnedSar,
    total_withdrawn_sar: totalWithdrawnSar,
    pending_withdrawal_sar: pendingWithdrawalSar,
    wallet_type: 'provider',
    updated_at: new Date().toISOString()
  };

  if (existingWallets && existingWallets.length > 0) {
    await supabase.from('wallets').update(walletData).eq('id', existingWallets[0].id);
    return { walletId: existingWallets[0].id };
  } else {
    // Check if renter wallet already exists for this user — don't conflict
    const { data: anyWallet } = await supabase
      .from('wallets').select('id, wallet_type').eq('user_id', userId).limit(1);

    if (anyWallet && anyWallet.length > 0 && anyWallet[0].wallet_type === 'renter') {
      // User has a renter wallet — update it to include provider earnings too
      await supabase.from('wallets').update({
        ...walletData, wallet_type: 'both'
      }).eq('id', anyWallet[0].id);
      return { walletId: anyWallet[0].id };
    }

    const { data: nw, error: wie } = await supabase
      .from('wallets').insert({
        ...walletData, user_id: userId, created_at: new Date().toISOString()
      }).select('id').single();
    if (wie) throw new Error('Provider wallet insert failed: ' + wie.message);
    return { walletId: nw.id };
  }
}

// ─── WITHDRAWAL SYNC (withdrawals → Supabase withdrawals + transactions) ─────

async function syncWithdrawal(withdrawal) {
  const mapping = providerMap.get(withdrawal.provider_id);
  if (!mapping) return null;

  const { userId } = mapping;

  // Map SQLite status to Supabase payout_status enum
  const statusMap = { 'pending': 'pending', 'processing': 'processing', 'completed': 'completed', 'failed': 'failed' };
  const supabaseStatus = statusMap[withdrawal.status] || 'pending';

  // Sync to withdrawals table
  const { data: existing, error: eqe } = await supabase
    .from('withdrawals').select('id').eq('sqlite_withdrawal_id', withdrawal.withdrawal_id).limit(1);
  if (eqe) throw new Error('Withdrawal query failed: ' + eqe.message);

  const withdrawalData = {
    provider_id: userId,
    sqlite_withdrawal_id: withdrawal.withdrawal_id,
    amount_sar: withdrawal.amount_sar,
    payout_method: withdrawal.payout_method === 'bank_transfer' ? 'bank_transfer' : 'wallet',
    payout_details: withdrawal.payout_details ? JSON.parse(withdrawal.payout_details || '{}') : null,
    status: supabaseStatus,
    requested_at: withdrawal.requested_at,
    processed_at: withdrawal.processed_at || null,
    notes: withdrawal.notes
  };

  if (existing && existing.length > 0) {
    await supabase.from('withdrawals').update(withdrawalData).eq('id', existing[0].id);
  } else {
    await supabase.from('withdrawals').insert({
      ...withdrawalData, created_at: new Date().toISOString()
    });
  }

  return { status: supabaseStatus };
}

// ─── MAIN SYNC CYCLE ────────────────────────────────────────────────────────

async function runSyncCycle() {
  if (!supabase || syncRunning) return null;
  syncRunning = true;
  const start = Date.now();
  try {
    // Phase 1: Sync providers → users + machines
    const providers = db.all('SELECT * FROM providers');
    let providersSynced = 0, providerErrors = 0;
    if (providers && providers.length) {
      console.log('[SYNC] Phase 1: Syncing ' + providers.length + ' providers');
      for (const p of providers) {
        try { await syncProvider(p); providersSynced++; } catch (e) { providerErrors++; console.error('[SYNC] Provider error: ' + e.message); }
      }
    }

    // Phase 2: Sync recent jobs → rentals + transactions
    // Only sync jobs from last 24 hours (or all active jobs) to avoid huge backlogs
    const recentJobs = db.all(`
      SELECT * FROM jobs
      WHERE status IN ('pending', 'running')
         OR (completed_at IS NOT NULL AND completed_at > datetime('now', '-24 hours'))
         OR (submitted_at > datetime('now', '-24 hours'))
      ORDER BY submitted_at DESC
      LIMIT 100
    `);
    let jobsSynced = 0, jobErrors = 0;
    if (recentJobs && recentJobs.length) {
      console.log('[SYNC] Phase 2: Syncing ' + recentJobs.length + ' jobs');
      for (const j of recentJobs) {
        try {
          const result = await syncJob(j);
          if (result) jobsSynced++;
        } catch (e) {
          jobErrors++;
          console.error('[SYNC] Job error (' + j.job_id + '): ' + e.message);
        }
      }
    }

    // Phase 3: Sync renters → users + wallets
    const renters = db.all('SELECT * FROM renters');
    let rentersSynced = 0, renterErrors = 0;
    if (renters && renters.length) {
      console.log('[SYNC] Phase 3a: Syncing ' + renters.length + ' renters → wallets');
      for (const r of renters) {
        try { await syncRenter(r); rentersSynced++; } catch (e) { renterErrors++; console.error('[SYNC] Renter error: ' + e.message); }
      }
    }

    // Phase 3b: Sync provider wallets (earnings balances)
    let provWalletsSynced = 0, provWalletErrors = 0;
    if (providers && providers.length) {
      console.log('[SYNC] Phase 3b: Syncing provider wallets');
      for (const p of providers) {
        try { const r = await syncProviderWallet(p); if (r) provWalletsSynced++; } catch (e) { provWalletErrors++; console.error('[SYNC] Provider wallet error: ' + e.message); }
      }
    }

    // Phase 3c: Sync withdrawals
    const withdrawals = db.all('SELECT * FROM withdrawals ORDER BY requested_at DESC LIMIT 50');
    let withdrawalsSynced = 0, withdrawalErrors = 0;
    if (withdrawals && withdrawals.length) {
      console.log('[SYNC] Phase 3c: Syncing ' + withdrawals.length + ' withdrawals');
      for (const w of withdrawals) {
        try { const r = await syncWithdrawal(w); if (r) withdrawalsSynced++; } catch (e) { withdrawalErrors++; console.error('[SYNC] Withdrawal error: ' + e.message); }
      }
    }

    lastSyncAt = new Date().toISOString();
    const totalErrors = providerErrors + jobErrors + renterErrors + provWalletErrors + withdrawalErrors;
    syncStats.total++;
    if (!totalErrors) syncStats.success++; else { syncStats.errors++; syncStats.lastError = new Date().toISOString(); }

    const duration = Date.now() - start;
    console.log(`[SYNC] Done: ${providersSynced} providers, ${jobsSynced} jobs, ${rentersSynced} renters, ${provWalletsSynced} prov-wallets, ${withdrawalsSynced} withdrawals | ${totalErrors} errors | ${duration}ms`);
    return { providersSynced, jobsSynced, rentersSynced, provWalletsSynced, withdrawalsSynced, providerErrors, jobErrors, renterErrors, withdrawalErrors, duration };
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
  getStatus: () => ({ initialized: !!supabase, running: syncRunning, lastSyncAt, stats: syncStats, intervalMs: SYNC_INTERVAL_MS, heartbeatTimeoutS: HEARTBEAT_TIMEOUT_S }),
  getProviderMap: () => Object.fromEntries(providerMap)
};
