import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockSupabaseSingle,
  mockSupabaseRpc,
  mockSupabaseFrom,
  mockMcGet,
  mockMcPost,
  mockMcPatch,
  mockAuditLog,
  createMockJob,
  createMockGpu,
  createMockWallet,
  createMockBillingSession,
} from './setup';

import { submitJob, getJobStatus, completeJob } from '../services/job-pipeline';

// We need to mock the internal service calls
vi.mock('../services/wallet', () => ({
  getBalance: vi.fn(),
  reserve: vi.fn(),
  debit: vi.fn(),
  credit: vi.fn(),
  releaseReservation: vi.fn(),
}));

vi.mock('../services/billing', () => ({
  startBillingSession: vi.fn(),
  closeBillingSession: vi.fn(),
}));

vi.mock('../services/docker-manager', () => ({
  launchJobContainer: vi.fn(),
  stopContainer: vi.fn(),
  wipeGPUMemory: vi.fn(),
}));

import { getBalance, reserve, credit, releaseReservation } from '../services/wallet';
import { startBillingSession, closeBillingSession } from '../services/billing';
import { launchJobContainer, stopContainer, wipeGPUMemory } from '../services/docker-manager';

const mockGetBalance = vi.mocked(getBalance);
const mockReserve = vi.mocked(reserve);
const mockCredit = vi.mocked(credit);
const mockReleaseReservation = vi.mocked(releaseReservation);
const mockStartBilling = vi.mocked(startBillingSession);
const mockCloseBilling = vi.mocked(closeBillingSession);
const mockLaunchContainer = vi.mocked(launchJobContainer);
const mockStopContainer = vi.mocked(stopContainer);
const mockWipeGPU = vi.mocked(wipeGPUMemory);

