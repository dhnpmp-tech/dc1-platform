/**
 * jobDispatch.test.js — Integration tests for DCP-758 job dispatch pipeline
 *
 * Tests the jobDispatchService functions directly (no HTTP layer):
 *   dispatch()     — credit hold + provider matching
 *   completeJob()  — settle billing, debit actual cost
 *   failJob()      — release credit hold, no charge
 *   getAvailableBalance() — available = balance - held reserves
 *
 * Uses in-memory SQLite (set in jest-setup.js via DC1_DB_PATH=:memory:).
 * No supertest required — exercises service layer directly.
 */

'use strict';

// Stub Supabase so lazy requires in routes don't throw on module load
process.env.SUPABASE_URL         = process.env.SUPABASE_URL         || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key-stub';

const crypto = require('crypto');
const db = require('../src/db');
const service = require('../src/services/jobDispatchService');

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanDb() {
  try { db.run('PRAGMA foreign_keys = OFF'); } catch (_) {}
  for (const t of ['credit_holds', 'escrow_holds', 'job_lifecycle_events', 'quota_log',
    'renter_quota', 'jobs', 'renters', 'providers']) {
    try { db.run(`DELETE FROM ${t}`); } catch (_) {}
  }
  try { db.run('PRAGMA foreign_keys = ON'); } catch (_) {}
}

function createRenter(balanceHalala = 10_000) {
  const id = 'r-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex');
  db.prepare(
    `INSERT INTO renters (name, email, api_key, status, balance_halala, created_at)
     VALUES (?, ?, ?, 'active', ?, datetime('now'))`
  ).run(`Renter-${id}`, `${id}@test.local`, `key-${id}`, balanceHalala);
  return db.get('SELECT * FROM renters ORDER BY id DESC LIMIT 1');
}

function createProvider({ status = 'online', gpuModel = 'RTX 4090' } = {}) {
  const id = 'p-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex');
  db.prepare(
    `INSERT INTO providers (name, email, gpu_model, os, api_key, status, vram_gb, gpu_vram_mib,
      price_per_min_halala, uptime_percent, last_heartbeat, created_at)
     VALUES (?, ?, ?, 'Linux', ?, ?, 24, 24576, 10, 99, datetime('now'), datetime('now'))`
  ).run(`Provider-${id}`, `${id}@test.local`, gpuModel, `pkey-${id}`, status);
  return db.get('SELECT * FROM providers ORDER BY id DESC LIMIT 1');
}

function createJob(renterId, providerId = null, status = 'pending') {
  const jobId = 'job-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex');
  db.prepare(
    `INSERT INTO jobs (job_id, renter_id, provider_id, job_type, status, cost_halala,
      duration_minutes, pricing_class, submitted_at, created_at)
     VALUES (?, ?, ?, 'llm_inference', ?, 500, 5, 'standard', datetime('now'), datetime('now'))`
  ).run(jobId, renterId, providerId, status);
  return db.get('SELECT * FROM jobs WHERE job_id = ?', jobId);
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeAll(() => {
  // Trigger service DB init (creates credit_holds table) before any test runs
  service.getHold('__init__');
});

beforeEach(() => cleanDb());

// ── getAvailableBalance ───────────────────────────────────────────────────────

describe('getAvailableBalance', () => {
  it('returns full balance when no holds exist', () => {
    const renter = createRenter(5_000);
    const bal = service.getAvailableBalance(db, renter.id);
    expect(bal.balance).toBe(5_000);
    expect(bal.reserved).toBe(0);
    expect(bal.available).toBe(5_000);
  });

  it('subtracts held credit holds from available', () => {
    const renter = createRenter(5_000);
    db.prepare(
      `INSERT INTO credit_holds (id, renter_id, job_id, amount_halala, status, created_at)
       VALUES (?, ?, 'job-held-1', 1_000, 'held', datetime('now'))`
    ).run('h1', renter.id);

    const bal = service.getAvailableBalance(db, renter.id);
    expect(bal.reserved).toBe(1_000);
    expect(bal.available).toBe(4_000);
  });

  it('does not subtract settled or released holds', () => {
    const renter = createRenter(3_000);
    db.prepare(
      `INSERT INTO credit_holds (id, renter_id, job_id, amount_halala, status, created_at)
       VALUES (?, ?, 'job-settled-1', 500, 'settled', datetime('now'))`
    ).run('h2', renter.id);

    const bal = service.getAvailableBalance(db, renter.id);
    expect(bal.reserved).toBe(0);
    expect(bal.available).toBe(3_000);
  });
});

