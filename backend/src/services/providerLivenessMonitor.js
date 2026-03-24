'use strict';
const db = require('../db');
const STALE_THRESHOLD_SEC = 90;
const POLL_INTERVAL_MS = 60_000;
let _intervalHandle = null;
function runLivenessSweep() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - STALE_THRESHOLD_SEC * 1000).toISOString();
  const nowIso = now.toISOString();
  const staleProviders = db.all(
    `SELECT id, name, last_heartbeat FROM providers WHERE status IN ('online','degraded') AND (last_heartbeat IS NULL OR last_heartbeat < ?)`, cutoff);
  if (staleProviders.length === 0) return { checked: 0, offlined: 0, requeued: 0 };
  let offlinedCount = 0, requeuedCount = 0;
  for (const provider of staleProviders) {
    db.prepare(`UPDATE providers SET status='offline', updated_at=? WHERE id=?`).run(nowIso, provider.id);
    offlinedCount++;
    const ageSeconds = provider.last_heartbeat ? Math.round((now - new Date(provider.last_heartbeat)) / 1000) : null;
    console.log(`[liveness] Provider #${provider.id} (${provider.name}) offline${ageSeconds != null ? ` — last heartbeat ${ageSeconds}s ago` : ' — never heartbeated'}`);
    const activeJobs = db.all(`SELECT id, job_id FROM jobs WHERE provider_id=? AND status IN ('running','assigned','pulling')`, provider.id);
    for (const job of activeJobs) {
      db.prepare(`UPDATE jobs SET status='pending', provider_id=NULL, assigned_at=NULL, picked_up_at=NULL, started_at=NULL, error=?, updated_at=? WHERE id=?`)
        .run(`Provider #${provider.id} went offline — requeued`, nowIso, job.id);
      try { db.prepare(`INSERT INTO job_lifecycle_events (job_id,event,status,source,message,created_at) VALUES(?,'job.requeued','pending','liveness_monitor',?,?)`).run(job.job_id, `Provider #${provider.id} (${provider.name}) went offline; job requeued`, nowIso); } catch(_) {}
      requeuedCount++;
      console.log(`[liveness] Job ${job.job_id} requeued (provider #${provider.id} offline)`);
    }
  }
  return { checked: staleProviders.length, offlined: offlinedCount, requeued: requeuedCount, timestamp: nowIso };
}
function start() {
  if (process.env.DC1_DB_PATH === ':memory:' || process.env.JEST_WORKER_ID) return;
  if (_intervalHandle) return;
  _intervalHandle = setInterval(() => { try { const r = runLivenessSweep(); if (r.offlined > 0) console.log(`[liveness] sweep: ${r.checked} stale, ${r.offlined} offlined, ${r.requeued} jobs requeued`); } catch(err) { console.error('[liveness] sweep error:', err.message); } }, POLL_INTERVAL_MS);
  if (_intervalHandle.unref) _intervalHandle.unref();
  console.log(`[liveness] monitor started (${STALE_THRESHOLD_SEC}s threshold, ${POLL_INTERVAL_MS/1000}s interval)`);
}
function stop() { if (_intervalHandle) { clearInterval(_intervalHandle); _intervalHandle = null; } }
module.exports = { start, stop, runLivenessSweep, STALE_THRESHOLD_SEC };
