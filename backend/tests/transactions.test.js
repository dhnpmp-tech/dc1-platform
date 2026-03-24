// Transaction History API tests — DCP-771
// Verifies pagination, CSV headers, date filters, SAR/USD conversion, and auth.
'use strict';

process.env.DC1_DB_PATH = ':memory:';

const http = require('http');
const crypto = require('crypto');
const db = require('../src/db');

// ─── SIMPLE TEST RUNNER ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅  ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌  ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'Expected equal'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}

// ─── HTTP HELPER ─────────────────────────────────────────────────────────────

const PORT = 19277;

function request(method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port: PORT, path, method, headers: { ...headers } };
    let bodyStr;
    if (body) {
      bodyStr = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let json = null;
        try { json = JSON.parse(raw); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json, text: raw });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── SEED HELPERS ────────────────────────────────────────────────────────────

const SAR_PER_USD = 3.75;
const HALALA_PER_USD = 375;

function seedRenter(email, apiKey) {
  const result = db.run(
    `INSERT INTO renters (name, email, api_key, status, balance_halala, created_at)
     VALUES (?, ?, ?, 'active', 0, ?)`,
    `Test Renter ${email}`, email, apiKey, new Date().toISOString()
  );
  return result.lastInsertRowid;
}

function seedLedgerEntry(renterId, direction, amountHalala, source, jobId, note, createdAt) {
  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO renter_credit_ledger (id, renter_id, amount_halala, direction, source, job_id, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, renterId, amountHalala, direction, source, jobId || null, note || null, createdAt
  );
  return id;
}

function seedProvider(email, apiKey) {
  const result = db.run(
    `INSERT INTO providers (name, email, api_key, gpu_model, status, claimable_earnings_halala, created_at)
     VALUES (?, ?, ?, 'RTX 4090', 'active', 0, ?)`,
    `Test Provider ${email}`, email, apiKey, new Date().toISOString()
  );
  return result.lastInsertRowid;
}

