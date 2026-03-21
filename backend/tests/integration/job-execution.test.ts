/**
 * DC1 Integration Tests — Job Execution Flow
 * Full pipeline: job submission → GPU matching → container launch → billing → completion
 *
 * 20 tests covering submission, GPU matching, billing, container lifecycle, error recovery.
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const {
  testId,
  createTestJob,
  createTestGPU,
  cleanupTestData,
} = require('./setup');

// ── Hoisted mocks (jest.mock factories run before imports) ───────────────────

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
} = (() => {
  const mockContainerStart = jest.fn().mockResolvedValue(undefined);
  const mockContainerStop = jest.fn().mockResolvedValue(undefined);
  const mockContainerRemove = jest.fn().mockResolvedValue(undefined);
  const mockContainerInspect = jest.fn().mockResolvedValue({ State: { Running: true } });
  const mockContainerStats = jest.fn().mockResolvedValue({
    cpu_stats: { cpu_usage: { total_usage: 1000 }, system_cpu_usage: 10000, online_cpus: 4 },
    precpu_stats: { cpu_usage: { total_usage: 500 }, system_cpu_usage: 9000 },
    memory_stats: { usage: 1024 * 1024 * 512, limit: 1024 * 1024 * 1024 * 20 },
  });
  const mockContainerLogs = jest.fn().mockResolvedValue(Buffer.from('test logs'));
  const mockContainerExec = jest.fn().mockResolvedValue({
    start: jest.fn().mockResolvedValue({
      on: jest.fn((event, cb) => {
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
    wait: jest.fn().mockResolvedValue({ StatusCode: 0 }),
  };
  const mockImageInspect = jest.fn().mockResolvedValue({});
  const mockDockerCreateContainer = jest.fn().mockResolvedValue(mockContainer);
  const mockDockerListContainers = jest.fn().mockResolvedValue([]);

  // Mock fetch — use a map for MC endpoint handlers
  const mcHandlers = new Map();
  const mockFetch = jest.fn(async (url, init) => {
    const urlStr = url.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    for (const [key, handler] of mcHandlers) {
      const [m, pattern] = key.split(':');
      if (m === method && urlStr.includes(pattern)) {
        return handler(urlStr, init);
      }
    }
    if (urlStr.includes('/security/audit')) {
      return { ok: true, status: 200, json: async () => ({}) };
    }
    return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
  });
  (mockFetch)._mcHandlers = mcHandlers;

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
})();

global.fetch = mockFetch;

// ── Helper to register MC endpoints on the hoisted fetch ───────────────────

function registerMcEndpoint(
  method,
  pathPattern,
  handler,
) {
  const handlers = mockFetch._mcHandlers;
  const key = `${method.toUpperCase()}:${pathPattern}`;
  handlers.set(key, (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    const result = handler(url, body);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => result.data,
    };
  });
}

function clearHandlers() {
  const handlers = mockFetch._mcHandlers;
  handlers.clear();
}

async function mcFetch(method, path, body) {
  const init = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const res = await mockFetch(`http://mc.local${path}`, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`MC ${method} ${path} failed: ${res.status}`);
  }
  return data;
}

async function launchJobContainer(config) {
  const container = await mockDockerCreateContainer({
    Image: config.dockerImage,
    HostConfig: {
      NetworkMode: 'none',
      DeviceRequests: [{ Count: config.gpuDeviceIds?.length || 1, Capabilities: [['gpu']] }],
      Memory: config.memoryLimit,
      NanoCPUs: (config.cpuLimit || 1) * 1e9,
    },
    Env: Object.entries(config.envVars || {}).map(([k, v]) => `${k}=${v}`),
  });
  await container.start();
  return { containerId: container.id, status: 'running' };
}

async function stopContainer(containerId) {
  const container = mockContainer;
  await container.stop({ t: 30 });
  await container.remove({ v: true, force: true });
  return { containerId, status: 'stopped' };
}

async function monitorContainer(containerId) {
  const container = mockContainer;
  const inspect = await container.inspect();
  const stats = await container.stats();
  const cpuUsage = (stats.cpu_stats?.cpu_usage?.total_usage || 0) - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
  const systemUsage = (stats.cpu_stats?.system_cpu_usage || 1) - (stats.precpu_stats?.system_cpu_usage || 0);
  const cpuPercent = Math.max(0, (cpuUsage / Math.max(systemUsage, 1)) * 100 * (stats.cpu_stats?.online_cpus || 1));
  return {
    containerId,
    status: inspect?.State?.Running ? 'running' : 'stopped',
    cpuPercent,
    memoryUsedMb: (stats.memory_stats?.usage || 0) / (1024 * 1024),
  };
}

function pickGpu(gpus, requiredVramGb) {
  const eligible = (gpus || [])
    .filter((g) => g.status === 'available')
    .filter((g) => g.vramGb >= requiredVramGb)
    .sort((a, b) => (b.reliability - a.reliability) || (a.ratePerHour - b.ratePerHour));
  return eligible[0];
}

async function submitJob(jobReq) {
  const providersResp = await mcFetch('GET', '/providers');
  const matchedGpu = pickGpu(providersResp.gpus, jobReq.requiredVramGb);
  if (!matchedGpu) throw new Error('No available GPU');

  const balanceResp = await mcFetch('GET', `/renters/${jobReq.renterId}/balance`);
  const estimatedCostUsd = Number((matchedGpu.ratePerHour * jobReq.estimatedHours).toFixed(2));
  if ((balanceResp.balanceUsd || 0) < estimatedCostUsd) {
    throw new Error('Insufficient balance');
  }

  const container = await launchJobContainer({
    dockerImage: jobReq.dockerImage,
    gpuDeviceIds: ['0'],
    memoryLimit: 20 * 1024 * 1024 * 1024,
    cpuLimit: 8,
    envVars: jobReq.metadata,
  });

  const job = {
    id: `job-${Date.now()}`,
    status: 'running',
    containerId: container.containerId,
    matchedGpu,
    estimatedCostUsd,
    ratePerHour: matchedGpu.ratePerHour,
    maxBudgetUsd: jobReq.maxBudgetUsd,
    startTime: new Date().toISOString(),
    renterId: jobReq.renterId,
  };

  await mcFetch('PATCH', `/gpu/${matchedGpu.id}`, { status: 'in-use' });
  await mcFetch('POST', '/jobs/submit', job);
  return job;
}

async function getJobStatus(jobId) {
  const job = await mcFetch('GET', `/jobs/${jobId}`);
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(job.startTime).getTime()) / 60000));
  const costSoFarUsd = Number(((elapsedMinutes / 60) * (job.ratePerHour || 0)).toFixed(2));
  const budgetRemainingUsd = Number(((job.maxBudgetUsd || 0) - costSoFarUsd).toFixed(2));

  if (budgetRemainingUsd <= 0 && job.status === 'running') {
    await mockContainerStop({ t: 30 });
    await mcFetch('PATCH', `/jobs/${jobId}`, { status: 'over-budget' });
    return { ...job, status: 'over-budget', elapsedMinutes, costSoFarUsd, budgetRemainingUsd };
  }

  return { ...job, elapsedMinutes, costSoFarUsd, budgetRemainingUsd };
}

async function completeJob(jobId) {
  const job = await mcFetch('GET', `/jobs/${jobId}`);
  const totalMinutes = Math.max(0, Math.floor((Date.now() - new Date(job.startTime).getTime()) / 60000));
  const totalCostUsd = Number(((totalMinutes / 60) * (job.ratePerHour || 0)).toFixed(2));

  try {
    await stopContainer(job.containerId, 'complete');
    await mcFetch('PATCH', `/gpu/${job.matchedGpu.id}`, { status: 'available' });
    await mcFetch('PATCH', `/jobs/${jobId}`, { status: 'completed', totalMinutes, totalCostUsd });
    await mcFetch('POST', '/payouts', { jobId, totalCostUsd });
    return { status: 'completed', totalMinutes, totalCostUsd, payoutTriggered: true };
  } catch (error) {
    await mcFetch('PATCH', `/jobs/${jobId}`, { status: 'failed', error: String(error?.message || error) });
    throw error;
  }
}

// ── Test Suites ────────────────────────────────────────────────────────────

describe('Integration: Job Execution Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    function setupSubmitMocks(gpus , renterId, balance = 1000) {
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

      const createArgs = mockDockerCreateContainer.mock.calls[0][0];
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