// ── dispatch ──────────────────────────────────────────────────────────────────

describe('dispatch', () => {
  it('creates a credit hold for the estimated cost', async () => {
    const renter = createRenter(10_000);
    const job = createJob(renter.id);

    const result = await service.dispatch(renter.id, job.job_id, 500, {});

    expect(result.holdId).toBeDefined();
    const hold = db.get('SELECT * FROM credit_holds WHERE job_id = ?', job.job_id);
    expect(hold).toBeDefined();
    expect(hold.status).toBe('held');
    expect(hold.amount_halala).toBe(500);
    expect(hold.renter_id).toBe(renter.id);
  });

  it('assigns job to an online provider when one is available', async () => {
    createProvider(); // creates an online provider
    const renter = createRenter(10_000);
    const job = createJob(renter.id);

    const result = await service.dispatch(renter.id, job.job_id, 500, {
      job_type: 'llm_inference',
    });

    expect(result.assigned).toBe(true);
    expect(result.queued).toBe(false);
  });

  it('queues job when no provider is available', async () => {
    // No providers in DB
    const renter = createRenter(10_000);
    const job = createJob(renter.id);

    const result = await service.dispatch(renter.id, job.job_id, 500, {});

    expect(result.assigned).toBe(false);
    expect(result.queued).toBe(true);

    // Hold still created even when queued
    const hold = db.get('SELECT * FROM credit_holds WHERE job_id = ?', job.job_id);
    expect(hold).toBeDefined();
    expect(hold.status).toBe('held');
  });

  it('throws INSUFFICIENT_CREDITS when available balance is too low', async () => {
    const renter = createRenter(100); // only 100 halala
    const job = createJob(renter.id);

    await expect(
      service.dispatch(renter.id, job.job_id, 500, {})
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
      available: 100,
      required: 500,
    });
  });

  it('is idempotent — duplicate dispatch reuses existing hold', async () => {
    const renter = createRenter(10_000);
    const job = createJob(renter.id);

    const r1 = await service.dispatch(renter.id, job.job_id, 500, {});
    const r2 = await service.dispatch(renter.id, job.job_id, 500, {});

    expect(r1.holdId).toBe(r2.holdId);

    const holds = db.all(
      'SELECT * FROM credit_holds WHERE job_id = ?', job.job_id
    );
    expect(holds.length).toBe(1);
  });

  it('accounts for existing holds when checking available balance', async () => {
    const renter = createRenter(1_000);

    // Place an existing hold for 900 — only 100 available
    db.prepare(
      `INSERT INTO credit_holds (id, renter_id, job_id, amount_halala, status, created_at)
       VALUES ('existing-hold', ?, 'other-job', 900, 'held', datetime('now'))`
    ).run(renter.id);

    const job = createJob(renter.id);

    await expect(
      service.dispatch(renter.id, job.job_id, 500, {}) // needs 500, only 100 available
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
  });
});

// ── completeJob ───────────────────────────────────────────────────────────────