function seedJob(providerId, costHalala, status, completedAt) {
  const jobId = `job-${crypto.randomBytes(8).toString('hex')}`;
  db.run(
    `INSERT INTO jobs (job_id, provider_id, status, cost_halala, completed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    jobId, providerId, status, costHalala, completedAt, new Date().toISOString()
  );
  return jobId;
}

// ─── TEST SUITE ──────────────────────────────────────────────────────────────

async function run() {
  // Start a minimal express app with only the transaction routes
  const express = require('express');
  const app = express();
  app.use(express.json());
  const { renterRouter, providerRouter } = require('../src/routes/transactions');
  app.use('/api/renters', renterRouter);
  app.use('/api/providers', providerRouter);

  const server = await new Promise((resolve) => {
    const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
  });

  // ─── RENTER TRANSACTION TESTS ─────────────────────────────────────────────

  const renterKey = 'dc1-renter-txtest-' + crypto.randomBytes(8).toString('hex');
  let renterId;

  await test('Setup: seed renter + ledger entries', async () => {
    renterId = seedRenter(`txtest-renter-${Date.now()}@test.dcp`, renterKey);
    // 3 credits + 2 debits
    seedLedgerEntry(renterId, 'credit', 37500, 'topup',      null, 'Top-up $100', '2026-02-01T10:00:00.000Z');
    seedLedgerEntry(renterId, 'debit',   7500, 'job_charge', 'job-001', 'Job run',    '2026-02-10T12:00:00.000Z');
    seedLedgerEntry(renterId, 'debit',   3750, 'job_charge', 'job-002', 'Job run 2',  '2026-02-15T14:00:00.000Z');
    seedLedgerEntry(renterId, 'credit', 18750, 'topup',      null, 'Top-up $50',  '2026-03-01T09:00:00.000Z');
    seedLedgerEntry(renterId, 'credit',  1875, 'refund',     'job-003', 'Refund',    '2026-03-10T08:00:00.000Z');
    assert(true, 'seeded');
  });

  await test('GET /api/renters/:id/transactions — returns list with correct structure', async () => {
    const r = await request('GET', `/api/renters/${renterId}/transactions`, {
      headers: { 'x-renter-key': renterKey },
    });
    assertEq(r.status, 200, 'status');
    assert(Array.isArray(r.body.transactions), 'has transactions array');
    assert(r.body.pagination, 'has pagination');
    assertEq(r.body.pagination.total, 5, 'total = 5 entries');

    const tx = r.body.transactions[0]; // most recent
    assert(typeof tx.id === 'string', 'id is string');
    assert(typeof tx.type === 'string', 'type is string');
    assert(tx.direction === 'credit', 'direction present');
    assert(typeof tx.amount_usd === 'number', 'amount_usd is number');
    assert(typeof tx.amount_sar === 'number', 'amount_sar is number');
    assert(typeof tx.balance_after_usd === 'number', 'balance_after_usd present');
    assert(typeof tx.balance_after_sar === 'number', 'balance_after_sar present');
    assert(typeof tx.created_at === 'string', 'created_at is string');
  });

  await test('GET /api/renters/:id/transactions — SAR conversion: 375 halala = $1 USD = 3.75 SAR', async () => {
    const r = await request('GET', `/api/renters/${renterId}/transactions`, {
      headers: { 'x-renter-key': renterKey },
    });
    assertEq(r.status, 200, 'status');
    // Find the $100 top-up (37500 halala)
    const topup = r.body.transactions.find((t) => t.type === 'topup' && t.amount_usd === 100);
    assert(topup, 'found $100 top-up');
    assertEq(topup.amount_usd, 100, 'amount_usd = 100');
    assertEq(topup.amount_sar, 375, 'amount_sar = 375');
  });

  await test('GET /api/renters/:id/transactions — date filter works', async () => {
    const r = await request('GET', `/api/renters/${renterId}/transactions?from=2026-03-01T00:00:00.000Z`, {
      headers: { 'x-renter-key': renterKey },
    });
    assertEq(r.status, 200, 'status');
    assertEq(r.body.pagination.total, 2, 'only 2 entries in March');
  });

  await test('GET /api/renters/:id/transactions — type filter works', async () => {
    const r = await request('GET', `/api/renters/${renterId}/transactions?type=job_charge`, {
      headers: { 'x-renter-key': renterKey },
    });
    assertEq(r.status, 200, 'status');
    assertEq(r.body.pagination.total, 2, 'only 2 job_charge entries');
    assert(r.body.transactions.every((t) => t.type === 'job_charge'), 'all type=job_charge');
  });

  await test('GET /api/renters/:id/transactions — pagination: limit + offset', async () => {
    const r = await request('GET', `/api/renters/${renterId}/transactions?limit=2&offset=0`, {
      headers: { 'x-renter-key': renterKey },
    });
    assertEq(r.status, 200, 'status');
    assertEq(r.body.transactions.length, 2, '2 results');
    assertEq(r.body.pagination.has_more, true, 'has_more = true');

    const r2 = await request('GET', `/api/renters/${renterId}/transactions?limit=2&offset=4`, {
      headers: { 'x-renter-key': renterKey },
    });
    assertEq(r2.body.transactions.length, 1, '1 result at offset 4');
    assertEq(r2.body.pagination.has_more, false, 'has_more = false at end');
  });

  await test('GET /api/renters/:id/transactions — 401 with no API key', async () => {
    const r = await request('GET', `/api/renters/${renterId}/transactions`);
    assertEq(r.status, 401, '401 without key');
  });

  await test('GET /api/renters/:id/transactions — 403 with wrong renter key', async () => {
    const otherKey = 'dc1-renter-other-' + crypto.randomBytes(8).toString('hex');
    const otherId = seedRenter(`other-${Date.now()}@test.dcp`, otherKey);
    const r = await request('GET', `/api/renters/${renterId}/transactions`, {
      headers: { 'x-renter-key': otherKey }, // valid key, wrong renter ID
    });
    assertEq(r.status, 403, '403 cross-renter access denied');
  });

  await test('GET /api/renters/:id/transactions/export — returns valid CSV', async () => {
    const r = await request('GET', `/api/renters/${renterId}/transactions/export`, {
      headers: { 'x-renter-key': renterKey },
    });
    assertEq(r.status, 200, 'status 200');
    assert(r.headers['content-type'].includes('text/csv'), 'content-type is text/csv');
    assert(r.headers['content-disposition'].includes('attachment'), 'content-disposition is attachment');

    const lines = r.text.trim().split('\r\n');
    assert(lines.length >= 2, 'at least header + 1 data row');

    const header = lines[0];
    assert(header.includes('Date'), 'header: Date');
    assert(header.includes('Type'), 'header: Type');
    assert(header.includes('Direction'), 'header: Direction');
    assert(header.includes('Description'), 'header: Description');
    assert(header.includes('Amount USD'), 'header: Amount USD');
    assert(header.includes('Amount SAR'), 'header: Amount SAR');
    assert(header.includes('Balance After'), 'header: Balance After');
    assertEq(lines.length, 6, '1 header + 5 data rows'); // 5 ledger entries
  });

  await test('GET /api/renters/:id/summary — returns monthly stats', async () => {
    const r = await request('GET', `/api/renters/${renterId}/summary`, {
      headers: { 'x-renter-key': renterKey },
    });
    assertEq(r.status, 200, 'status 200');
    assert(typeof r.body.current_month_usd === 'number', 'current_month_usd');
    assert(typeof r.body.current_month_sar === 'number', 'current_month_sar');
    assert(typeof r.body.last_month_usd === 'number', 'last_month_usd');
    assert(typeof r.body.last_month_sar === 'number', 'last_month_sar');
    assert(typeof r.body.total_jobs === 'number', 'total_jobs');
    assert(typeof r.body.avg_job_cost_usd === 'number', 'avg_job_cost_usd');
    assertEq(r.body.total_jobs, 2, 'total_jobs = 2 job_charge entries');
  });

  // ─── PROVIDER TRANSACTION TESTS ────────────────────────────────────────────

  const providerKey = 'dc1-provider-txtest-' + crypto.randomBytes(8).toString('hex');
  let providerId;

  await test('Setup: seed provider + completed jobs', async () => {
    providerId = seedProvider(`txtest-provider-${Date.now()}@test.dcp`, providerKey);
    // 37500 halala = $100 gross. Net = $85 after 15% fee.
    seedJob(providerId, 37500, 'completed', '2026-02-05T10:00:00.000Z');
    seedJob(providerId, 18750, 'completed', '2026-02-20T11:00:00.000Z');
    seedJob(providerId, 7500,  'completed', '2026-03-05T09:00:00.000Z');
    // pending job should NOT appear in earnings
    seedJob(providerId, 9999,  'pending',   null);
    assert(true, 'seeded');
  });

  await test('GET /api/providers/:id/transactions — returns earnings list', async () => {
    const r = await request('GET', `/api/providers/${providerId}/transactions`, {
      headers: { 'x-provider-key': providerKey },
    });
    assertEq(r.status, 200, 'status 200');
    assert(Array.isArray(r.body.transactions), 'has transactions array');
    assertEq(r.body.pagination.total, 3, 'only 3 completed jobs');

    const tx = r.body.transactions[0];
    assert(typeof tx.job_id === 'string', 'job_id present');
    assert(typeof tx.amount_usd === 'number', 'amount_usd present');
    assert(typeof tx.amount_sar === 'number', 'amount_sar present');
    assert(typeof tx.platform_fee_usd === 'number', 'platform_fee_usd present');
    assert(typeof tx.platform_fee_sar === 'number', 'platform_fee_sar present');
    assert(typeof tx.net_amount_usd === 'number', 'net_amount_usd present');
    assert(typeof tx.net_amount_sar === 'number', 'net_amount_sar present');
  });

  await test('GET /api/providers/:id/transactions — 15% platform fee calculation correct', async () => {
    const r = await request('GET', `/api/providers/${providerId}/transactions`, {
      headers: { 'x-provider-key': providerKey },
    });
    // The $100 gross job (37500 halala)
    const job100 = r.body.transactions.find((t) => t.amount_usd === 100);
    assert(job100, 'found $100 job');
    assertEq(job100.platform_fee_usd, 15, 'fee = $15 (15%)');
    assertEq(job100.net_amount_usd, 85, 'net = $85');
    assertEq(job100.amount_sar, 375, 'gross SAR = 375');
    assertEq(job100.platform_fee_sar, 56.25, 'fee SAR = 56.25');
    assertEq(job100.net_amount_sar, 318.75, 'net SAR = 318.75');
  });

  await test('GET /api/providers/:id/transactions — date filter works', async () => {
    const r = await request('GET', `/api/providers/${providerId}/transactions?from=2026-03-01T00:00:00.000Z`, {
      headers: { 'x-provider-key': providerKey },
    });
    assertEq(r.status, 200, 'status 200');
    assertEq(r.body.pagination.total, 1, 'only 1 job in March');
  });

  await test('GET /api/providers/:id/transactions — pagination works', async () => {
    const r = await request('GET', `/api/providers/${providerId}/transactions?limit=2&offset=0`, {
      headers: { 'x-provider-key': providerKey },
    });
    assertEq(r.body.transactions.length, 2, '2 results');
    assertEq(r.body.pagination.has_more, true, 'has_more = true');
  });

  await test('GET /api/providers/:id/transactions — 401 with no API key', async () => {
    const r = await request('GET', `/api/providers/${providerId}/transactions`);
    assertEq(r.status, 401, '401 without key');
  });

  await test('GET /api/providers/:id/transactions/export — returns valid CSV', async () => {
    const r = await request('GET', `/api/providers/${providerId}/transactions/export`, {
      headers: { 'x-provider-key': providerKey },
    });
    assertEq(r.status, 200, 'status 200');
    assert(r.headers['content-type'].includes('text/csv'), 'content-type is text/csv');

    const lines = r.text.trim().split('\r\n');
    assertEq(lines.length, 4, '1 header + 3 data rows');

    const header = lines[0];
    assert(header.includes('Date'), 'header: Date');
    assert(header.includes('Job ID'), 'header: Job ID');
    assert(header.includes('Gross USD'), 'header: Gross USD');
    assert(header.includes('Gross SAR'), 'header: Gross SAR');
    assert(header.includes('Platform Fee USD'), 'header: Platform Fee USD');
    assert(header.includes('Net Amount USD'), 'header: Net Amount USD');
    assert(header.includes('Net Amount SAR'), 'header: Net Amount SAR');
  });

  await test('GET /api/providers/:id/earnings/summary — returns financial summary', async () => {
    const r = await request('GET', `/api/providers/${providerId}/earnings/summary`, {
      headers: { 'x-provider-key': providerKey },
    });
    assertEq(r.status, 200, 'status 200');
    assert(typeof r.body.pending_payout_usd === 'number', 'pending_payout_usd');
    assert(typeof r.body.pending_payout_sar === 'number', 'pending_payout_sar');
    assert(typeof r.body.total_paid_usd === 'number', 'total_paid_usd');
    assert(typeof r.body.lifetime_earnings_net_usd === 'number', 'lifetime_earnings_net_usd');
    assert(typeof r.body.current_month_net_usd === 'number', 'current_month_net_usd');
    assertEq(r.body.platform_fee_rate, 0.15, 'platform_fee_rate = 0.15');

    // Lifetime net = (37500 + 18750 + 7500) * 0.85 = 63750 * 0.85 = 54188 halala
    // = 54188 / 375 = ~144.5 USD
    assert(r.body.lifetime_earnings_net_usd > 0, 'lifetime > 0');
  });

  server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
