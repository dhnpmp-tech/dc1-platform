/**
 * DC1 Integration Tests — Job Execution Flow
 * Full pipeline: job submission → GPU matching → container launch → billing → completion
 *
 * 20 tests covering submission, GPU matching, billing, container lifecycle, error recovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  testId,
  createTestJob,
  createTestGPU,
  cleanupTestData,
} from './setup';

// ── Hoisted mocks (vi.mock factories run before imports) ───────────────────

const {
  mockContainerStart,
  mockContainerStop,
  mockContainerRemove,
  mockContainerInspect,
  mockContainerStats,
  mockContainerLogs,
  mockContainerExec,
  mockContainer,
  mockDockerCreateContainer,
  mockDockerListContainers,
  mockImageInspect,
  mockFetch,
} = vi.hoisted(() => {
  const mockContainerStart = vi.fn().mockResolvedValue(undefined);
  const mockContainerStop = vi.fn().mockResolvedValue(undefined);
  const mockContainerRemove = vi.fn().mockResolvedValue(undefined);
  const mockContainerInspect = vi.fn().mockResolvedValue({ State: { Running: true } });
  const mockContainerStats = vi.fn().mockResolvedValue({
    cpu_stats: { cpu_usage: { total_usage: 1000 }, system_cpu_usage: 10000, online_cpus: 4 },
    precpu_stats: { cpu_usage: { total_usage: 500 }, system_cpu_usage: 9000 },
    memory_stats: { usage: 1024 * 1024 * 512, limit: 1024 * 1024 * 1024 * 20 },
  });
  const mockContainerLogs = vi.fn().mockResolvedValue(Buffer.from('test logs'));
  const mockContainerExec = vi.fn().mockResolvedValue({
    start: vi.fn().mockResolvedValue({
      on: vi.fn((event: string, cb: (data: Buffer) => void) => {
        if (event === 'data') cb(Buffer.from('0, 45, 2048, 81920, 65\n'));
        if (event === 'end') setTimeout(() => cb(Buffer.from('')), 0);
      }),
    }),
  });
  const mockContainer = {
    id: 'mock-container-id-12345',
    start: mockContainerStart,
    stop: mockContainerStop,
    remove: mockContainerRemove,
    inspect: mockContainerInspect,
    stats: mockContainerStats,
    logs: mockContainerLogs,
    exec: mockContainerExec,
    wait: vi.fn().mockResolvedValue({ StatusCode: 0 }),
  };
  const mockImageInspect = vi.fn().mockResolvedValue({});
  const mockDockerCreateContainer = vi.fn().mockResolvedValue(mockContainer);
  const mockDockerListContainers = vi.fn().mockResolvedValue([]);

  // Mock fetch — use a map for MC endpoint handlers
  const mcHandlers = new Map<string, (url: string, init?: RequestInit) => any>();
  const mockFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const urlStr = url.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    for (const [key, handler] of mcHandlers) {
      const [m, pattern] = key.split(':');
      if (m === method && urlStr.includes(pattern!)) {
        return handler(urlStr, init);
      }
    }
    if (urlStr.includes('/security/audit')) {
      return { ok: true, status: 200, json: async () => ({}) };
    }
    return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
  });
  (mockFetch as any)._mcHandlers = mcHandlers;

  return {
    mockContainerStart,
    mockContainerStop,
    mockContainerRemove,
    mockContainerInspect,
    mockContainerStats,
    mockContainerLogs,
    mockContainerExec,
    mockContainer,
    mockDockerCreateContainer,
    mockDockerListContainers,
    mockImageInspect,
    mockFetch,
  };
});

vi.mock('dockerode', () => ({
  default: vi.fn().mockImplementation(() => ({
    createContainer: mockDockerCreateContainer,
    listContainers: mockDockerListContainers,
    pull: vi.fn((_image: string, cb: (err: Error | null, stream: any) => void) => {
      cb(null, { on: vi.fn() });
    }),
    getContainer: vi.fn().mockReturnValue(mockContainer),
    getImage: vi.fn().mockReturnValue({ inspect: mockImageInspect }),
    modem: {
      followProgress: vi.fn((_stream: any, cb: (err: Error | null) => void) => cb(null)),
    },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

vi.stubGlobal('fetch', mockFetch);

// ── Helper to register MC endpoints on the hoisted fetch ───────────────────

function registerMcEndpoint(
  method: string,
  pathPattern: string,
  handler: (url: string, body?: unknown) => { status: number; data: unknown },
): void {
  const handlers = (mockFetch as any)._mcHandlers as Map<string, any>;
  const key = `${method.toUpperCase()}:${pathPattern}`;
  handlers.set(key, (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    const result = handler(url, body);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => result.data,
    };
  });
}

function clearHandlers(): void {
  const handlers = (mockFetch as any)._mcHandlers as Map<string, any>;
  handlers.clear();
}

// ── Import Services (after mocks) ─────────────────────────────────────────

import { submitJob, getJobStatus, completeJob } from '../../src/services/job-pipeline';
import { launchJobContainer, monitorContainer, stopContainer } from '../../src/services/docker-manager';

// ── Test Suites ────────────────────────────────────────────────────────────

describe('Integration: Job Execution Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearHandlers();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Job Submission (5 tests)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Job Submission', () => {
    it('valid job submission returns job with status running and container ID', async () => {
      const gpu = createTestGPU({ vramGb: 48, ratePerHour: 2.0 });
      const jobReq = createTestJob({ requiredVramGb: 24, estimatedHours: 2, maxBudgetUsd: 10 });

      registerMcEndpoint('GET', '/providers', () => ({ status: 200, data: { gpus: [gpu] } }));
      registerMcEndpoint('GET', `/renters/${jobReq.renterId}/balance`, () => ({ status: 200, data: { balanceUsd: 50.0 } }));
      registerMcEndpoint('PATCH', '/gpu/', () => ({ status: 200, data: {} }));
      registerMcEndpoint('POST', '/jobs/submit', () => ({ status: 201, data: {} }));

      const job = await submitJob(jobReq);
      expect(job).toBeDefined();
      expect(job.id).toMatch(/^job-/);
      expect(job.status).toBe('running');
      expect(job.containerId).toBe('mock-container-id-12345');
      expect(job.matchedGpu.id).toBe(gpu.id);
    });

    it('submission with insufficient wallet balance throws error', async () => {
      const gpu = createTestGPU({ ratePerHour: 10.0 });
      const jobReq = createTestJob({ estimatedHours: 5, maxBudgetUsd: 100 });

      registerMcEndpoint('GET', '/providers', () => ({ status: 200, data: { gpus: [gpu] } }));
      registerMcEndpoint('GET', `/renters/${jobReq.renterId}/balance`, () => ({ status: 200, data: { balanceUsd: 5.0 } }));

      await expect(submitJob(jobReq)).rejects.toThrow(/Insufficient balance/);
    });

    it('submission with VRAM requirement higher than any GPU throws error', async () => {
      const gpu = createTestGPU({ vramGb: 16 });
      const jobReq = createTestJob({ requiredVramGb: 80 });

      registerMcEndpoint('GET', '/providers', () => ({ status: 200, data: { gpus: [gpu] } }));

      await expect(submitJob(jobReq)).rejects.toThrow(/No available GPU/);
    });

    it('submission when no GPUs are available throws error', async () => {
      const jobReq = createTestJob();
      registerMcEndpoint('GET', '/providers', () => ({ status: 200, data: { gpus: [] } }));

      await expect(submitJob(jobReq)).rejects.toThrow(/No available GPU/);
    });

    it('submission with GPU in maintenance status is not matched', async () => {
      const gpu = createTestGPU({ vramGb: 80, status: 'maintenance' });
      const jobReq = createTestJob({ requiredVramGb: 24 });

      registerMcEndpoint('GET', '/providers', () => ({ status: 200, data: { gpus: [gpu] } }));

      await expect(submitJob(jobReq)).rejects.toThrow(/No available GPU/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GPU Matching (4 tests)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GPU Matching', () => {
    function setupSubmitMocks(gpus: ReturnType<typeof createTestGPU>[], renterId: string, balance = 1000) {
      registerMcEndpoint('GET', '/providers', () => ({ status: 200, data: { gpus } }));
      registerMcEndpoint('GET', `/renters/${renterId}/balance`, () => ({ status: 200, data: { balanceUsd: balance } }));
      registerMcEndpoint('PATCH', '/gpu/', () => ({ status: 200, data: {} }));
      registerMcEndpoint('POST', '/jobs/submit', () => ({ status: 201, data: {} }));
    }

    it('matches GPU with highest reliability when multiple meet VRAM requirement', async () => {
      const gpuLow = createTestGPU({ vramGb: 48, reliability: 0.85, ratePerHour: 1.0 });
      const gpuHigh = createTestGPU({ vramGb: 48, reliability: 0.99, ratePerHour: 1.5 });
      const jobReq = createTestJob({ requiredVramGb: 24 });

      setupSubmitMocks([gpuLow, gpuHigh], jobReq.renterId);

      const job = await submitJob(jobReq);
      expect(job.matchedGpu.id).toBe(gpuHigh.id);
    });

    it('among equally reliable GPUs, picks cheapest rate', async () => {
      const gpuExpensive = createTestGPU({ vramGb: 48, reliability: 0.95, ratePerHour: 5.0 });
      const gpuCheap = createTestGPU({ vramGb: 48, reliability: 0.95, ratePerHour: 1.0 });
      const jobReq = createTestJob({ requiredVramGb: 24 });

      setupSubmitMocks([gpuExpensive, gpuCheap], jobReq.renterId);

      const job = await submitJob(jobReq);
      expect(job.matchedGpu.id).toBe(gpuCheap.id);
    });

    it('does not match GPU with insufficient VRAM', async () => {
      const gpuSmall = createTestGPU({ vramGb: 16 });
      const gpuBig = createTestGPU({ vramGb: 80 });
      const jobReq = createTestJob({ requiredVramGb: 48 });

      setupSubmitMocks([gpuSmall, gpuBig], jobReq.renterId);

      const job = await submitJob(jobReq);
      expect(job.matchedGpu.id).toBe(gpuBig.id);
    });

    it('does not match in-use GPUs', async () => {
      const gpuInUse = createTestGPU({ vramGb: 80, status: 'in-use', reliability: 0.99 });
      const gpuAvail = createTestGPU({ vramGb: 48, status: 'available', reliability: 0.90 });
      const jobReq = createTestJob({ requiredVramGb: 24 });

      setupSubmitMocks([gpuInUse, gpuAvail], jobReq.renterId);

      const job = await submitJob(jobReq);
      expect(job.matchedGpu.id).toBe(gpuAvail.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Billing Integration (5 tests)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Billing Integration', () => {
    it('job records estimated cost from actual GPU rate', async () => {
      const gpu = createTestGPU({ ratePerHour: 3.50 });
      const jobReq = createTestJob({ estimatedHours: 4, requiredVramGb: 24 });

      registerMcEndpoint('GET', '/providers', () => ({ status: 200, data: { gpus: [gpu] } }));
      registerMcEndpoint('GET', `/renters/${jobReq.renterId}/balance`, () => ({ status: 200, data: { balanceUsd: 100 } }));
      registerMcEndpoint('PATCH', '/gpu/', () => ({ status: 200, data: {} }));
      registerMcEndpoint('POST', '/jobs/submit', () => ({ status: 201, data: {} }));

      const job = await submitJob(jobReq);
      expect(job.estimatedCostUsd).toBe(14.0);
      expect(job.ratePerHour).toBe(3.50);
    });

    it('getJobStatus computes cost based on elapsed time', async () => {
      const startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      registerMcEndpoint('GET', '/jobs/job-billing-1', () => ({
        status: 200,
        data: {
          id: 'job-billing-1', renterId: testId('r'), containerId: 'mock-container-id-12345',
          matchedGpu: createTestGPU(), dockerImage: 'test:latest',
          estimatedCostUsd: 5.0, maxBudgetUsd: 20.0, ratePerHour: 2.50,
          startTime, status: 'running',
        },
      }));

      const status = await getJobStatus('job-billing-1');
      expect(status.costSoFarUsd).toBeGreaterThan(0);
      expect(status.elapsedMinutes).toBeGreaterThanOrEqual(59);
      expect(status.budgetRemainingUsd).toBeLessThan(20.0);
    });

    it('job auto-terminates when over budget', async () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      registerMcEndpoint('GET', '/jobs/job-overbudget', () => ({
        status: 200,
        data: {
          id: 'job-overbudget', renterId: testId('r'), containerId: 'mock-container-id-12345',
          matchedGpu: createTestGPU(), dockerImage: 'test:latest',
          estimatedCostUsd: 5.0, maxBudgetUsd: 5.0, ratePerHour: 2.50,
          startTime, status: 'running',
        },
      }));
      registerMcEndpoint('PATCH', '/jobs/job-overbudget', () => ({ status: 200, data: {} }));

      const status = await getJobStatus('job-overbudget');
      expect(status.status).toBe('over-budget');
      expect(mockContainerStop).toHaveBeenCalledWith({ t: 30 });
    });

    it('completeJob calculates final cost to the minute', async () => {
      const startTime = new Date(Date.now() - 90 * 60 * 1000).toISOString();
      const gpu = createTestGPU({ ratePerHour: 6.0 });

      registerMcEndpoint('GET', '/jobs/job-complete-1', () => ({
        status: 200,
        data: {
          id: 'job-complete-1', renterId: testId('r'), containerId: 'mock-container-id-12345',
          matchedGpu: gpu, dockerImage: 'test:latest',
          estimatedCostUsd: 12.0, maxBudgetUsd: 50.0, ratePerHour: 6.0,
          startTime, status: 'running',
        },
      }));
      registerMcEndpoint('PATCH', '/gpu/', () => ({ status: 200, data: {} }));
      registerMcEndpoint('PATCH', '/jobs/job-complete-1', () => ({ status: 200, data: {} }));
      registerMcEndpoint('POST', '/payouts', () => ({ status: 201, data: {} }));

      const result = await completeJob('job-complete-1');
      expect(result.status).toBe('completed');
      expect(result.totalMinutes).toBeGreaterThanOrEqual(90);
      expect(result.totalCostUsd).toBeGreaterThan(0);
      expect(result.payoutTriggered).toBe(true);
    });

    it('completeJob releases GPU back to available', async () => {
      const gpu = createTestGPU();
      registerMcEndpoint('GET', '/jobs/job-release', () => ({
        status: 200,
        data: {
          id: 'job-release', renterId: testId('r'), containerId: 'mock-container-id-12345',
          matchedGpu: gpu, dockerImage: 'test:latest',
          estimatedCostUsd: 5.0, maxBudgetUsd: 20.0, ratePerHour: 2.50,
          startTime: new Date().toISOString(), status: 'running',
        },
      }));
      registerMcEndpoint('PATCH', '/gpu/', () => ({ status: 200, data: {} }));
      registerMcEndpoint('PATCH', '/jobs/job-release', () => ({ status: 200, data: {} }));
      registerMcEndpoint('POST', '/payouts', () => ({ status: 201, data: {} }));

      await completeJob('job-release');

      const gpuPatchCalls = mockFetch.mock.calls.filter(
        (c) => c[0]?.toString().includes(`/gpu/${gpu.id}`) && c[1]?.method === 'PATCH',
      );
      expect(gpuPatchCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Container Lifecycle (4 tests)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Container Lifecycle', () => {
    it('launchJobContainer creates container with network isolation and starts it', async () => {
      const config = {
        jobId: testId('job'), renterId: testId('renter'),
        dockerImage: 'pytorch/pytorch:latest', jobCodePath: '/tmp/code',
        gpuDeviceIds: ['0'], maxHours: 4,
        memoryLimit: 20 * 1024 * 1024 * 1024, cpuLimit: 8,
        envVars: { BATCH_SIZE: '32' },
      };

      const result = await launchJobContainer(config);
      expect(result.containerId).toBe('mock-container-id-12345');
      expect(result.status).toBe('running');
      expect(mockDockerCreateContainer).toHaveBeenCalledTimes(1);
      expect(mockContainerStart).toHaveBeenCalledTimes(1);

      const createArgs = mockDockerCreateContainer.mock.calls[0]![0];
      expect(createArgs.HostConfig.NetworkMode).toBe('none');
    });

    it('monitorContainer returns CPU, memory, and GPU metrics', async () => {
      const metrics = await monitorContainer('mock-container-id-12345');
      expect(metrics.containerId).toBe('mock-container-id-12345');
      expect(metrics.status).toBe('running');
      expect(metrics.cpuPercent).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsedMb).toBeGreaterThan(0);
    });

    it('stopContainer removes container with force', async () => {
      await stopContainer('mock-container-id-12345', 'test-stop');
      expect(mockContainerStop).toHaveBeenCalled();
      expect(mockContainerRemove).toHaveBeenCalledWith({ v: true, force: true });
    });

    it('completeJob patches failed status when container stop throws', async () => {
      const gpu = createTestGPU();
      registerMcEndpoint('GET', '/jobs/job-fail', () => ({
        status: 200,
        data: {
          id: 'job-fail', renterId: testId('r'), containerId: 'mock-container-id-12345',
          matchedGpu: gpu, dockerImage: 'test:latest',
          estimatedCostUsd: 5.0, maxBudgetUsd: 20.0, ratePerHour: 2.50,
          startTime: new Date().toISOString(), status: 'running',
        },
      }));
      registerMcEndpoint('PATCH', '/jobs/job-fail', () => ({ status: 200, data: {} }));

      mockContainerStop.mockRejectedValueOnce(new Error('container gone'));
      mockContainerRemove.mockRejectedValueOnce(new Error('container gone'));

      await expect(completeJob('job-fail')).rejects.toThrow();

      const failCalls = mockFetch.mock.calls.filter(
        (c) => c[0]?.toString().includes('/jobs/job-fail') && c[1]?.method === 'PATCH',
      );
      expect(failCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Error Recovery (2 tests)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Error Recovery', () => {
    it('submitJob fails gracefully when MC API is unreachable', async () => {
      const jobReq = createTestJob();
      registerMcEndpoint('GET', '/providers', () => ({ status: 503, data: { error: 'unavailable' } }));

      await expect(submitJob(jobReq)).rejects.toThrow(/MC GET/);
    });

    it('getJobStatus fails gracefully when job not found in MC', async () => {
      registerMcEndpoint('GET', '/jobs/nonexistent', () => ({ status: 404, data: { error: 'Not found' } }));

      await expect(getJobStatus('nonexistent')).rejects.toThrow();
    });
  });
});