describe('completeJob', () => {
  it('debits actual cost from renter balance and settles the hold', async () => {
    const renter = createRenter(10_000);
    const job = createJob(renter.id);

    await service.dispatch(renter.id, job.job_id, 800, {}); // hold 800

    const result = await service.completeJob(job.job_id, 500); // actual: 500

    expect(result.settled).toBe(true);
    expect(result.actualCostHalala).toBe(500);
    expect(result.refundedHalala).toBe(300); // 800 - 500

    // Balance reduced by actual cost only
    const updatedRenter = db.get('SELECT balance_halala FROM renters WHERE id = ?', renter.id);
    expect(updatedRenter.balance_halala).toBe(10_000 - 500);

    // Hold marked settled
    const hold = db.get('SELECT * FROM credit_holds WHERE job_id = ?', job.job_id);
    expect(hold.status).toBe('settled');
    expect(hold.actual_amount_halala).toBe(500);
    expect(hold.resolved_at).toBeDefined();
  });

  it('returns settled:false when no hold exists (legacy job)', async () => {
    const renter = createRenter(5_000);
    const job = createJob(renter.id);
    // Do NOT dispatch — no hold

    const result = await service.completeJob(job.job_id, 200);
    expect(result.settled).toBe(false);

    // Balance unchanged
    const updatedRenter = db.get('SELECT balance_halala FROM renters WHERE id = ?', renter.id);
    expect(updatedRenter.balance_halala).toBe(5_000);
  });

  it('handles zero actual cost (cancelled before any execution)', async () => {
    const renter = createRenter(5_000);
    const job = createJob(renter.id);
    await service.dispatch(renter.id, job.job_id, 400, {});

    const result = await service.completeJob(job.job_id, 0);
    expect(result.settled).toBe(true);
    expect(result.actualCostHalala).toBe(0);
    expect(result.refundedHalala).toBe(400); // full refund

    // Balance unchanged (no debit for 0-cost)
    const updatedRenter = db.get('SELECT balance_halala FROM renters WHERE id = ?', renter.id);
    expect(updatedRenter.balance_halala).toBe(5_000);
  });
});

// ── failJob ───────────────────────────────────────────────────────────────────

describe('failJob', () => {
  it('releases the credit hold without deducting renter balance', async () => {
    const renter = createRenter(10_000);
    const job = createJob(renter.id);
    await service.dispatch(renter.id, job.job_id, 600, {});

    const result = await service.failJob(job.job_id);

    expect(result.released).toBe(true);
    expect(result.releasedHalala).toBe(600);

    // Balance unchanged — renter not charged for failure
    const updatedRenter = db.get('SELECT balance_halala FROM renters WHERE id = ?', renter.id);
    expect(updatedRenter.balance_halala).toBe(10_000);

    // Hold released
    const hold = db.get('SELECT * FROM credit_holds WHERE job_id = ?', job.job_id);
    expect(hold.status).toBe('released');
    expect(hold.actual_amount_halala).toBe(0);
    expect(hold.resolved_at).toBeDefined();
  });

  it('returns released:false when no hold exists', async () => {
    const renter = createRenter(5_000);
    const job = createJob(renter.id);

    const result = await service.failJob(job.job_id);
    expect(result.released).toBe(false);
    expect(result.releasedHalala).toBe(0);
  });

  it('released hold counts as zero reservation (balance available again)', async () => {
    const renter = createRenter(1_000);
    const job1 = createJob(renter.id);
    const job2 = createJob(renter.id);

    // Hold all balance on job1
    await service.dispatch(renter.id, job1.job_id, 1_000, {});

    // Now balance is unavailable
    await expect(
      service.dispatch(renter.id, job2.job_id, 100, {})
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });

    // Fail job1 — releases hold
    await service.failJob(job1.job_id);

    // Now job2 can be dispatched
    const result = await service.dispatch(renter.id, job2.job_id, 100, {});
    expect(result.holdId).toBeDefined();
  });
});

// ── getHold ───────────────────────────────────────────────────────────────────

describe('getHold', () => {
  it('returns the credit hold record for a job', async () => {
    const renter = createRenter(5_000);
    const job = createJob(renter.id);
    await service.dispatch(renter.id, job.job_id, 300, {});

    const hold = service.getHold(job.job_id);
    expect(hold).toBeDefined();
    expect(hold.status).toBe('held');
    expect(hold.amount_halala).toBe(300);
  });

  it('returns undefined for a job with no hold', () => {
    expect(service.getHold('nonexistent-job')).toBeUndefined();
  });
});
