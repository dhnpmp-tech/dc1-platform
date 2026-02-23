import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockDockerCreateContainer,
  mockDockerGetContainer,
  mockContainer,
  mockContainerStop,
  mockContainerKill,
  mockContainerLogs,
  mockContainerInspect,
  mockContainerRemove,
  mockExecSync,
  mockAuditLog,
} from './setup';

import {
  launchJobContainer,
  monitorContainer,
  stopContainer,
  wipeGPUMemory,
} from '../services/docker-manager';

describe('Docker Manager Service', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // launchJobContainer
  // ═══════════════════════════════════════════════════════════════════════════
  describe('launchJobContainer', () => {
    it('should enforce NetworkMode: none for security isolation', async () => {
      mockDockerCreateContainer.mockResolvedValueOnce({
        ...mockContainer,
        start: vi.fn().mockResolvedValue(undefined),
      });

      await launchJobContainer({
        jobId: 'job-001',
        dockerImage: 'pytorch/pytorch:latest',
        gpuId: 'gpu-001',
        userId: 'user-001',
      });

      const createCall = mockDockerCreateContainer.mock.calls[0][0];
      expect(createCall.HostConfig.NetworkMode).toBe('none');
    });

    it('should pass GPU device to container via DeviceRequests', async () => {
      mockDockerCreateContainer.mockResolvedValueOnce({
        ...mockContainer,
        start: vi.fn().mockResolvedValue(undefined),
      });

      await launchJobContainer({
        jobId: 'job-001',
        dockerImage: 'pytorch/pytorch:latest',
        gpuId: 'gpu-001',
        userId: 'user-001',
      });

      const createCall = mockDockerCreateContainer.mock.calls[0][0];
      const deviceRequests = createCall.HostConfig.DeviceRequests;
      expect(deviceRequests).toBeDefined();
      expect(deviceRequests.length).toBeGreaterThan(0);
      expect(deviceRequests[0].Driver).toBe('nvidia');
    });

    it('should log container launch to audit trail', async () => {
      mockDockerCreateContainer.mockResolvedValueOnce({
        ...mockContainer,
        start: vi.fn().mockResolvedValue(undefined),
      });

      await launchJobContainer({
        jobId: 'job-001',
        dockerImage: 'pytorch/pytorch:latest',
        gpuId: 'gpu-001',
        userId: 'user-001',
      });

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.stringMatching(/container.*launch|launch.*container/i),
          jobId: 'job-001',
        })
      );
    });

    it('should return container ID on successful launch', async () => {
      mockDockerCreateContainer.mockResolvedValueOnce({
        ...mockContainer,
        id: 'new-container-id',
        start: vi.fn().mockResolvedValue(undefined),
      });

      const result = await launchJobContainer({
        jobId: 'job-001',
        dockerImage: 'pytorch/pytorch:latest',
        gpuId: 'gpu-001',
        userId: 'user-001',
      });

      expect(result.containerId).toBeDefined();
    });

    it('should throw on Docker socket error', async () => {
      mockDockerCreateContainer.mockRejectedValueOnce(
        new Error('Cannot connect to Docker daemon')
      );

      await expect(
        launchJobContainer({
          jobId: 'job-001',
          dockerImage: 'pytorch/pytorch:latest',
          gpuId: 'gpu-001',
          userId: 'user-001',
        })
      ).rejects.toThrow(/docker/i);
    });

    it('should set container name with job ID for traceability', async () => {
      mockDockerCreateContainer.mockResolvedValueOnce({
        ...mockContainer,
        start: vi.fn().mockResolvedValue(undefined),
      });

      await launchJobContainer({
        jobId: 'job-001',
        dockerImage: 'pytorch/pytorch:latest',
        gpuId: 'gpu-001',
        userId: 'user-001',
      });

      const createCall = mockDockerCreateContainer.mock.calls[0][0];
      expect(createCall.name).toContain('job-001');
    });

    it('should NOT allow network access (no bridge, host, or custom networks)', async () => {
      mockDockerCreateContainer.mockResolvedValueOnce({
        ...mockContainer,
        start: vi.fn().mockResolvedValue(undefined),
      });

      await launchJobContainer({
        jobId: 'job-001',
        dockerImage: 'pytorch/pytorch:latest',
        gpuId: 'gpu-001',
        userId: 'user-001',
      });

      const createCall = mockDockerCreateContainer.mock.calls[0][0];
      expect(createCall.HostConfig.NetworkMode).toBe('none');
      expect(createCall.NetworkingConfig).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // wipeGPUMemory
  // ═══════════════════════════════════════════════════════════════════════════
  describe('wipeGPUMemory', () => {
    it('should use nvidia-smi --clocks-reset (NOT --gpu-reset)', async () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''));

      await wipeGPUMemory('gpu-001');

      const command = mockExecSync.mock.calls[0][0];
      expect(command).toContain('--clocks-reset');
      expect(command).not.toContain('--gpu-reset');
    });

    it('should target the specific GPU by ID', async () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''));

      await wipeGPUMemory('gpu-001');

      const command = mockExecSync.mock.calls[0][0];
      expect(command).toContain('gpu-001');
    });

    it('should throw if nvidia-smi command fails', async () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('nvidia-smi: command not found');
      });

      await expect(wipeGPUMemory('gpu-001')).rejects.toThrow();
    });

    it('should log GPU wipe to audit trail', async () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''));

      await wipeGPUMemory('gpu-001');

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.stringMatching(/gpu.*wipe|wipe.*gpu|memory.*wipe/i),
        })
      );
    });

    it('should NEVER use --gpu-reset flag (safety critical)', async () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''));

      await wipeGPUMemory('gpu-001');

      // Verify across ALL execSync calls that --gpu-reset is never used
      for (const call of mockExecSync.mock.calls) {
        expect(call[0]).not.toContain('--gpu-reset');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // stopContainer
  // ═══════════════════════════════════════════════════════════════════════════
  describe('stopContainer', () => {
    it('should send SIGTERM first with 30s timeout', async () => {
      mockContainerStop.mockResolvedValueOnce(undefined);

      await stopContainer('container-001');

      expect(mockContainerStop).toHaveBeenCalledWith(
        expect.objectContaining({ t: 30 })
      );
    });

    it('should send SIGKILL if SIGTERM times out', async () => {
      mockContainerStop.mockRejectedValueOnce(new Error('container stop timeout'));
      mockContainerKill.mockResolvedValueOnce(undefined);

      await stopContainer('container-001');

      expect(mockContainerStop).toHaveBeenCalled();
      expect(mockContainerKill).toHaveBeenCalled();
    });

    it('should capture container logs before stopping', async () => {
      mockContainerLogs.mockResolvedValueOnce('job output logs...');
      mockContainerStop.mockResolvedValueOnce(undefined);

      await stopContainer('container-001');

      expect(mockContainerLogs).toHaveBeenCalled();
    });

    it('should handle already-stopped container gracefully', async () => {
      mockContainerStop.mockRejectedValueOnce(
        Object.assign(new Error('container already stopped'), { statusCode: 304 })
      );

      // Should not throw
      await expect(stopContainer('container-001')).resolves.not.toThrow();
    });

    it('should handle non-existent container gracefully', async () => {
      mockDockerGetContainer.mockReturnValueOnce({
        stop: vi.fn().mockRejectedValue(
          Object.assign(new Error('no such container'), { statusCode: 404 })
        ),
        kill: vi.fn(),
        logs: vi.fn().mockResolvedValue(''),
        inspect: vi.fn(),
      });

      await expect(stopContainer('nonexistent')).resolves.not.toThrow();
    });

    it('should log stop action to audit', async () => {
      mockContainerStop.mockResolvedValueOnce(undefined);

      await stopContainer('container-001');

      expect(mockAuditLog).toHaveBeenCalled();
    });

    it('should follow SIGTERM → 30s → SIGKILL sequence specifically', async () => {
      const callOrder: string[] = [];
      mockContainerStop.mockImplementationOnce(async () => {
        callOrder.push('SIGTERM');
        throw new Error('timeout');
      });
      mockContainerKill.mockImplementationOnce(async () => {
        callOrder.push('SIGKILL');
      });

      await stopContainer('container-001');

      expect(callOrder).toEqual(['SIGTERM', 'SIGKILL']);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // monitorContainer
  // ═══════════════════════════════════════════════════════════════════════════
  describe('monitorContainer', () => {
    it('should return running status for active container', async () => {
      mockContainerInspect.mockResolvedValueOnce({
        State: { Status: 'running', Running: true, ExitCode: 0 },
      });

      const result = await monitorContainer('container-001');

      expect(result.status).toBe('running');
    });

    it('should return exited status with exit code', async () => {
      mockContainerInspect.mockResolvedValueOnce({
        State: { Status: 'exited', Running: false, ExitCode: 0 },
      });

      const result = await monitorContainer('container-001');

      expect(result.status).toBe('exited');
      expect(result.exitCode).toBe(0);
    });

    it('should detect container crash (non-zero exit code)', async () => {
      mockContainerInspect.mockResolvedValueOnce({
        State: { Status: 'exited', Running: false, ExitCode: 137 },
      });

      const result = await monitorContainer('container-001');

      expect(result.exitCode).toBe(137); // SIGKILL
      expect(result.status).toBe('exited');
    });

    it('should handle OOM killed container', async () => {
      mockContainerInspect.mockResolvedValueOnce({
        State: { Status: 'exited', Running: false, ExitCode: 137, OOMKilled: true },
      });

      const result = await monitorContainer('container-001');

      expect(result.oomKilled).toBe(true);
    });
  });
});
