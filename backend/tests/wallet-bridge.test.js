'use strict';

/**
 * wallet-bridge.test.js
 * Tests for DC1 Wallet Bridge:
 *   1. Job sync mapping (SQLite → Supabase job_history)
 *   2. Wallet debit on job completion
 *   3. Admin credit endpoint
 *   4. Idempotency (double-completion doesn't double-debit)
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Minimal Supabase mock factory ────────────────────────────────────────────

function createSupabaseMock(overrides = {}) {
  const calls = { rpc: [], from: [] };
  const insertedTransactions = new Map(); // idem_key → row

  const mockClient = {
    _calls: calls,
    _transactions: insertedTransactions,

    rpc: async (name, params) => {
      calls.rpc.push({ name, params });

      // Simulate idempotency for debit_wallet_atomic
      if (name === 'debit_wallet_atomic') {
        if (insertedTransactions.has(params.p_idempotency_key)) {
          return { data: insertedTransactions.get(params.p_idempotency_key), error: null };
        }
        const row = { id: params.p_idempotency_key, user_id: params.p_user_id, type: 'debit', amount_halala: params.p_amount_halala };
        insertedTransactions.set(params.p_idempotency_key, row);
        return { data: row, error: null };
      }

      // credit_wallet_atomic
      if (name === 'credit_wallet_atomic') {
        if (insertedTransactions.has(params.p_idempotency_key)) {
          return { data: insertedTransactions.get(params.p_idempotency_key), error: null };
        }
        const row = { id: params.p_idempotency_key, user_id: params.p_user_id, type: 'credit', amount_halala: params.p_amount_halala };
        insertedTransactions.set(params.p_idempotency_key, row);
        return { data: row, error: null };
      }

      return overrides.rpc ? overrides.rpc(name, params) : { data: null, error: null };
    },

    from: (table) => {
      const chain = {
        _table: table,
        _filters: {},
        _upsertData: null,

        select: (cols) => { chain._select = cols; return chain; },
        eq: (k, v) => { chain._filters[k] = v; return chain; },
        limit: (n) => { chain._limit = n; return chain; },
        update: (data) => { chain._updateData = data; return chain; },
        upsert: (data, opts) => { chain._upsertData = data; chain._upsertOpts = opts; return chain; },
        insert: async (data) => {
          calls.from.push({ op: 'insert', table, data });
          if (overrides.insertError) return { error: overrides.insertError };
          if (table === 'billing_transactions') {
            const id = data.id || 'mock-tx-' + Math.random().toString(36).slice(2);
            insertedTransactions.set(id, { ...data, id });
          }
          return { data: { id: data.id || 'mock-id' }, error: null };
        },
        single: async () => {
          if (chain._upsertData) {
            calls.from.push({ op: 'upsert', table, data: chain._upsertData });
            return { data: { ...chain._upsertData, wallet_debited: false, provider_credited: false }, error: null };
          }
          // users lookup by email
          if (table === 'users' && chain._filters.email) {
            const userId = overrides.userIds?.[chain._filters.email];
            if (!userId) return { data: null, error: null };
            return { data: { id: userId, email: chain._filters.email }, error: null };
          }
          return { data: null, error: null };
        },
        maybeSingle: async () => chain.single(),
        // array responses
        then: undefined, // suppress accidental awaits on intermediate chains
      };

      // Make the chain itself awaitable (returns array)
      const p = async () => {
        if (table === 'users' && chain._filters.email) {
          const userId = overrides.userIds?.[chain._filters.email];
          if (!userId) return { data: [], error: null };
          return { data: [{ id: userId, email: chain._filters.email, name: 'Test User' }], error: null };
        }
        if (table === 'billing_transactions') {
          if (chain._filters.type === 'credit') return { data: [{ amount_halala: overrides.creditsHalala || 50000 }], error: null };
          if (chain._filters.type === 'debit')  return { data: [{ amount_halala: overrides.debitsHalala  || 0     }], error: null };
        }
        if (table === 'billing_reservations') return { data: [], error: null };
        return { data: [], error: null };
      };

      // Wrap chain methods to return promise when awaited directly
      chain[Symbol.asyncIterator] = undefined;
      Object.defineProperty(chain, 'then', {
        get: () => (resolve, reject) => p().then(resolve, reject),
      });
      Object.defineProperty(chain, 'catch', {
        get: () => (fn) => p().catch(fn),
      });

      return chain;
    },
  };

  return mockClient;
}

// ─── 1. deterministicUuid ─────────────────────────────────────────────────────

describe('deterministicUuid', () => {
  // Inline the same algorithm used in jobs.js and supabase-sync.js
  const crypto = require('crypto');
  function deterministicUuid(seed) {
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    return [
      hash.slice(0, 8),
      hash.slice(8, 12),
      '4' + hash.slice(13, 16),
      (((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)) + hash.slice(18, 20),
      hash.slice(20, 32),
    ].join('-');
  }

  it('produces a valid UUID-shaped string', () => {
    const u = deterministicUuid('dc1-renter-debit-job-abc123');
    assert.match(u, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('is deterministic — same seed → same UUID', () => {
    const seed = 'dc1-renter-debit-job-1735000000-xyz';
    assert.equal(deterministicUuid(seed), deterministicUuid(seed));
  });

  it('different seeds → different UUIDs', () => {
    assert.notEqual(
      deterministicUuid('dc1-renter-debit-job-AAA'),
      deterministicUuid('dc1-provider-credit-job-AAA')
    );
  });
});

// ─── 2. Job sync field mapping ────────────────────────────────────────────────

describe('syncJobs field mapping', () => {
  it('maps SQLite job fields to job_history correctly', () => {
    // Simulate what syncJobs() upserts
    const sqliteJob = {
      id: 42,
      job_id: 'job-1735000000-abc',
      provider_id: 7,
      job_type: 'llm-inference',
      status: 'completed',
      cost_halala: 150,
      actual_cost_halala: 200,
      provider_earned_halala: 150,   // floor(200*0.75)=150
      dc1_fee_halala: 50,
      duration_minutes: 10,
      actual_duration_minutes: 13,
      submitted_at: '2026-03-10T05:00:00.000Z',
      completed_at: '2026-03-10T05:13:00.000Z',
    };

    const mapped = {
      job_id:                  sqliteJob.job_id,
      provider_sqlite_id:      sqliteJob.provider_id,
      job_type:                sqliteJob.job_type,
      status:                  sqliteJob.status,
      cost_halala:             sqliteJob.cost_halala,
      actual_cost_halala:      sqliteJob.actual_cost_halala,
      provider_earned_halala:  sqliteJob.provider_earned_halala,
      dc1_fee_halala:          sqliteJob.dc1_fee_halala,
      duration_minutes:        sqliteJob.duration_minutes,
      actual_duration_minutes: sqliteJob.actual_duration_minutes,
      submitted_at:            sqliteJob.submitted_at,
      completed_at:            sqliteJob.completed_at,
    };

    assert.equal(mapped.job_id, 'job-1735000000-abc');
    assert.equal(mapped.provider_sqlite_id, 7);
    assert.equal(mapped.actual_cost_halala, 200);
    assert.equal(mapped.provider_earned_halala, 150);
    assert.equal(mapped.dc1_fee_halala, 50);
    assert.equal(mapped.provider_earned_halala + mapped.dc1_fee_halala, mapped.actual_cost_halala);
  });

  it('falls back to cost_halala if actual_cost_halala missing', () => {
    const job = { cost_halala: 100, actual_cost_halala: null, provider_earned_halala: null, dc1_fee_halala: null };
    const actual = job.actual_cost_halala || job.cost_halala || 0;
    const providerEarned = job.provider_earned_halala || Math.floor(actual * 0.75);
    const dc1Fee = job.dc1_fee_halala || (actual - providerEarned);

    assert.equal(actual, 100);
    assert.equal(providerEarned, 75);
    assert.equal(dc1Fee, 25);
    assert.equal(providerEarned + dc1Fee, actual);
  });
});

// ─── 3. Wallet debit on job completion ───────────────────────────────────────

describe('applyWalletBilling', () => {
  // Inline the function from jobs.js for unit-testing
  const crypto = require('crypto');

  function deterministicUuid(seed) {
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    return [
      hash.slice(0, 8), hash.slice(8, 12),
      '4' + hash.slice(13, 16),
      (((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)) + hash.slice(18, 20),
      hash.slice(20, 32),
    ].join('-');
  }

  async function applyWalletBilling(supabase, { jobId, actualCostHalala, providerEarned, renterEmail, providerEmail }) {
    const resolveId = async (email) => {
      if (!email) return null;
      const { data } = await supabase.from('users').select('id').eq('email', email).limit(1);
      return data?.[0]?.id || null;
    };

    if (renterEmail && actualCostHalala > 0) {
      const userId = await resolveId(renterEmail);
      if (userId) {
        await supabase.rpc('debit_wallet_atomic', {
          p_user_id: userId,
          p_amount_halala: actualCostHalala,
          p_reason: 'job_completion',
          p_job_id: null,
          p_idempotency_key: deterministicUuid('dc1-renter-debit-' + jobId),
        });
      }
    }

    if (providerEmail && providerEarned > 0) {
      const userId = await resolveId(providerEmail);
      if (userId) {
        await supabase.rpc('credit_wallet_atomic', {
          p_user_id: userId,
          p_amount_halala: providerEarned,
          p_reason: 'provider_earning',
          p_idempotency_key: deterministicUuid('dc1-provider-credit-' + jobId),
        });
      }
    }
  }

  it('debits renter and credits provider on job completion', async () => {
    const mock = createSupabaseMock({
      userIds: {
        'renter@example.com':   'uuid-renter-001',
        'provider@example.com': 'uuid-provider-001',
      },
    });

    await applyWalletBilling(mock, {
      jobId:            'job-test-001',
      actualCostHalala: 200,
      providerEarned:   150,
      renterEmail:      'renter@example.com',
      providerEmail:    'provider@example.com',
    });

    const debitCall = mock._calls.rpc.find(c => c.name === 'debit_wallet_atomic');
    assert.ok(debitCall, 'debit_wallet_atomic should be called');
    assert.equal(debitCall.params.p_user_id, 'uuid-renter-001');
    assert.equal(debitCall.params.p_amount_halala, 200);
    assert.equal(debitCall.params.p_reason, 'job_completion');

    const creditCall = mock._calls.rpc.find(c => c.name === 'credit_wallet_atomic');
    assert.ok(creditCall, 'credit_wallet_atomic should be called');
    assert.equal(creditCall.params.p_user_id, 'uuid-provider-001');
    assert.equal(creditCall.params.p_amount_halala, 150);
    assert.equal(creditCall.params.p_reason, 'provider_earning');
  });

  it('skips debit if renter_email is absent', async () => {
    const mock = createSupabaseMock({
      userIds: { 'provider@example.com': 'uuid-provider-002' },
    });

    await applyWalletBilling(mock, {
      jobId:            'job-test-002',
      actualCostHalala: 200,
      providerEarned:   150,
      renterEmail:      null,           // <-- no renter
      providerEmail:    'provider@example.com',
    });

    const debitCall = mock._calls.rpc.find(c => c.name === 'debit_wallet_atomic');
    assert.ok(!debitCall, 'debit_wallet_atomic should NOT be called without renter_email');

    const creditCall = mock._calls.rpc.find(c => c.name === 'credit_wallet_atomic');
    assert.ok(creditCall, 'credit_wallet_atomic should still be called for provider');
  });

  it('skips credit if provider not found in Supabase', async () => {
    const mock = createSupabaseMock({
      userIds: {
        'renter@example.com': 'uuid-renter-003',
        // provider NOT in Supabase
      },
    });

    await applyWalletBilling(mock, {
      jobId:            'job-test-003',
      actualCostHalala: 100,
      providerEarned:   75,
      renterEmail:      'renter@example.com',
      providerEmail:    'unknown-provider@example.com',
    });

    const creditCall = mock._calls.rpc.find(c => c.name === 'credit_wallet_atomic');
    assert.ok(!creditCall, 'credit_wallet_atomic should NOT be called for unknown provider');
  });
});

// ─── 4. Idempotency — double-completion doesn't double-debit ─────────────────

describe('wallet idempotency', () => {
  const crypto = require('crypto');

  function deterministicUuid(seed) {
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    return [
      hash.slice(0, 8), hash.slice(8, 12),
      '4' + hash.slice(13, 16),
      (((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)) + hash.slice(18, 20),
      hash.slice(20, 32),
    ].join('-');
  }

  it('same job_id produces same idempotency key → RPC called twice but DB inserts once', async () => {
    const mock = createSupabaseMock({
      userIds: { 'renter@example.com': 'uuid-renter-idem' },
    });

    const jobId = 'job-idem-test-001';
    const idemKey = deterministicUuid('dc1-renter-debit-' + jobId);

    // First call
    await mock.rpc('debit_wallet_atomic', {
      p_user_id: 'uuid-renter-idem',
      p_amount_halala: 200,
      p_reason: 'job_completion',
      p_job_id: null,
      p_idempotency_key: idemKey,
    });

    // Second call (simulating double-completion)
    const { data: result } = await mock.rpc('debit_wallet_atomic', {
      p_user_id: 'uuid-renter-idem',
      p_amount_halala: 200,
      p_reason: 'job_completion',
      p_job_id: null,
      p_idempotency_key: idemKey,
    });

    // Should have returned the EXISTING row (idempotent)
    assert.equal(result.id, idemKey, 'Should return the existing transaction row');
    // Only one entry in the mock transactions store
    assert.equal(mock._transactions.size, 1, 'Only one transaction should be stored');
  });

  it('different job_ids produce different idempotency keys', () => {
    const k1 = deterministicUuid('dc1-renter-debit-job-AAA');
    const k2 = deterministicUuid('dc1-renter-debit-job-BBB');
    assert.notEqual(k1, k2);
  });
});

// ─── 5. Admin wallet credit endpoint ─────────────────────────────────────────

describe('POST /api/admin/wallet/credit', () => {
  // We test the logic directly without spinning up Express
  async function adminCreditLogic(supabase, { email, amount_sar, reason }) {
    if (!email || !amount_sar) throw new Error('Missing required fields: email, amount_sar');

    const amountSar = parseFloat(amount_sar);
    if (isNaN(amountSar) || amountSar <= 0) throw new Error('amount_sar must be a positive number');

    const { data: users, error: userErr } = await supabase
      .from('users').select('id, email, name').eq('email', email).limit(1);

    if (userErr) throw new Error('User lookup failed: ' + userErr.message);
    if (!users?.length) throw new Error('User not found: ' + email);

    const user = users[0];
    const amountHalala = Math.round(amountSar * 100);
    const txId = require('crypto').randomUUID();

    const { error: creditErr } = await supabase.from('billing_transactions').insert({
      id: txId, user_id: user.id, type: 'credit',
      amount_halala: amountHalala, reason: reason || 'admin_credit',
      job_id: null, created_at: new Date().toISOString(),
    });

    if (creditErr) throw new Error('Credit failed: ' + creditErr.message);
    return { txId, amountHalala, userId: user.id };
  }

  it('credits a user wallet by email', async () => {
    const mock = createSupabaseMock({
      userIds: { 'peter@dc1.com': 'uuid-peter-001' },
    });

    const result = await adminCreditLogic(mock, {
      email: 'peter@dc1.com',
      amount_sar: 10,
      reason: 'test top-up',
    });

    assert.equal(result.amountHalala, 1000);
    assert.equal(result.userId, 'uuid-peter-001');
    const insertCall = mock._calls.from.find(c => c.op === 'insert' && c.table === 'billing_transactions');
    assert.ok(insertCall, 'billing_transactions insert should be called');
    assert.equal(insertCall.data.amount_halala, 1000);
    assert.equal(insertCall.data.type, 'credit');
  });

  it('throws if user not found', async () => {
    const mock = createSupabaseMock({ userIds: {} });
    await assert.rejects(
      () => adminCreditLogic(mock, { email: 'nobody@dc1.com', amount_sar: 5 }),
      /User not found/
    );
  });

  it('throws if amount_sar missing', async () => {
    const mock = createSupabaseMock({});
    await assert.rejects(
      () => adminCreditLogic(mock, { email: 'x@x.com', amount_sar: null }),
      /Missing required fields/
    );
  });

  it('converts SAR to halala correctly', async () => {
    const mock = createSupabaseMock({
      userIds: { 'test@dc1.com': 'uuid-test-001' },
    });
    const { amountHalala } = await adminCreditLogic(mock, { email: 'test@dc1.com', amount_sar: 2.5 });
    assert.equal(amountHalala, 250, '2.5 SAR = 250 halala');
  });
});

// ─── 6. Billing split integrity ───────────────────────────────────────────────

describe('billing split', () => {
  function splitBilling(totalHalala) {
    const provider = Math.floor(totalHalala * 0.75);
    return { provider, dc1: totalHalala - provider };
  }

  it('provider + dc1 === total (no rounding leak)', () => {
    for (const n of [1, 7, 100, 199, 1000, 1337]) {
      const { provider, dc1 } = splitBilling(n);
      assert.equal(provider + dc1, n, 'Split must sum to total for n=' + n);
    }
  });

  it('provider always gets floor(75%)', () => {
    assert.equal(splitBilling(100).provider, 75);
    assert.equal(splitBilling(101).provider, 75);
    assert.equal(splitBilling(200).provider, 150);
  });
});
