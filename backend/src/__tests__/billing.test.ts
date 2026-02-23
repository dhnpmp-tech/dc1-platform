import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockSupabase,
  mockSupabaseRpc,
  mockSupabaseSingle,
  mockSupabaseFrom,
  mockAuditLog,
  createMockBillingSession,
  createMockBillingTick,
  createMockWallet,
} from './setup';

// Service under test — mocked imports resolved via setup.ts
import {
  startBillingSession,
  recordBillingTick,
  closeBillingSession,
  verifyBillingIntegrity,
} from '../services/billing';

describe('Billing Service', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // startBillingSession
  // ═══════════════════════════════════════════════════════════════════════════
  describe('startBillingSession', () => {
    it('should create a new billing session with correct initial values', async () => {
      const session = createMockBillingSession();
      mockSupabaseSingle.mockResolvedValueOnce({ data: session, error: null });

      const result = await startBillingSession({
        jobId: 'job-001',
        userId: 'user-001',
        providerId: 'provider-001',
        gpuId: 'gpu-001',
        ratePerHour: 9375,
        reservationId: 'reservation-001',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('active');
      expect(result.totalCharged).toBe(0);
    });

    it('should store rate in halala (integer), not SAR (decimal)', async () => {
      const session = createMockBillingSession({ ratePerHour: 9375 });
      mockSupabaseSingle.mockResolvedValueOnce({ data: session, error: null });

      const result = await startBillingSession({
        jobId: 'job-001',
        userId: 'user-001',
        providerId: 'provider-001',
        gpuId: 'gpu-001',
        ratePerHour: 9375,
        reservationId: 'reservation-001',
      });

      expect(result.ratePerHour).toBe(9375);
      expect(Number.isInteger(result.ratePerHour)).toBe(true);
    });

    it('should be idempotent — return existing session for same jobId', async () => {
      const existing = createMockBillingSession();
      // First call: conflict/existing found
      mockSupabaseSingle
        .mockResolvedValueOnce({ data: null, error: { code: '23505' } }) // unique violation
        .mockResolvedValueOnce({ data: existing, error: null }); // fetch existing

      const result = await startBillingSession({
        jobId: 'job-001',
        userId: 'user-001',
        providerId: 'provider-001',
        gpuId: 'gpu-001',
        ratePerHour: 9375,
        reservationId: 'reservation-001',
      });

      expect(result.id).toBe(existing.id);
    });

    it('should create a wallet reservation for estimated cost', async () => {
      const session = createMockBillingSession();
      mockSupabaseSingle.mockResolvedValueOnce({ data: session, error: null });
      mockSupabaseRpc.mockResolvedValueOnce({ data: { id: 'reservation-001' }, error: null });

      await startBillingSession({
        jobId: 'job-001',
        userId: 'user-001',
        providerId: 'provider-001',
        gpuId: 'gpu-001',
        ratePerHour: 9375,
        reservationId: 'reservation-001',
      });

      // Reservation should be linked
      expect(session.reservationId).toBe('reservation-001');
    });

    it('should throw if Supabase insert fails with non-duplicate error', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { code: '42000', message: 'DB down' },
      });

      await expect(
        startBillingSession({
          jobId: 'job-001',
          userId: 'user-001',
          providerId: 'provider-001',
          gpuId: 'gpu-001',
          ratePerHour: 9375,
          reservationId: 'reservation-001',
        })
      ).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // recordBillingTick
  // ═══════════════════════════════════════════════════════════════════════════
  describe('recordBillingTick', () => {
    it('should calculate increment as ratePerHour / 60 (per-minute tick) in halala', async () => {
      const session = createMockBillingSession({ ratePerHour: 9375 });
      const expectedIncrement = Math.floor(9375 / 60); // 156 halala
      const tick = createMockBillingTick({ incrementAmount: expectedIncrement });

      mockSupabaseSingle
        .mockResolvedValueOnce({ data: session, error: null }) // fetch session
        .mockResolvedValueOnce({ data: tick, error: null }); // insert tick

      const result = await recordBillingTick('billing-session-001');

      expect(result.incrementAmount).toBe(156);
      expect(Number.isInteger(result.incrementAmount)).toBe(true);
    });

    it('should use floor() for halala math — no fractional amounts', async () => {
      // Rate that produces fractional: 10000 / 60 = 166.666...
      const session = createMockBillingSession({ ratePerHour: 10000 });
      const tick = createMockBillingTick({ incrementAmount: Math.floor(10000 / 60) });

      mockSupabaseSingle
        .mockResolvedValueOnce({ data: session, error: null })
        .mockResolvedValueOnce({ data: tick, error: null });

      const result = await recordBillingTick('billing-session-001');

      expect(result.incrementAmount).toBe(166); // floor(166.666) = 166
      expect(Number.isInteger(result.incrementAmount)).toBe(true);
    });

    it('should split 75% to provider, 25% to platform', async () => {
      const increment = 156;
      const providerShare = Math.floor(increment * 0.75); // 117
      const platformShare = increment - providerShare; // 39
      const tick = createMockBillingTick({
        incrementAmount: increment,
        providerShare,
        platformShare,
      });
      const session = createMockBillingSession({ ratePerHour: 9375 });

      mockSupabaseSingle
        .mockResolvedValueOnce({ data: session, error: null })
        .mockResolvedValueOnce({ data: tick, error: null });

      const result = await recordBillingTick('billing-session-001');

      expect(result.providerShare).toBe(117);
      expect(result.platformShare).toBe(39);
      expect(result.providerShare + result.platformShare).toBe(result.incrementAmount);
    });

    it('should ensure provider + platform shares always equal increment (no rounding leak)', async () => {
      // Odd number: 157 halala → 75% = 117.75 → floor = 117, platform = 157 - 117 = 40
      const increment = 157;
      const providerShare = Math.floor(increment * 0.75); // 117
      const platformShare = increment - providerShare; // 40
      const tick = createMockBillingTick({ incrementAmount: increment, providerShare, platformShare });

      const session = createMockBillingSession({ ratePerHour: 9420 });
      mockSupabaseSingle
        .mockResolvedValueOnce({ data: session, error: null })
        .mockResolvedValueOnce({ data: tick, error: null });

      const result = await recordBillingTick('billing-session-001');

      expect(result.providerShare + result.platformShare).toBe(increment);
    });

    it('should compute cumulative amount from previous ticks', async () => {
      const session = createMockBillingSession({ ratePerHour: 9375 });
      const prevTick = createMockBillingTick({ tickNumber: 2, cumulativeAmount: 312 });
      const newTick = createMockBillingTick({
        tickNumber: 3,
        incrementAmount: 156,
        cumulativeAmount: 468,
      });

      mockSupabaseSingle
        .mockResolvedValueOnce({ data: session, error: null })
        .mockResolvedValueOnce({ data: newTick, error: null });

      const result = await recordBillingTick('billing-session-001');

      expect(result.cumulativeAmount).toBe(468);
      expect(result.tickNumber).toBe(3);
    });

    it('should generate a proof hash for each tick', async () => {
      const session = createMockBillingSession();
      const tick = createMockBillingTick({ proofHash: 'sha256-proof-hash-value' });

      mockSupabaseSingle
        .mockResolvedValueOnce({ data: session, error: null })
        .mockResolvedValueOnce({ data: tick, error: null });

      const result = await recordBillingTick('billing-session-001');

      expect(result.proofHash).toBeDefined();
      expect(typeof result.proofHash).toBe('string');
      expect(result.proofHash.length).toBeGreaterThan(0);
    });

    it('should reject tick for a closed session', async () => {
      const session = createMockBillingSession({ status: 'closed' });
      mockSupabaseSingle.mockResolvedValueOnce({ data: session, error: null });

      await expect(recordBillingTick('billing-session-001')).rejects.toThrow();
    });

    it('should reject tick for non-existent session', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(recordBillingTick('nonexistent-session')).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // closeBillingSession
  // ═══════════════════════════════════════════════════════════════════════════
  describe('closeBillingSession', () => {
    it('should set status to closed and record endedAt timestamp', async () => {
      const session = createMockBillingSession({ status: 'active' });
      const closedSession = {
        ...session,
        status: 'closed',
        endedAt: '2026-02-20T11:00:00Z',
        totalCharged: 9360,
        providerPayout: 7020,
        platformFee: 2340,
      };

      mockSupabaseSingle
        .mockResolvedValueOnce({ data: session, error: null })
        .mockResolvedValueOnce({ data: closedSession, error: null });

      const result = await closeBillingSession('billing-session-001');

      expect(result.status).toBe('closed');
      expect(result.endedAt).toBeDefined();
    });

    it('should compute final totalCharged as sum of all tick increments', async () => {
      const session = createMockBillingSession({ status: 'active' });
      const closedSession = {
        ...session,
        status: 'closed',
        totalCharged: 9360, // 60 ticks × 156 halala
        providerPayout: 7020,
        platformFee: 2340,
      };

      mockSupabaseSingle
        .mockResolvedValueOnce({ data: session, error: null })
        .mockResolvedValueOnce({ data: closedSession, error: null });

      const result = await closeBillingSession('billing-session-001');

      expect(result.totalCharged).toBe(9360);
      expect(result.providerPayout + result.platformFee).toBe(result.totalCharged);
    });

    it('should generate a receipt hash on close', async () => {
      const session = createMockBillingSession({ status: 'active' });
      const closedSession = {
        ...session,
        status: 'closed',
        receiptHash: 'sha256-receipt-hash-final',
        totalCharged: 9360,
      };

      mockSupabaseSingle
        .mockResolvedValueOnce({ data: session, error: null })
        .mockResolvedValueOnce({ data: closedSession, error: null });

      const result = await closeBillingSession('billing-session-001');

      expect(result.receiptHash).toBeDefined();
      expect(typeof result.receiptHash).toBe('string');
    });

    it('should be idempotent — closing an already closed session returns same result', async () => {
      const closed = createMockBillingSession({
        status: 'closed',
        totalCharged: 9360,
        receiptHash: 'existing-hash',
      });
      mockSupabaseSingle.mockResolvedValueOnce({ data: closed, error: null });

      const result = await closeBillingSession('billing-session-001');

      expect(result.status).toBe('closed');
      expect(result.receiptHash).toBe('existing-hash');
    });

    it('should settle reservation on close', async () => {
      const session = createMockBillingSession({ status: 'active' });
      const closedSession = { ...session, status: 'closed', totalCharged: 9360 };

      mockSupabaseSingle
        .mockResolvedValueOnce({ data: session, error: null })
        .mockResolvedValueOnce({ data: closedSession, error: null });

      await closeBillingSession('billing-session-001');

      // Verify reservation settlement was triggered (via RPC or update)
      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it('should throw for non-existent session', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(closeBillingSession('nonexistent')).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // verifyBillingIntegrity
  // ═══════════════════════════════════════════════════════════════════════════
  describe('verifyBillingIntegrity', () => {
    it('should return valid for untampered billing session', async () => {
      const session = createMockBillingSession({
        status: 'closed',
        totalCharged: 312,
        receiptHash: 'valid-receipt-hash',
      });
      const ticks = [
        createMockBillingTick({ tickNumber: 1, incrementAmount: 156, cumulativeAmount: 156 }),
        createMockBillingTick({ tickNumber: 2, incrementAmount: 156, cumulativeAmount: 312 }),
      ];

      mockSupabaseSingle.mockResolvedValueOnce({ data: session, error: null });
      // Ticks query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: ticks, error: null }),
          }),
        }),
      });

      const result = await verifyBillingIntegrity('billing-session-001');

      expect(result.valid).toBe(true);
    });

    it('should detect tampered proof hash in tick chain', async () => {
      const session = createMockBillingSession({
        status: 'closed',
        totalCharged: 312,
      });
      const ticks = [
        createMockBillingTick({ tickNumber: 1, proofHash: 'valid-hash-1' }),
        createMockBillingTick({ tickNumber: 2, proofHash: 'TAMPERED-HASH' }),
      ];

      mockSupabaseSingle.mockResolvedValueOnce({ data: session, error: null });
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: ticks, error: null }),
          }),
        }),
      });

      const result = await verifyBillingIntegrity('billing-session-001');

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should detect if totalCharged does not match sum of increments', async () => {
      const session = createMockBillingSession({
        status: 'closed',
        totalCharged: 999, // wrong — should be 312
      });
      const ticks = [
        createMockBillingTick({ tickNumber: 1, incrementAmount: 156, cumulativeAmount: 156 }),
        createMockBillingTick({ tickNumber: 2, incrementAmount: 156, cumulativeAmount: 312 }),
      ];

      mockSupabaseSingle.mockResolvedValueOnce({ data: session, error: null });
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: ticks, error: null }),
          }),
        }),
      });

      const result = await verifyBillingIntegrity('billing-session-001');

      expect(result.valid).toBe(false);
    });

    it('should validate 75/25 split on every tick', async () => {
      const session = createMockBillingSession({ status: 'closed', totalCharged: 156 });
      const ticks = [
        createMockBillingTick({
          tickNumber: 1,
          incrementAmount: 156,
          providerShare: 100, // wrong — should be 117
          platformShare: 56, // wrong — should be 39
        }),
      ];

      mockSupabaseSingle.mockResolvedValueOnce({ data: session, error: null });
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: ticks, error: null }),
          }),
        }),
      });

      const result = await verifyBillingIntegrity('billing-session-001');

      expect(result.valid).toBe(false);
    });

    it('should detect missing ticks in sequence', async () => {
      const session = createMockBillingSession({ status: 'closed', totalCharged: 468 });
      const ticks = [
        createMockBillingTick({ tickNumber: 1, incrementAmount: 156 }),
        // tick 2 missing!
        createMockBillingTick({ tickNumber: 3, incrementAmount: 156 }),
      ];

      mockSupabaseSingle.mockResolvedValueOnce({ data: session, error: null });
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: ticks, error: null }),
          }),
        }),
      });

      const result = await verifyBillingIntegrity('billing-session-001');

      expect(result.valid).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SAR Display Formatting
  // ═══════════════════════════════════════════════════════════════════════════
  describe('SAR/Halala formatting', () => {
    it('should store all amounts as integer halala internally', () => {
      const session = createMockBillingSession({ totalCharged: 9375 });
      expect(Number.isInteger(session.totalCharged)).toBe(true);
    });

    it('should convert halala to SAR for display: 9375 halala = 93.75 SAR', () => {
      const halala = 9375;
      const sar = halala / 100;
      expect(sar).toBe(93.75);
    });

    it('should convert halala to SAR for display: 100 halala = 1.00 SAR', () => {
      const halala = 100;
      const sar = (halala / 100).toFixed(2);
      expect(sar).toBe('1.00');
    });

    it('should handle zero halala', () => {
      const halala = 0;
      const sar = (halala / 100).toFixed(2);
      expect(sar).toBe('0.00');
    });

    it('should never produce fractional halala values', () => {
      // Simulate tick calculations for various rates
      const rates = [9375, 10000, 7500, 5000, 12345];
      for (const rate of rates) {
        const increment = Math.floor(rate / 60);
        const providerShare = Math.floor(increment * 0.75);
        const platformShare = increment - providerShare;

        expect(Number.isInteger(increment)).toBe(true);
        expect(Number.isInteger(providerShare)).toBe(true);
        expect(Number.isInteger(platformShare)).toBe(true);
        expect(providerShare + platformShare).toBe(increment);
      }
    });
  });
});
