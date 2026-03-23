import * as vscode from 'vscode';
import { WorkspaceConfig } from './config';

export interface NodeStatus {
  status: 'online' | 'offline' | 'starting' | 'stopping' | 'error';
  uptime_seconds: number;
  total_jobs_completed: number;
  active_jobs: number;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  version: string;
}

export interface GPU {
  id: string;
  name: string;
  vram_gb: number;
  status: 'available' | 'in_use' | 'error';
  allocated_percent: number;
  temperature_c: number;
}

export interface Earnings {
  total_earned: number;
  this_month: number;
  pending: number;
  last_payment_date: string | null;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export class ProviderAPI {
  private baseUrl: string;
  private config: WorkspaceConfig;

  constructor(config: WorkspaceConfig) {
    this.config = config;
    const cfg = vscode.workspace.getConfiguration('dcp-provider');
    this.baseUrl = cfg.get<string>('nodeApiUrl', 'http://localhost:8080');
  }

  private async makeRequest<T>(path: string, method: string = 'GET', body?: any): Promise<T> {
    try {
      const url = `${this.baseUrl}/api/provider${path}`;
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      throw new Error(`API request failed: ${message}`);
    }
  }

  async getNodeStatus(): Promise<NodeStatus> {
    return this.makeRequest<NodeStatus>('/status');
  }

  async startNode(): Promise<void> {
    await this.makeRequest<{ success: boolean }>('/start', 'POST');
  }

  async stopNode(): Promise<void> {
    await this.makeRequest<{ success: boolean }>('/stop', 'POST');
  }

  async restartNode(): Promise<void> {
    await this.makeRequest<{ success: boolean }>('/restart', 'POST');
  }

  async getAvailableGPUs(): Promise<GPU[]> {
    const result = await this.makeRequest<{ gpus: GPU[] }>('/gpus');
    return result.gpus || [];
  }

  async allocateGPU(gpuId: string, percentage: number): Promise<void> {
    await this.makeRequest<{ success: boolean }>('/gpus/allocate', 'POST', {
      gpu_id: gpuId,
      allocation_percent: percentage,
    });
  }

  async getEarnings(): Promise<Earnings> {
    return this.makeRequest<Earnings>('/earnings');
  }

  async getNodeLogs(limit: number = 50): Promise<LogEntry[]> {
    const result = await this.makeRequest<{ logs: LogEntry[] }>(`/logs?limit=${limit}`);
    return result.logs || [];
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.getNodeStatus();
      return true;
    } catch {
      return false;
    }
  }
}