describe('Job Pipeline Service', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // submitJob
  // ═══════════════════════════════════════════════════════════════════════════
  describe('submitJob', () => {
    it('should match GPU with sufficient VRAM for job requirements', async () => {
      const gpu = createMockGpu({ vram: 24576 }); // 24GB
      const job = createMockJob({ gpuRequirements: { minVram: 16384 } });
      const wallet = createMockWallet({ availableBalance: 100_000 });

      mockGetBalance.mockResolvedValueOnce(wallet as any);
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [gpu], error: null }),
            }),
          }),
        }),
      });
      mockReserve.mockResolvedValueOnce({ id: 'res-001', status: 'held', amount: 9375 } as any);
      mockStartBilling.mockResolvedValueOnce(createMockBillingSession() as any);
      mockLaunchContainer.mockResolvedValueOnce({ containerId: 'container-001' } as any);
      mockSupabaseSingle.mockResolvedValueOnce({ data: { ...job, status: 'running' }, error: null });
      mockMcPost.mockResolvedValueOnce({ data: { success: true } });

      const result = await submitJob({
        userId: 'user-001',
        dockerImage: 'pytorch/pytorch:latest',
        gpuRequirements: { minVram: 16384 },
        maxBudget: 50_000,
      });

      expect(result.status).toBe('running');
    });

    it('should reject GPU with insufficient VRAM', async () => {
      const wallet = createMockWallet({ availableBalance: 100_000 });
      mockGetBalance.mockResolvedValueOnce(wallet as any);
      // No GPUs match the VRAM filter
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      await expect(
        submitJob({
          userId: 'user-001',
          dockerImage: 'pytorch/pytorch:latest',
          gpuRequirements: { minVram: 80000 }, // 80GB — nothing available
          maxBudget: 50_000,
        })
      ).rejects.toThrow(/no.*gpu|unavailable/i);
    });

    it('should sort GPUs by reliability score (highest first)', async () => {
      const gpu1 = createMockGpu({ id: 'gpu-low', reliabilityScore: 0.85 });
      const gpu2 = createMockGpu({ id: 'gpu-high', reliabilityScore: 0.99 });
      const wallet = createMockWallet({ availableBalance: 100_000 });

      mockGetBalance.mockResolvedValueOnce(wallet as any);
      // Return GPUs sorted by reliability desc
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [gpu2, gpu1], error: null }),
            }),
          }),
        }),
      });
      mockReserve.mockResolvedValueOnce({ id: 'res-001', status: 'held', amount: 9375 } as any);
      mockStartBilling.mockResolvedValueOnce(createMockBillingSession() as any);
      mockLaunchContainer.mockResolvedValueOnce({ containerId: 'container-001' } as any);
      mockSupabaseSingle.mockResolvedValueOnce({
        data: createMockJob({ assignedGpuId: 'gpu-high', status: 'running' }),
        error: null,
      });
      mockMcPost.mockResolvedValueOnce({ data: { success: true } });

      const result = await submitJob({
        userId: 'user-001',
        dockerImage: 'pytorch/pytorch:latest',
        gpuRequirements: { minVram: 16384 },
        maxBudget: 50_000,
      });

      expect(result.assignedGpuId).toBe('gpu-high');
    });

    it('should check user balance against gpu.ratePerHour before assignment', async () => {
      const wallet = createMockWallet({ availableBalance: 100 }); // only 1 SAR
      mockGetBalance.mockResolvedValueOnce(wallet as any);

      await expect(
        submitJob({
          userId: 'user-001',
          dockerImage: 'pytorch/pytorch:latest',
          gpuRequirements: { minVram: 16384 },
          maxBudget: 50_000,
        })
      ).rejects.toThrow(/insufficient.*balance/i);
    });

    it('should create a wallet reservation for estimated job cost', async () => {
      const gpu = createMockGpu({ ratePerHour: 9375 });
      const wallet = createMockWallet({ availableBalance: 100_000 });

      mockGetBalance.mockResolvedValueOnce(wallet as any);
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [gpu], error: null }),
            }),
          }),
        }),
      });
      mockReserve.mockResolvedValueOnce({ id: 'res-001', status: 'held', amount: 9375 } as any);
      mockStartBilling.mockResolvedValueOnce(createMockBillingSession() as any);
      mockLaunchContainer.mockResolvedValueOnce({ containerId: 'container-001' } as any);
      mockSupabaseSingle.mockResolvedValueOnce({
        data: createMockJob({ status: 'running' }),
        error: null,
      });
      mockMcPost.mockResolvedValueOnce({ data: { success: true } });

      await submitJob({
        userId: 'user-001',
        dockerImage: 'pytorch/pytorch:latest',
        gpuRequirements: { minVram: 16384 },
        maxBudget: 50_000,
      });

      expect(mockReserve).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-001' })
      );
    });

    it('should persist job state to Mission Control API', async () => {
      const gpu = createMockGpu();
      const wallet = createMockWallet({ availableBalance: 100_000 });

      mockGetBalance.mockResolvedValueOnce(wallet as any);
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [gpu], error: null }),
            }),
          }),
        }),
      });
      mockReserve.mockResolvedValueOnce({ id: 'res-001', status: 'held', amount: 9375 } as any);
      mockStartBilling.mockResolvedValueOnce(createMockBillingSession() as any);
      mockLaunchContainer.mockResolvedValueOnce({ containerId: 'container-001' } as any);
      mockSupabaseSingle.mockResolvedValueOnce({
        data: createMockJob({ status: 'running' }),
        error: null,
      });
      mockMcPost.mockResolvedValueOnce({ data: { success: true } });

      await submitJob({
        userId: 'user-001',
        dockerImage: 'pytorch/pytorch:latest',
        gpuRequirements: { minVram: 16384 },
        maxBudget: 50_000,
      });

      expect(mockMcPost).toHaveBeenCalled();
    });

    it('should handle container launch failure gracefully', async () => {
      const gpu = createMockGpu();
      const wallet = createMockWallet({ availableBalance: 100_000 });

      mockGetBalance.mockResolvedValueOnce(wallet as any);
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [gpu], error: null }),
            }),
          }),
        }),
      });
      mockReserve.mockResolvedValueOnce({ id: 'res-001', status: 'held', amount: 9375 } as any);
      mockStartBilling.mockResolvedValueOnce(createMockBillingSession() as any);
      mockLaunchContainer.mockRejectedValueOnce(new Error('Docker socket unavailable'));

      await expect(
        submitJob({
          userId: 'user-001',
          dockerImage: 'pytorch/pytorch:latest',
          gpuRequirements: { minVram: 16384 },
          maxBudget: 50_000,
        })
      ).rejects.toThrow(/docker|container|unavailable/i);

      // Should release the reservation on failure
      expect(mockReleaseReservation).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getJobStatus
  // ═══════════════════════════════════════════════════════════════════════════
  describe('getJobStatus', () => {
    it('should return current job status from database', async () => {
      const job = createMockJob({ status: 'running' });
      mockSupabaseSingle.mockResolvedValueOnce({ data: job, error: null });

      const result = await getJobStatus('job-001');

      expect(result.status).toBe('running');
    });

    it('should trigger auto-kill when job exceeds maxBudget', async () => {
      const job = createMockJob({
        status: 'running',
        maxBudget: 10_000,
        containerId: 'container-001',
        billingSessionId: 'billing-session-001',
      });
      const billingSession = createMockBillingSession({ totalCharged: 15_000 }); // over budget

      mockSupabaseSingle
        .mockResolvedValueOnce({ data: job, error: null })
        .mockResolvedValueOnce({ data: billingSession, error: null });

      mockStopContainer.mockResolvedValueOnce(undefined);
      mockMcPatch.mockResolvedValueOnce({ data: { success: true } });
      mockCloseBilling.mockResolvedValueOnce({ ...billingSession, status: 'closed' } as any);
      mockWipeGPU.mockResolvedValueOnce(undefined);

      const result = await getJobStatus('job-001');

      expect(mockStopContainer).toHaveBeenCalledWith('container-001');
      expect(mockMcPatch).toHaveBeenCalled(); // status update to MC
    });

    it('should not auto-kill when within budget', async () => {
      const job = createMockJob({
        status: 'running',
        maxBudget: 50_000,
        billingSessionId: 'billing-session-001',
      });
      const billingSession = createMockBillingSession({ totalCharged: 5_000 });

      mockSupabaseSingle
        .mockResolvedValueOnce({ data: job, error: null })
        .mockResolvedValueOnce({ data: billingSession, error: null });

      await getJobStatus('job-001');

      expect(mockStopContainer).not.toHaveBeenCalled();
    });

    it('should throw for non-existent job', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(getJobStatus('nonexistent')).rejects.toThrow();
    });

    it('should return completed status for finished jobs', async () => {
      const job = createMockJob({ status: 'completed' });
      mockSupabaseSingle.mockResolvedValueOnce({ data: job, error: null });

      const result = await getJobStatus('job-001');

      expect(result.status).toBe('completed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // completeJob
  // ═══════════════════════════════════════════════════════════════════════════
  describe('completeJob', () => {
    it('should wipe GPU memory after job completion', async () => {
      const job = createMockJob({
        status: 'running',
        containerId: 'container-001',
        assignedGpuId: 'gpu-001',
        billingSessionId: 'billing-session-001',
      });
      const billingSession = createMockBillingSession({ totalCharged: 9360 });
      const closedBilling = { ...billingSession, status: 'closed', providerPayout: 7020 };

      mockSupabaseSingle.mockResolvedValueOnce({ data: job, error: null });
      mockStopContainer.mockResolvedValueOnce(undefined);
      mockWipeGPU.mockResolvedValueOnce(undefined);
      mockCloseBilling.mockResolvedValueOnce(closedBilling as any);
      mockCredit.mockResolvedValueOnce({} as any);
      mockReleaseReservation.mockResolvedValueOnce({} as any);
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { ...job, status: 'completed' },
        error: null,
      });
      mockMcPatch.mockResolvedValueOnce({ data: { success: true } });

      await completeJob('job-001');

      expect(mockWipeGPU).toHaveBeenCalledWith('gpu-001');
    });

    it('should trigger provider payout on completion', async () => {
      const job = createMockJob({
        status: 'running',
        containerId: 'container-001',
        assignedGpuId: 'gpu-001',
        billingSessionId: 'billing-session-001',
      });
      const closedBilling = createMockBillingSession({
        status: 'closed',
        totalCharged: 9360,
        providerPayout: 7020,
        providerId: 'provider-001',
      });

      mockSupabaseSingle.mockResolvedValueOnce({ data: job, error: null });
      mockStopContainer.mockResolvedValueOnce(undefined);
      mockWipeGPU.mockResolvedValueOnce(undefined);
      mockCloseBilling.mockResolvedValueOnce(closedBilling as any);
      mockCredit.mockResolvedValueOnce({} as any);
      mockReleaseReservation.mockResolvedValueOnce({} as any);
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { ...job, status: 'completed' },
        error: null,
      });
      mockMcPatch.mockResolvedValueOnce({ data: { success: true } });

      await completeJob('job-001');

      expect(mockCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'provider-001',
          amount: 7020,
        })
      );
    });

    it('should close billing session and settle reservation', async () => {
      const job = createMockJob({
        status: 'running',
        containerId: 'container-001',
        assignedGpuId: 'gpu-001',
        billingSessionId: 'billing-session-001',
      });
      const closedBilling = createMockBillingSession({ status: 'closed', totalCharged: 9360 });

      mockSupabaseSingle.mockResolvedValueOnce({ data: job, error: null });
      mockStopContainer.mockResolvedValueOnce(undefined);
      mockWipeGPU.mockResolvedValueOnce(undefined);
      mockCloseBilling.mockResolvedValueOnce(closedBilling as any);
      mockCredit.mockResolvedValueOnce({} as any);
      mockReleaseReservation.mockResolvedValueOnce({} as any);
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { ...job, status: 'completed' },
        error: null,
      });
      mockMcPatch.mockResolvedValueOnce({ data: { success: true } });

      await completeJob('job-001');

      expect(mockCloseBilling).toHaveBeenCalledWith('billing-session-001');
      expect(mockReleaseReservation).toHaveBeenCalled();
    });

    it('should update job status to completed in DB and Mission Control', async () => {
      const job = createMockJob({
        status: 'running',
        containerId: 'container-001',
        assignedGpuId: 'gpu-001',
        billingSessionId: 'billing-session-001',
      });

      mockSupabaseSingle.mockResolvedValueOnce({ data: job, error: null });
      mockStopContainer.mockResolvedValueOnce(undefined);
      mockWipeGPU.mockResolvedValueOnce(undefined);
      mockCloseBilling.mockResolvedValueOnce(createMockBillingSession({ status: 'closed' }) as any);
      mockCredit.mockResolvedValueOnce({} as any);
      mockReleaseReservation.mockResolvedValueOnce({} as any);
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { ...job, status: 'completed' },
        error: null,
      });
      mockMcPatch.mockResolvedValueOnce({ data: { success: true } });

      await completeJob('job-001');

      expect(mockMcPatch).toHaveBeenCalled();
    });

    it('should throw for non-existent job', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(completeJob('nonexistent')).rejects.toThrow();
    });

    it('should throw for already completed job', async () => {
      const job = createMockJob({ status: 'completed' });
      mockSupabaseSingle.mockResolvedValueOnce({ data: job, error: null });

      await expect(completeJob('job-001')).rejects.toThrow();
    });

    it('should still wipe GPU even if billing close fails', async () => {
      const job = createMockJob({
        status: 'running',
        containerId: 'container-001',
        assignedGpuId: 'gpu-001',
        billingSessionId: 'billing-session-001',
      });

      mockSupabaseSingle.mockResolvedValueOnce({ data: job, error: null });
      mockStopContainer.mockResolvedValueOnce(undefined);
      mockWipeGPU.mockResolvedValueOnce(undefined);
      mockCloseBilling.mockRejectedValueOnce(new Error('billing error'));

      // GPU wipe should still happen before billing close throws
      try {
        await completeJob('job-001');
      } catch {
        // expected
      }

      expect(mockWipeGPU).toHaveBeenCalledWith('gpu-001');
    });
  });
});
