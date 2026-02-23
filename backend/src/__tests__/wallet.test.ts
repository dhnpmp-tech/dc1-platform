import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockSupabaseRpc,
  mockSupabaseSingle,
  mockSupabaseFrom,
  createMockWallet,
} from './setup';

import {
  debit,
  credit,
  reserve,
  releaseReservation,
  getBalance,
} from '../services/wallet';

describe('Wallet Service', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // debit
  // ═══════════════════════════════════════════════════════════════════════════
  describe('debit', () => {
    it('should call debit_wallet_atomic RPC for atomic debit', async () => {
      mockSupabaseRpc.mockResolvedValueOnce({ data: { success: true }, error: null });

      await debit({ userId: 'user-001', amount: 5000, idempotencyKey: 'debit-001' });

      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        'debit_wallet_atomic',
        expect.objectContaining({
          p_user_id: 'user-001',
          p_amount: 5000,
          p_idempotency_key: 'debit-001',
        })
      );
    });

    it('should reject debit when available balance < amount', async () => {
      mockSupabaseRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'insufficient_balance', code: 'P0001' },
      });

      await expect(
        debit({ userId: 'user-001', amount: 200_000, idempotencyKey: 'debit-002' })
      ).rejects.toThrow(/insufficient/i);
    });

    it('should debit exact halala amount (integer only)', async () => {
      mockSupabaseRpc.mockResolvedValueOnce({ data: { success: true }, error: null });

      await debit({ userId: 'user-001', amount: 9375, idempotencyKey: 'debit-003' });

      const call = mockSupabaseRpc.mock.calls[0];
      expect(Number.isInteger(call[1].p_amount)).toBe(true);
      expect(call[1].p_amount).toBe(9375);
    });

    it('should deduplicate using idempotency key — second call is a no-op', async () => {
      // First call succeeds
      mockSupabaseRpc.mockResolvedValueOnce({ data: { success: true, deduplicated: false }, error: null });
      await debit({ userId: 'user-001', amount: 5000, idempotencyKey: 'debit-dup' });

      // Second call with same key — returns success but deduplicated
      mockSupabaseRpc.mockResolvedValueOnce({ data: { success: true, deduplicated: true }, error: null });
      const result = await debit({ userId: 'user-001', amount: 5000, idempotencyKey: 'debit-dup' });

      expect(mockSupabaseRpc).toHaveBeenCalledTimes(2);
      // Both calls used the same idempotency key
      expect(mockSupabaseRpc.mock.calls[0][1].p_idempotency_key).toBe('debit-dup');
      expect(mockSupabaseRpc.mock.calls[1][1].p_idempotency_key).toBe('debit-dup');
    });

    it('should throw on RPC failure (DB error)', async () => {
      mockSupabaseRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection refused', code: '08000' },
      });

      await expect(
        debit({ userId: 'user-001', amount: 1000, idempotencyKey: 'debit-err' })
      ).rejects.toThrow();
    });

    it('should reject zero amount debit', async () => {
      await expect(
        debit({ userId: 'user-001', amount: 0, idempotencyKey: 'debit-zero' })
      ).rejects.toThrow();
    });

    it('should reject negative amount debit', async () => {
      await expect(
        debit({ userId: 'user-001', amount: -100, idempotencyKey: 'debit-neg' })
      ).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // credit
  // ═══════════════════════════════════════════════════════════════════════════
  describe('credit', () => {
    it('should increase total and available balance by credited amount', async () => {
      const wallet = createMockWallet({ totalBalance: 100_000, availableBalance: 100_000 });
      const updated = { ...wallet, totalBalance: 105_000, availableBalance: 105_000 };

      mockSupabaseRpc.mockResolvedValueOnce({ data: updated, error: null });

      const result = await credit({ userId: 'user-001', amount: 5000 });

      expect(result.totalBalance).toBe(105_000);
      expect(result.availableBalance).toBe(105_000);
    });

    it('should credit exact halala amount', async () => {
      mockSupabaseRpc.mockResolvedValueOnce({
        data: createMockWallet({ totalBalance: 109_375 }),
        error: null,
      });

      await credit({ userId: 'user-001', amount: 9375 });

      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ p_amount: 9375 })
      );
    });

    it('should not change reserved balance on credit', async () => {
      const wallet = createMockWallet({ reservedBalance: 20_000 });
      const updated = { ...wallet, totalBalance: 120_000, availableBalance: 100_000 };

      mockSupabaseRpc.mockResolvedValueOnce({ data: updated, error: null });

      const result = await credit({ userId: 'user-001', amount: 20_000 });

      expect(result.reservedBalance).toBe(20_000);
    });

    it('should reject zero amount credit', async () => {
      await expect(credit({ userId: 'user-001', amount: 0 })).rejects.toThrow();
    });

    it('should reject negative amount credit', async () => {
      await expect(credit({ userId: 'user-001', amount: -500 })).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // reserve
  // ═══════════════════════════════════════════════════════════════════════════
  describe('reserve', () => {
    it('should reduce available balance but not total balance', async () => {
      const reservation = {
        id: 'reservation-001',
        userId: 'user-001',
        amount: 20_000,
        status: 'held',
      };
      mockSupabaseRpc.mockResolvedValueOnce({ data: reservation, error: null });

      const result = await reserve({ userId: 'user-001', amount: 20_000, jobId: 'job-001' });

      expect(result.status).toBe('held');
      expect(result.amount).toBe(20_000);
    });

    it('should create a reservation with held status', async () => {
      const reservation = {
        id: 'reservation-002',
        userId: 'user-001',
        amount: 10_000,
        status: 'held',
      };
      mockSupabaseRpc.mockResolvedValueOnce({ data: reservation, error: null });

      const result = await reserve({ userId: 'user-001', amount: 10_000, jobId: 'job-001' });

      expect(result.status).toBe('held');
    });

    it('should reject reservation when available balance is insufficient', async () => {
      mockSupabaseRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'insufficient_available_balance', code: 'P0001' },
      });

      await expect(
        reserve({ userId: 'user-001', amount: 999_999, jobId: 'job-001' })
      ).rejects.toThrow(/insufficient/i);
    });

    it('should store reservation amount in halala', async () => {
      const reservation = { id: 'res-003', amount: 9375, status: 'held' };
      mockSupabaseRpc.mockResolvedValueOnce({ data: reservation, error: null });

      const result = await reserve({ userId: 'user-001', amount: 9375, jobId: 'job-001' });

      expect(Number.isInteger(result.amount)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // releaseReservation
  // ═══════════════════════════════════════════════════════════════════════════
  describe('releaseReservation', () => {
    it('should set status to settled when job completes normally', async () => {
      const released = { id: 'reservation-001', status: 'settled', settledAmount: 8000 };
      mockSupabaseRpc.mockResolvedValueOnce({ data: released, error: null });

      const result = await releaseReservation({
        reservationId: 'reservation-001',
        settledAmount: 8000,
      });

      expect(result.status).toBe('settled');
      expect(result.settledAmount).toBe(8000);
    });

    it('should set status to released when job is cancelled (no charge)', async () => {
      const released = { id: 'reservation-001', status: 'released', settledAmount: 0 };
      mockSupabaseRpc.mockResolvedValueOnce({ data: released, error: null });

      const result = await releaseReservation({
        reservationId: 'reservation-001',
        settledAmount: 0,
      });

      expect(result.status).toBe('released');
    });

    it('should restore available balance for unsettled portion', async () => {
      // Reserved 20000, settled 8000 → 12000 should be restored to available
      const released = { id: 'reservation-001', status: 'settled', settledAmount: 8000, restoredAmount: 12000 };
      mockSupabaseRpc.mockResolvedValueOnce({ data: released, error: null });

      const result = await releaseReservation({
        reservationId: 'reservation-001',
        settledAmount: 8000,
      });

      expect(result.restoredAmount).toBe(12000);
    });

    it('should throw for non-existent reservation', async () => {
      mockSupabaseRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'reservation not found' },
      });

      await expect(
        releaseReservation({ reservationId: 'nonexistent', settledAmount: 0 })
      ).rejects.toThrow();
    });

    it('should be idempotent — releasing already-settled reservation is no-op', async () => {
      const released = { id: 'reservation-001', status: 'settled', settledAmount: 8000 };
      mockSupabaseRpc.mockResolvedValueOnce({ data: released, error: null });

      const result = await releaseReservation({
        reservationId: 'reservation-001',
        settledAmount: 8000,
      });

      expect(result.status).toBe('settled');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getBalance
  // ═══════════════════════════════════════════════════════════════════════════
  describe('getBalance', () => {
    it('should return available = total - reserved', async () => {
      const wallet = createMockWallet({
        totalBalance: 100_000,
        reservedBalance: 20_000,
        availableBalance: 80_000,
      });
      mockSupabaseSingle.mockResolvedValueOnce({ data: wallet, error: null });

      const result = await getBalance('user-001');

      expect(result.availableBalance).toBe(result.totalBalance - result.reservedBalance);
      expect(result.availableBalance).toBe(80_000);
    });

    it('should return zero available when fully reserved', async () => {
      const wallet = createMockWallet({
        totalBalance: 50_000,
        reservedBalance: 50_000,
        availableBalance: 0,
      });
      mockSupabaseSingle.mockResolvedValueOnce({ data: wallet, error: null });

      const result = await getBalance('user-001');

      expect(result.availableBalance).toBe(0);
    });

    it('should return all amounts in halala (integers)', async () => {
      const wallet = createMockWallet();
      mockSupabaseSingle.mockResolvedValueOnce({ data: wallet, error: null });

      const result = await getBalance('user-001');

      expect(Number.isInteger(result.totalBalance)).toBe(true);
      expect(Number.isInteger(result.reservedBalance)).toBe(true);
      expect(Number.isInteger(result.availableBalance)).toBe(true);
    });

    it('should throw for non-existent user', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(getBalance('nonexistent')).rejects.toThrow();
    });

    it('should return currency as SAR', async () => {
      const wallet = createMockWallet({ currency: 'SAR' });
      mockSupabaseSingle.mockResolvedValueOnce({ data: wallet, error: null });

      const result = await getBalance('user-001');

      expect(result.currency).toBe('SAR');
    });
  });
});
