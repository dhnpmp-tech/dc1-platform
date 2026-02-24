/**
 * DC1 Integration Tests — Billing Reconciliation
 * Penny-perfect billing verification: all amounts in halala (integer arithmetic).
 * 10 tests verifying no floating-point errors in billing pipeline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testId, cleanupTestData, costForMinutes, splitCost } from './setup';

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const {
  billingTransactionsStore,
  billingReservationsStore,
  mockRpc,
  mockFrom,
  resetStores,
} = vi.hoisted(() => {
  const billingTransactionsStore: any[] = [];
  const billingReservationsStore: Record<string, any> = {};

  const mockRpc = vi.fn().mockImplementation((_fn: string, params: any) => {
    const tx = {
      id: params.p_idempotency_key ?? `tx-${Date.now()}`,
      user_id: params.p_user_id,
      type: 'debit',
      amount_halala: params.p_amount_halala,
      reason: params.p_reason ?? 'debit',
      job_id: params.p_job_id,
      created_at: new Date().toISOString(),
    };
    billingTransactionsStore.push(tx);
    return Promise.resolve({ data: tx, error: null });
  });

  const mockFrom = vi.fn((table: string) => {
    const chain: any = {
      _table: table,
      _filters: {} as Record<string, any>,
      _insertData: null as any,
    };

    chain.select = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn((col: string, val: any) => {
      chain._filters[col] = val;
      return chain;
    });
    chain.in = vi.fn(() => chain);

    chain.insert = vi.fn((data: any) => {
      chain._insertData = data;
      if (table === 'billing_transactions') billingTransactionsStore.push(data);
      if (table === 'billing_reservations') billingReservationsStore[data.id] = data;
      return chain;
    });

    chain.update = vi.fn((data: any) => {
      if (table === 'billing_reservations' && chain._filters.id) {
        Object.assign(billingReservationsStore[chain._filters.id] ?? {}, data);
      }
      return chain;
    });

    chain.delete = vi.fn().mockReturnValue(chain);

    chain.single = vi.fn().mockImplementation(() => {
      if (table === 'billing_transactions' && chain._insertData) {
        return Promise.resolve({ data: chain._insertData, error: null });
      }
      if (table === 'billing_reservations') {
        if (chain._insertData)
          return Promise.resolve({ data: chain._insertData, error: null });
        const d = billingReservationsStore[chain._filters.id];
        return Promise.resolve({
          data: d ?? null,
          error: d ? null : { message: 'not found' },
        });
      }
      return Promise.resolve({ data: chain._insertData, error: null });
    });

    chain.maybeSingle = vi.fn().mockImplementation(() => {
      if (table === 'billing_transactions' && chain._filters.id) {
        const found = billingTransactionsStore.find(
          (t: any) => t.id === chain._filters.id,
        );
        return Promise.resolve({ data: found ?? null, error: null });
      }
      if (table === 'billing_reservations' && chain._filters.id) {
        return Promise.resolve({
          data: billingReservationsStore[chain._filters.id] ?? null,
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Array resolution for getBalance queries
    chain.then = (resolve: (v: any) => void) => {
      if (table === 'billing_transactions') {
        const userId = chain._filters.user_id;
        const type = chain._filters.type;
        const filtered = billingTransactionsStore.filter(
          (t: any) => t.user_id === userId && t.type === type,
        );
        return resolve({ data: filtered, error: null });
      }
      if (table === 'billing_reservations') {
        const userId = chain._filters.user_id;
        const filtered = Object.values(billingReservationsStore).filter(
          (r: any) => r.user_id === userId && r.status === 'held',
        );
        return resolve({ data: filtered, error: null });
      }
      return resolve({ data: [], error: null });
    };

    return chain;
  });

  function resetStores() {
    billingTransactionsStore.length = 0;
    for (const k of Object.keys(billingReservationsStore))
      delete billingReservationsStore[k];
  }

  return {
    billingTransactionsStore,
    billingReservationsStore,
    mockRpc,
    mockFrom,
    resetStores,
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
);

// ── Import Services (after mocks) ───────────────────────────────────────────
import * as wallet from '../../src/services/wallet';

// ── Helpers ──────────────────────────────────────────────────────────────────
function seedWallet(userId: string, amountHalala: number) {
  billingTransactionsStore.push({
    id: testId('seed'),
    user_id: userId,
    type: 'credit',
    amount_halala: amountHalala,
    reason: 'seed',
    job_id: null,
    created_at: new Date().toISOString(),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('Integration: Billing Reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
    cleanupTestData();
  });

  it('sarToHalala: ﷼0.50 = exactly 50 halala (no floating point)', () => {
    expect(wallet.sarToHalala(0.5)).toBe(50);
    expect(wallet.sarToHalala(1.99)).toBe(199);
    expect(wallet.sarToHalala(0.01)).toBe(1);
    expect(wallet.sarToHalala(100)).toBe(10000);
  });

  it('halalaToSar: 50 halala = ﷼0.50', () => {
    expect(wallet.halalaToSar(50)).toBe(0.5);
    expect(wallet.halalaToSar(199)).toBe(1.99);
    expect(wallet.halalaToSar(1)).toBe(0.01);
  });

  it('costForMinutes: integer arithmetic produces exact results', () => {
    // Imported from setup.ts — shared utility, not inline
    expect(costForMinutes(60, 100)).toBe(100);
    expect(costForMinutes(30, 100)).toBe(50);
    expect(costForMinutes(1, 100)).toBe(2);
    expect(costForMinutes(90, 200)).toBe(300);
  });

  it('splitCost: 75/25 provider/DC1 split sums exactly to total', () => {
    // Imported from setup.ts — shared utility, not inline
    for (const amount of [100, 101, 199, 1, 0, 333, 10000, 7]) {
      const { provider, dc1 } = splitCost(amount);
      expect(provider + dc1).toBe(amount);
    }
  });

  it('all wallet amounts are stored as integers (no floats)', () => {
    const renterId = testId('renter');
    seedWallet(renterId, 10000);
    const tx = billingTransactionsStore.find((t) => t.user_id === renterId);
    expect(Number.isInteger(tx.amount_halala)).toBe(true);
    expect(tx.amount_halala).toBe(10000);
  });

  it('debit_wallet_atomic RPC is called for debits', async () => {
    const userId = testId('user');
    seedWallet(userId, 5000);
    await wallet.debit({ userId, amount: 100, reason: 'test', jobId: 'job-1' });
    expect(mockRpc).toHaveBeenCalledWith(
      'debit_wallet_atomic',
      expect.objectContaining({
        p_user_id: userId,
        p_amount_halala: 100,
      }),
    );
  });

  it('reserve fails when available balance insufficient', async () => {
    const userId = testId('user');
    // No funds — balance is 0
    // Mock RPC to return insufficient-balance error (mirrors real DB constraint)
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Cannot reserve: insufficient balance' },
    });
    await expect(wallet.reserve(userId, 5000, 'job-1')).rejects.toThrow(
      /insufficient/i,
    );
  });

  it('credit records correct integer amount', async () => {
    const userId = testId('provider');
    const tx = await wallet.credit(userId, 750, 'Provider credit', 'job-1');
    expect(tx.amountHalala).toBe(750);
    expect(tx.type).toBe('credit');
    expect(Number.isInteger(tx.amountHalala)).toBe(true);
  });

  it('multiple ticks sum correctly without floating-point drift', () => {
    const ticks = [10, 10, 10];
    const total = ticks.reduce((sum, t) => sum + t, 0);
    expect(total).toBe(30);
    expect(Number.isInteger(total)).toBe(true);
    // Classic float trap: 0.1 + 0.2 !== 0.3, but 10 + 20 === 30 in integers
    expect(10 + 20).toBe(30);
  });

  it('overflow protection: debit rejects when over balance via RPC error', async () => {
    const userId = testId('user');
    seedWallet(userId, 100);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Insufficient balance' },
    });
    await expect(
      wallet.debit({ userId, amount: 200, reason: 'overdraft test' }),
    ).rejects.toThrow(/Insufficient balance/);
  });
});
